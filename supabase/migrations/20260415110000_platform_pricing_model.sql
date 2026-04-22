-- Super-admin pricing model settings.
--
-- Single-row table that holds the platform-wide annual prepaid discount
-- percentage plus any per-tier / per-bundle / multi-location price
-- overrides the super-admin has configured. Not yet wired to the
-- dealer-facing pricing picker — this is a standalone configuration
-- surface while we finalize the model. Once the picker reads from this
-- table, the values here become authoritative and the static
-- `fallbackCatalog.ts` + `architecturePricing.ts` modules drop to pure
-- fallbacks.
--
-- Gating is enforced at the app layer (super-admin = admin role with
-- dealership_id = 'default') — matches the existing pattern on
-- platform_products and platform_bundles.

CREATE TABLE IF NOT EXISTS public.platform_pricing_model (
  id text PRIMARY KEY DEFAULT 'global',
  annual_discount_pct numeric NOT NULL DEFAULT 15
    CHECK (annual_discount_pct >= 0 AND annual_discount_pct <= 50),
  tier_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  multi_location_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT single_row CHECK (id = 'global')
);

COMMENT ON TABLE public.platform_pricing_model IS
  'Singleton row (id=global) holding super-admin-controlled pricing model — annual prepaid discount %, per-tier / per-bundle overrides, and multi-location volume overrides. App-layer gated.';
COMMENT ON COLUMN public.platform_pricing_model.annual_discount_pct IS
  'Platform-wide annual-prepaid discount percentage (0-50). Applied to a tier monthly_price to derive the annual-equivalent monthly rate shown to dealers.';
COMMENT ON COLUMN public.platform_pricing_model.tier_overrides IS
  'Per-tier price overrides keyed by tier_id. Shape: { [tier_id]: { monthly?: number, annual?: number } }. Missing entry means "use catalog price."';
COMMENT ON COLUMN public.platform_pricing_model.bundle_overrides IS
  'Per-bundle price overrides keyed by bundle_id. Same shape as tier_overrides.';
COMMENT ON COLUMN public.platform_pricing_model.multi_location_overrides IS
  'Per-tier multi-location (3+ rooftops) price overrides. Shape: { [tier_id]: { monthly?: number, annual?: number } }.';

ALTER TABLE public.platform_pricing_model ENABLE ROW LEVEL SECURITY;

-- Permissive read (the pricing picker will read this once wired). Write
-- is also permissive at the DB layer; the super-admin gate lives in the
-- React app (canManageAccess && dealership_id === 'default'), mirroring
-- the pattern used for platform_products / platform_bundles.
CREATE POLICY "Anyone can read pricing model" ON public.platform_pricing_model
  FOR SELECT USING (true);
CREATE POLICY "Anyone can update pricing model" ON public.platform_pricing_model
  FOR ALL USING (true);

-- Seed the singleton row.
INSERT INTO public.platform_pricing_model (id, annual_discount_pct)
VALUES ('global', 15)
ON CONFLICT (id) DO NOTHING;
