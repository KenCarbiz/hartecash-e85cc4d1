-- Pricing v3.2 — latest adjustments per user direction 2026-04-14:
--   • AutoLabels Basic:  $299 → $399/mo   (Basic plan, new/used stickers + addendums)
--   • AutoLabels Premium: $895 → $899/mo  (FTC compliance, audit trail)
--   • AutoCurb annual prepaid: $1,495 → $1,499/mo equivalent
--     ($1,499 × 12 = $17,988 upfront)
--   • Row order: AutoCurb(1) → AutoLabels(2) → AutoFrame(3) → AutoFilm(4)
--     (AutoFrame comes BEFORE AutoFilm, reversing v3.1)

UPDATE public.platform_product_tiers
   SET monthly_price = 399.00,
       annual_price  = 3990.00,
       name          = 'Basic',
       updated_at    = now()
 WHERE id = 'autolabels_base';

UPDATE public.platform_product_tiers
   SET monthly_price = 899.00,
       annual_price  = 8990.00,
       name          = 'Premium',
       updated_at    = now()
 WHERE id = 'autolabels_pro';

UPDATE public.platform_product_tiers
   SET monthly_price = 1995.00,
       annual_price  = 17988.00,
       name          = 'AutoCurb',
       updated_at    = now()
 WHERE id = 'autocurb_standard';

-- Row order: AutoFrame(3), AutoFilm(4)
UPDATE public.platform_products SET sort_order = 3 WHERE id = 'autoframe';
UPDATE public.platform_products SET sort_order = 4 WHERE id = 'autofilm';
