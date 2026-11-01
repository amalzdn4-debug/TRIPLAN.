-- TRIPLAN initial schema. PostgreSQL 14+ (works on Supabase, Neon, RDS and PGlite).
-- Mirrors src/db/schema.ts. Apply with `npm run db:migrate`.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  email_verified_at timestamptz,
  google_sub text,
  stripe_customer_id text,
  trips_created_total integer NOT NULL DEFAULT 0 CHECK (trips_created_total >= 0),
  trip_credits integer NOT NULL DEFAULT 0 CHECK (trip_credits >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));
CREATE UNIQUE INDEX users_google_sub_idx ON users (google_sub);
CREATE UNIQUE INDEX users_stripe_customer_idx ON users (stripe_customer_id);

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  home_city text,
  bio text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en',
  currency char(3) NOT NULL DEFAULT 'EUR',
  units text NOT NULL DEFAULT 'metric' CHECK (units IN ('metric','imperial')),
  time_format text NOT NULL DEFAULT 'auto' CHECK (time_format IN ('auto','12h','24h')),
  marketing_emails boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('verify_email','reset_password')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX auth_tokens_hash_idx ON auth_tokens (token_hash);

CREATE TABLE languages (
  code text PRIMARY KEY,
  native_name text NOT NULL,
  dir text NOT NULL DEFAULT 'ltr' CHECK (dir IN ('ltr','rtl')),
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE translation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale text NOT NULL REFERENCES languages(code),
  key text NOT NULL,
  value text NOT NULL,
  reviewed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX translation_records_locale_key_idx ON translation_records (locale, key);

CREATE TABLE countries (
  code char(2) PRIMARY KEY,
  continent text NOT NULL CHECK (continent IN ('europe','mena','asia','north_america','south_america','africa','oceania')),
  currency char(3)
);

CREATE TABLE cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL REFERENCES countries(code),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  timezone text
);
CREATE INDEX cities_country_idx ON cities (country_code);

CREATE TABLE destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  summary text NOT NULL,
  description text NOT NULL DEFAULT '',
  best_time text,
  suggested_days_min integer,
  suggested_days_max integer,
  budget_level text CHECK (budget_level IN ('budget','mid','premium')),
  climate text CHECK (climate IN ('temperate','mediterranean','tropical','desert','continental','subtropical','oceanic')),
  travel_styles text[] NOT NULL DEFAULT '{}',
  experiences text[] NOT NULL DEFAULT '{}',
  best_months integer[] NOT NULL DEFAULT '{}',
  neighborhoods jsonb NOT NULL DEFAULT '[]',
  popularity integer NOT NULL DEFAULT 50,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  content_status text NOT NULL DEFAULT 'sample' CHECK (content_status IN ('sample','verified')),
  translations jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX destinations_slug_idx ON destinations (slug);
CREATE INDEX destinations_city_idx ON destinations (city_id);

CREATE TABLE destination_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL,
  credit_name text,
  credit_url text,
  license text NOT NULL DEFAULT 'Unsplash License',
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX destination_images_dest_idx ON destination_images (destination_id);

CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('attraction','restaurant','accommodation','activity','luggage_storage','transport_hub')),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  address text,
  neighborhood text,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  duration_min integer,
  price_level integer CHECK (price_level BETWEEN 1 AND 4),
  cuisine text,
  dietary_tags text[] NOT NULL DEFAULT '{}',
  opening_hours jsonb,
  website_url text,
  booking_url text,
  verification text NOT NULL DEFAULT 'sample' CHECK (verification IN ('sample','verified','community')),
  source text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_dest_kind_idx ON places (destination_id, kind);

CREATE TABLE transport_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('metro','bus','train','tram','taxi','airport_transfer','car_rental','bike','ferry','walking')),
  title text NOT NULL,
  description text,
  url text,
  verification text NOT NULL DEFAULT 'sample' CHECK (verification IN ('sample','verified'))
);

CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('fast','detailed')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','completed')),
  destination_id uuid REFERENCES destinations(id) ON DELETE SET NULL,
  destination_name text NOT NULL,
  departure_city text,
  start_date date,
  end_date date,
  adults integer NOT NULL DEFAULT 1 CHECK (adults BETWEEN 0 AND 50),
  children integer NOT NULL DEFAULT 0 CHECK (children BETWEEN 0 AND 50),
  budget_total numeric(12,2),
  currency char(3) NOT NULL DEFAULT 'EUR',
  preferences jsonb NOT NULL DEFAULT '{}',
  generation_source text CHECK (generation_source IN ('rules','ai')),
  entitlement text NOT NULL DEFAULT 'free' CHECK (entitlement IN ('free','credit','subscription')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX trips_user_idx ON trips (user_id, updated_at DESC);

CREATE TABLE trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  relation text,
  is_child boolean NOT NULL DEFAULT false
);

CREATE TABLE itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  date date,
  title text NOT NULL,
  start_time text NOT NULL DEFAULT '09:00',
  notes text
);
CREATE UNIQUE INDEX itinerary_days_trip_day_idx ON itinerary_days (trip_id, day_index);

CREATE TABLE itinerary_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id uuid NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  position integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('attraction','meal','activity','break','accommodation','transport','custom')),
  meal_type text CHECK (meal_type IN ('breakfast','lunch','snack','dinner','drinks')),
  title text NOT NULL,
  description text,
  place_id uuid REFERENCES places(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  address text,
  start_time text,
  duration_min integer NOT NULL DEFAULT 60,
  cost_min numeric(10,2),
  cost_max numeric(10,2),
  cost_currency char(3),
  cost_basis text CHECK (cost_basis IN ('per_person','total')),
  cost_status text CHECK (cost_status IN ('estimated','confirmed')),
  link_url text,
  link_label text,
  locked boolean NOT NULL DEFAULT false,
  travel_mode text CHECK (travel_mode IN ('walking','transit','driving','cycling')),
  travel_minutes integer,
  travel_meters integer,
  travel_source text CHECK (travel_source IN ('provider','estimate'))
);
CREATE INDEX itinerary_stops_day_pos_idx ON itinerary_stops (day_id, position);
CREATE INDEX itinerary_stops_trip_idx ON itinerary_stops (trip_id);

CREATE TABLE saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES destinations(id) ON DELETE CASCADE,
  place_id uuid REFERENCES places(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((destination_id IS NULL) <> (place_id IS NULL))
);
CREATE UNIQUE INDEX saved_items_user_dest_idx ON saved_items (user_id, destination_id);
CREATE UNIQUE INDEX saved_items_user_place_idx ON saved_items (user_id, place_id);

CREATE TABLE community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recommendation','hidden_gem','review','restaurant','tip')),
  title text NOT NULL,
  body text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden','removed')),
  like_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_dest_idx ON community_posts (destination_id, status, created_at DESC);
CREATE INDEX community_posts_status_idx ON community_posts (status);

CREATE TABLE post_likes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE post_saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('published','pending','hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','offensive','misleading','unsafe','other')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reports_reporter_post_idx ON reports (reporter_id, post_id);
CREATE INDEX reports_status_idx ON reports (status);

CREATE TABLE subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'EUR',
  billing text NOT NULL CHECK (billing IN ('free','one_time','yearly')),
  trips_included integer,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_stripe_idx ON subscriptions (stripe_subscription_id);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES subscription_plans(id),
  stripe_session_id text,
  stripe_invoice_id text,
  amount_cents integer NOT NULL,
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_session_idx ON payments (stripe_session_id);
CREATE UNIQUE INDEX payments_invoice_idx ON payments (stripe_invoice_id);
CREATE INDEX payments_user_idx ON payments (user_id);

CREATE TABLE stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  alt text NOT NULL,
  city text NOT NULL,
  country_code char(2) NOT NULL,
  destination_slug text,
  credit_name text,
  credit_url text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  topic text NOT NULL,
  message text NOT NULL,
  locale text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
