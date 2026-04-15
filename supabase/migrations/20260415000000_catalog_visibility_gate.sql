-- Platform catalog visibility gate — super-admin controlled.
--
-- Separates TWO things that `is_active` was conflating:
--   • is_active              — the row is not archived / soft-deleted.
--                              Existing subscriptions rely on this.
--   • is_available_for_new_subs — the product/bundle shows up in the
--                              onboarding + Billing & Plan pickers for
--                              new dealers. Super admins toggle this
--                              to gate apps that aren't built out yet.
--
-- Default `true` so existing rows stay visible until a super-admin
-- decides otherwise.

ALTER TABLE public.platform_products
  ADD COLUMN IF NOT EXISTS is_available_for_new_subs boolean NOT NULL DEFAULT true;

ALTER TABLE public.platform_bundles
  ADD COLUMN IF NOT EXISTS is_available_for_new_subs boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_products.is_available_for_new_subs IS
  'Super-admin gate: when false, product is hidden from new subscription flows (Billing & Plan picker, onboarding). Existing subs keep their entitlements.';
COMMENT ON COLUMN public.platform_bundles.is_available_for_new_subs IS
  'Super-admin gate: when false, bundle is hidden from new subscription flows. Existing bundle subs keep their entitlements.';

-- Index only the "hidden" rows (they are the rare case). Queries that
-- filter `is_available_for_new_subs = true` will use a plain seq scan
-- against the small catalog table, which is fine.
CREATE INDEX IF NOT EXISTS idx_platform_products_hidden
  ON public.platform_products (id) WHERE is_available_for_new_subs = false;
CREATE INDEX IF NOT EXISTS idx_platform_bundles_hidden
  ON public.platform_bundles (id) WHERE is_available_for_new_subs = false;
