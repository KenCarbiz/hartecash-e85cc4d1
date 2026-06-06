-- Tenant-scope the customer data-rights RPCs.
--
-- Problem this closes: export_customer_data / purge_customer_data matched the
-- customer's rows by phone/email across ALL dealerships, and
-- request_customer_data_action picked "the most recent" tenant. So a request
-- raised from Tenant A's /my-data-rights page could export (revealing) or
-- delete Tenant B's records for the same phone. We now thread the ORIGINATING
-- dealership_id through and scope every match to it.
--
-- request_customer_data_action gains an optional _dealership_id. When provided
-- (the self-service-data-action edge function passes the tenant the customer
-- is on), the request is scoped to that dealership and only opens if the
-- customer actually has a submission there. When NULL, behavior is unchanged
-- (back-compat for any other caller) — it falls back to the most-recent tenant.
-- export/purge scope every table match to the request's dealership_id when set.
--
-- Idempotent (CREATE OR REPLACE).

-- ── 1. request_customer_data_action(_phone, _email, _kind, _dealership_id) ──
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

  -- Resolve the dealership scope. If the caller passed a dealership, only open
  -- a request when the contact actually has a submission AT that dealership
  -- (scopes the whole action to one tenant). Otherwise fall back to the most
  -- recent submission's tenant (back-compat).
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
    -- Don't reveal whether we have data; return a fake-positive envelope with
    -- no token (downstream skips when no legit submission exists).
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

-- ── 2. purge_customer_data — scope every match to _req.dealership_id ────────
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

  -- Target submissions, scoped to the request's dealership when set.
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

  -- appointments / consent_log are matched by phone/email directly; scope to
  -- the request's dealership too.
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

-- ── 3. export_customer_data — scope every match to _req.dealership_id ───────
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
    WHERE ((_req.contact_phone IS NOT NULL AND phone = _req.contact_phone)
        OR (_req.contact_email IS NOT NULL AND email = _req.contact_email))
      AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id)
  ),
  sub_ids AS (
    SELECT id, token FROM subs
  ),
  calls AS (
    SELECT vcl.id, vcl.started_at, vcl.duration_seconds, vcl.outcome,
           vcl.feedback_score, vcl.feedback_comment, vcl.feedback_captured_at,
           vcl.transcript, vcl.summary
    FROM voice_call_log vcl
    WHERE vcl.submission_id IN (SELECT id FROM sub_ids)
  ),
  call_grades AS (
    SELECT vcg.call_id, vcg.composite_score, vcg.gating_failed,
           vcg.dim_compliance, vcg.dim_vehicle_confirm,
           vcg.dim_motivation_disco, vcg.dim_quote_band,
           vcg.dim_objection_handle, vcg.dim_close_control,
           vcg.dim_transfer_hygiene, vcg.dim_pacing,
           vcg.dim_hallucination, vcg.dim_brand_tone,
           vcg.rationale, vcg.created_at
    FROM voice_call_grades vcg
    WHERE vcg.call_id IN (SELECT id FROM calls)
  ),
  call_turns AS (
    SELECT vct.call_id, vct.turn_index, vct.speaker, vct.text,
           vct.sentiment, vct.start_ms, vct.end_ms
    FROM voice_call_turns vct
    WHERE vct.call_id IN (SELECT id FROM calls)
  ),
  appts AS (
    SELECT * FROM appointments
    WHERE ((_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
        OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email))
      AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id)
  ),
  consents AS (
    SELECT created_at, consent_type, consent_text, form_source
    FROM consent_log
    WHERE ((_req.contact_phone IS NOT NULL AND customer_phone = _req.contact_phone)
        OR (_req.contact_email IS NOT NULL AND customer_email = _req.contact_email))
      AND (_req.dealership_id IS NULL OR dealership_id::text = _req.dealership_id)
  ),
  notes AS (
    SELECT created_at, channel, trigger_key, status, recipient, error_message
    FROM notification_log
    WHERE submission_id IN (SELECT id FROM sub_ids)
  )
  SELECT jsonb_build_object(
    'ok', true,
    'exported_at', now(),
    'submissions',  COALESCE(jsonb_agg(DISTINCT to_jsonb(subs.*))
                             FILTER (WHERE subs.id IS NOT NULL), '[]'::jsonb),
    'voice_calls',  (SELECT COALESCE(jsonb_agg(to_jsonb(calls.*)), '[]'::jsonb) FROM calls),
    'voice_call_grades', (SELECT COALESCE(jsonb_agg(to_jsonb(call_grades.*)), '[]'::jsonb) FROM call_grades),
    'voice_call_turns',  (SELECT COALESCE(jsonb_agg(to_jsonb(call_turns.*) ORDER BY call_turns.turn_index), '[]'::jsonb) FROM call_turns),
    'appointments', (SELECT COALESCE(jsonb_agg(to_jsonb(appts.*)), '[]'::jsonb) FROM appts),
    'consent_records', (SELECT COALESCE(jsonb_agg(to_jsonb(consents.*)), '[]'::jsonb) FROM consents),
    'notifications',(SELECT COALESCE(jsonb_agg(to_jsonb(notes.*)), '[]'::jsonb) FROM notes),
    'note', 'Storage objects (driver''s license, title docs, photos) are not included in this JSON. Reply to the original SMS to request a separate signed-link export.'
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

NOTIFY pgrst, 'reload schema';
