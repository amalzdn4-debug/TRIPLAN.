-- 0007: admins (the site owner) can create unlimited trips for testing. Their trips are recorded as
-- entitlement 'admin' so they never count as free, credit or subscription usage. Additive only.
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_entitlement_check;
ALTER TABLE trips ADD CONSTRAINT trips_entitlement_check CHECK (entitlement IN ('free','credit','subscription','admin'));

-- Official websites (Wikidata P856) are new: queue already-imported destinations once more so
-- their places get the link. Re-import is idempotent (no duplicate places/photos, admin text and
-- verified places untouched).
UPDATE destinations SET enrichment_status = 'pending' WHERE enrichment_status = 'done';
