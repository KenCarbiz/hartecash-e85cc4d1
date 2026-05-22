
-- ===== ocr_jobs: token-gated access ============================

DROP POLICY IF EXISTS ocr_jobs_select_all ON public.ocr_jobs;
DROP POLICY IF EXISTS ocr_jobs_insert_all ON public.ocr_jobs;
DROP POLICY IF EXISTS ocr_jobs_update_all ON public.ocr_jobs;

-- Staff can read OCR jobs for submissions in their own tenant.
CREATE POLICY ocr_jobs_staff_read
  ON public.ocr_jobs FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- All writes routed through service-role / SECURITY DEFINER RPCs.
CREATE POLICY ocr_jobs_service_write
  ON public.ocr_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Token-gated read: returns minimal status fields for the customer
-- portal's live OCR progress display. Never returns the `result`
-- JSONB (driver-license/title PII) to anonymous callers.
CREATE OR REPLACE FUNCTION public.ocr_jobs_for_token(p_token text)
RETURNS TABLE (
  id uuid,
  doc_id text,
  status text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.doc_id, j.status, j.error_message, j.created_at, j.updated_at
  FROM public.ocr_jobs j
  WHERE j.submission_token = p_token
    AND p_token IS NOT NULL
    AND p_token <> ''
    AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.token = p_token)
  ORDER BY j.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.ocr_jobs_for_token(text) TO anon, authenticated;

-- Token-gated upsert: insert a queued OCR job or update an existing one
-- (status / error). Validates the token maps to a real submission.
CREATE OR REPLACE FUNCTION public.ocr_jobs_upsert_for_token(
  p_token text,
  p_doc_id text,
  p_pipeline text,
  p_storage_bucket text,
  p_storage_path text,
  p_status text,
  p_error text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id uuid;
  v_dealership_id text;
  v_job_id uuid;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'submission token required';
  END IF;

  SELECT id, dealership_id INTO v_submission_id, v_dealership_id
  FROM public.submissions WHERE token = p_token;
  IF v_submission_id IS NULL THEN
    RAISE EXCEPTION 'invalid submission token';
  END IF;

  IF p_status NOT IN ('queued','running','completed','failed') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  IF p_job_id IS NOT NULL THEN
    UPDATE public.ocr_jobs
       SET status = p_status,
           error_message = COALESCE(p_error, error_message),
           updated_at = now()
     WHERE id = p_job_id AND submission_token = p_token
     RETURNING id INTO v_job_id;
    IF v_job_id IS NULL THEN
      RAISE EXCEPTION 'job not found or token mismatch';
    END IF;
    RETURN v_job_id;
  END IF;

  INSERT INTO public.ocr_jobs (
    submission_id, submission_token, dealership_id,
    doc_id, pipeline, storage_bucket, storage_path, status, error_message
  ) VALUES (
    v_submission_id, p_token, v_dealership_id,
    p_doc_id, p_pipeline, p_storage_bucket, p_storage_path, p_status, p_error
  ) RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ocr_jobs_upsert_for_token(text,text,text,text,text,text,text,uuid) TO anon, authenticated;

-- ===== watched_vehicles: token-gated access ====================

DROP POLICY IF EXISTS "Anyone can read watched vehicle by token" ON public.watched_vehicles;
DROP POLICY IF EXISTS "Anyone can update watched vehicle by token" ON public.watched_vehicles;
-- Keep "Anyone can insert watched vehicle" — public form entry point.

CREATE OR REPLACE FUNCTION public.watched_vehicle_get(p_token text)
RETURNS SETOF public.watched_vehicles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.watched_vehicles
  WHERE token = p_token AND p_token IS NOT NULL AND p_token <> '';
$$;
GRANT EXECUTE ON FUNCTION public.watched_vehicle_get(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.watched_vehicle_history_for_token(p_token text)
RETURNS TABLE (
  id uuid,
  snapshot_value numeric,
  delta_from_previous numeric,
  checked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.snapshot_value, h.delta_from_previous, h.checked_at
  FROM public.watched_vehicle_history h
  JOIN public.watched_vehicles w ON w.id = h.watched_vehicle_id
  WHERE w.token = p_token AND p_token IS NOT NULL AND p_token <> ''
  ORDER BY h.checked_at DESC
  LIMIT 24;
$$;
GRANT EXECUTE ON FUNCTION public.watched_vehicle_history_for_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.watched_vehicle_update_pref(
  p_token text,
  p_field text,
  p_value boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN ('notify_email','notify_sms','is_active') THEN
    RAISE EXCEPTION 'field not allowed: %', p_field;
  END IF;
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'token required';
  END IF;
  EXECUTE format(
    'UPDATE public.watched_vehicles SET %I = $1, updated_at = now() WHERE token = $2',
    p_field
  ) USING p_value, p_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.watched_vehicle_update_pref(text,text,boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
