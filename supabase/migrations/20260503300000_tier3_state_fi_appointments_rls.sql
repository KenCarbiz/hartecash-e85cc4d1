-- Sprint B — Wire can_act_in_state() into appointments UPDATE policy.
--
-- Continuation of Tier 3.15 (per-state F&I scoping). The appointments
-- table doesn't carry its own state column — appointments belong to
-- a store_location_id which has a state on dealership_locations.
-- This migration extends the policy by joining through that path.
--
-- Same gate semantics as the submissions migration:
--   - platform admin → pass
--   - non-F&I roles → pass (role_requires_state_license guards)
--   - users with empty/NULL licensed_states → pass (back-compat)
--   - F&I roles with non-empty licensed_states → must have the
--     appointment's store-state in their list
--
-- Appointments without a store_location_id default to empty-string
-- match — these will fail for licensed F&I users, which is the
-- safer default (an unattributed appointment shouldn't be edited
-- by an F&I rep who's licensed elsewhere).
--
-- IDEMPOTENT — DROP IF EXISTS / CREATE.

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments in licensed states"
  ON public.appointments;

CREATE POLICY "Staff can update appointments in licensed states"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE(
          (SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id),
          ''
        )
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE(
          (SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id),
          ''
        )
      )
    )
  );

COMMENT ON POLICY "Staff can update appointments in licensed states"
  ON public.appointments IS
  'F&I roles need the store''s state in their licensed_states list. Non-F&I roles bypass via can_act_in_state. Platform admins always pass. Appointments missing a store_location_id default to empty-state which fails the gate for licensed users.';

NOTIFY pgrst, 'reload schema';
