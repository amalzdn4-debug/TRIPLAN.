-- 0005: community posts with photos, location, comments and comment reports.
-- Additive only: existing posts, likes, saves and reports are kept unchanged.

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS place_name text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS community_posts_user_idx ON community_posts (user_id, created_at);

-- Uploaded images (Vercel Blob). "pending" until attached to a post; unattached uploads are
-- cleaned up by the daily job. Only re-encoded JPEG/WebP files up to 4 MB are accepted.
CREATE TABLE IF NOT EXISTS media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES community_posts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'post_photo' CHECK (kind IN ('post_photo','avatar')),
  url text NOT NULL UNIQUE,
  pathname text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/webp')),
  bytes integer NOT NULL CHECK (bytes > 0 AND bytes <= 4194304),
  width integer,
  height integer,
  position integer NOT NULL DEFAULT 0,
  alt text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','attached')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_uploads_post_idx ON media_uploads (post_id, position);
CREATE INDEX IF NOT EXISTS media_uploads_user_status_idx ON media_uploads (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','removed')),
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS post_comments_status_idx ON post_comments (status);

-- Reports can now target a post or a comment (exactly one).
ALTER TABLE reports ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE;
DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_one_target_ck CHECK ((post_id IS NOT NULL) <> (comment_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS reports_reporter_comment_idx ON reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;

-- Keep the RLS lockdown in force for every table, including the new ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
