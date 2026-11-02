import "server-only";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

export const POST_TYPES = ["recommendation", "hidden_gem", "review", "restaurant", "tip"] as const;
export type PostType = (typeof POST_TYPES)[number];

export interface PostPhoto {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface PostView {
  id: string;
  type: PostType;
  title: string;
  body: string;
  rating: number | null;
  locale: string;
  status: "published" | "pending" | "hidden" | "removed";
  likeCount: number;
  commentCount: number;
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  author: string;
  authorAvatar: string | null;
  destinationSlug: string;
  destinationCity: string;
  placeName: string | null;
  lat: number | null;
  lng: number | null;
  photos: PostPhoto[];
  likedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
}

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  author: string;
  authorAvatar: string | null;
  mine: boolean;
}

/** Shown when a member hasn't set a display name. Never an invented person. */
const ANON = "";

async function loadPosts(where: SQL[], limit: number): Promise<PostView[]> {
  const db = await getDb();
  const me = await getCurrentUser();
  const rows = await db
    .select({
      p: schema.communityPosts,
      author: schema.profiles.displayName,
      avatar: schema.profiles.avatarUrl,
      slug: schema.destinations.slug,
      city: schema.cities.name,
    })
    .from(schema.communityPosts)
    .innerJoin(schema.destinations, eq(schema.destinations.id, schema.communityPosts.destinationId))
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.communityPosts.userId))
    .where(and(...where))
    .orderBy(desc(schema.communityPosts.createdAt))
    .limit(Math.min(limit, 100));
  const ids = rows.map((r) => r.p.id);
  let liked = new Set<string>();
  let saved = new Set<string>();
  const photos = new Map<string, PostPhoto[]>();
  if (ids.length) {
    const media = await db
      .select()
      .from(schema.mediaUploads)
      .where(and(inArray(schema.mediaUploads.postId, ids), eq(schema.mediaUploads.status, "attached")))
      .orderBy(asc(schema.mediaUploads.position));
    for (const m of media) photos.set(m.postId!, [...(photos.get(m.postId!) ?? []), { id: m.id, url: m.url, alt: m.alt, width: m.width, height: m.height }]);
    if (me) {
      liked = new Set((await db.select({ id: schema.postLikes.postId }).from(schema.postLikes).where(and(eq(schema.postLikes.userId, me.id), inArray(schema.postLikes.postId, ids)))).map((r) => r.id));
      saved = new Set((await db.select({ id: schema.postSaves.postId }).from(schema.postSaves).where(and(eq(schema.postSaves.userId, me.id), inArray(schema.postSaves.postId, ids)))).map((r) => r.id));
    }
  }
  return rows.map((r) => ({
    id: r.p.id,
    type: r.p.type,
    title: r.p.title,
    body: r.p.body,
    rating: r.p.rating,
    locale: r.p.locale,
    status: r.p.status,
    likeCount: r.p.likeCount,
    commentCount: r.p.commentCount,
    createdAt: r.p.createdAt.toISOString(),
    editedAt: r.p.editedAt ? r.p.editedAt.toISOString() : null,
    authorId: r.p.userId,
    author: r.author || ANON,
    authorAvatar: r.avatar ?? null,
    destinationSlug: r.slug,
    destinationCity: r.city,
    placeName: r.p.placeName,
    lat: r.p.lat,
    lng: r.p.lng,
    photos: photos.get(r.p.id) ?? [],
    likedByMe: liked.has(r.p.id),
    savedByMe: saved.has(r.p.id),
    mine: me?.id === r.p.userId,
  }));
}

export async function getPosts(opts: { destinationSlug?: string | null; type?: string | null; limit?: number; savedOnly?: boolean; authorId?: string } = {}): Promise<PostView[]> {
  try {
    const me = await getCurrentUser();
    const where: SQL[] = [eq(schema.communityPosts.status, "published")];
    if (opts.destinationSlug) where.push(eq(schema.destinations.slug, opts.destinationSlug));
    if (opts.type && (POST_TYPES as readonly string[]).includes(opts.type)) where.push(eq(schema.communityPosts.type, opts.type as PostType));
    if (opts.authorId) where.push(eq(schema.communityPosts.userId, opts.authorId));
    if (opts.savedOnly) {
      if (!me) return [];
      where.push(sql`exists (select 1 from post_saves s where s.post_id = ${schema.communityPosts.id} and s.user_id = ${me.id})`);
    }
    return await loadPosts(where, opts.limit ?? 30);
  } catch (err) {
    console.error("[community] failed to load posts", err);
    return [];
  }
}

export function getLatestPosts(_locale: string, limit = 3) {
  return getPosts({ limit });
}

/**
 * One post with its comments. Published posts are public; the author (and admins) can also see
 * their own post while it's waiting for moderation or hidden. Removed posts are not shown.
 */
export async function getPost(id: string): Promise<{ post: PostView; comments: CommentView[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const me = await getCurrentUser();
  const visible: SQL = me
    ? me.role === "admin"
      ? sql`true`
      : sql`(${schema.communityPosts.status} = 'published' or (${schema.communityPosts.userId} = ${me.id} and ${schema.communityPosts.status} <> 'removed'))`
    : eq(schema.communityPosts.status, "published");
  const [post] = await loadPosts([eq(schema.communityPosts.id, id), visible], 1);
  if (!post) return null;
  const db = await getDb();
  const rows = await db
    .select({ c: schema.postComments, author: schema.profiles.displayName, avatar: schema.profiles.avatarUrl })
    .from(schema.postComments)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.postComments.userId))
    .where(and(eq(schema.postComments.postId, id), eq(schema.postComments.status, "published")))
    .orderBy(asc(schema.postComments.createdAt))
    .limit(200);
  return {
    post,
    comments: rows.map((r) => ({
      id: r.c.id,
      body: r.c.body,
      createdAt: r.c.createdAt.toISOString(),
      editedAt: r.c.editedAt ? r.c.editedAt.toISOString() : null,
      authorId: r.c.userId,
      author: r.author || ANON,
      authorAvatar: r.avatar ?? null,
      mine: me?.id === r.c.userId,
    })),
  };
}

/** A member's public profile: display name, home city, bio and published posts. Never the email. */
export async function getMemberProfile(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const db = await getDb();
  const [u] = await db
    .select({ id: schema.users.id, status: schema.users.status, createdAt: schema.users.createdAt, name: schema.profiles.displayName, homeCity: schema.profiles.homeCity, bio: schema.profiles.bio, avatar: schema.profiles.avatarUrl })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId));
  if (!u || u.status !== "active") return null;
  const posts = await getPosts({ authorId: userId, limit: 50 });
  const [{ n: comments }] = await db.select({ n: count() }).from(schema.postComments).where(and(eq(schema.postComments.userId, userId), eq(schema.postComments.status, "published")));
  return { id: u.id, name: u.name || ANON, homeCity: u.homeCity, bio: u.bio, avatar: u.avatar, memberSince: u.createdAt.toISOString(), posts, commentCount: comments };
}
