/**
 * Content import: Wikipedia introductions (8 languages), licensed Wikimedia photos and Wikidata
 * attractions & transport hubs for each destination. Resumable and idempotent — it is run in small
 * time-boxed batches by the deploy build, a daily cron job and an admin button.
 *
 * Never overwrites editorial work: admin-written descriptions/translations, verified places and
 * existing images are left untouched.
 */
import type { SqlClient } from "@/db/raw";
import { fetchArticle, SITE_LANGS, cityNameFromTitle } from "./wikipedia";
import { fetchLicensedImages, type LicensedImage } from "./commons";
import { ATTRACTION_TYPES, fetchAttractions, fetchHubs, type WikidataPlace, TICKETED_TYPES } from "./wikidata";
import { haversineMeters } from "@/lib/geo";

export interface EnrichOptions {
  /** Stop starting new destinations after this many milliseconds. */
  budgetMs: number;
  limit?: number;
  slugs?: string[];
  log?: (msg: string) => void;
}

export interface EnrichSummary {
  processed: number;
  done: number;
  partial: number;
  failed: number;
  remaining: number;
  errors: { slug: string; error: string }[];
}

interface DestRow {
  id: string;
  slug: string;
  kind: string;
  wiki_title: string | null;
  description: string;
  translations: Record<string, { summary?: string; description?: string; bestTime?: string; name?: string }> | string | null;
  city: string;
  lat: number;
  lng: number;
}

