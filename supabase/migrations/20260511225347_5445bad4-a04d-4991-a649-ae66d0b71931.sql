CREATE OR REPLACE FUNCTION public.current_user_dealership_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT dealership_id) FILTER (WHERE dealership_id IS NOT NULL),
    ARRAY[]::text[]
  ) FROM public.user_roles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_dealership_ids() TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff read voice_call_turns" ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns" ON public.voice_call_turns FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.voice_call_log vcl
  WHERE vcl.id = voice_call_turns.call_id
    AND vcl.dealership_id::text = ANY(public.current_user_dealership_ids())));

DROP POLICY IF EXISTS "Staff read voice_call_grades" ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades" ON public.voice_call_grades FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.voice_call_log vcl
  WHERE vcl.id = voice_call_grades.call_id
    AND vcl.dealership_id::text = ANY(public.current_user_dealership_ids())));

DROP POLICY IF EXISTS "Staff read voice_call_variants_used" ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used" ON public.voice_call_variants_used FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.voice_call_log vcl
  WHERE vcl.id = voice_call_variants_used.call_id
    AND vcl.dealership_id::text = ANY(public.current_user_dealership_ids())));

DROP VIEW IF EXISTS public.v_dealership_privacy_posture CASCADE;
DROP VIEW IF EXISTS public.v_bulk_access_anomalies CASCADE;

CREATE VIEW public.v_bulk_access_anomalies AS
WITH base AS (
  SELECT staff_user_id, staff_label, dealership_id, submission_id, created_at
  FROM public.customer_data_access_log
  WHERE created_at >= now() - interval '14 days'
    AND staff_user_id IS NOT NULL AND submission_id IS NOT NULL
),
sliding AS (
  SELECT a.staff_user_id, a.staff_label, a.dealership_id, a.created_at AS window_start,
    (SELECT count(DISTINCT b.submission_id) FROM base b
     WHERE b.staff_user_id = a.staff_user_id AND b.dealership_id = a.dealership_id
       AND b.created_at BETWEEN a.created_at AND a.created_at + interval '60 minutes') AS distinct_in_window
  FROM base a
)
SELECT staff_user_id, staff_label, dealership_id, window_start, distinct_in_window
FROM sliding WHERE distinct_in_window >= 50
ORDER BY distinct_in_window DESC, window_start DESC LIMIT 100;
GRANT SELECT ON public.v_bulk_access_anomalies TO authenticated;

CREATE TABLE IF NOT EXISTS public.dealership_privacy_posture_snapshot (
  dealership_id text PRIMARY KEY,
  voice_transcript_retention_days integer,
  recording_url_retention_days integer,
  customer_memory_retention_days integer,
  notification_log_retention_days integer,
  last_voice_redact_at timestamptz,
  last_memory_redact_at timestamptz,
  staff_pii_views_30d integer,
  distinct_staff_pii_viewers_30d integer,
  pending_data_requests integer,
  fulfilled_requests_90d integer,
  bulk_access_anomalies_14d integer,
  active_opt_outs integer,
  oldest_unredacted_call_at timestamptz,
  retention_config_updated_at timestamptz,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dealership_privacy_posture_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access posture snapshot" ON public.dealership_privacy_posture_snapshot;
CREATE POLICY "Service role full access posture snapshot" ON public.dealership_privacy_posture_snapshot
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read own tenant posture snapshot" ON public.dealership_privacy_posture_snapshot;
CREATE POLICY "Staff read own tenant posture snapshot" ON public.dealership_privacy_posture_snapshot
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.refresh_dealership_privacy_posture()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $$
BEGIN
  DELETE FROM dealership_privacy_posture_snapshot;
  INSERT INTO dealership_privacy_posture_snapshot
    (dealership_id, voice_transcript_retention_days, recording_url_retention_days,
     customer_memory_retention_days, notification_log_retention_days,
     last_voice_redact_at, last_memory_redact_at, staff_pii_views_30d,
     distinct_staff_pii_viewers_30d, pending_data_requests, fulfilled_requests_90d,
     bulk_access_anomalies_14d, active_opt_outs, oldest_unredacted_call_at,
     retention_config_updated_at, snapshot_at)
  SELECT prc.dealership_id,
    prc.voice_transcript_retention_days, prc.recording_url_retention_days,
    prc.customer_memory_retention_days, prc.notification_log_retention_days,
    (SELECT max(end_time) FROM cron.job_run_details
      WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'redact_old_voice_pii')),
    (SELECT max(end_time) FROM cron.job_run_details
      WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'redact_old_customer_memory')),
    (SELECT count(*) FROM customer_data_access_log
      WHERE dealership_id = prc.dealership_id AND created_at >= now() - interval '30 days'),
    (SELECT count(DISTINCT staff_user_id) FROM customer_data_access_log
      WHERE dealership_id = prc.dealership_id AND created_at >= now() - interval '30 days'),
    (SELECT count(*) FROM customer_data_request
      WHERE dealership_id = prc.dealership_id AND status = 'pending'),
    (SELECT count(*) FROM customer_data_request
      WHERE dealership_id = prc.dealership_id AND status = 'fulfilled'
        AND fulfilled_at >= now() - interval '90 days'),
    (SELECT count(*) FROM v_bulk_access_anomalies
      WHERE dealership_id = prc.dealership_id),
    (SELECT count(*) FROM opt_outs o JOIN submissions s ON s.id = o.submission_id
      WHERE s.dealership_id = prc.dealership_id),
    (SELECT min(created_at) FROM voice_call_log
      WHERE dealership_id::text = prc.dealership_id AND pii_redacted_at IS NULL
        AND transcript IS NOT NULL AND transcript NOT LIKE '[redacted%]'),
    prc.updated_at, now()
  FROM pii_retention_config prc;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_dealership_privacy_posture() TO service_role;

CREATE VIEW public.v_dealership_privacy_posture AS
SELECT * FROM public.dealership_privacy_posture_snapshot;
GRANT SELECT ON public.v_dealership_privacy_posture TO authenticated;

SELECT cron.unschedule('refresh_dealership_privacy_posture')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_dealership_privacy_posture');
SELECT cron.schedule('refresh_dealership_privacy_posture', '45 4 * * *',
  $$ SELECT public.refresh_dealership_privacy_posture() $$);

SELECT public.refresh_dealership_privacy_posture();

NOTIFY pgrst, 'reload schema';