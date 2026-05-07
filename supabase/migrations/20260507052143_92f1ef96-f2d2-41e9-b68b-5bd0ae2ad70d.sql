-- Unified photo roles: pre_appointment_role + boost_role on photo_config
-- Idempotent per CLAUDE.md migration authoring rule.

ALTER TABLE public.photo_config
  ADD COLUMN IF NOT EXISTS pre_appointment_role text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS boost_role text NOT NULL DEFAULT 'off';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_config_pre_appointment_role_check'
  ) THEN
    ALTER TABLE public.photo_config
      ADD CONSTRAINT photo_config_pre_appointment_role_check
      CHECK (pre_appointment_role IN ('off','optional','required'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_config_boost_role_check'
  ) THEN
    ALTER TABLE public.photo_config
      ADD CONSTRAINT photo_config_boost_role_check
      CHECK (boost_role IN ('off','bonus','required'));
  END IF;
END $$;

-- Backfill pre_appointment_role from legacy is_enabled / is_required
UPDATE public.photo_config
   SET pre_appointment_role = CASE
     WHEN is_enabled = false THEN 'off'
     WHEN is_required = true THEN 'required'
     ELSE 'optional'
   END
 WHERE pre_appointment_role = 'off'
   AND (is_enabled = true OR is_required = true);

-- Backfill boost_role = 'required' for canonical Boost shots
UPDATE public.photo_config
   SET boost_role = 'required'
 WHERE boost_role = 'off'
   AND shot_id IN ('front','driver_side','passenger_side','rear','dashboard','wheel');

-- Add bonus shots for default dealership
INSERT INTO public.photo_config (
  dealership_id, shot_id, label, description, orientation,
  is_enabled, is_required, pre_appointment_role, boost_role, sort_order
)
SELECT 'default', 'interior_driver_seat', 'Driver Seat',
       'Show the condition of the driver seat — wear, tears, stains.',
       'portrait', true, false, 'optional', 'bonus',
       COALESCE((SELECT MAX(sort_order) FROM public.photo_config WHERE dealership_id='default'), 0) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.photo_config
   WHERE dealership_id='default' AND shot_id='interior_driver_seat'
);

INSERT INTO public.photo_config (
  dealership_id, shot_id, label, description, orientation,
  is_enabled, is_required, pre_appointment_role, boost_role, sort_order
)
SELECT 'default', 'interior_steering_wheel', 'Steering Wheel',
       'Capture the steering wheel to show interior wear.',
       'portrait', true, false, 'optional', 'bonus',
       COALESCE((SELECT MAX(sort_order) FROM public.photo_config WHERE dealership_id='default'), 0) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.photo_config
   WHERE dealership_id='default' AND shot_id='interior_steering_wheel'
);

CREATE INDEX IF NOT EXISTS idx_photo_config_dealership_boost_role
  ON public.photo_config (dealership_id, boost_role);

NOTIFY pgrst, 'reload schema';