
-- Add outcome tracking columns to submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_accepted boolean DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_sale_price integer DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_days_to_sale integer DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_wholesaled boolean DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_wholesale_price integer DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_recon_actual integer DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_entered_at timestamptz DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS outcome_entered_by text DEFAULT NULL;

-- Add intelligence and carrying cost fields to offer_settings
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS floor_plan_rate_pct numeric NOT NULL DEFAULT 6.5;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS lot_cost_per_day integer NOT NULL DEFAULT 8;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS learning_threshold integer NOT NULL DEFAULT 250;
ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS archetype_deduction_overrides jsonb DEFAULT NULL;
