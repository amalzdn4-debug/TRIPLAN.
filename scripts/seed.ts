/**
 * Idempotent seed: languages, countries, cities, destinations, sample places,
 * pricing plans and the default hero rotation. Safe to run repeatedly.
 */
import { loadEnv } from "./load-env";
import { connect } from "./db-client";
import { SEED_DESTINATIONS, COUNTRY_CONTINENT, seedImageFor } from "../src/data/destinations";
import { SEED_CONNECTIONS } from "../src/data/connections";
import { DEFAULT_HERO_SLIDES } from "../src/data/hero";
import { LOCALES, LOCALE_META } from "../src/config/locales";

async function main() {
  loadEnv();
  const db = await connect();

  for (const code of LOCALES) {
    await db.query(
      `INSERT INTO languages (code, native_name, dir) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET native_name = EXCLUDED.native_name, dir = EXCLUDED.dir`,
      [code, LOCALE_META[code].nativeName, LOCALE_META[code].dir],
    );
  }

  for (const [code, info] of Object.entries(COUNTRY_CONTINENT)) {
    await db.query(
      `INSERT INTO countries (code, continent, currency) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET continent = EXCLUDED.continent, currency = EXCLUDED.currency`,
      [code, info.continent, info.currency],
    );
  }

  let placeCount = 0;
  for (const d of SEED_DESTINATIONS) {
    const existingCity = await db.query<{ id: string }>(`SELECT id FROM cities WHERE country_code = $1 AND name = $2`, [d.country, d.city]);
    let cityId = existingCity[0]?.id;
    if (!cityId) {
      const rows = await db.query<{ id: string }>(
        `INSERT INTO cities (country_code, name, lat, lng, timezone) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [d.country, d.city, d.lat, d.lng, d.tz],
      );
      cityId = rows[0].id;
    }

    const neighborhoods = JSON.stringify((d.neighborhoods ?? []).map((name) => ({ name })));
    const destRows = await db.query<{ id: string }>(
      `INSERT INTO destinations (slug, city_id, summary, best_time, suggested_days_min, suggested_days_max, budget_level, climate,
         travel_styles, experiences, best_months, neighborhoods, popularity, featured, content_status, kind, wiki_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,'sample',$15,$16)
       ON CONFLICT (slug) DO UPDATE SET
         -- Refresh seed text only while nobody has touched the destination (never edited in /admin, still "sample").
         -- updated_at is deliberately left alone, so an admin edit is never overwritten by a later deploy.
         summary = CASE WHEN destinations.content_status = 'sample' AND destinations.updated_at = destinations.created_at THEN EXCLUDED.summary ELSE destinations.summary END,
         best_time = CASE WHEN destinations.content_status = 'sample' AND destinations.updated_at = destinations.created_at THEN EXCLUDED.best_time ELSE destinations.best_time END,
         neighborhoods = CASE WHEN destinations.content_status = 'sample' AND destinations.updated_at = destinations.created_at THEN EXCLUDED.neighborhoods ELSE destinations.neighborhoods END,
         -- Technical fields added in 0003: filled in once, never overwriting an admin's choice.
         kind = CASE WHEN destinations.updated_at = destinations.created_at THEN EXCLUDED.kind ELSE destinations.kind END,
         wiki_title = COALESCE(destinations.wiki_title, EXCLUDED.wiki_title)
       RETURNING id`,
      [d.slug, cityId, d.summary, d.bestTime, d.days[0], d.days[1], d.budget, d.climate, d.styles, d.experiences, d.bestMonths, neighborhoods, d.popularity, !!d.featured, d.kind ?? "city", d.wiki ?? d.city],
    );
    const destinationId = destRows[0].id;

    const img = seedImageFor(d.slug);
    if (img) {
      const has = await db.query(`SELECT 1 FROM destination_images WHERE destination_id = $1 AND url = $2`, [destinationId, img.url]);
      if (!has.length) {
        await db.query(
          `INSERT INTO destination_images (destination_id, url, alt, credit_name, credit_url, license, sort_order) VALUES ($1,$2,$3,$4,$5,'Unsplash License',0)`,
          [destinationId, img.url, img.alt, img.creditName, img.creditUrl],
        );
      }
    }

    for (const p of d.places ?? []) {
      const exists = await db.query(`SELECT 1 FROM places WHERE destination_id = $1 AND name = $2`, [destinationId, p.name]);
      if (exists.length) continue;
      await db.query(
        `INSERT INTO places (destination_id, kind, name, lat, lng, neighborhood, tags, duration_min, verification, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sample','triplan-seed')`,
        [destinationId, p.kind, p.name, p.lat, p.lng, p.neighborhood ?? null, p.tags, p.durationMin],
      );
      placeCount++;
    }
  }

  // Intercity connections — inserted once; admin edits and verifications are never overwritten.
  const ids = new Map((await db.query<{ id: string; slug: string }>(`SELECT id, slug FROM destinations`)).map((r) => [r.slug, r.id]));
  let connCount = 0;
  for (const c of SEED_CONNECTIONS) {
    const from = ids.get(c.from);
    const to = ids.get(c.to);
    if (!from || !to) throw new Error(`Connection ${c.from} → ${c.to} references an unknown destination`);
    const rows = await db.query(
      `INSERT INTO destination_connections (from_destination_id, to_destination_id, mode, typical_minutes, direct, note, source)
       VALUES ($1,$2,$3,$4,$5,$6,'curated') ON CONFLICT (from_destination_id, to_destination_id, mode) DO NOTHING RETURNING id`,
      [from, to, c.mode, c.minutes, c.direct, c.note ?? null],
    );
    connCount += rows.length;
  }

  // Pricing — editable later in /admin/pricing. Only inserted if missing so admin changes persist.
  const plans: [string, string, number, string, number | null, number][] = [
    ["free", "Free", 0, "free", 1, 0],
    ["trip_pack", "Additional trip", 299, "one_time", 1, 1],
    ["monthly", "Monthly", 699, "monthly", 4, 2],
    ["annual", "Annual", 2999, "yearly", null, 3],
  ];
  for (const [id, name, cents, billing, trips, order] of plans) {
    const added = await db.query(
      `INSERT INTO subscription_plans (id, name, price_cents, currency, billing, trips_included, sort_order)
       VALUES ($1,$2,$3,'EUR',$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
      [id, name, cents, billing, trips, order],
    );
    // When Monthly is first added to an existing site, list it before Annual (only that once).
    if (id === "monthly" && added.length) await db.query(`UPDATE subscription_plans SET sort_order = 3 WHERE id = 'annual' AND sort_order = 2`);
  }

  const heroCount = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM hero_slides`);
  if (!heroCount[0] || Number(heroCount[0].n) === 0) {
    let i = 0;
    for (const s of DEFAULT_HERO_SLIDES) {
      await db.query(
        `INSERT INTO hero_slides (image_url, alt, city, country_code, destination_slug, credit_name, credit_url, sort_order, enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [s.imageUrl, s.alt, s.city, s.countryCode, s.destinationSlug ?? null, s.creditName ?? null, s.creditUrl ?? null, i++],
      );
    }
  }

  console.log(`Seed complete: ${SEED_DESTINATIONS.length} destinations, ${placeCount} new places, ${connCount} new connections.`);
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
