-- ── 1. request_customer_data_action ──
CREATE OR REPLACE FUNCTION public.request_customer_data_action(
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _kind  text DEFAULT 'export',
  _dealership_id text DEFAULT NULL
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

  IF _dealership_id IS NOT NULL AND length(trim(_dealership_id)) > 0 THEN
    SELECT dealership_id::text INTO _dealer
    FROM submissions
    WHERE ((_phone IS NOT NULL AND phone = _phone)
        OR (_email IS NOT NULL AND email = _email))
      AND dealership_id::text = _dealership_id
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT dealership_id::text INTO _dealer
    FROM submissions
    WHERE (_phone IS NOT NULL AND phone = _phone)
       OR (_email IS NOT NULL AND email = _email)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF _dealer IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'submitted', true);
  END IF;

  INSERT INTO customer_data_request
    (dealership_id, contact_phone, contact_email, kind)
  VALUES
    (_dealer, _phone, _email, _kind)
  RETURNING request_token INTO _token;

  RETURN jsonb_build_object('ok', true, 'submitted', true, 'request_token', _token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_customer_data_action(text, text, text, text)
  TO anon, authenticated, service_role;

-- ── 2. purge_customer_data ──
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
  _sub_count   int := 0;
  _call_count  int := 0;
  _appt_count  int := 0;
  _consent_count int := 0;
  _notif_count int := 0;
  _sub_ids     uuid[];
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

  SELECT array_agg(id) INTO _sub_ids
  FROM submissions
  WHERE ((_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
      OR (_req.contact_email IS NOT NULL AND email = _req.contact_email))
    AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id);

  IF _sub_ids IS NULL THEN
    _sub_ids := ARRAY[]::uuid[];
  END IF;

  UPDATE submissions
  SET name             = '[purged]',
      phone            = NULL,
      email            = NULL,
      vin              = '[purged]',
      customer_memory  = '[]'::jsonb,
      declined_reason  = NULL,
      competitor_mentioned = NULL,
      customer_walk_away_number = NULL
  WHERE id = ANY(_sub_ids);
  GET DIAGNOSTICS _sub_count = ROW_COUNT;

  UPDATE voice_call_log
  SET customer_name    = '[purged]',
      phone_number     = '[purged]',
      transcript       = '[purged per customer request]',
      summary          = NULL,
      recording_url    = NULL,
      pii_redacted_at  = now()
  WHERE submission_id = ANY(_sub_ids);
  GET DIAGNOSTICS _call_count = ROW_COUNT;

  UPDATE voice_call_turns
  SET text = '[purged]', pii_redacted_at = now()
  WHERE call_id IN (SELECT id FROM voice_call_log WHERE submission_id = ANY(_sub_ids));

  UPDATE voice_call_grades
  SET rationale = '[purged]', pii_redacted_at = now()
  WHERE call_id IN (SELECT id FROM voice_call_log WHERE submission_id = ANY(_sub_ids));

  UPDATE appointments
  SET customer_name  = '[purged]',
      customer_email = '[purged]',
      customer_phone = '[purged]',
      notes          = NULL
  WHERE ((_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
      OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email))
    AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id);
  GET DIAGNOSTICS _appt_count = ROW_COUNT;

  UPDATE consent_log
  SET customer_name  = '[purged]',
      customer_phone = NULL,
      customer_email = NULL,
      ip_address     = NULL,
      user_agent     = NULL
  WHERE ((_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
      OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email))
    AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id);
  GET DIAGNOSTICS _consent_count = ROW_COUNT;

  UPDATE notification_log
  SET recipient = '[purged]', error_message = NULL
  WHERE submission_id = ANY(_sub_ids);
  GET DIAGNOSTICS _notif_count = ROW_COUNT;

  INSERT INTO customer_data_purge_queue
    (submission_id, contact_phone, contact_email)
  SELECT id, _req.contact_phone, _req.contact_email
  FROM unnest(_sub_ids) AS id;

  UPDATE customer_data_request
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE id = _req.id;

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

GRANT EXECUTE ON FUNCTION public.purge_customer_data(uuid)
  TO anon, authenticated, service_role;

-- ── 3. export_customer_data ──
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

  SELECT jsonb_build_object(
    'submissions', COALESCE(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb)
  ) INTO _result
  FROM submissions s
  WHERE ((_req.contact_phone IS NOT NULL AND s.phone = _req.contact_phone)
      OR (_req.contact_email IS NOT NULL AND s.email = _req.contact_email))
    AND (_req.dealership_id IS NULL OR s.dealership_id::text = _req.dealership_id);

  UPDATE customer_data_request
  SET status = 'fulfilled', fulfilled_at = now()
  WHERE id = _req.id;

  RETURN jsonb_build_object('ok', true) || _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_customer_data(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';