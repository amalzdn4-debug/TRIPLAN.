"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { commentSchema, flattenErrors, formToObject, postSchema, reviewSchema, type ActionState } from "@/lib/validation";
import { deleteStored } from "@/lib/storage";

const AUTO_HIDE_REPORTS = 3;

/** Very small spam heuristic: many links or repeated characters send a post to the moderation queue. */
function looksSpammy(text: string) {
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  return links > 2 || /(.)\1{9,}/.test(text);
}

type PhotoRef = { id: string; alt: string };

/**
 * Attaches the member's own uploaded photos to a post in the given order. Uploads that belong to
 * someone else, or to another post, are ignored. Photos removed while editing are deleted.
 */
async function syncPhotos(tx: Tx, userId: string, postId: string, photos: PhotoRef[]): Promise<string[]> {
  const ids = photos.map((p) => p.id);
  const current = await tx.select({ id: schema.mediaUploads.id, url: schema.mediaUploads.url }).from(schema.mediaUploads).where(eq(schema.mediaUploads.postId, postId));
  const dropped = current.filter((c) => !ids.includes(c.id));
  if (dropped.length) await tx.delete(schema.mediaUploads).where(inArray(schema.mediaUploads.id, dropped.map((d) => d.id)));
  for (let i = 0; i < photos.length; i++) {
    await tx
      .update(schema.mediaUploads)
      .set({ postId, position: i, alt: photos[i].alt || null, status: "attached" })
      .where(
        and(
          eq(schema.mediaUploads.id, photos[i].id),
          eq(schema.mediaUploads.userId, userId),
          or(eq(schema.mediaUploads.status, "pending"), eq(schema.mediaUploads.postId, postId)),
        ),
      );
  }
  return dropped.map((d) => d.url);
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

async function postInput(fd: FormData) {
  const raw = formToObject(fd);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { error: { ok: false, errors: flattenErrors(parsed.error), values: raw } as ActionState };
  const db = await getDb();
  const [dest] = await db.select({ id: schema.destinations.id }).from(schema.destinations).where(eq(schema.destinations.slug, parsed.data.destinationSlug));
  if (!dest) return { error: { ok: false, errors: { destinationSlug: "invalid" }, values: raw } as ActionState };
  const d = parsed.data;
  // A pin needs both coordinates.
  const pin = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : { lat: null, lng: null };
  return { raw, data: d, destinationId: dest.id, pin };
}

export async function createPostAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (!user.emailVerified) return { ok: false, message: "verifyEmailFirst" };
  const input = await postInput(fd);
  if ("error" in input) return input.error!;
  if (!(await rateLimit("post", 5, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited", values: input.raw };
  const { type, title, body, rating, placeName, photos } = input.data;
  const status = looksSpammy(`${title} ${body} ${placeName}`) ? "pending" : "published";
  const db = await getDb();
  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(schema.communityPosts)
      .values({ userId: user.id, destinationId: input.destinationId, type, title, body, rating: type === "review" ? rating : null, locale: await getLocale(), status, placeName: placeName || null, ...input.pin })
      .returning({ id: schema.communityPosts.id });
    await syncPhotos(tx, user.id, post.id, photos);
    return post.id;
  });
  revalidatePath("/[locale]/community", "page");
  return { ok: true, message: status === "pending" ? "postPending" : "postPublished", values: { postId } };
}

/** Edits your own post. Moderated (hidden/removed) posts can't be edited back into view. */
export async function updatePostAction(postId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const db = await getDb();
  const [existing] = await db.select({ status: schema.communityPosts.status }).from(schema.communityPosts).where(and(eq(schema.communityPosts.id, postId), eq(schema.communityPosts.userId, user.id)));
  if (!existing || existing.status === "removed" || existing.status === "hidden") return { ok: false, message: "notAllowed" };
  const input = await postInput(fd);
  if ("error" in input) return input.error!;
  if (!(await rateLimit("post-edit", 30, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited", values: input.raw };
  const { type, title, body, rating, placeName, photos } = input.data;
  const status = existing.status === "pending" || looksSpammy(`${title} ${body} ${placeName}`) ? "pending" : "published";
  const removedUrls = await db.transaction(async (tx) => {
    await tx
      .update(schema.communityPosts)
      .set({ destinationId: input.destinationId, type, title, body, rating: type === "review" ? rating : null, status, placeName: placeName || null, ...input.pin, editedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.communityPosts.id, postId), eq(schema.communityPosts.userId, user.id)));
    return syncPhotos(tx, user.id, postId, photos);
  });
  await deleteStored(removedUrls);
  revalidatePath("/[locale]/community", "page");
  revalidatePath(`/[locale]/community/posts/${postId}`, "page");
  return { ok: true, message: status === "pending" ? "postPending" : "postUpdated", values: { postId } };
}

/** Deletes your own post, its comments, likes and photos (including the stored files). */
export async function deletePostAction(postId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const db = await getDb();
  const urls = (await db.select({ url: schema.mediaUploads.url }).from(schema.mediaUploads).where(and(eq(schema.mediaUploads.postId, postId), eq(schema.mediaUploads.userId, user.id)))).map((r) => r.url);
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx.delete(schema.communityPosts).where(and(eq(schema.communityPosts.id, postId), eq(schema.communityPosts.userId, user.id))).returning({ id: schema.communityPosts.id });
    if (rows.length && urls.length) await tx.delete(schema.mediaUploads).where(inArray(schema.mediaUploads.url, urls));
    return rows.length > 0;
  });
  if (!deleted) return { ok: false };
  await deleteStored(urls);
  revalidatePath("/[locale]/community", "page");
  return { ok: true };
}

const refreshCommentCount = (postId: string) =>
  getDb().then((db) =>
    db
      .update(schema.communityPosts)
      .set({ commentCount: sql`(select count(*)::int from post_comments c where c.post_id = ${postId} and c.status = 'published')` })
      .where(eq(schema.communityPosts.id, postId)),
  );

export async function addCommentAction(postId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (!user.emailVerified) return { ok: false, message: "verifyEmailFirst" };
  const raw = formToObject(fd);
  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  if (!(await rateLimit("comment", 30, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited", values: raw };
  const db = await getDb();
  const [post] = await db.select({ status: schema.communityPosts.status }).from(schema.communityPosts).where(eq(schema.communityPosts.id, postId));
  if (!post || post.status !== "published") return { ok: false, message: "notAllowed" };
  const status = looksSpammy(parsed.data.body) ? "hidden" : "published";
  await db.insert(schema.postComments).values({ postId, userId: user.id, body: parsed.data.body, status });
  await refreshCommentCount(postId);
  revalidatePath(`/[locale]/community/posts/${postId}`, "page");
  return { ok: true, message: status === "hidden" ? "commentPending" : "commentAdded" };
}

export async function deleteCommentAction(commentId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const db = await getDb();
  const [row] = await db.delete(schema.postComments).where(and(eq(schema.postComments.id, commentId), eq(schema.postComments.userId, user.id))).returning({ postId: schema.postComments.postId });
  if (!row) return { ok: false };
  await refreshCommentCount(row.postId);
  revalidatePath(`/[locale]/community/posts/${row.postId}`, "page");
  return { ok: true };
}

export async function reportCommentAction(commentId: string, reason: string, details: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const r = ["spam", "offensive", "misleading", "unsafe", "other"].includes(reason) ? (reason as "spam") : "other";
  if (!(await rateLimit("report", 20, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited" };
  const db = await getDb();
  const inserted = await db
    .insert(schema.reports)
    .values({ reporterId: user.id, commentId, reason: r, details: String(details ?? "").slice(0, 500) || null })
    .onConflictDoNothing()
    .returning({ id: schema.reports.id });
  if (inserted.length) {
    const [c] = await db
      .update(schema.postComments)
      .set({ reportCount: sql`${schema.postComments.reportCount} + 1` })
      .where(eq(schema.postComments.id, commentId))
      .returning({ reportCount: schema.postComments.reportCount, status: schema.postComments.status, postId: schema.postComments.postId });
    if (c && c.reportCount >= AUTO_HIDE_REPORTS && c.status === "published") {
      await db.update(schema.postComments).set({ status: "hidden" }).where(eq(schema.postComments.id, commentId));
      await refreshCommentCount(c.postId);
    }
  }
  return { ok: true, message: "reportReceived" };
}

export async function toggleLikeAction(postId: string): Promise<{ liked: boolean; count: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const removed = await db.delete(schema.postLikes).where(and(eq(schema.postLikes.userId, user.id), eq(schema.postLikes.postId, postId))).returning();
  let liked = false;
  if (!removed.length) {
    await db.insert(schema.postLikes).values({ userId: user.id, postId }).onConflictDoNothing();
    liked = true;
  }
  const [row] = await db
    .update(schema.communityPosts)
    .set({ likeCount: sql`(select count(*)::int from post_likes where post_id = ${postId})` })
    .where(eq(schema.communityPosts.id, postId))
    .returning({ count: schema.communityPosts.likeCount });
  return { liked, count: row?.count ?? 0 };
}

export async function toggleSavePostAction(postId: string): Promise<{ saved: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const removed = await db.delete(schema.postSaves).where(and(eq(schema.postSaves.userId, user.id), eq(schema.postSaves.postId, postId))).returning();
  if (removed.length) return { saved: false };
  await db.insert(schema.postSaves).values({ userId: user.id, postId }).onConflictDoNothing();
  return { saved: true };
}

export async function reportPostAction(postId: string, reason: string, details: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  const r = ["spam", "offensive", "misleading", "unsafe", "other"].includes(reason) ? (reason as "spam") : "other";
  if (!(await rateLimit("report", 20, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited" };
  const db = await getDb();
  const inserted = await db
    .insert(schema.reports)
    .values({ reporterId: user.id, postId, reason: r, details: String(details ?? "").slice(0, 500) || null })
    .onConflictDoNothing()
    .returning({ id: schema.reports.id });
  if (inserted.length) {
    const [p] = await db
      .update(schema.communityPosts)
      .set({ reportCount: sql`${schema.communityPosts.reportCount} + 1` })
      .where(eq(schema.communityPosts.id, postId))
      .returning({ reportCount: schema.communityPosts.reportCount, status: schema.communityPosts.status });
    if (p && p.reportCount >= AUTO_HIDE_REPORTS && p.status === "published") {
      await db.update(schema.communityPosts).set({ status: "hidden" }).where(eq(schema.communityPosts.id, postId));
    }
  }
  return { ok: true, message: "reportReceived" };
}

export async function createReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (!user.emailVerified) return { ok: false, message: "verifyEmailFirst" };
  const raw = formToObject(fd);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  if (!(await rateLimit("review", 2, 24 * 60 * 60_000, user.id))) return { ok: false, message: "rateLimited" };
  const db = await getDb();
  // Platform reviews are moderated before publication.
  await db.insert(schema.platformReviews).values({ userId: user.id, rating: parsed.data.rating, body: parsed.data.body, locale: await getLocale(), status: "pending" });
  return { ok: true, message: "reviewPending" };
}

export async function toggleSaveDestinationAction(destinationId: string): Promise<{ saved: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const removed = await db.delete(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.destinationId, destinationId))).returning();
  if (removed.length) return { saved: false };
  await db.insert(schema.savedItems).values({ userId: user.id, destinationId }).onConflictDoNothing();
  return { saved: true };
}

export async function toggleSavePlaceAction(placeId: string): Promise<{ saved: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const removed = await db.delete(schema.savedItems).where(and(eq(schema.savedItems.userId, user.id), eq(schema.savedItems.placeId, placeId))).returning();
  if (removed.length) return { saved: false };
  await db.insert(schema.savedItems).values({ userId: user.id, placeId }).onConflictDoNothing();
  return { saved: true };
}
