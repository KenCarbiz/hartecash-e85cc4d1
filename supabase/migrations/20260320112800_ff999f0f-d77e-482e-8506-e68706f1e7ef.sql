
CREATE TABLE public.form_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default' UNIQUE,
  
  -- Step-level toggles (Vehicle Info and Your Details are always required)
  step_vehicle_build boolean NOT NULL DEFAULT true,
  step_condition_history boolean NOT NULL DEFAULT true,
  
  -- Condition & History question toggles
  q_overall_condition boolean NOT NULL DEFAULT true,
  q_exterior_damage boolean NOT NULL DEFAULT true,
  q_windshield_damage boolean NOT NULL DEFAULT true,
  q_moonroof boolean NOT NULL DEFAULT true,
  q_interior_damage boolean NOT NULL DEFAULT true,
  q_tech_issues boolean NOT NULL DEFAULT true,
  q_engine_issues boolean NOT NULL DEFAULT true,
  q_mechanical_issues boolean NOT NULL DEFAULT true,
  q_drivable boolean NOT NULL DEFAULT true,
  q_accidents boolean NOT NULL DEFAULT true,
  q_smoked_in boolean NOT NULL DEFAULT true,
  q_tires_replaced boolean NOT NULL DEFAULT true,
  q_num_keys boolean NOT NULL DEFAULT true,
  
  -- Vehicle Build question toggles
  q_exterior_color boolean NOT NULL DEFAULT true,
  q_drivetrain boolean NOT NULL DEFAULT true,
  q_modifications boolean NOT NULL DEFAULT true,
  
  -- Your Details question toggles
  q_loan_details boolean NOT NULL DEFAULT true,
  
  -- Get Your Offer toggles
  q_next_step boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read form config"
  ON public.form_config FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage form config"
  ON public.form_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
