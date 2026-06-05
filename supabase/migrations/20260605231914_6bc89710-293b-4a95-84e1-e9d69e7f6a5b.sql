-- Tenant-isolation hardening (security audit, June 2026).
UPDATE public.user_roles
SET is_platform_admin = true
WHERE role = 'admin'::app_role
  AND dealership_id = 'default'
  AND is_platform_admin = false;

DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update scoped submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions in licensed states" ON public.submissions;
CREATE POLICY "Staff can update submissions in licensed states"
  ON public.submissions FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  );

DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments in licensed states" ON public.appointments;
CREATE POLICY "Staff can update appointments in licensed states"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), '')
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), '')
      )
    )
  );

DROP POLICY IF EXISTS "Staff can read appointments" ON public.appointments;
CREATE POLICY "Staff can read appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff read own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff read own-dealership conversation events"
  ON public.conversation_events FOR SELECT TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff insert own-dealership conversation events"
  ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
      AND is_platform_admin = true
  );
$$;

NOTIFY pgrst, 'reload schema';