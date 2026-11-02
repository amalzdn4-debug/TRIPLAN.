-- 0006: Monthly plan (a set number of trips per billing month) and admin-managed affiliate partners.
-- Additive only: existing plans, subscriptions and payments are kept.

-- Monthly billing for plans.
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_billing_check;
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_billing_check CHECK (billing IN ('free','one_time','monthly','yearly'));

-- Billing-period tracking on subscriptions: trips used in the current period reset when Stripe
-- reports a new period (renewal). livemode tells real payments apart from Stripe test mode.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS trips_used_in_period integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT true;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;

-- Affiliate partners. Nothing is shown publicly unless an admin marks a partner "approved"
-- (i.e. the programme has actually accepted TRIPLAN). No partners are created automatically.
CREATE TABLE IF NOT EXISTS affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('accommodation','flights','activities','transport','car_rental','luggage','insurance','esim','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paused','rejected')),
  -- https URL with optional placeholders: {city} {country} {checkin} {checkout} {adults} {lat} {lng} {locale}
  link_template text NOT NULL CHECK (link_template ~ '^https://'),
  website_url text,
  approved_at timestamptz,
  -- Internal notes only (e.g. programme name, contact). Never shown to visitors.
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_partners_status_idx ON affiliate_partners (status, category, sort_order);

-- One row per outbound click through /go/<partner>. No IP address is stored; a daily-rotating
-- hash lets us count unique visitors without being able to identify them.
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  visitor_hash text,
  source text,
  destination_slug text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_clicks_partner_idx ON affiliate_clicks (partner_id, created_at);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
