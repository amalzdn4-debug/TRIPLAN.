import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_HERO_SLIDES, type HeroSlideData } from "@/data/hero";
import { SEED_DESTINATIONS, COUNTRY_CONTINENT, seedImageFor } from "@/data/destinations";

export interface DestinationCardData {
  id: string;
  slug: string;
  city: string;
  countryCode: string;
  continent: string;
  summary: string;
  daysMin: number | null;
  daysMax: number | null;
  budgetLevel: string | null;
  climate: string | null;
  travelStyles: string[];
  experiences: string[];
  bestMonths: number[];
  popularity: number;
  featured: boolean;
  contentStatus: "sample" | "verified";
  image: { url: string; alt: string; creditName: string | null; creditUrl: string | null } | null;
  placeCount: number;
}

function localized<T extends { summary: string; translations?: Record<string, { summary?: string }> | null }>(row: T, locale: string) {
  return row.translations?.[locale]?.summary || row.summary;
}

async function loadCards(): Promise<(DestinationCardData & { translations: Record<string, { summary?: string; description?: string; bestTime?: string }> })[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.destinations.id,
      slug: schema.destinations.slug,
      city: schema.cities.name,
      countryCode: schema.cities.countryCode,
      continent: schema.countries.continent,
      summary: schema.destinations.summary,
      translations: schema.destinations.translations,
      daysMin: schema.destinations.suggestedDaysMin,
      daysMax: schema.destinations.suggestedDaysMax,
      budgetLevel: schema.destinations.budgetLevel,
      climate: schema.destinations.climate,
      travelStyles: schema.destinations.travelStyles,
      experiences: schema.destinations.experiences,
      bestMonths: schema.destinations.bestMonths,
      popularity: schema.destinations.popularity,
      featured: schema.destinations.featured,
      contentStatus: schema.destinations.contentStatus,
      placeCount: sql<number>`(select count(*)::int from places p where p.destination_id = ${schema.destinations.id} and p.kind in ('attraction','activity'))`,
    })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .innerJoin(schema.countries, eq(schema.countries.code, schema.cities.countryCode))
    .where(eq(schema.destinations.published, true))
    .orderBy(desc(schema.destinations.popularity));
  const ids = rows.map((r) => r.id);
  const images = ids.length
    ? await db.select().from(schema.destinationImages).where(inArray(schema.destinationImages.destinationId, ids)).orderBy(asc(schema.destinationImages.sortOrder))
    : [];
  return rows.map((r) => {
    const img = images.find((i) => i.destinationId === r.id);
    return {
      ...r,
      placeCount: Number(r.placeCount),
      image: img ? { url: img.url, alt: img.alt, creditName: img.creditName, creditUrl: img.creditUrl } : null,
    };
  });
}

/** Fallback when the database is not reachable (e.g. first deploy before migrations). */
function seedCards() {
  return SEED_DESTINATIONS.map((d) => ({
    id: d.slug,
    slug: d.slug,
    city: d.city,
    countryCode: d.country,
    continent: d.continent,
    summary: d.summary,
    translations: {},
    daysMin: d.days[0],
    daysMax: d.days[1],
    budgetLevel: d.budget,
    climate: d.climate,
    travelStyles: d.styles,
    experiences: d.experiences,
    bestMonths: d.bestMonths,
    popularity: d.popularity,
    featured: !!d.featured,
    contentStatus: "sample" as const,
    image: seedImageFor(d.slug),
    placeCount: d.places?.length ?? 0,
  }));
}

const cachedCards = unstable_cache(
  async () => {
    try {
      return await loadCards();
    } catch (err) {
      console.error("[destinations] DB unavailable, using seed data", err);
      return seedCards();
    }
  },
  ["destination-cards"],
  { revalidate: 600, tags: ["destinations"] },
);

export async function getDestinationCards(locale: string): Promise<DestinationCardData[]> {
  const cards = await cachedCards();
  return cards.map(({ translations, ...c }) => ({ ...c, summary: localized({ summary: c.summary, translations }, locale) }));
}

export const getHeroSlides = unstable_cache(
  async (): Promise<HeroSlideData[]> => {
    try {
      const db = await getDb();
      const rows = await db.select().from(schema.heroSlides).where(eq(schema.heroSlides.enabled, true)).orderBy(asc(schema.heroSlides.sortOrder));
      if (!rows.length) return DEFAULT_HERO_SLIDES;
      return rows.map((r) => ({ id: r.id, imageUrl: r.imageUrl, alt: r.alt, city: r.city, countryCode: r.countryCode, destinationSlug: r.destinationSlug, creditName: r.creditName, creditUrl: r.creditUrl }));
    } catch {
      return DEFAULT_HERO_SLIDES;
    }
  },
  ["hero-slides"],
  { revalidate: 300, tags: ["hero"] },
);

