
-- 1. analytics_events: tighten anon insert
DROP POLICY IF EXISTS "Anyone can insert analytics_events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics_events"
ON public.analytics_events
FOR INSERT
TO public
WITH CHECK (
  dealership_id IS NULL
  OR dealership_id = 'default'
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.dealership_id = analytics_events.dealership_id)
);

-- 2. consent_log: require valid submission token OR staff
DROP POLICY IF EXISTS "Anyone can create consent records" ON public.consent_log;
CREATE POLICY "Anyone can create consent records"
ON public.consent_log
FOR INSERT
TO public
WITH CHECK (
  (submission_token IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.token = consent_log.submission_token))
  OR is_platform_admin(auth.uid())
  OR is_staff(auth.uid())
);

-- 3. embed_events: tighten anon insert
DROP POLICY IF EXISTS "embed_events_service_write" ON public.embed_events;
CREATE POLICY "embed_events_anon_insert"
ON public.embed_events
FOR INSERT
TO public
WITH CHECK (
  dealership_id IS NULL
  OR dealership_id = 'default'
  OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.dealership_id = embed_events.dealership_id)
);

-- 4. ocr_jobs: only service role writes (drop public ALL policy)
DROP POLICY IF EXISTS "ocr_jobs_service_write" ON public.ocr_jobs;
CREATE POLICY "ocr_jobs_service_write"
ON public.ocr_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. submissions: trigger to scrub sensitive fields on anon insert
CREATE OR REPLACE FUNCTION public.scrub_anon_submission_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For inserts by unauthenticated users, prevent setting privileged columns.
  IF auth.uid() IS NULL THEN
    NEW.offered_price := NULL;
    NEW.is_hot_lead := false;
    NEW.progress_status := 'new';
    NEW.assigned_rep_email := NULL;
    -- Force default PIN generation (random 4-digit)
    NEW.inspection_pin := lpad((floor((random() * 10000)))::text, 4, '0');
    -- Disallow arbitrary tenant assignment: if not a known tenant, force 'default'
    IF NEW.dealership_id IS NULL
       OR NEW.dealership_id = 'default'
       OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.dealership_id = NEW.dealership_id) THEN
      NEW.dealership_id := 'default';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_anon_submission_insert_trg ON public.submissions;
CREATE TRIGGER scrub_anon_submission_insert_trg
BEFORE INSERT ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.scrub_anon_submission_insert();

-- 6. watched_vehicles: require token match
DROP POLICY IF EXISTS "watched_vehicles_insert_with_valid_submission" ON public.watched_vehicles;
CREATE POLICY "watched_vehicles_insert_with_valid_token"
ON public.watched_vehicles
FOR INSERT
TO public
WITH CHECK (
  submission_id IS NOT NULL
  AND token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = watched_vehicles.submission_id
      AND s.token = watched_vehicles.token
  )
);

-- 7. profiles: hide manager_pin_hash from app users
REVOKE SELECT (manager_pin_hash) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (manager_pin_hash) ON public.profiles FROM authenticated, anon;

-- 8. testimonials: scope staff read to own tenant
DROP POLICY IF EXISTS "Staff can read all testimonials" ON public.testimonials;
CREATE POLICY "Staff can read tenant testimonials"
ON public.testimonials
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

NOTIFY pgrst, 'reload schema';
