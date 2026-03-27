
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS service_hero_headline text NOT NULL DEFAULT 'There''s Never Been a Better Time to Upgrade or Sell',
  ADD COLUMN IF NOT EXISTS service_hero_subtext text NOT NULL DEFAULT 'You''re already coming in for service. Let us show you what your car is worth — it takes less than 2 minutes.',
  ADD COLUMN IF NOT EXISTS trade_hero_headline text NOT NULL DEFAULT 'Submit Your Trade-In Info',
  ADD COLUMN IF NOT EXISTS trade_hero_subtext text NOT NULL DEFAULT 'Already shopping with us? Send us your trade details from home — we''ll have your value ready.';
