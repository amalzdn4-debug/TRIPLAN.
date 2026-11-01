"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { flattenErrors, formToObject, postSchema, reviewSchema, type ActionState } from "@/lib/validation";

const AUTO_HIDE_REPORTS = 3;

/** Very small spam heuristic: many links or repeated characters send a post to the moderation queue. */
function looksSpammy(text: string) {
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  return links > 2 || /(.)\1{9,}/.test(text);
}

export async function createPostAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "signInRequired" };
  if (!user.emailVerified) return { ok: false, message: "verifyEmailFirst" };
  const raw = formToObject(fd);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), values: raw };
  if (!(await rateLimit("post", 5, 60 * 60_000, user.id))) return { ok: false, message: "rateLimited", values: raw };
  const db = await getDb();
  const [dest] = await db.select({ id: schema.destinations.id }).from(schema.destinations).where(eq(schema.destinations.slug, parsed.data.destinationSlug));
  if (!dest) return { ok: false, errors: { destinationSlug: "invalid" }, values: raw };
  const { type, title, body, rating } = parsed.data;
  const status = looksSpammy(`${title} ${body}`) ? "pending" : "published";
  await db.insert(schema.communityPosts).values({
    userId: user.id,
    destinationId: dest.id,
    type,
    title,
    body,
    rating: type === "review" ? rating : null,
    locale: await getLocale(),
    status,
  });
  revalidatePath("/[locale]/community", "page");
  return { ok: true, message: status === "pending" ? "postPending" : "postPublished" };
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
