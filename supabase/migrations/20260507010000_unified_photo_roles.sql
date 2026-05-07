-- Unified photo roles for photo_config.
--
-- Background: photo_config has driven the standard "/upload/:token" flow
-- (controlled by is_enabled + is_required) since 20260331183716, but the
-- AI Boost retake flow at /boost-offer/:token has been hardcoding its own
-- parallel shot list inside BoostOfferClarity.tsx (REQUIRED_SHOTS +
-- BONUS_SHOTS) with its own ids ("exterior_front", "dashboard_odometer",
-- "tires_wheels", etc.). That created two namespaces for the same
-- physical photos and gave the dealer no way to configure the boost
-- recipe.
--
-- This migration unifies both flows into photo_config by adding two
-- role columns scoped by MOMENT (not by system):
--
--   pre_appointment_role : 'off' | 'optional' | 'required'
--     Controls what the customer sees in the standard upload flow
--     they hit before their dealership appointment.
--
--   boost_role           : 'off' | 'bonus' | 'required'
--     Controls what shows up in the AI Boost retake flow when the
--     dealer's offer comes in low and the customer can capture
--     fresh photos for an AI re-appraisal.
--
-- A single shot can be set to 'required' on BOTH (e.g. Front 3/4):
-- the upload flow demands it before the appointment, AND the boost
-- flow re-asks for a fresh staged version because boost AI scoring
-- depends on photo quality (daylight, alignment with the silhouette).
--
-- Safe to re-apply: every CREATE / ALTER / INSERT is guarded.

-- 1. Role columns ------------------------------------------------------------
ALTER TABLE public.photo_config
  ADD COLUMN IF NOT EXISTS pre_appointment_role text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS boost_role           text NOT NULL DEFAULT 'off';

-- Constrain to known values. Drop-and-recreate so the migration is
-- idempotent and the constraint matches the latest enum.
ALTER TABLE public.photo_config
  DROP CONSTRAINT IF EXISTS photo_config_pre_appointment_role_chk;
ALTER TABLE public.photo_config
  ADD  CONSTRAINT photo_config_pre_appointment_role_chk
  CHECK (pre_appointment_role IN ('off','optional','required'));

ALTER TABLE public.photo_config
  DROP CONSTRAINT IF EXISTS photo_config_boost_role_chk;
ALTER TABLE public.photo_config
  ADD  CONSTRAINT photo_config_boost_role_chk
  CHECK (boost_role IN ('off','bonus','required'));

-- 2. Backfill from existing is_enabled / is_required so today's rows
--    keep today's behavior in the standard upload flow.
UPDATE public.photo_config
SET pre_appointment_role = CASE
  WHEN is_enabled = false THEN 'off'
  WHEN is_required = true  THEN 'required'
  ELSE 'optional'
END
WHERE pre_appointment_role = 'off';

-- 3. Backfill boost_role for the shots BoostOfferClarity has been
--    hardcoding. The boost flow's shot ids collapse into the
--    canonical photo_config ids:
--      exterior_front       -> front
--      exterior_driver      -> driver_side
--      exterior_passenger   -> passenger_side
--      exterior_rear        -> rear
--      dashboard_odometer   -> dashboard
--      tires_wheels         -> wheel
--      interior_driver_seat   (new — see step 4)
--      interior_steering_wheel(new — see step 4)
UPDATE public.photo_config
SET boost_role = 'required'
WHERE dealership_id = 'default'
  AND shot_id IN ('front','driver_side','passenger_side','rear','dashboard','wheel')
  AND boost_role = 'off';

-- 4. Two boost-bonus shots that don't exist in the standard catalog
--    yet. These are wear-tells the AI uses to validate the odometer
--    OCR. Off in the pre-appointment flow by default; bonus in boost.
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

-- 5. Helpful index for the boost flow's per-dealer SELECTs.
CREATE INDEX IF NOT EXISTS photo_config_boost_role_idx
  ON public.photo_config (dealership_id, boost_role)
  WHERE boost_role <> 'off';

-- 6. PostgREST schema cache reload so the new columns are reachable
--    from the Supabase client without a restart.
NOTIFY pgrst, 'reload schema';
