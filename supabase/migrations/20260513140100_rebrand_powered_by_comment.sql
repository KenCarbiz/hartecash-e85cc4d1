-- Brand rename: Autocurb.ai → AutoCurb.io.
--
-- The original 20260412002000_powered_by_mode.sql migration set a
-- COMMENT ON COLUMN that referenced "Autocurb.ai". User-visible UI
-- strings have already been updated in the React codebase; this
-- migration brings the DB metadata in line so introspection tools
-- and Supabase Studio show the correct brand.
--
-- Idempotent — COMMENT ON COLUMN is naturally a write-once-per-run
-- operation and re-running is safe.

COMMENT ON COLUMN site_config.force_autocurb_attribution IS
  'Super-admin controlled. When true, the "Powered by AutoCurb.io" credit is always rendered on the customer-facing site footer regardless of the dealer''s white_label_settings.powered_by_mode. Used to enforce attribution for dealers on tiers that do not include white-label rights. Dealers cannot edit this field themselves; only platform admins can toggle it via Tenants management.';

NOTIFY pgrst, 'reload schema';
