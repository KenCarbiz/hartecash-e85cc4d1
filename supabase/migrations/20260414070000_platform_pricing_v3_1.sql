-- Pricing v3.1 — adjustments per user direction 2026-04-14 (evening):
--   • AutoLabels Premium: $899 → $895/mo
--   • All-Apps Unlimited annual prepaid: $3,899 → $3,799/mo equivalent
--     ($3,799 × 12 = $45,588 annual upfront)
--   • AutoFilm moves ahead of AutoFrame in the row order
--
-- This migration is purely an UPDATE pass; v3 (20260414060000) already
-- inserted the rows with ON CONFLICT semantics. If any environment
-- hasn't run v3 yet, these updates are harmless no-ops.

UPDATE public.platform_product_tiers
   SET monthly_price = 895.00,
       annual_price  = 8950.00,
       updated_at    = now()
 WHERE id = 'autolabels_pro';

UPDATE public.platform_bundles
   SET monthly_price = 3999.00,
       annual_price  = 45588.00,
       description   = 'Every app at its top tier, unlimited usage, with white-glove onboarding, a dedicated Customer Success Manager, priority 24/7 support, and quarterly business reviews. $3,999/mo or $3,799/mo prepaid 12 months. Per rooftop.'
 WHERE id = 'all_apps_unlimited';

-- Row ordering: AutoCurb(1) → AutoLabels(2) → AutoFilm(3) → AutoFrame(4)
UPDATE public.platform_products SET sort_order = 3 WHERE id = 'autofilm';
UPDATE public.platform_products SET sort_order = 4 WHERE id = 'autoframe';
