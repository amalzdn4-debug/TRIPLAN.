-- 0004: multi-city trips. Additive only: existing trips, days and stops are untouched
-- (new columns are nullable or have defaults, so single-city trips keep working as before).

-- Which destination each day is spent in (null = the trip's main destination).
ALTER TABLE itinerary_days
  ADD COLUMN IF NOT EXISTS destination_id uuid REFERENCES destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'normal';
DO $$ BEGIN
  ALTER TABLE itinerary_days ADD CONSTRAINT itinerary_days_kind_ck CHECK (kind IN ('normal','travel','day_trip'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS itinerary_days_destination_idx ON itinerary_days (destination_id);

-- Structured extras for a stop, e.g. an intercity journey (mode, typical minutes, from/to).
ALTER TABLE itinerary_stops ADD COLUMN IF NOT EXISTS details jsonb;
