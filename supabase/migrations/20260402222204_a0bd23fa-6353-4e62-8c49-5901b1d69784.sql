
ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS high_mileage_penalty jsonb NOT NULL DEFAULT '{"enabled":false,"avg_miles_per_year":12000,"penalty_pct_per_step":2,"step_size_pct":20,"max_penalty_pct":10,"max_miles_per_year":25000}'::jsonb,
  ADD COLUMN IF NOT EXISTS color_desirability jsonb NOT NULL DEFAULT '{"enabled":false,"adjustments":{"white":2,"black":2,"silver":1,"gray":1,"red":0,"blue":0,"green":-1,"yellow":-3,"orange":-2,"purple":-2,"brown":-2,"gold":-1,"beige":-2}}'::jsonb,
  ADD COLUMN IF NOT EXISTS seasonal_adjustment jsonb NOT NULL DEFAULT '{"enabled":false,"adjustment_pct":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS deduction_modes jsonb NOT NULL DEFAULT '{"accidents":"flat","not_drivable":"flat"}'::jsonb;

ALTER TABLE public.pricing_models
  ADD COLUMN IF NOT EXISTS high_mileage_penalty jsonb NOT NULL DEFAULT '{"enabled":false,"avg_miles_per_year":12000,"penalty_pct_per_step":2,"step_size_pct":20,"max_penalty_pct":10,"max_miles_per_year":25000}'::jsonb,
  ADD COLUMN IF NOT EXISTS color_desirability jsonb NOT NULL DEFAULT '{"enabled":false,"adjustments":{"white":2,"black":2,"silver":1,"gray":1,"red":0,"blue":0,"green":-1,"yellow":-3,"orange":-2,"purple":-2,"brown":-2,"gold":-1,"beige":-2}}'::jsonb,
  ADD COLUMN IF NOT EXISTS seasonal_adjustment jsonb NOT NULL DEFAULT '{"enabled":false,"adjustment_pct":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS deduction_modes jsonb NOT NULL DEFAULT '{"accidents":"flat","not_drivable":"flat"}'::jsonb;
