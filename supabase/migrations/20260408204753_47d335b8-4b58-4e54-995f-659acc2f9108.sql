
-- Add strategy_mode and market_adjustment to pricing_models
ALTER TABLE public.pricing_models
  ADD COLUMN IF NOT EXISTS strategy_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS market_adjustment jsonb DEFAULT NULL;

-- Add manager_pin, target_gross_min, wholesale_only fields to offer_settings
ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS manager_pin text NOT NULL DEFAULT '0000',
  ADD COLUMN IF NOT EXISTS target_gross_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_only_mileage integer NOT NULL DEFAULT 120000,
  ADD COLUMN IF NOT EXISTS wholesale_only_age_years integer NOT NULL DEFAULT 10;

-- Add manager override fields to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS manager_override_amount integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manager_override_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manager_override_by text DEFAULT NULL;
