-- Pricing v3.3 — final polish prices (2026-04-14 night session):
--   • AutoFilm now has annual prepaid: $999 monthly OR $899/mo prepaid 12 mo
--     ($899 × 12 = $10,788 upfront)
--   • All-Apps Unlimited bundle annual: $3,799 → $3,499/mo equivalent
--     ($3,499 × 12 = $41,988 upfront)
--   • AutoFrame tier descriptions shortened to evocative captions
--     ("Perfect for smaller lots", "Growing inventories",
--     "High-volume lots & groups") so the 3-column row reads
--     like a Michelin menu rather than a spec sheet.
--   • AutoFrame tier name labels: "75 Units" → "75 Vehicles" etc.

UPDATE public.platform_product_tiers
   SET monthly_price = 999.00,
       annual_price  = 10788.00,
       updated_at    = now()
 WHERE id = 'autofilm_full';

UPDATE public.platform_bundles
   SET monthly_price = 3999.00,
       annual_price  = 41988.00,
       description   = 'Every app at its top tier, unlimited usage, with white-glove onboarding, a dedicated Customer Success Manager, priority 24/7 support, and quarterly business reviews. $3,999/mo or $3,499/mo prepaid 12 months. Per rooftop.'
 WHERE id = 'all_apps_unlimited';

UPDATE public.platform_product_tiers
   SET name        = '75 Vehicles',
       description = 'Perfect for smaller lots',
       updated_at  = now()
 WHERE id = 'autoframe_70';

UPDATE public.platform_product_tiers
   SET name        = '125 Vehicles',
       description = 'Growing inventories',
       updated_at  = now()
 WHERE id = 'autoframe_120';

UPDATE public.platform_product_tiers
   SET name        = 'Unlimited',
       description = 'High-volume lots & groups',
       updated_at  = now()
 WHERE id = 'autoframe_unlimited';
