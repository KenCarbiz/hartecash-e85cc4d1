CREATE TABLE IF NOT EXISTS public.customer_data_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_token   uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  dealership_id   text,
  contact_phone   text,
  contact_email   text,
  kind            text NOT NULL CHECK (kind IN ('export', 'delete')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'fulfilled', 'expired', 'denied')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  fulfilled_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS customer_data_request_token_idx
  ON public.customer_data_request (request_token);
CREATE INDEX IF NOT EXISTS customer_data_request_dealer_idx
  ON public.customer_data_request (dealership_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_request_phone_idx
  ON public.customer_data_request (contact_phone);

ALTER TABLE public.customer_data_request ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access cdr" ON public.customer_data_request;
CREATE POLICY "Service role full access cdr"
  ON public.customer_data_request FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read own tenant cdr" ON public.customer_data_request;
CREATE POLICY "Admins read own tenant cdr"
  ON public.customer_data_request FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.request_customer_data_action(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _kind  text DEFAULT 'export'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dealer text;
  _token  uuid;
BEGIN
  IF _kind NOT IN ('export', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  IF (_phone IS NULL OR length(trim(_phone)) = 0)
     AND (_email IS NULL OR length(trim(_email)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contact');
  END IF;

  SELECT dealership_id::text INTO _dealer
  FROM submissions
  WHERE (_phone IS NOT NULL AND phone = _phone)
     OR (_email IS NOT NULL AND email = _email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF _dealer IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'submitted', true);
  END IF;

  INSERT INTO customer_data_request
    (dealership_id, contact_phone, contact_email, kind)
  VALUES
    (_dealer, _phone, _email, _kind)
  RETURNING request_token INTO _token;

  RETURN jsonb_build_object(
    'ok', true,
    'submitted', true,
    'request_token', _token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_customer_data_action(text, text, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.export_customer_data(
  _token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req     record;
  _result  jsonb;
BEGIN
  SELECT id, dealership_id, contact_phone, contact_email,
         kind, status, expires_at
    INTO _req
  FROM customer_data_request
  WHERE request_token = _token;

  IF _req.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  IF _req.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;
  IF _req.expires_at < now() THEN
    UPDATE customer_data_request SET status = 'expired' WHERE id = _req.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _req.kind != 'export' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_kind');
  END IF;

  WITH subs AS (
    SELECT * FROM submissions
    WHERE (_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
       OR (_req.contact_email IS NOT NULL AND email = _req.contact_email)
  ),
  calls AS (
    SELECT vcl.id, vcl.started_at, vcl.duration_seconds, vcl.outcome,
           vcl.feedback_score, vcl.feedback_comment,
           vcl.transcript, vcl.summary
    FROM voice_call_log vcl
    WHERE vcl.submission_id IN (SELECT id FROM subs)
  ),
  notes AS (
    SELECT created_at, channel, trigger_key, status, recipient
    FROM notification_log
    WHERE submission_id IN (SELECT id FROM subs)
  )
  SELECT jsonb_build_object(
    'ok', true,
    'exported_at', now(),
    'submissions', COALESCE(jsonb_agg(DISTINCT to_jsonb(subs.*))
                            FILTER (WHERE subs.id IS NOT NULL), '[]'::jsonb),
    'voice_calls', (SELECT COALESCE(jsonb_agg(to_jsonb(calls.*)), '[]'::jsonb) FROM calls),
    'notifications', (SELECT COALESCE(jsonb_agg(to_jsonb(notes.*)), '[]'::jsonb) FROM notes)
  ) INTO _result
  FROM subs;

  UPDATE customer_data_request
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE id = _req.id;

  RETURN COALESCE(_result, jsonb_build_object('ok', true, 'submissions', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_customer_data(uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.purge_customer_data(
  _token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req     record;
  _sub_count int := 0;
  _call_count int := 0;
BEGIN
  SELECT id, dealership_id, contact_phone, contact_email,
         kind, status, expires_at
    INTO _req
  FROM customer_data_request
  WHERE request_token = _token;

  IF _req.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  IF _req.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;
  IF _req.expires_at < now() THEN
    UPDATE customer_data_request SET status = 'expired' WHERE id = _req.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _req.kind != 'delete' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_kind');
  END IF;

  WITH targets AS (
    SELECT id FROM submissions
    WHERE (_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
       OR (_req.contact_email IS NOT NULL AND email = _req.contact_email)
  )
  UPDATE submissions s
  SET name             = '[purged]',
      phone            = NULL,
      email            = NULL,
      vin              = '[purged]',
      customer_memory  = '[]'::jsonb,
      declined_reason  = NULL,
      competitor_mentioned = NULL,
      customer_walk_away_number = NULL
  FROM targets t
  WHERE s.id = t.id;
  GET DIAGNOSTICS _sub_count = ROW_COUNT;

  UPDATE voice_call_log
  SET customer_name    = '[purged]',
      phone_number     = '[purged]',
      transcript       = '[purged per customer request]',
      summary          = NULL,
      recording_url    = NULL,
      pii_redacted_at  = now()
  WHERE submission_id IN (
    SELECT id FROM submissions
    WHERE name = '[purged]'
      AND phone IS NULL
  );
  GET DIAGNOSTICS _call_count = ROW_COUNT;

  UPDATE voice_call_turns
  SET text = '[purged]', pii_redacted_at = now()
  WHERE call_id IN (
    SELECT id FROM voice_call_log WHERE transcript = '[purged per customer request]'
  );

  UPDATE notification_log
  SET recipient = '[purged]', error_message = NULL
  WHERE submission_id IN (
    SELECT id FROM submissions
    WHERE name = '[purged]' AND phone IS NULL
  );

  UPDATE customer_data_request
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE id = _req.id;

  RETURN jsonb_build_object(
    'ok', true,
    'submissions_purged', _sub_count,
    'calls_purged', _call_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_customer_data(uuid)
  TO anon, authenticated, service_role;

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
    WHERE o.submission_id IN (
      SELECT s.id FROM submissions s
      WHERE s.dealership_id::text = prc.dealership_id
    ))
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