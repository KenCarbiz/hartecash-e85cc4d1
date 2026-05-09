-- Unified photo roles for photo_config (idempotent).
ALTER TABLE public.photo_config
  ADD COLUMN IF NOT EXISTS pre_appointment_role text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS boost_role           text NOT NULL DEFAULT 'off';

ALTER TABLE public.photo_config DROP CONSTRAINT IF EXISTS photo_config_pre_appointment_role_chk;
ALTER TABLE public.photo_config ADD  CONSTRAINT photo_config_pre_appointment_role_chk
  CHECK (pre_appointment_role IN ('off','optional','required'));

ALTER TABLE public.photo_config DROP CONSTRAINT IF EXISTS photo_config_boost_role_chk;
ALTER TABLE public.photo_config ADD  CONSTRAINT photo_config_boost_role_chk
  CHECK (boost_role IN ('off','bonus','required'));

UPDATE public.photo_config
SET pre_appointment_role = CASE
  WHEN is_enabled = false THEN 'off'
  WHEN is_required = true  THEN 'required'
  ELSE 'optional'
END
WHERE pre_appointment_role = 'off';

UPDATE public.photo_config
SET boost_role = 'required'
WHERE dealership_id = 'default'
  AND shot_id IN ('front','driver_side','passenger_side','rear','dashboard','wheel')
  AND boost_role = 'off';

INSERT INTO public.photo_config
  (dealership_id, shot_id, label, description, orientation,
   is_enabled, is_required, sort_order,
   pre_appointment_role, boost_role)
VALUES
  ('default','interior_driver_seat','Driver Seat',
   'Whole seat from the door, daylight if you can','any',
   true, false, 20, 'off', 'bonus'),
  ('default','interior_steering_wheel','Steering Wheel',
   'Straight on from the driver seat','any',
   true, false, 21, 'off', 'bonus')
ON CONFLICT (dealership_id, shot_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS photo_config_boost_role_idx
  ON public.photo_config (dealership_id, boost_role)
  WHERE boost_role <> 'off';

NOTIFY pgrst, 'reload schema';