const MAX_IMAGES = 6;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function similarName(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

export async function enrichDestination(db: SqlClient, d: DestRow, log: (m: string) => void): Promise<{ status: "done" | "partial" | "failed"; errors: string[] }> {
  const errors: string[] = [];
  const title = d.wiki_title || d.city;

  // 1. Wikipedia introduction (English + other languages where available).
  const article = await fetchArticle(title);
  if (!article) return { status: "failed", errors: [`No English Wikipedia article titled "${title}"`] };
  const translations = typeof d.translations === "string" ? JSON.parse(d.translations) : (d.translations ?? {});
  for (const lang of SITE_LANGS) {
    if (lang === "en") continue;
    const ex = article.extracts[lang];
    if (ex && !translations[lang]?.description) translations[lang] = { ...(translations[lang] ?? {}), description: ex.extract };
    // The city's name in this language (from the article title), unless an editor already set one.
    const name = ex ? cityNameFromTitle(ex.title, d.city) : null;
    if (name && !translations[lang]?.name) translations[lang] = { ...(translations[lang] ?? {}), name };
  }
  const wikiLinks = Object.fromEntries(Object.entries(article.extracts).map(([l, v]) => [l, v!.url]));
  await db.query(
    `UPDATE destinations SET wiki_title = $2, wikipedia_url = $3, wiki_extract = $4,
       description = CASE WHEN description = '' THEN $4 ELSE description END,
       translations = $5::jsonb
     WHERE id = $1`,
    [d.id, article.title, article.url, article.extract, JSON.stringify({ ...translations, _wikiLinks: wikiLinks })],
  );

  // 2. Attractions and transport hubs from Wikidata.
  let attractions: WikidataPlace[] = [];
  try {
    attractions = await fetchAttractions(d.lat, d.lng, d.kind);
  } catch (e) {
    errors.push(`attractions: ${(e as Error).message}`);
  }
  let hubs: Awaited<ReturnType<typeof fetchHubs>> = [];
  try {
    hubs = await fetchHubs(d.lat, d.lng);
  } catch (e) {
    errors.push(`transport hubs: ${(e as Error).message}`);
  }

  // 3. Licences for the lead image and attraction photos (one batched request).
  let licensed = new Map<string, LicensedImage>();
  try {
    licensed = await fetchLicensedImages([article.imageFile ?? "", ...attractions.map((a) => a.imageFile ?? "")]);
  } catch (e) {
    errors.push(`images: ${(e as Error).message}`);
  }

  // 4. Images: lead photo first, then attraction photos, up to MAX_IMAGES in total.
  const existing = await db.query<{ url: string; sort_order: number }>(`SELECT url, sort_order FROM destination_images WHERE destination_id = $1`, [d.id]);
  let sort = existing.reduce((m, r) => Math.max(m, Number(r.sort_order) + 1), 0);
  const candidates: { img: LicensedImage; alt: string }[] = [];
  const lead = article.imageFile ? licensed.get(article.imageFile) : undefined;
  if (lead) candidates.push({ img: lead, alt: d.city });
  for (const a of attractions) {
    const img = a.imageFile ? licensed.get(a.imageFile) : undefined;
    if (img && !candidates.some((c) => c.img.url === img.url)) candidates.push({ img, alt: `${a.name}, ${d.city}` });
  }
  for (const { img, alt } of candidates) {
    if (existing.length + 0 >= MAX_IMAGES) break;
    if (existing.some((r) => r.url === img.url)) continue;
    const rows = await db.query(
      `INSERT INTO destination_images (destination_id, url, alt, credit_name, credit_url, license, license_url, file_page_url, width, height, sort_order, source, hero_eligible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'wikimedia',$12) ON CONFLICT (destination_id, url) DO NOTHING RETURNING url`,
      [d.id, img.url, alt, img.author, img.filePageUrl, img.license, img.licenseUrl, img.filePageUrl, img.width, img.height, sort++, img.heroEligible],
    );
    if (rows.length) existing.push({ url: img.url, sort_order: sort - 1 });
  }

  // 5. Places: update the same Wikidata item, merge with a nearby seeded place of the same name, or insert.
  const places = await db.query<{ id: string; name: string; lat: number; lng: number; wikidata_id: string | null; verification: string; kind: string }>(
    `SELECT id, name, lat, lng, wikidata_id, verification, kind FROM places WHERE destination_id = $1`,
    [d.id],
  );
  const upsert = async (p: WikidataPlace, kind: "attraction" | "transport_hub", extra: Record<string, unknown>, minutes: number | null, tags: string[]) => {
    const img = p.imageFile ? licensed.get(p.imageFile) : undefined;
    const details = JSON.stringify({ names: p.names, wikidataType: p.typeQid, ...(TICKETED_TYPES.has(p.typeQid) ? { ticketed: true } : {}), ...extra });
    // Same place = same Wikidata item, a similar name within 400 m, or anything of the same kind within 150 m
    // (catches places an editor has renamed).
    const same =
      places.find((x) => x.wikidata_id === p.qid) ??
      places.find((x) => !x.wikidata_id && x.kind === kind && similarName(x.name, p.name) && haversineMeters(x, p) < 400) ??
      places.find((x) => !x.wikidata_id && x.kind === kind && haversineMeters(x, p) < 150);
    if (same) {
      if (same.verification === "verified") return; // editor-checked places are never changed automatically
      await db.query(
        `UPDATE places SET wikidata_id = $2, popularity = $3, image_url = COALESCE(image_url, $4), image_credit = COALESCE(image_credit, $5), image_license = COALESCE(image_license, $6),
           details = details || $7::jsonb, website_url = COALESCE(website_url, $8), updated_at = now() WHERE id = $1`,
        [same.id, p.qid, p.sitelinks, img?.url ?? null, img?.author ?? null, img?.license ?? null, details, p.website],
      );
      same.wikidata_id = p.qid;
      return;
    }
    await db.query(
      `INSERT INTO places (destination_id, kind, name, lat, lng, tags, duration_min, verification, source, wikidata_id, image_url, image_credit, image_license, popularity, details, website_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'sample','wikidata',$8,$9,$10,$11,$12,$13::jsonb,$14)
       ON CONFLICT (destination_id, wikidata_id) WHERE wikidata_id IS NOT NULL DO NOTHING`,
      [d.id, kind, p.name, p.lat, p.lng, tags, minutes, p.qid, img?.url ?? null, img?.author ?? null, img?.license ?? null, p.sitelinks, details, p.website],
    );
    places.push({ id: "", name: p.name, lat: p.lat, lng: p.lng, wikidata_id: p.qid, verification: "sample", kind });
  };
  for (const a of attractions) {
    const profile = ATTRACTION_TYPES[a.typeQid] ?? { minutes: 60, tags: ["culture"], label: "attraction" };
    await upsert(a, "attraction", { category: profile.label }, profile.minutes, profile.tags);
  }
  for (const h of hubs) await upsert(h, "transport_hub", { hub: h.hub }, null, [h.hub]);

  log(`  ${d.slug}: ${article.title} · ${Object.keys(article.extracts).length} languages · ${candidates.length} photos · ${attractions.length} attractions · ${hubs.length} hubs${errors.length ? ` · ${errors.length} issue(s)` : ""}`);
  return { status: errors.length ? "partial" : "done", errors };
}

export async function enrichBatch(db: SqlClient, opts: EnrichOptions): Promise<EnrichSummary> {
  const log = opts.log ?? (() => undefined);
  const started = Date.now();
  const params: unknown[] = [];
  let where = `d.published AND (d.enrichment_status = 'pending' OR (d.enrichment_status IN ('failed','partial') AND (d.enriched_at IS NULL OR d.enriched_at < now() - interval '3 days')))`;
  if (opts.slugs?.length) {
    params.push(opts.slugs);
    where = `d.slug = ANY($1)`;
  }
  const rows = await db.query<DestRow>(
    `SELECT d.id, d.slug, d.kind, d.wiki_title, d.description, d.translations, c.name AS city, c.lat, c.lng
     FROM destinations d JOIN cities c ON c.id = d.city_id
     WHERE ${where}
     ORDER BY (d.enrichment_status = 'pending') DESC, d.popularity DESC
     LIMIT ${Math.max(1, Math.min(opts.limit ?? 500, 500))}`,
    params,
  );
  const summary: EnrichSummary = { processed: 0, done: 0, partial: 0, failed: 0, remaining: 0, errors: [] };
  for (const d of rows) {
    if (Date.now() - started > opts.budgetMs) break;
    summary.processed++;
    let status: "done" | "partial" | "failed" = "failed";
    let errors: string[] = [];
    try {
      ({ status, errors } = await enrichDestination(db, { ...d, lat: Number(d.lat), lng: Number(d.lng) }, log));
    } catch (e) {
      errors = [(e as Error).message];
    }
    summary[status]++;
    if (errors.length) summary.errors.push({ slug: d.slug, error: errors.join("; ") });
    if (status === "failed") log(`  ${d.slug}: FAILED — ${errors.join("; ")}`);
    await db.query(`UPDATE destinations SET enrichment_status = $2, enrichment_error = $3, enriched_at = now() WHERE id = $1`, [d.id, status, errors.join("; ").slice(0, 1000) || null]);
  }
  const left = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM destinations WHERE published AND enrichment_status = 'pending'`);
  summary.remaining = Number(left[0]?.n ?? 0);
  return summary;
}
