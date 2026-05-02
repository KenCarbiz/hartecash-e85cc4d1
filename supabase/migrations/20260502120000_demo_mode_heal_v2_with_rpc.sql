-- Demo mode — second-pass heal + client-side recovery RPC.
--
-- The previous heal migration (20260502100000_demo_mode_heal_columns.sql)
-- adds the columns IF NOT EXISTS and notifies PostgREST. On environments
-- where PostgREST cached the schema before the columns landed and missed
-- the reload signal, the admin "Save demo mode" button still fails with:
--
--   Could not find the 'demo_mode' column of 'site_config' in the
--   schema cache
--
-- This migration:
--   1. Re-asserts the columns (no-op on healthy DBs).
--   2. Issues NOTIFY pgrst 'reload schema' AND 'reload config' so even
--      a partially-stuck PostgREST refreshes.
--   3. Exposes public.heal_demo_mode_schema() — an RPC the admin save
--      button calls when it hits the schema-cache error. The function
--      runs the same ALTER TABLE + NOTIFY under SECURITY DEFINER so a
--      logged-in admin can self-heal without waiting for a redeploy.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_offer_amount integer NOT NULL DEFAULT 23599;

COMMENT ON COLUMN public.site_config.demo_mode IS
  'When true, the public sell-flow bypasses Black Book and serves a synthetic vehicle + the demo_offer_amount as the customer-facing offer.';

COMMENT ON COLUMN public.site_config.demo_offer_amount IS
  'Flat customer-facing offer amount served when demo_mode = true. Default 23599.';

-- Self-heal RPC. Idempotent. SECURITY DEFINER so it runs with the
-- migration owner's privileges (postgres) — the caller only needs
-- EXECUTE, granted below to authenticated users.
CREATE OR REPLACE FUNCTION public.heal_demo_mode_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_demo_mode boolean;
  has_demo_offer boolean;
BEGIN
  ALTER TABLE public.site_config
    ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS demo_offer_amount integer NOT NULL DEFAULT 23599;

  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'site_config'
        AND column_name = 'demo_mode'
    ),
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'site_config'
        AND column_name = 'demo_offer_amount'
    )
  INTO has_demo_mode, has_demo_offer;

  -- Force PostgREST to drop both schema and config caches.
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');

  RETURN jsonb_build_object(
    'demo_mode_column', has_demo_mode,
    'demo_offer_amount_column', has_demo_offer,
    'reloaded_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.heal_demo_mode_schema() FROM public;
GRANT EXECUTE ON FUNCTION public.heal_demo_mode_schema() TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
