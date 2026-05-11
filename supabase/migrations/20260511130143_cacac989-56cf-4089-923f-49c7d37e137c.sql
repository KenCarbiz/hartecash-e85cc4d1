DROP VIEW IF EXISTS public.v_dealership_privacy_posture;
DROP VIEW IF EXISTS public.v_bulk_access_anomalies;

CREATE OR REPLACE VIEW public.v_bulk_access_anomalies AS
WITH bursts AS (
  SELECT
    a.staff_user_id,
    a.staff_label,
    a.dealership_id,
    a.created_at AS window_start,
    count(DISTINCT a.submission_id) FILTER (
      WHERE a2.created_at BETWEEN a.created_at AND a.created_at + interval '60 minutes'
    ) AS distinct_in_window
  FROM customer_data_access_log a
  JOIN customer_data_access_log a2
    ON a2.staff_user_id = a.staff_user_id
   AND a2.dealership_id = a.dealership_id
  WHERE a.created_at >= now() - interval '14 days'
    AND a.staff_user_id IS NOT NULL
    AND a.submission_id IS NOT NULL
  GROUP BY a.staff_user_id, a.staff_label, a.dealership_id, a.created_at
)
SELECT
  staff_user_id,
  staff_label,
  dealership_id,
  window_start,
  distinct_in_window
FROM bursts
WHERE distinct_in_window >= 50
ORDER BY distinct_in_window DESC, window_start DESC
LIMIT 100;

GRANT SELECT ON public.v_bulk_access_anomalies TO authenticated;

CREATE OR REPLACE VIEW public.v_dealership_privacy_posture AS
SELECT
  prc.dealership_id,
  prc.voice_transcript_retention_days,
  prc.recording_url_retention_days,
  prc.customer_memory_retention_days,
  prc.notification_log_retention_days,
  (SELECT max(end_time) FROM cron.job_run_details
    WHERE jobid IN (SELECT jobid FROM cron.job
                    WHERE jobname = 'redact_old_voice_pii'))
    AS last_voice_redact_at,
  (SELECT max(end_time) FROM cron.job_run_details
    WHERE jobid IN (SELECT jobid FROM cron.job
                    WHERE jobname = 'redact_old_customer_memory'))
    AS last_memory_redact_at,
  (SELECT count(*) FROM customer_data_access_log
    WHERE dealership_id = prc.dealership_id
      AND created_at >= now() - interval '30 days')
    AS staff_pii_views_30d,
  (SELECT count(DISTINCT staff_user_id) FROM customer_data_access_log
    WHERE dealership_id = prc.dealership_id
      AND created_at >= now() - interval '30 days')
    AS distinct_staff_pii_viewers_30d,
  (SELECT count(*) FROM customer_data_request
    WHERE dealership_id = prc.dealership_id AND status = 'pending')
    AS pending_data_requests,
  (SELECT count(*) FROM customer_data_request
    WHERE dealership_id = prc.dealership_id AND status = 'fulfilled'
      AND fulfilled_at >= now() - interval '90 days')
    AS fulfilled_requests_90d,
  (SELECT count(*) FROM v_bulk_access_anomalies
    WHERE dealership_id = prc.dealership_id)
    AS bulk_access_anomalies_14d,
  (SELECT count(*) FROM opt_outs o
    JOIN submissions s ON s.id = o.submission_id
    WHERE s.dealership_id::text = prc.dealership_id)
    AS active_opt_outs,
  (SELECT min(created_at) FROM voice_call_log
    WHERE dealership_id::text = prc.dealership_id
      AND pii_redacted_at IS NULL
      AND transcript IS NOT NULL
      AND transcript NOT LIKE '[redacted%]')
    AS oldest_unredacted_call_at,
  prc.updated_at AS retention_config_updated_at
FROM pii_retention_config prc;

GRANT SELECT ON public.v_dealership_privacy_posture TO authenticated;

NOTIFY pgrst, 'reload schema';