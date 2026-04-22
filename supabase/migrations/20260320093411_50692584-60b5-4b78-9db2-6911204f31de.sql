
-- Add adjustment_type column to offer_rules (percentage or flat dollar)
ALTER TABLE public.offer_rules ADD COLUMN IF NOT EXISTS adjustment_type text NOT NULL DEFAULT 'pct';

-- Add new configurable fields to offer_settings
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS recon_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS offer_floor numeric NOT NULL DEFAULT 500;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS offer_ceiling numeric DEFAULT NULL;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS condition_multipliers jsonb NOT NULL DEFAULT '{"excellent": 1.05, "good": 1.0, "fair": 0.90, "rough": 0.78}'::jsonb;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS deduction_amounts jsonb NOT NULL DEFAULT '{"accidents_1": 800, "accidents_2": 1800, "accidents_3plus": 3000, "exterior_damage_per_item": 300, "interior_damage_per_item": 200, "windshield_cracked": 400, "windshield_chipped": 150, "engine_issue_per_item": 500, "mechanical_issue_per_item": 350, "tech_issue_per_item": 150, "not_drivable": 1500, "smoked_in": 500, "tires_not_replaced": 400, "missing_keys_1": 200, "missing_keys_0": 400}'::jsonb;
