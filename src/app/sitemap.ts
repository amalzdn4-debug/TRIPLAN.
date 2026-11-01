import type { MetadataRoute } from "next";
import { LOCALES } from "@/config/locales";
import { PUBLIC_PATHS, siteUrl } from "@/config/site";
import { SEED_DESTINATIONS } from "@/data/destinations";

export const revalidate = 3600;

async function destinationSlugs(): Promise<string[]> {
  try {
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    return (await db.select({ slug: schema.destinations.slug }).from(schema.destinations).where(eq(schema.destinations.published, true))).map((r) => r.slug);
  } catch {
    return SEED_DESTINATIONS.map((d) => d.slug);
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const paths = [...PUBLIC_PATHS, "/destinations", ...(await destinationSlugs()).map((s) => `/destinations/${s}`)];
  return paths.map((p) => ({
    url: `${base}/en${p}`,
    changeFrequency: p.startsWith("/legal") ? "yearly" : "weekly",
    priority: p === "" ? 1 : p.startsWith("/destinations/") ? 0.7 : 0.6,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${p}`])) },
  }));
}
