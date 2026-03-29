
CREATE TABLE public.depth_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  name text NOT NULL,
  policy_type text NOT NULL DEFAULT 'standard',
  oem_brands text[] NOT NULL DEFAULT '{}',
  all_brands boolean NOT NULL DEFAULT true,
  max_vehicle_age_years integer DEFAULT NULL,
  max_mileage integer DEFAULT NULL,
  min_tire_depth integer NOT NULL DEFAULT 4,
  min_brake_depth integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.depth_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage depth policies" ON public.depth_policies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read depth policies" ON public.depth_policies FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));