type DestinationRow = typeof schema.destinations.$inferSelect;
type CityRow = typeof schema.cities.$inferSelect;
type ImageRow = typeof schema.destinationImages.$inferSelect;
type PlaceRow = typeof schema.places.$inferSelect;
type TransportRow = typeof schema.transportOptions.$inferSelect;

/** Seed-data version of a destination page, used only when the database is unreachable. */
function seedDetail(slug: string, locale: string) {
  const d = SEED_DESTINATIONS.find((x) => x.slug === slug);
  if (!d) return null;
  const epoch = new Date(0);
  const info = COUNTRY_CONTINENT[d.country];
  const img = seedImageFor(d.slug);
  const dest: DestinationRow = {
    id: d.slug, slug: d.slug, cityId: d.slug, summary: d.summary, description: "", bestTime: d.bestTime,
    suggestedDaysMin: d.days[0], suggestedDaysMax: d.days[1], budgetLevel: d.budget, climate: d.climate,
    travelStyles: d.styles, experiences: d.experiences, bestMonths: d.bestMonths,
    neighborhoods: (d.neighborhoods ?? []).map((name) => ({ name })), popularity: d.popularity, featured: !!d.featured,
    published: true, contentStatus: "sample", translations: {}, createdAt: epoch, updatedAt: epoch,
  } as DestinationRow;
  const city = { id: d.slug, countryCode: d.country, name: d.city, lat: d.lat, lng: d.lng, timezone: d.tz } as CityRow;
  const images = img ? [{ id: `${d.slug}-img`, destinationId: d.slug, url: img.url, alt: img.alt, creditName: img.creditName, creditUrl: img.creditUrl, license: "Unsplash License", sortOrder: 0 } as ImageRow] : [];
  const places = (d.places ?? []).map((p, i) => ({
    id: `${d.slug}-${i}`, destinationId: d.slug, kind: p.kind, name: p.name, lat: p.lat, lng: p.lng, address: null, neighborhood: p.neighborhood ?? null,
    description: null, tags: p.tags, durationMin: p.durationMin, priceLevel: null, cuisine: null, dietaryTags: [], openingHours: null,
    websiteUrl: null, bookingUrl: null, verification: "sample", source: "seed", details: {}, createdAt: epoch, updatedAt: epoch,
  }) as unknown as PlaceRow);
  return {
    ...dest,
    translatedContent: locale === "en",
    city,
    continent: info?.continent ?? d.continent,
    localCurrency: info?.currency ?? null,
    images,
    places,
    transport: [] as TransportRow[],
  };
}

export async function getDestinationDetail(slug: string, locale: string) {
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
    await db.select({ id: schema.destinations.id }).from(schema.destinations).limit(1);
  } catch (err) {
    console.error("[destinations] DB unavailable, using seed data", err);
    return seedDetail(slug, locale);
  }
  const rows = await db
    .select({
      d: schema.destinations,
      city: schema.cities,
      continent: schema.countries.continent,
      currency: schema.countries.currency,
    })
    .from(schema.destinations)
    .innerJoin(schema.cities, eq(schema.cities.id, schema.destinations.cityId))
    .innerJoin(schema.countries, eq(schema.countries.code, schema.cities.countryCode))
    .where(and(eq(schema.destinations.slug, slug), eq(schema.destinations.published, true)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [images, places, transport] = await Promise.all([
    db.select().from(schema.destinationImages).where(eq(schema.destinationImages.destinationId, row.d.id)).orderBy(asc(schema.destinationImages.sortOrder)),
    db.select().from(schema.places).where(eq(schema.places.destinationId, row.d.id)).orderBy(asc(schema.places.createdAt)),
    db.select().from(schema.transportOptions).where(eq(schema.transportOptions.destinationId, row.d.id)),
  ]);
  const tr = row.d.translations?.[locale] ?? {};
  return {
    ...row.d,
    summary: tr.summary || row.d.summary,
    description: tr.description || row.d.description,
    bestTime: tr.bestTime || row.d.bestTime,
    translatedContent: Boolean(tr.summary) || locale === "en",
    city: row.city,
    continent: row.continent,
    localCurrency: row.currency,
    images,
    places,
    transport,
  };
}

export type DestinationDetail = NonNullable<Awaited<ReturnType<typeof getDestinationDetail>>>;

/** Destinations available in the planner, with whether curated stops exist. */
export async function getPlannerDestinations(locale: string) {
  const cards = await getDestinationCards(locale);
  return cards.map((c) => ({ slug: c.slug, city: c.city, countryCode: c.countryCode, placeCount: c.placeCount }));
}
