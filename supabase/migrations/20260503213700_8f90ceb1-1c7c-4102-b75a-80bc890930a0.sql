-- Add slug column for stable string identifiers
ALTER TABLE public.platform_product_tiers
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS platform_product_tiers_slug_key
  ON public.platform_product_tiers (slug)
  WHERE slug IS NOT NULL;

-- Seed Basic + Premium tiers under the Autocurb product
WITH p AS (
  SELECT id FROM public.platform_products WHERE lower(name) = 'autocurb' LIMIT 1
)
INSERT INTO public.platform_product_tiers
  (id, product_id, slug, name, description, monthly_price, annual_price,
   features, inventory_limit, included_with_product_ids, is_introductory,
   allow_overage, overage_price_per_unit, sort_order, is_active)
SELECT
  gen_random_uuid(), p.id, 'autocurb_standard',
  'Basic',
  'Off-street vehicle acquisition — instant offers, inspections, appraisals, dealer dashboard. Includes the cadence engine and click-to-dial; voice automation requires Premium.',
  1995.00, 17955.00,
  ARRAY['Instant offers','Inspections','Appraisals','Dealer dashboard','Cadence engine','Click-to-dial']::text[],
  NULL, ARRAY[]::uuid[], false,
  false, NULL, 0, true
FROM p
WHERE NOT EXISTS (SELECT 1 FROM public.platform_product_tiers WHERE slug = 'autocurb_standard');

WITH p AS (
  SELECT id FROM public.platform_products WHERE lower(name) = 'autocurb' LIMIT 1
)
INSERT INTO public.platform_product_tiers
  (id, product_id, slug, name, description, monthly_price, annual_price,
   features, inventory_limit, included_with_product_ids, is_introductory,
   allow_overage, overage_price_per_unit, sort_order, is_active)
SELECT
  gen_random_uuid(), p.id, 'autocurb_premium',
  'Premium',
  'Everything in Basic, plus the AI Voice agent — outbound campaigns, voicemail drop, on-call qualification, voice-call analytics, and full transcript history in every customer file.',
  2495.00, 22455.00,
  ARRAY['Everything in Basic','AI Voice agent — outbound campaigns','Voicemail drop fallback','On-call qualification + appointment-set','Voice call transcripts in customer file','Voice analytics: connect rate, talk time, outcomes','Concurrent-call atomic billing','Bland.ai or OpenAI Realtime provider']::text[],
  NULL, ARRAY[]::uuid[], false,
  false, NULL, 1, true
FROM p
WHERE NOT EXISTS (SELECT 1 FROM public.platform_product_tiers WHERE slug = 'autocurb_premium');

NOTIFY pgrst, 'reload schema';