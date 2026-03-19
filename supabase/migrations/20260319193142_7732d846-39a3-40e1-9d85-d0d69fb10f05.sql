-- Offer settings: global or per-dealership valuation config
CREATE TABLE public.offer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  bb_value_basis text NOT NULL DEFAULT 'tradein_avg',
  global_adjustment_pct numeric NOT NULL DEFAULT 0,
  deductions_config jsonb NOT NULL DEFAULT '{"accidents": true, "exterior_damage": true, "interior_damage": true, "windshield_damage": true, "engine_issues": true, "mechanical_issues": true, "tech_issues": true, "not_drivable": true, "smoked_in": true, "tires_not_replaced": true, "missing_keys": true}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dealership_id)
);

-- Offer rules: criteria-based adjustments and hot list
CREATE TABLE public.offer_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'criteria',
  criteria jsonb NOT NULL DEFAULT '{}',
  adjustment_pct numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  flag_in_dashboard boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add hot lead flag to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS matched_rule_ids uuid[] DEFAULT NULL;

-- RLS for offer_settings: admin only
ALTER TABLE public.offer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offer settings"
  ON public.offer_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read offer settings"
  ON public.offer_settings FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- RLS for offer_rules: admin only for write, staff can read
ALTER TABLE public.offer_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offer rules"
  ON public.offer_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read offer rules"
  ON public.offer_rules FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Seed default settings
INSERT INTO public.offer_settings (dealership_id) VALUES ('default') ON CONFLICT DO NOTHING;