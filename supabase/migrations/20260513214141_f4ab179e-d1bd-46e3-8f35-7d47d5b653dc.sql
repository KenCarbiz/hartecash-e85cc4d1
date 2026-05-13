
-- =========================================================================
-- Tighten cross-tenant RLS: require dealership scope on top of is_staff()
-- Idempotent: every CREATE is preceded by DROP POLICY IF EXISTS.
-- =========================================================================

-- ---------- bdc_call_tasks (no direct dealership_id; join via submissions) ----------
DROP POLICY IF EXISTS "Staff read bdc tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff read bdc tasks"
ON public.bdc_call_tasks FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = bdc_call_tasks.submission_id
      AND s.dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Staff update bdc tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff update bdc tasks"
ON public.bdc_call_tasks FOR UPDATE
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = bdc_call_tasks.submission_id
      AND s.dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = bdc_call_tasks.submission_id
      AND s.dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

-- ---------- cadence_log (join via submissions) ----------
DROP POLICY IF EXISTS "Staff can read cadence log" ON public.cadence_log;
CREATE POLICY "Staff can read cadence log"
ON public.cadence_log FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = cadence_log.submission_id
      AND s.dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

-- ---------- damage_reports (direct text dealership_id, NOT NULL) ----------
DROP POLICY IF EXISTS "Staff can view damage reports" ON public.damage_reports;
CREATE POLICY "Staff can view damage reports"
ON public.damage_reports FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND dealership_id = public.get_user_dealership_id(auth.uid())
);

DROP POLICY IF EXISTS "Staff can insert damage reports" ON public.damage_reports;
CREATE POLICY "Staff can insert damage reports"
ON public.damage_reports FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND dealership_id = public.get_user_dealership_id(auth.uid())
);

-- ---------- follow_ups (direct text dealership_id, NOT NULL) ----------
DROP POLICY IF EXISTS "Staff can read follow-ups" ON public.follow_ups;
CREATE POLICY "Staff can read follow-ups"
ON public.follow_ups FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND dealership_id = public.get_user_dealership_id(auth.uid())
);

DROP POLICY IF EXISTS "Staff can insert follow-ups" ON public.follow_ups;
CREATE POLICY "Staff can insert follow-ups"
ON public.follow_ups FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND dealership_id = public.get_user_dealership_id(auth.uid())
);

-- ---------- voice_call_log (uuid dealership_id, nullable) ----------
DROP POLICY IF EXISTS "Staff can view call log" ON public.voice_call_log;
CREATE POLICY "Staff can view call log"
ON public.voice_call_log FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND dealership_id IS NOT NULL
  AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
);

DROP POLICY IF EXISTS "Staff can insert call log" ON public.voice_call_log;
CREATE POLICY "Staff can insert call log"
ON public.voice_call_log FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND dealership_id IS NOT NULL
  AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
);

DROP POLICY IF EXISTS "Staff can update call log" ON public.voice_call_log;
CREATE POLICY "Staff can update call log"
ON public.voice_call_log FOR UPDATE
USING (
  public.is_staff(auth.uid())
  AND dealership_id IS NOT NULL
  AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND dealership_id IS NOT NULL
  AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
);

-- ---------- voice_pipeline_jobs (join via voice_call_log) ----------
DROP POLICY IF EXISTS "Staff read voice_pipeline_jobs" ON public.voice_pipeline_jobs;
CREATE POLICY "Staff read voice_pipeline_jobs"
ON public.voice_pipeline_jobs FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.voice_call_log vcl
    WHERE vcl.id = voice_pipeline_jobs.call_id
      AND vcl.dealership_id IS NOT NULL
      AND vcl.dealership_id = public.get_user_dealership_id(auth.uid())::uuid
  )
);

-- ---------- voice_grade_runs — lock to platform admin only ----------
DROP POLICY IF EXISTS "staff_read_voice_grade_runs" ON public.voice_grade_runs;
CREATE POLICY "staff_read_voice_grade_runs"
ON public.voice_grade_runs FOR SELECT
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "staff_write_voice_grade_runs" ON public.voice_grade_runs;
CREATE POLICY "staff_write_voice_grade_runs"
ON public.voice_grade_runs FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- ---------- voice_script_templates ----------
-- SELECT: staff see shared (NULL) templates plus their own dealership's
DROP POLICY IF EXISTS "Staff can read templates" ON public.voice_script_templates;
CREATE POLICY "Staff can read templates"
ON public.voice_script_templates FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND (
    dealership_id IS NULL
    OR dealership_id = public.get_user_dealership_id(auth.uid())::uuid
  )
);

-- ALL: platform admins manage everything; dealer admins only their own tenant's
-- non-NULL templates (cannot escalate into the shared library).
DROP POLICY IF EXISTS "Admin can manage templates" ON public.voice_script_templates;
CREATE POLICY "Admin can manage templates"
ON public.voice_script_templates FOR ALL
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id IS NOT NULL
    AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id IS NOT NULL
    AND dealership_id = public.get_user_dealership_id(auth.uid())::uuid
  )
);

-- ---------- profiles (join via user_roles to find target user's tenant) ----------
-- Self-access policies (Users can read/update/create own profile) and the
-- anon-deny policy are intentionally left untouched.
DROP POLICY IF EXISTS "Staff can read all profiles" ON public.profiles;
CREATE POLICY "Staff can read all profiles"
ON public.profiles FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
      AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Staff can update all profiles" ON public.profiles;
CREATE POLICY "Staff can update all profiles"
ON public.profiles FOR UPDATE
USING (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
      AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id
      AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
