
-- Pricing models table: stores savable/nameable pricing configurations
CREATE TABLE public.pricing_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  schedule_start date,
  schedule_end date,
  priority integer NOT NULL DEFAULT 0,
  bb_value_basis text NOT NULL DEFAULT 'tradein_avg',
  global_adjustment_pct numeric NOT NULL DEFAULT 0,
  regional_adjustment_pct numeric NOT NULL DEFAULT 0,
  condition_multipliers jsonb NOT NULL DEFAULT '{"fair": 0.90, "good": 1.0, "rough": 0.78, "excellent": 1.05}'::jsonb,
  deductions_config jsonb NOT NULL DEFAULT '{"accidents": true, "smoked_in": true, "tech_issues": true, "missing_keys": true, "not_drivable": true, "engine_issues": true, "exterior_damage": true, "interior_damage": true, "mechanical_issues": true, "windshield_damage": true, "tires_not_replaced": true}'::jsonb,
  deduction_amounts jsonb NOT NULL DEFAULT '{"smoked_in": 500, "accidents_1": 800, "accidents_2": 1800, "not_drivable": 1500, "missing_keys_0": 400, "missing_keys_1": 200, "accidents_3plus": 3000, "tires_not_replaced": 400, "windshield_chipped": 150, "windshield_cracked": 400, "tech_issue_per_item": 150, "engine_issue_per_item": 500, "exterior_damage_per_item": 300, "interior_damage_per_item": 200, "mechanical_issue_per_item": 350}'::jsonb,
  recon_cost numeric NOT NULL DEFAULT 0,
  offer_floor numeric NOT NULL DEFAULT 500,
  offer_ceiling numeric,
  age_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  mileage_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GSM temporary access requests
CREATE TABLE public.pricing_model_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- RLS for pricing_models
ALTER TABLE public.pricing_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and GM can manage pricing models"
ON public.pricing_models FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gsm_gm'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gsm_gm'::app_role)
);

CREATE POLICY "Staff can read pricing models"
ON public.pricing_models FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

-- RLS for access requests
ALTER TABLE public.pricing_model_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and GM can manage access requests"
ON public.pricing_model_access_requests FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gsm_gm'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gsm_gm'::app_role)
);

CREATE POLICY "Users can create own access requests"
ON public.pricing_model_access_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own access requests"
ON public.pricing_model_access_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);
