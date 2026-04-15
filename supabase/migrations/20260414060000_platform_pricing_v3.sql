-- Platform pricing v3 — final pricing per user direction (2026-04-14).
--
-- Supersedes pricing v2 seed values with the authoritative price list:
--
--   AutoCurb                    $1,995/mo  or $1,495/mo prepaid 12 mo
--   AutoLabels Basic            $299/mo    (FREE w/ AutoCurb OR w/ Premium)
--   AutoLabels Premium          $899/mo
--   AutoFrame (up to 75)        $399/mo
--   AutoFrame (up to 125)       $599/mo
--   AutoFrame (unlimited)       $799/mo
--   AutoFilm (Sales+Service)    $999/mo
--   All-Apps Unlimited bundle   $3,999/mo  or $3,899/mo prepaid 12 mo
--
-- Key changes from v2:
--  • AutoCurb collapses to ONE tier. The old "starter introductory" is
--    retired — the discount now lives in annual_price (prepaid 12-mo).
--  • AutoLabels Basic is FREE with AutoCurb *and* with AutoLabels Premium.
--    Previously it was only free w/ AutoCurb.
--  • AutoLabels "Pro" → "Premium" and the description now matches the
--    FTC-CARS-rule language the user dictated (compliance trail retained
--    after all signoffs).
--  • AutoFrame caps: 70→75, 120→125.
--  • AutoFilm $899 → $999.
--  • Bundle annual_price changed to reflect the $3,899/mo prepaid math.
--
-- Seeds are UPSERTs so this is safe to re-apply.

-- ── 1. Retire old AutoCurb starter tier ────────────────────────────────
-- Kept for historical FK safety, hidden from the catalog.
UPDATE public.platform_product_tiers
   SET is_active = false,
       is_introductory = false,
       updated_at = now()
 WHERE id = 'autocurb_starter';

-- ── 2. Upsert the authoritative tier list ──────────────────────────────
INSERT INTO public.platform_product_tiers
  (id, product_id, name, description, monthly_price, annual_price,
   features, inventory_limit, included_with_product_ids, is_introductory,
   allow_overage, overage_price_per_unit, sort_order, is_active)
VALUES
  -- ─ AutoCurb: single tier, monthly OR annual prepaid ─
  --   $1,495/mo × 12 = $17,940 prepaid (the annual_price column stores
  --   the full-year upfront amount, not a per-month equivalent). The UI
  --   divides by 12 when showing the per-month-equivalent label.
  ('autocurb_standard', 'autocurb',
   'AutoCurb',
   'Off-street vehicle acquisition — instant offers, inspections, appraisals, dealer dashboard.',
   1995.00, 17940.00,
   '["Unlimited customer submissions","Instant cash offers","VIN & plate decoding","Inspection workflow","Mobile appraisal","Dealer dashboard","Advanced reporting","API access","Multi-user roles","Priority support"]'::jsonb,
   NULL, ARRAY[]::text[], false,
   false, NULL, 0, true),

  -- ─ AutoLabels Basic — FREE with AutoCurb OR with Premium ─
  ('autolabels_base', 'autolabels',
   'Basic',
   'Window-sticker + addendum platform. Unlimited vehicles. Included free with any AutoCurb or AutoLabels Premium subscription.',
   299.00, 2990.00,
   '["New-car addendums","Used-car addendums","FTC Used Car Buyers Guide","Unlimited vehicles","Standard templates","Print + digital formats"]'::jsonb,
   NULL, ARRAY['autocurb', 'autolabels']::text[], false,
   false, NULL, 0, true),

  -- ─ AutoLabels Premium ─
  ('autolabels_pro', 'autolabels',
   'Premium',
   'FTC-compliant addendum and window-sticker platform. Tracks every vehicle and its installed accessories with full customer disclosure and signoff. Complete compliance trail is retained after dealer and customer signoffs — dealer-safe audit evidence if you are ever questioned.',
   899.00, 8990.00,
   '["Everything in Basic","FTC CARS Rule compliance","Per-vehicle accessory tracking","Customer disclosure + electronic signoff","Dealer signoff","Retained compliance trail (post-signoff)","State-specific compliance rules","Deal-jacket export","Priority support"]'::jsonb,
   NULL, ARRAY[]::text[], false,
   false, NULL, 1, true),

  -- ─ AutoFrame — inventory-tiered ─
  ('autoframe_70', 'autoframe',
   'Up to 75 Units',
   'AI photo booth for smaller lots — up to 75 active inventory units.',
   399.00, 3990.00,
   '["AI background removal","Consistent studio lighting","Up to 75 active units","Standard turnaround","Email support"]'::jsonb,
   75, ARRAY[]::text[], false,
   true, 10.00, 0, true),

  ('autoframe_120', 'autoframe',
   'Up to 125 Units',
   'AI photo booth for growing lots — up to 125 active inventory units.',
   599.00, 5990.00,
   '["Everything in 75-unit","Up to 125 active units","Priority turnaround","Chat + email support"]'::jsonb,
   125, ARRAY[]::text[], false,
   true, 10.00, 1, true),

  ('autoframe_unlimited', 'autoframe',
   'Unlimited',
   'Unlimited inventory for high-volume stores and groups.',
   799.00, 7990.00,
   '["Everything in 125-unit","Unlimited active units","Rush turnaround SLA","Dedicated account manager"]'::jsonb,
   NULL, ARRAY[]::text[], false,
   false, NULL, 2, true),

  -- ─ AutoFilm — one combined tier ─
  ('autofilm_full', 'autofilm',
   'Sales + Service MPI',
   'Full video MPI covering both sales and service departments — one subscription, both teams.',
   999.00, 9990.00,
   '["Sales walkaround videos","Service MPI videos","Customer-facing video delivery","SMS + email distribution","AI transcription","Performance analytics","Priority support"]'::jsonb,
   NULL, ARRAY[]::text[], false,
   false, NULL, 0, true)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  features = EXCLUDED.features,
  inventory_limit = EXCLUDED.inventory_limit,
  included_with_product_ids = EXCLUDED.included_with_product_ids,
  is_introductory = EXCLUDED.is_introductory,
  allow_overage = EXCLUDED.allow_overage,
  overage_price_per_unit = EXCLUDED.overage_price_per_unit,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ── 3. All-Apps Unlimited bundle: monthly + annual-prepaid math ────────
-- $3,899/mo × 12 = $46,788 annual prepaid.
UPDATE public.platform_bundles
   SET monthly_price = 3999.00,
       annual_price  = 46788.00,
       description   = 'Every app at its top tier, unlimited usage, with white-glove onboarding, a dedicated Customer Success Manager, priority 24/7 support, and quarterly business reviews. $3,999/mo or $3,899/mo prepaid 12 months. Per rooftop.',
       is_featured   = true,
       sort_order    = 0
 WHERE id = 'all_apps_unlimited';

COMMENT ON COLUMN public.platform_product_tiers.annual_price IS
  'Full 12-month prepaid price. UI shows per-month-equivalent by dividing by 12. E.g. AutoCurb annual_price=17940 renders as "$1,495/mo prepaid 12 mo".';
