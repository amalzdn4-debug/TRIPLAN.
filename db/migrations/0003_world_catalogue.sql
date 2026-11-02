-- 0003 — World catalogue: 300+ destinations, Wikipedia/Wikimedia enrichment, intercity connections.
-- Additive and safe to apply on a live database: no rows are deleted or rewritten.

-- Allow the two new climate types.
ALTER TABLE destinations DROP CONSTRAINT IF EXISTS destinations_climate_check;
ALTER TABLE destinations ADD CONSTRAINT destinations_climate_check
  CHECK (climate IN ('temperate','mediterranean','tropical','desert','continental','subtropical','oceanic','alpine','subarctic'));

-- What sort of place it is (used for stay planning and slideshow variety) and enrichment bookkeeping.
ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'city' CHECK (kind IN ('city','coastal','island','nature')),
  ADD COLUMN IF NOT EXISTS wiki_title text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS wiki_extract text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending','done','partial','failed','skipped')),
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;
CREATE INDEX IF NOT EXISTS destinations_enrichment_idx ON destinations (enrichment_status, enriched_at);

-- Image provenance: where it came from, its licence and size, so credits are always shown correctly.
ALTER TABLE destination_images
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unsplash' CHECK (source IN ('unsplash','wikimedia','upload')),
  ADD COLUMN IF NOT EXISTS license_url text,
  ADD COLUMN IF NOT EXISTS file_page_url text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS hero_eligible boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS destination_images_dest_url_uq ON destination_images (destination_id, url);

-- Attractions imported from Wikidata keep their identifier so re-imports update instead of duplicating.
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS wikidata_id text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_credit text,
  ADD COLUMN IF NOT EXISTS image_license text,
  ADD COLUMN IF NOT EXISTS popularity integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS places_dest_wikidata_uq ON places (destination_id, wikidata_id) WHERE wikidata_id IS NOT NULL;

-- Intercity connections (curated typical journey times; never live timetables).
CREATE TABLE IF NOT EXISTS destination_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  to_destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('train','bus','ferry','flight','car')),
  typical_minutes integer NOT NULL CHECK (typical_minutes > 0 AND typical_minutes < 2880),
  direct boolean NOT NULL DEFAULT true,
  note text,
  source text NOT NULL DEFAULT 'curated' CHECK (source IN ('curated','admin')),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_destination_id <> to_destination_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS destination_connections_pair_uq ON destination_connections (from_destination_id, to_destination_id, mode);
CREATE INDEX IF NOT EXISTS destination_connections_to_idx ON destination_connections (to_destination_id);

-- Keep the RLS lockdown from 0002 in force for every table, including the new one.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
