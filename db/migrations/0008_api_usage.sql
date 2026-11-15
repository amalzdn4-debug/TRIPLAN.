-- 0008: monthly call counter for paid third-party APIs (Google Maps Routes), so the site can stop
-- at a limit the owner sets instead of running up a bill. Only counts are stored — never API content.
CREATE TABLE IF NOT EXISTS api_usage (
  service text NOT NULL,
  month text NOT NULL,          -- 'YYYY-MM' (UTC)
  calls integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service, month)
);
