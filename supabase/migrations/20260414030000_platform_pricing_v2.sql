-- Platform pricing v2 — per-product tiers, entitlements, and the All-Apps
-- Unlimited bundle.
--
-- Supersedes the original 3-bundle model (starter/growth/enterprise) with
-- a cleaner structure:
--
--   Products:
--     autocurb           (existing, kept)
--     autolabels         (new — replaces cleardeal branding)
--     autoframe          (existing, base_url updated to autoframe.io)
--     autofilm           (new — replaces video_mpi branding)
--
--   Tiers (per product):
--     autocurb_starter    $1,495/mo   introductory
--     autocurb_standard   $1,999/mo
--     autolabels_base     $299/mo     FREE with Autocurb
--     autolabels_pro      $895/mo     full FTC compliance + signoff + audit
--     autoframe_70        $399/mo     up to 70 inventory units
--     autoframe_120       $599/mo     up to 120 inventory units
--     autoframe_unlimited $799/mo     unlimited inventory
--     autofilm_full       $899/mo     sales + service MPI
--
--   Bundle:
--     all_apps_unlimited  $3,999/mo   all products at top tier, white-glove
--
-- All prices per rooftop.

-- ────────────────────────────────────────────────────────────────────────
-- 1. New products + updates to existing products
-- ────────────────────────────────────────────────────────────────────────

