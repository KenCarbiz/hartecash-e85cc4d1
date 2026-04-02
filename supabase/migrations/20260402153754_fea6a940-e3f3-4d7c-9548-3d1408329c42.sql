
ALTER TABLE public.offer_settings
ADD COLUMN IF NOT EXISTS low_mileage_bonus jsonb NOT NULL DEFAULT '{"enabled": false, "avg_miles_per_year": 12000, "bonus_pct_per_step": 2, "step_size_pct": 20, "max_bonus_pct": 8, "min_miles_per_year": 4000}'::jsonb;

ALTER TABLE public.pricing_models
ADD COLUMN IF NOT EXISTS low_mileage_bonus jsonb NOT NULL DEFAULT '{"enabled": false, "avg_miles_per_year": 12000, "bonus_pct_per_step": 2, "step_size_pct": 20, "max_bonus_pct": 8, "min_miles_per_year": 4000}'::jsonb;
