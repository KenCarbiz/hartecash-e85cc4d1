
-- Photo configuration table for dealer-managed shot requirements
CREATE TABLE public.photo_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  shot_id text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  orientation text NOT NULL DEFAULT 'landscape',
  is_enabled boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, shot_id)
);

ALTER TABLE public.photo_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage their tenant's photo config
CREATE POLICY "Admins can manage own tenant photo config"
  ON public.photo_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));

-- Anyone can read photo config (customers need it for the upload flow)
CREATE POLICY "Anyone can read photo config"
  ON public.photo_config FOR SELECT TO public
  USING (true);

-- Seed default shots for the 'default' dealership
INSERT INTO public.photo_config (dealership_id, shot_id, label, description, orientation, is_enabled, is_required, sort_order) VALUES
  ('default', 'front', 'Front', 'Center front bumper, capture full width', 'landscape', true, true, 0),
  ('default', 'rear', 'Rear', 'Center rear bumper, capture full width', 'landscape', true, true, 1),
  ('default', 'driver_side', 'Driver Side', 'Step back — full bumper to bumper, wheels in frame', 'landscape', true, true, 2),
  ('default', 'passenger_side', 'Passenger Side', 'Step back — full bumper to bumper, wheels in frame', 'landscape', true, true, 3),
  ('default', 'dashboard', 'Dashboard & Odometer', 'Capture full dash — odometer reading must be visible', 'landscape', true, true, 4),
  ('default', 'interior', 'Interior', 'Front seats, console, and steering wheel', 'landscape', true, true, 5),
  ('default', 'driver_rocker', 'Driver Rocker Panel', 'Crouch low — shoot along underside between wheels', 'landscape', true, false, 6),
  ('default', 'pass_rocker', 'Passenger Rocker Panel', 'Crouch low — shoot along underside between wheels', 'landscape', true, false, 7),
  ('default', 'wheel', 'Wheel / Tire', 'Fill the frame with one wheel — check tread depth', 'any', true, false, 8),
  ('default', 'windshield', 'Windshield', 'Stand at front corner — capture full glass, look for chips', 'landscape', true, false, 9),
  ('default', 'hood', 'Engine Bay', 'Open hood — capture full engine compartment', 'landscape', false, false, 10),
  ('default', 'trunk', 'Trunk / Cargo Area', 'Open trunk/liftgate — shoot straight in from behind', 'landscape', false, false, 11),
  ('default', 'driver_door', 'Driver Door Interior', 'Open door — shoot across front seat from outside', 'any', false, false, 12),
  ('default', 'undercarriage', 'Wheel Well', 'Crouch at corner — capture wheel well for rust', 'any', false, false, 13),
  ('default', 'damage', 'Damage Close-up', 'Close-up of any scratches, dents, or wear', 'any', true, false, 14);
