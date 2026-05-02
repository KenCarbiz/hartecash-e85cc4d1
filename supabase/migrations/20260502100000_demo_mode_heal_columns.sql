-- Heal migration: ensure demo_mode + demo_offer_amount columns exist on
-- site_config and force PostgREST to drop its schema cache so the admin
-- "Demo mode" save actually lands.
--
-- The original add (20260502090000_demo_mode_blackbook_fallback.sql) is
-- idempotent, but on environments where PostgREST cached the schema
-- before the columns landed, every save from ChannelsSettings →
-- saveDemoMode fails with:
--
--   Could not find the 'demo_mode' column of 'site_config' in the
--   schema cache
--
-- Re-applying with IF NOT EXISTS is a no-op on healthy DBs; on broken
-- ones it heals. The NOTIFY at the end forces PostgREST to drop its
-- cache so the next REST call sees the columns immediately. Same
-- pattern as 20260429150000_site_config_heal_columns.sql.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_offer_amount integer NOT NULL DEFAULT 23599;

-- Belt-and-suspenders: re-stamp the column comments so any
-- connection-level metadata cache is also invalidated.
COMMENT ON COLUMN public.site_config.demo_mode IS
  'When true, the public sell-flow bypasses Black Book and serves a synthetic vehicle + the demo_offer_amount as the customer-facing offer. Used while BB credentials are renegotiated. Cadence engine still fires normally so end-to-end demos exercise the full pipeline.';

COMMENT ON COLUMN public.site_config.demo_offer_amount IS
  'Flat customer-facing offer amount served when demo_mode = true. Default 23599. Set to whatever value the demo audience expects to see.';

NOTIFY pgrst, 'reload schema';
