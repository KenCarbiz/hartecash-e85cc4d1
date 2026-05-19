ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS range_spread_pct numeric DEFAULT 0.10;

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_range_spread_pct_bounds;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_spread_pct_bounds
  CHECK (range_spread_pct IS NULL OR (range_spread_pct >= 0.02 AND range_spread_pct <= 0.30));

COMMENT ON COLUMN public.offer_settings.range_spread_pct IS
  'When pricing_reveal_mode = range_then_price, the moto sell flow shows the customer firm × (1 ± range_spread_pct) before phone verification. Default 0.10 (±10%).';

NOTIFY pgrst, 'reload schema';