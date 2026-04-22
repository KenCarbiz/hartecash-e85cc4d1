-- Seed the super-admin Pricing Model with the authoritative 4-architecture
-- pricing matrix (per user direction dated 2026-04-15, image set 2).
--
-- Shape change vs. the initial migration: tier_overrides and bundle_overrides
-- now hold a nested object keyed by architecture:
--
--   {
--     [tier_id]: {
--       single_store:           { monthly, annual },
--       single_store_secondary: { monthly, annual },
--       multi_location:         { monthly, annual },
--       dealer_group:           { monthly, annual }
--     },
--     …
--   }
--
-- `annual` is the per-month-equivalent rate when billed annually prepaid
-- (matches the "annual pre-paid" column in the source tables). A missing
-- `annual` key means the tier is monthly-only at that architecture.

UPDATE public.platform_pricing_model
   SET
     annual_discount_pct = 15,
     tier_overrides = '{
       "autocurb_standard": {
         "single_store":           { "monthly": 1999, "annual": 1639 },
         "single_store_secondary": { "monthly": 1999, "annual": 1639 },
         "multi_location":         { "monthly": 1799, "annual": 1475 },
         "dealer_group":           { "monthly": 1599, "annual": 1311 }
       },
       "autolabels_base": {
         "single_store":           { "monthly": 399 },
         "single_store_secondary": { "monthly": 399 },
         "multi_location":         { "monthly": 349 },
         "dealer_group":           { "monthly": 299 }
       },
       "autolabels_pro": {
         "single_store":           { "monthly": 899 },
         "single_store_secondary": { "monthly": 899 },
         "multi_location":         { "monthly": 849 },
         "dealer_group":           { "monthly": 799 }
       },
       "autoframe_70": {
         "single_store":           { "monthly": 399 },
         "single_store_secondary": { "monthly": 399 },
         "multi_location":         { "monthly": 349 },
         "dealer_group":           { "monthly": 329 }
       },
       "autoframe_120": {
         "single_store":           { "monthly": 599 },
         "single_store_secondary": { "monthly": 599 },
         "multi_location":         { "monthly": 549 },
         "dealer_group":           { "monthly": 529 }
       },
       "autoframe_unlimited": {
         "single_store":           { "monthly": 799 },
         "single_store_secondary": { "monthly": 799 },
         "multi_location":         { "monthly": 749 },
         "dealer_group":           { "monthly": 729 }
       },
       "autofilm_full": {
         "single_store":           { "monthly": 999, "annual": 849 },
         "single_store_secondary": { "monthly": 999, "annual": 849 },
         "multi_location":         { "monthly": 949, "annual": 807 },
         "dealer_group":           { "monthly": 799, "annual": 679 }
       }
     }'::jsonb,
     bundle_overrides = '{
       "all_apps_unlimited": {
         "single_store":           { "monthly": 3999, "annual": 3399 },
         "single_store_secondary": { "monthly": 3999, "annual": 3399 },
         "multi_location":         { "monthly": 3799, "annual": 3305 },
         "dealer_group":           { "monthly": 3495, "annual": 3041 }
       }
     }'::jsonb,
     multi_location_overrides = '{}'::jsonb,
     updated_at = now()
 WHERE id = 'global';

-- If the singleton row somehow doesn't exist yet, create it with the seed.
INSERT INTO public.platform_pricing_model (
  id, annual_discount_pct, tier_overrides, bundle_overrides, multi_location_overrides
)
SELECT
  'global',
  15,
  '{
    "autocurb_standard": {
      "single_store":           { "monthly": 1999, "annual": 1639 },
      "single_store_secondary": { "monthly": 1999, "annual": 1639 },
      "multi_location":         { "monthly": 1799, "annual": 1475 },
      "dealer_group":           { "monthly": 1599, "annual": 1311 }
    },
    "autolabels_base": {
      "single_store":           { "monthly": 399 },
      "single_store_secondary": { "monthly": 399 },
      "multi_location":         { "monthly": 349 },
      "dealer_group":           { "monthly": 299 }
    },
    "autolabels_pro": {
      "single_store":           { "monthly": 899 },
      "single_store_secondary": { "monthly": 899 },
      "multi_location":         { "monthly": 849 },
      "dealer_group":           { "monthly": 799 }
    },
    "autoframe_70": {
      "single_store":           { "monthly": 399 },
      "single_store_secondary": { "monthly": 399 },
      "multi_location":         { "monthly": 349 },
      "dealer_group":           { "monthly": 329 }
    },
    "autoframe_120": {
      "single_store":           { "monthly": 599 },
      "single_store_secondary": { "monthly": 599 },
      "multi_location":         { "monthly": 549 },
      "dealer_group":           { "monthly": 529 }
    },
    "autoframe_unlimited": {
      "single_store":           { "monthly": 799 },
      "single_store_secondary": { "monthly": 799 },
      "multi_location":         { "monthly": 749 },
      "dealer_group":           { "monthly": 729 }
    },
    "autofilm_full": {
      "single_store":           { "monthly": 999, "annual": 849 },
      "single_store_secondary": { "monthly": 999, "annual": 849 },
      "multi_location":         { "monthly": 949, "annual": 807 },
      "dealer_group":           { "monthly": 799, "annual": 679 }
    }
  }'::jsonb,
  '{
    "all_apps_unlimited": {
      "single_store":           { "monthly": 3999, "annual": 3399 },
      "single_store_secondary": { "monthly": 3999, "annual": 3399 },
      "multi_location":         { "monthly": 3799, "annual": 3305 },
      "dealer_group":           { "monthly": 3495, "annual": 3041 }
    }
  }'::jsonb,
  '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.platform_pricing_model WHERE id = 'global');

COMMENT ON COLUMN public.platform_pricing_model.tier_overrides IS
  'Per-tier, per-architecture pricing. Shape: { [tier_id]: { [architecture]: { monthly: number, annual?: number } } }. `annual` is the per-month-equivalent rate when billed annually prepaid; missing means monthly-only.';
COMMENT ON COLUMN public.platform_pricing_model.bundle_overrides IS
  'Per-bundle, per-architecture pricing. Same shape as tier_overrides.';
