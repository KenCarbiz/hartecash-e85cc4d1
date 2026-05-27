DROP POLICY IF EXISTS "Public read default phases" ON public.conversation_phases;
DROP POLICY IF EXISTS "Authenticated read default phases" ON public.conversation_phases;
CREATE POLICY "Authenticated read default phases" ON public.conversation_phases
  FOR SELECT TO authenticated
  USING (dealership_id = 'default' AND is_active = true);

DROP POLICY IF EXISTS "Public read default signals" ON public.customer_signals;
DROP POLICY IF EXISTS "Authenticated read default signals" ON public.customer_signals;
CREATE POLICY "Authenticated read default signals" ON public.customer_signals
  FOR SELECT TO authenticated
  USING (dealership_id = 'default' AND is_active = true);

DROP POLICY IF EXISTS "Public read default intel" ON public.industry_intel;
DROP POLICY IF EXISTS "Authenticated read default intel" ON public.industry_intel;
CREATE POLICY "Authenticated read default intel" ON public.industry_intel
  FOR SELECT TO authenticated
  USING (dealership_id = 'default' AND is_active = true);

DROP POLICY IF EXISTS "Public read default objections" ON public.objection_playbook;
DROP POLICY IF EXISTS "Authenticated read default objections" ON public.objection_playbook;
CREATE POLICY "Authenticated read default objections" ON public.objection_playbook
  FOR SELECT TO authenticated
  USING (dealership_id = 'default' AND is_active = true);

DROP POLICY IF EXISTS "Public read default persona" ON public.voice_agent_persona;
DROP POLICY IF EXISTS "Authenticated read default persona" ON public.voice_agent_persona;
CREATE POLICY "Authenticated read default persona" ON public.voice_agent_persona
  FOR SELECT TO authenticated
  USING (dealership_id = 'default' AND is_active = true);

DROP POLICY IF EXISTS "Anyone can read permission groups" ON public.permission_groups;
DROP POLICY IF EXISTS "Authenticated read permission groups" ON public.permission_groups;
CREATE POLICY "Authenticated read permission groups" ON public.permission_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Dealer admin can read own egress logs" ON public.data_egress_log;
DROP POLICY IF EXISTS "Managers read own egress logs" ON public.data_egress_log;
CREATE POLICY "Managers read own egress logs" ON public.data_egress_log
  FOR SELECT TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'gsm_gm'::app_role))
  );

DROP POLICY IF EXISTS "Staff can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update profiles in their dealership" ON public.profiles;
CREATE POLICY "Admins update profiles in their dealership" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id
        AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id
        AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.scrub_anon_submission_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    NEW.offered_price := NULL;
    NEW.is_hot_lead := false;
    NEW.progress_status := 'new';
    NEW.cadence_state := NULL;
    NEW.cadence_step := 0;
    NEW.cadence_next_due_at := NULL;
    NEW.cadence_paused_until := NULL;
    NEW.assigned_rep_email := NULL;
    NEW.internal_notes := NULL;
    NEW.inspector_grade := NULL;
    NEW.decline_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';