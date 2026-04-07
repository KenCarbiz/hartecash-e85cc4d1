ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS max_market_pct numeric DEFAULT NULL;
ALTER TABLE public.pricing_models ADD COLUMN IF NOT EXISTS max_market_pct numeric DEFAULT NULL;