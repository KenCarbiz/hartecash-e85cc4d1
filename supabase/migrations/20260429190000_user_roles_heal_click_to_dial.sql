-- Heal migration: ensure click-to-dial availability columns exist on
-- user_roles AND force PostgREST to reload its schema cache.
--
-- The original adds (20260429140000_click_to_dial_v2.sql) are
-- idempotent (`ADD COLUMN IF NOT EXISTS`) but environments where
-- they were partially applied or where PostgREST kept a stale cache
-- still error with:
--
--   Could not find the 'click_to_dial_dnd' column of 'user_roles'
--   in the schema cache
--
-- Re-applying the column adds is a no-op on healthy DBs; on broken
-- ones it heals. The NOTIFY at the end forces PostgREST to drop its
-- cache so the next REST call sees the columns immediately.
--
-- Mirrors the site_config heal pattern from
-- 20260429150000_site_config_heal_columns.sql.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS click_to_dial_dnd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_start time,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_end time,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_tz text;

NOTIFY pgrst, 'reload schema';
