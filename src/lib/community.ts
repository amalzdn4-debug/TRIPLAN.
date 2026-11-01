import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

export interface PostView {
  id: string;
  type: "recommendation" | "hidden_gem" | "review" | "restaurant" | "tip";
  title: string;
  body: string;
  rating: number | null;
  locale: string;
  likeCount: number;
  createdAt: string;
  author: string;
  destinationSlug: string;
  destinationCity: string;
  likedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
}

export async function getPosts(opts: { destinationSlug?: string | null; type?: string | null; limit?: number; savedOnly?: boolean } = {}): Promise<PostView[]> {
  try {
    const db = await getDb();
    const me = await getCurrentUser();
    const where: SQL[] = [eq(schema.communityPosts.status, "published")];
    if (opts.destinationSlug) where.push(eq(schema.destinations.slug, opts.destinationSlug));
    if (opts.type && ["recommendation", "hidden_gem", "review", "restaurant", "tip"].includes(opts.type)) where.push(eq(schema.communityPosts.type, opts.type as "tip"));
    if (opts.savedOnly) {
      if (!me) return [];
      where.push(sql`exists (select 1 from post_saves s where s.post_id = ${schema.communityPosts.id} and s.user_id = ${me.id})`);
    }
    const rows = await db
      .select({
        p: schema.communityPosts,
        author: schema.profiles.displayName,
        slug: schema.destinations.slug,
        city: schema.cities.name,
      })
      .from(schema.communityPosts)
      .innerJoin(schema.destinations, eq(schema.destinations.id, schema.communityPosts.destinationId))
      .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.communityPosts.userId))
      .where(and(...where))
      .orderBy(desc(schema.communityPosts.createdAt))
      .limit(Math.min(opts.limit ?? 30, 100));
    const ids = rows.map((r) => r.p.id);
    let liked = new Set<string>();
    let saved = new Set<string>();
    if (me && ids.length) {
      liked = new Set((await db.select({ id: schema.postLikes.postId }).from(schema.postLikes).where(and(eq(schema.postLikes.userId, me.id), inArray(schema.postLikes.postId, ids)))).map((r) => r.id));
      saved = new Set((await db.select({ id: schema.postSaves.postId }).from(schema.postSaves).where(and(eq(schema.postSaves.userId, me.id), inArray(schema.postSaves.postId, ids)))).map((r) => r.id));
    }
    return rows.map((r) => ({
      id: r.p.id,
      type: r.p.type,
      title: r.p.title,
      body: r.p.body,
      rating: r.p.rating,
      locale: r.p.locale,
      likeCount: r.p.likeCount,
      createdAt: r.p.createdAt.toISOString(),
      author: r.author || "Traveller",
      destinationSlug: r.slug,
      destinationCity: r.city,
      likedByMe: liked.has(r.p.id),
      savedByMe: saved.has(r.p.id),
      mine: me?.id === r.p.userId,
    }));
  } catch (err) {
    console.error("[community] failed to load posts", err);
    return [];
  }
}

export function getLatestPosts(_locale: string, limit = 3) {
  return getPosts({ limit });
}
