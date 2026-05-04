-- Force PostgREST to drop its in-memory schema cache so subsequent
-- API requests re-read every column on site_config (and every other
-- public schema table). Customer-flagged: hero edits in admin
-- couldn't save because PostgREST kept rejecting the UPDATE with
-- "Could not find the 'auto_route_appraiser_queue' column of
-- 'site_config' in the schema cache" — the column existed in the
-- DB but PostgREST hadn't refreshed its cache after the prior
-- migrations.
--
-- This file does nothing structural. Apply it any time PostgREST
-- gets stuck holding a stale schema view.

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
