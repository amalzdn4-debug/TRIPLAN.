-- Defence in depth for hosted Postgres that also exposes an auto-generated REST API
-- (e.g. Supabase PostgREST). Triplan only accesses the database from the server using the
-- owner role, which bypasses RLS. Enabling RLS with no policies means the public "anon" and
-- "authenticated" API roles can read/write nothing, even if the API is left enabled.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
