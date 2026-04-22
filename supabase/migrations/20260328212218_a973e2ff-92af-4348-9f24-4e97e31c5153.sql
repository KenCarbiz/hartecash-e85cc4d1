
-- Inspection configuration table
-- Stores which sections/fields are enabled and custom checklist items
CREATE TABLE public.inspection_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  
  -- Section toggles (on/off for each major section)
  section_tires boolean NOT NULL DEFAULT true,
  section_measurements boolean NOT NULL DEFAULT true,
  section_exterior boolean NOT NULL DEFAULT true,
  section_interior boolean NOT NULL DEFAULT true,
  section_mechanical boolean NOT NULL DEFAULT true,
  section_electrical boolean NOT NULL DEFAULT true,
  section_glass boolean NOT NULL DEFAULT true,
  
  -- Section ordering (lower = first)
  section_order jsonb NOT NULL DEFAULT '["tires","measurements","exterior","interior","mechanical","electrical","glass"]'::jsonb,
  
  -- Field-level toggles: JSON objects mapping field names to booleans
  -- e.g. {"Hood": true, "Front Bumper": false}
  -- If a field is missing from the object, it defaults to enabled
  disabled_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tire/brake field toggles
  show_tire_tread_depth boolean NOT NULL DEFAULT true,
  show_brake_pad_measurements boolean NOT NULL DEFAULT true,
  
  -- Measurement field toggles
  show_paint_readings boolean NOT NULL DEFAULT true,
  show_oil_life boolean NOT NULL DEFAULT true,
  show_battery_health boolean NOT NULL DEFAULT true,
  
  -- Per-section requirements
  require_photos jsonb NOT NULL DEFAULT '{}'::jsonb,
  require_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Custom checklist items: array of {section, label, sort_order}
  custom_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(dealership_id)
);

-- Enable RLS
ALTER TABLE public.inspection_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage inspection config"
  ON public.inspection_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read inspection config"
  ON public.inspection_config FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can read inspection config"
  ON public.inspection_config FOR SELECT
  TO public
  USING (true);

-- Insert default row
INSERT INTO public.inspection_config (dealership_id) VALUES ('default');
