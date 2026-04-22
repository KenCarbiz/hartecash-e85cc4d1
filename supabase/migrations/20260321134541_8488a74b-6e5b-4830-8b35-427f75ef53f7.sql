
-- Create dealership_locations table
CREATE TABLE public.dealership_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL DEFAULT 'CT',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dealership_locations ENABLE ROW LEVEL SECURITY;

-- Anyone can read active locations
CREATE POLICY "Anyone can read active locations"
  ON public.dealership_locations FOR SELECT TO public
  USING (is_active = true);

-- Staff can read all locations
CREATE POLICY "Staff can read all locations"
  ON public.dealership_locations FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- Admins can manage locations
CREATE POLICY "Admins can manage locations"
  ON public.dealership_locations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing locations
INSERT INTO public.dealership_locations (name, city, state, sort_order) VALUES
  ('Harte Nissan', 'Hartford', 'CT', 1),
  ('Harte Infiniti', 'Hartford', 'CT', 2),
  ('George Harte Nissan', 'West Haven', 'CT', 3),
  ('George Harte Infiniti', 'Wallingford', 'CT', 4),
  ('Harte Hyundai', 'Old Saybrook', 'CT', 5);
