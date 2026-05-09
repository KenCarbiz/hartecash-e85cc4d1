-- Compliance Tier 1 (adapted for current schema)

CREATE TABLE IF NOT EXISTS public.customer_data_purge_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid,
  contact_phone   text,
  contact_email   text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','done','failed')),
  storage_purged  boolean NOT NULL DEFAULT false,
  bland_purged    boolean NOT NULL DEFAULT false,
  attempt_count   integer NOT NULL DEFAULT 0,
  last_error      text,
  enqueued_at     timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS customer_data_purge_queue_pending_idx
  ON public.customer_data_purge_queue (enqueued_at) WHERE status = 'pending';

ALTER TABLE public.customer_data_purge_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access purge_queue" ON public.customer_data_purge_queue;
CREATE POLICY "Service role full access purge_queue"
  ON public.customer_data_purge_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read own tenant purge_queue" ON public.customer_data_purge_queue;
CREATE POLICY "Admins read own tenant purge_queue"
  ON public.customer_data_purge_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.purge_customer_data(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _req record;
  _sub_count int := 0; _call_count int := 0; _appt_count int := 0;
  _consent_count int := 0; _notif_count int := 0;
  _sub_ids uuid[];
BEGIN
  SELECT id, dealership_id, contact_phone, contact_email, kind, status, expires_at
    INTO _req FROM customer_data_request WHERE request_token = _token;

  IF _req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token'); END IF;
  IF _req.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_processed'); END IF;
  IF _req.expires_at < now() THEN
    UPDATE customer_data_request SET status = 'expired' WHERE id = _req.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _req.kind != 'delete' THEN RETURN jsonb_build_object('ok', false, 'reason', 'wrong_kind'); END IF;

  SELECT array_agg(id) INTO _sub_ids FROM submissions
  WHERE (_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
     OR (_req.contact_email IS NOT NULL AND email = _req.contact_email);
  IF _sub_ids IS NULL THEN _sub_ids := ARRAY[]::uuid[]; END IF;

  UPDATE submissions
  SET name = '[purged]', phone = NULL, email = NULL, vin = '[purged]',
      customer_memory = '[]'::jsonb, decline_reason = NULL
  WHERE id = ANY(_sub_ids);
  GET DIAGNOSTICS _sub_count = ROW_COUNT;

  UPDATE voice_call_log
  SET customer_name = '[purged]', phone_number = '[purged]',
      transcript = '[purged per customer request]', summary = NULL,
      recording_url = NULL, pii_redacted_at = now()
  WHERE submission_id = ANY(_sub_ids);
  GET DIAGNOSTICS _call_count = ROW_COUNT;

  UPDATE voice_call_turns SET text = '[purged]'
  WHERE call_id IN (SELECT id FROM voice_call_log WHERE submission_id = ANY(_sub_ids));

  UPDATE voice_call_grades SET rationale = '[purged]'
  WHERE call_id IN (SELECT id FROM voice_call_log WHERE submission_id = ANY(_sub_ids));

  UPDATE appointments
  SET customer_name = '[purged]', customer_email = '[purged]',
      customer_phone = '[purged]', notes = NULL
  WHERE (_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
     OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email);
  GET DIAGNOSTICS _appt_count = ROW_COUNT;

  UPDATE consent_log
  SET customer_name = '[purged]', customer_phone = NULL, customer_email = NULL,
      ip_address = NULL, user_agent = NULL
  WHERE (_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
     OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email);
  GET DIAGNOSTICS _consent_count = ROW_COUNT;

  UPDATE notification_log SET recipient = '[purged]', error_message = NULL
  WHERE submission_id = ANY(_sub_ids);
  GET DIAGNOSTICS _notif_count = ROW_COUNT;

  INSERT INTO customer_data_purge_queue (submission_id, contact_phone, contact_email)
  SELECT id, _req.contact_phone, _req.contact_email FROM unnest(_sub_ids) AS id;

  UPDATE customer_data_request SET status = 'fulfilled', fulfilled_at = now() WHERE id = _req.id;

  RETURN jsonb_build_object(
    'ok', true,
    'submissions_purged', _sub_count,
    'calls_purged', _call_count,
    'appointments_purged', _appt_count,
    'consent_records_purged', _consent_count,
    'notifications_purged', _notif_count,
    'storage_purge_queued', array_length(_sub_ids, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_customer_data(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.export_customer_data(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _req record; _result jsonb;
BEGIN
  SELECT id, dealership_id, contact_phone, contact_email, kind, status, expires_at
    INTO _req FROM customer_data_request WHERE request_token = _token;

  IF _req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token'); END IF;
  IF _req.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_processed'); END IF;
  IF _req.expires_at < now() THEN
    UPDATE customer_data_request SET status = 'expired' WHERE id = _req.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF _req.kind != 'export' THEN RETURN jsonb_build_object('ok', false, 'reason', 'wrong_kind'); END IF;

  WITH subs AS (
    SELECT * FROM submissions
    WHERE (_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
       OR (_req.contact_email IS NOT NULL AND email = _req.contact_email)
  ),
  sub_ids AS (SELECT id, token FROM subs),
  calls AS (
    SELECT vcl.id, vcl.started_at, vcl.duration_seconds, vcl.outcome,
           vcl.feedback_score, vcl.feedback_comment, vcl.feedback_captured_at,
           vcl.transcript, vcl.summary
    FROM voice_call_log vcl WHERE vcl.submission_id IN (SELECT id FROM sub_ids)
  ),
  call_grades AS (
    SELECT vcg.call_id, vcg.composite_score, vcg.gating_failed,
           vcg.dim_compliance, vcg.rationale
    FROM voice_call_grades vcg WHERE vcg.call_id IN (SELECT id FROM calls)
  ),
  call_turns AS (
    SELECT vct.call_id, vct.turn_index, vct.speaker, vct.text,
           vct.sentiment, vct.start_ms, vct.end_ms
    FROM voice_call_turns vct WHERE vct.call_id IN (SELECT id FROM calls)
  ),
  appts AS (
    SELECT * FROM appointments
    WHERE (_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
       OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email)
  ),
  consents AS (
    SELECT created_at, consent_type, consent_text, form_source FROM consent_log
    WHERE (_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
       OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email)
  ),
  notes AS (
    SELECT created_at, channel, trigger_key, status, recipient, error_message
    FROM notification_log WHERE submission_id IN (SELECT id FROM sub_ids)
  )
  SELECT jsonb_build_object(
    'ok', true, 'exported_at', now(),
    'submissions',  COALESCE(jsonb_agg(DISTINCT to_jsonb(subs.*)) FILTER (WHERE subs.id IS NOT NULL), '[]'::jsonb),
    'voice_calls',  (SELECT COALESCE(jsonb_agg(to_jsonb(calls.*)), '[]'::jsonb) FROM calls),
    'voice_call_grades', (SELECT COALESCE(jsonb_agg(to_jsonb(call_grades.*)), '[]'::jsonb) FROM call_grades),
    'voice_call_turns',  (SELECT COALESCE(jsonb_agg(to_jsonb(call_turns.*) ORDER BY call_turns.turn_index), '[]'::jsonb) FROM call_turns),
    'appointments', (SELECT COALESCE(jsonb_agg(to_jsonb(appts.*)), '[]'::jsonb) FROM appts),
    'consent_records', (SELECT COALESCE(jsonb_agg(to_jsonb(consents.*)), '[]'::jsonb) FROM consents),
    'notifications',(SELECT COALESCE(jsonb_agg(to_jsonb(notes.*)), '[]'::jsonb) FROM notes),
    'note', 'Storage objects (driver''s license, title docs, photos) are not included in this JSON. Reply to the original SMS to request a separate signed-link export.'
  ) INTO _result FROM subs;

  UPDATE customer_data_request SET status = 'fulfilled', fulfilled_at = now() WHERE id = _req.id;
  RETURN COALESCE(_result, jsonb_build_object('ok', true, 'submissions', '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_customer_data(uuid) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.security_incident (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   text,
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status          text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','contained','notified','closed','dismissed')),
  detected_via    text NOT NULL CHECK (detected_via IN (
                    'bulk_access_anomaly','staff_report','vendor_breach',
                    'customer_complaint','scheduled_audit','external_disclosure'
                  )),
  discovered_at   timestamptz NOT NULL DEFAULT now(),
  notification_due_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  summary         text NOT NULL,
  affected_record_count integer,
  affected_data_categories text[],
  staff_user_ids  uuid[],
  related_anomaly_window timestamptz,
  notes           text,
  contained_at    timestamptz,
  customers_notified_at timestamptz,
  closed_at       timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_incident_dealer_idx
  ON public.security_incident (dealership_id, discovered_at DESC);
CREATE INDEX IF NOT EXISTS security_incident_open_idx
  ON public.security_incident (notification_due_at)
  WHERE status NOT IN ('closed','dismissed');

ALTER TABLE public.security_incident ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access security_incident" ON public.security_incident;
CREATE POLICY "Service role full access security_incident"
  ON public.security_incident FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage own tenant security_incident" ON public.security_incident;
CREATE POLICY "Admins manage own tenant security_incident"
  ON public.security_incident FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (dealership_id IS NULL OR dealership_id = public.get_user_dealership_id(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (dealership_id IS NULL OR dealership_id = public.get_user_dealership_id(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.register_security_incident(
  _summary text, _detected_via text, _severity text DEFAULT 'medium',
  _affected_count integer DEFAULT NULL, _categories text[] DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _dealer text; _id uuid;
BEGIN
  IF _uid IS NULL OR NOT public.is_staff(_uid) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT dealership_id INTO _dealer FROM user_roles WHERE user_id = _uid LIMIT 1;

  INSERT INTO security_incident
    (dealership_id, severity, detected_via, summary,
     affected_record_count, affected_data_categories, notes, created_by)
  VALUES (_dealer::text, _severity, _detected_via, _summary,
          _affected_count, _categories, _notes, _uid)
  RETURNING id INTO _id;

  INSERT INTO error_log (source, severity, message, dealership_id, context)
  VALUES (
    'security_incident', 'fatal',
    'Security incident registered: ' || left(_summary, 240),
    _dealer::text,
    jsonb_build_object('incident_id', _id, 'detected_via', _detected_via)
  );

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_security_incident(text, text, text, integer, text[], text)
  TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_config_dealership_name_not_placeholder'
      AND conrelid = 'public.site_config'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.site_config
        ADD CONSTRAINT site_config_dealership_name_not_placeholder
        CHECK (dealership_name IS NULL
               OR lower(trim(dealership_name)) NOT IN ('our dealership','dealership','default','tbd','your dealership'))
        NOT VALID;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';