-- AutoLabels (new brand replacing cleardeal)
INSERT INTO public.platform_products (id, name, description, icon_name, base_url, is_active, sort_order) VALUES
  ('autolabels', 'AutoLabels',
   'Window stickers, addendums, and FTC compliance — customer signoff, audit trail, and state-specific compliance',
   'Tag', 'https://autolabels.io', true, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  base_url = EXCLUDED.base_url,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

-- AutoFilm (new brand replacing video_mpi)
INSERT INTO public.platform_products (id, name, description, icon_name, base_url, is_active, sort_order) VALUES
  ('autofilm', 'AutoFilm',
   'Video MPI for sales and service — walkarounds, customer-facing video delivery, SMS/email distribution',
   'Video', 'https://autofilm.io', true, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  base_url = EXCLUDED.base_url,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

-- Update existing products in place
UPDATE public.platform_products
   SET name = 'AutoCurb',
       description = 'Off-street vehicle acquisition — instant offers, inspections, and appraisals',
       base_url = 'https://autocurb.io',
       sort_order = 1
 WHERE id = 'autocurb';

UPDATE public.platform_products
   SET name = 'AutoFrame',
       description = 'AI-powered vehicle photography — inventory-tiered pricing for every lot size',
       base_url = 'https://autoframe.io',
       sort_order = 3
 WHERE id = 'autoframe';

-- Retire legacy products (kept for historical subscriptions but hidden from switcher)
UPDATE public.platform_products SET is_active = false WHERE id IN ('cleardeal', 'video_mpi');

-- ────────────────────────────────────────────────────────────────────────
-- 2. platform_product_tiers — per-product tier ladder
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_product_tiers (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.platform_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  monthly_price numeric(10, 2) NOT NULL,
  annual_price numeric(10, 2),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Inventory cap for inventory-gated products (AutoFrame). NULL = unlimited.
  inventory_limit integer,
  -- Complimentary entitlement: this tier is granted for free to any dealer
  -- who has an ACTIVE subscription to any of these product ids.
  -- e.g. autolabels_base.included_with_product_ids = ['autocurb']
  included_with_product_ids text[] NOT NULL DEFAULT '{}',
  -- Introductory / promotional flag (affects UI copy only)
  is_introductory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_product_tiers_product_idx
  ON public.platform_product_tiers (product_id, sort_order);

CREATE INDEX IF NOT EXISTS platform_product_tiers_included_with_gin
  ON public.platform_product_tiers USING gin (included_with_product_ids);

ALTER TABLE public.platform_product_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_product_tiers_read_all" ON public.platform_product_tiers;
CREATE POLICY "platform_product_tiers_read_all"
  ON public.platform_product_tiers FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────────────────
-- 3. Seed tiers
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO public.platform_product_tiers
  (id, product_id, name, description, monthly_price, annual_price,
   features, inventory_limit, included_with_product_ids, is_introductory, sort_order)
VALUES
  -- AutoCurb
  ('autocurb_starter', 'autocurb',
   'Starter (Introductory)',
   'Introductory pricing for new AutoCurb dealerships. Full access to the acquisition stack.',
   1495.00, 14950.00,
   '["Unlimited customer submissions","Instant cash offers","VIN / plate decoding","Inspection workflow","Mobile appraisal","Dealer dashboard","Standard support"]'::jsonb,
   NULL, ARRAY[]::text[], true, 0),

  ('autocurb_standard', 'autocurb',
   'Standard',
   'Standard AutoCurb pricing — full acquisition stack for established dealerships.',
   1999.00, 19990.00,
   '["Everything in Starter","Advanced reporting","API access","Multi-user roles","Priority email support"]'::jsonb,
   NULL, ARRAY[]::text[], false, 1),

  -- AutoLabels — Base is complimentary with AutoCurb
  ('autolabels_base', 'autolabels',
   'Base',
   'Window stickers and addendums. Included FREE with every AutoCurb subscription.',
   299.00, 2990.00,
   '["New-car addendums","Used-car addendums","FTC Used Car Buyers Guide","Standard templates","Print + digital formats"]'::jsonb,
   NULL, ARRAY['autocurb'], false, 0),

  ('autolabels_pro', 'autolabels',
   'Pro',
   'Full FTC-compliance platform with customer signoff, audit trail, and state-specific rules.',
   895.00, 8950.00,
   '["Everything in Base","FTC CARS Rule compliance","Customer electronic signoff","Full audit trail","State-specific compliance rules","Deal-jacket export","Priority support"]'::jsonb,
   NULL, ARRAY[]::text[], false, 1),

  -- AutoFrame — inventory-based ladder
  ('autoframe_70', 'autoframe',
   'Up to 70 Units',
   'AI photo booth for smaller lots — up to 70 inventory units active at once.',
   399.00, 3990.00,
   '["AI background removal","Consistent studio lighting","Up to 70 active inventory units","Standard turnaround","Email support"]'::jsonb,
   70, ARRAY[]::text[], false, 0),

  ('autoframe_120', 'autoframe',
   'Up to 120 Units',
   'AI photo booth for growing lots — up to 120 inventory units active at once.',
   599.00, 5990.00,
   '["Everything in 70-unit","Up to 120 active inventory units","Priority turnaround","Chat + email support"]'::jsonb,
   120, ARRAY[]::text[], false, 1),

  ('autoframe_unlimited', 'autoframe',
   'Unlimited',
   'Unlimited inventory for high-volume stores and groups.',
   799.00, 7990.00,
   '["Everything in 120-unit","Unlimited active inventory units","Rush turnaround SLA","Dedicated account manager"]'::jsonb,
   NULL, ARRAY[]::text[], false, 2),

  -- AutoFilm — single tier covering sales + service
  ('autofilm_full', 'autofilm',
   'Sales + Service MPI',
   'Full video MPI for both sales and service departments — one price, both departments.',
   899.00, 8990.00,
   '["Sales walkaround videos","Service MPI videos","Customer-facing delivery","SMS + email distribution","AI transcription","Performance analytics","Priority support"]'::jsonb,
   NULL, ARRAY[]::text[], false, 0)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features = EXCLUDED.features,
  inventory_limit = EXCLUDED.inventory_limit,
  included_with_product_ids = EXCLUDED.included_with_product_ids,
  is_introductory = EXCLUDED.is_introductory,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- ────────────────────────────────────────────────────────────────────────
-- 4. dealer_subscriptions: add tier_ids column + rooftop_count
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS tier_ids text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS rooftop_count integer NOT NULL DEFAULT 1;

-- ────────────────────────────────────────────────────────────────────────
-- 5. Bundles: deprecate legacy bundles, add All-Apps Unlimited + Enterprise
-- ────────────────────────────────────────────────────────────────────────

-- Enterprise bundles (for dealer groups) don't expose a public price —
-- the sales team quotes custom terms per group. `is_enterprise` tells
-- the UI to render "Contact Sales" instead of a price, and tells the
-- billing layer not to wire these through self-serve Stripe checkout.
ALTER TABLE public.platform_bundles
  ADD COLUMN IF NOT EXISTS is_enterprise boolean NOT NULL DEFAULT false;

-- Hide legacy bundles from the pricing grid (kept for historical FK safety)
UPDATE public.platform_bundles
   SET is_featured = false,
       sort_order = 99
 WHERE id IN ('starter', 'growth', 'enterprise');

INSERT INTO public.platform_bundles
  (id, name, description, monthly_price, annual_price, product_ids, is_featured, sort_order, is_enterprise)
VALUES
  ('all_apps_unlimited', 'All-Apps Unlimited',
   'Every product at its top tier, unlimited usage, with white-glove onboarding, a dedicated Customer Success Manager, priority 24/7 support, and quarterly business reviews. Per rooftop.',
   3999.00, 39990.00,
   ARRAY['autocurb', 'autolabels', 'autoframe', 'autofilm'],
   true, 0, false),

  -- Enterprise — dealer groups (multi-rooftop). Custom pricing, white-
  -- glove everything, not self-serve. `monthly_price` is nominal (stored
  -- as 0 to satisfy NOT NULL); UI reads `is_enterprise` to render
  -- "Contact Sales" in place of a dollar amount.
  ('enterprise_group', 'Enterprise (Dealer Groups)',
   'For dealer groups operating multiple rooftops. Everything in All-Apps Unlimited, plus cross-rooftop reporting, consolidated billing, group SSO, a named Enterprise CSM, dedicated onboarding team, custom integration engineering, and negotiated multi-rooftop pricing.',
   0, 0,
   ARRAY['autocurb', 'autolabels', 'autoframe', 'autofilm'],
   false, 1, true)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  product_ids = EXCLUDED.product_ids,
  is_featured = EXCLUDED.is_featured,
  sort_order = EXCLUDED.sort_order,
  is_enterprise = EXCLUDED.is_enterprise;
