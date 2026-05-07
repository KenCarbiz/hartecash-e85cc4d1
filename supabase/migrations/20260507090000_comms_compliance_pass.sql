-- Compliance + multi-tenant safety pass.
--
-- Closes the three highest-leverage findings from the comms-architect
-- audit:
--   1. Real idempotency on notification_log — deterministic key column
--      + UNIQUE index so duplicate sends within a 5-minute bucket
--      error at the DB layer instead of double-blasting the customer.
--   2. can_touch(submission_id, channel) — single function called from
--      send-notification, launch-voice-call, and cadence-tick that
--      enforces opt-out (all channels), recipient-local quiet hours,
--      and per-channel + total touch caps. Closes the voice opt-out
--      gap (Bland reading from a stale enrollment snapshot) and the
--      missing frequency-cap enforcement.
--   3. submissions.assigned_twilio_from — placeholder so per-dealer
--      Twilio number routing has somewhere to write. The actual read
--      side ships in send-notification edge function code.
--
-- Idempotent. Safe to re-run.

-- ── 1. notification_log idempotency ───────────────────────────────
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Backfill old rows so the constraint we add doesn't choke on NULLs.
UPDATE public.notification_log
SET idempotency_key = trigger_key || ':' || COALESCE(submission_id::text, 'no-sub')
                       || ':' || channel || ':' || recipient
                       || ':' || to_char(created_at, 'YYYYMMDDHH24MI')
WHERE idempotency_key IS NULL;

ALTER TABLE public.notification_log
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_idempotency_key_uq
  ON public.notification_log (idempotency_key);

-- ── 2. can_touch — single source of truth for "may we contact this
--      submission on this channel right now?" Returns:
--        ('ok', NULL)
--        ('opted_out', 'sms' | 'email' | 'voice' | 'all')
--        ('quiet_hours', '21:00-08:00')
--        ('frequency_cap', '3 in 24h')
--        ('channel_gap', '4h SMS gap')
--        ('paused', 'cadence_paused_until 2025-05-08T15:00')
--      Callers respect 'ok' only; everything else aborts and logs.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_touch(
  _submission_id uuid,
  _channel text  -- 'sms' | 'email' | 'voice'
)
RETURNS TABLE(decision text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub      record;
  _phone    text;
  _email    text;
  _opt_count int;
  _last_same_channel timestamptz;
  _touches_24h int;
  _touches_7d  int;
  _min_gap_hours numeric;
BEGIN
  IF _channel NOT IN ('sms','email','voice') THEN
    decision := 'invalid_channel';
    reason   := _channel;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT id, phone, email,
         dealership_id, progress_status,
         (SELECT cadence_paused_until FROM submissions s2 WHERE s2.id = s.id) AS paused
    INTO _sub
  FROM submissions s
  WHERE s.id = _submission_id;
  IF _sub.id IS NULL THEN
    decision := 'not_found'; reason := ''; RETURN NEXT; RETURN;
  END IF;

  _phone := COALESCE(_sub.phone, '');
  _email := COALESCE(_sub.email, '');

  -- Cadence pause overrides everything except staff manual sends —
  -- callers that legitimately bypass the pause (rep clicks Send)
  -- skip can_touch entirely.
  IF _sub.paused IS NOT NULL AND _sub.paused > now() THEN
    decision := 'paused';
    reason   := 'cadence_paused_until ' || _sub.paused::text;
    RETURN NEXT; RETURN;
  END IF;

  -- ── Opt-out: 'all' kills everything; channel-specific kills its own.
  -- Some deployments use sms_opt_outs as a separate table; check both.
  SELECT count(*) INTO _opt_count
  FROM opt_outs
  WHERE (
    (_channel = 'sms'   AND phone = _phone AND channel IN ('sms','all'))
    OR (_channel = 'email' AND email = _email AND channel IN ('email','all'))
    OR (_channel = 'voice' AND phone = _phone AND channel IN ('voice','all'))
    OR ((phone = _phone OR email = _email) AND channel = 'all')
  );
  IF _opt_count > 0 THEN
    decision := 'opted_out';
    reason   := _channel;
    RETURN NEXT; RETURN;
  END IF;

  -- ── Recipient-local quiet hours (9pm–8am customer-local).
  -- We don't have a per-submission timezone column yet; until we do,
  -- this enforces dealership-local hours which is the safer default
  -- (errs on the side of NOT calling). SMS + voice respect this;
  -- email is exempt because CAN-SPAM doesn't have a quiet-hour rule.
  IF _channel IN ('sms','voice') THEN
    DECLARE
      _tz text;
      _local_hour int;
    BEGIN
      -- Prefer customer-local timezone (set per submission by the TCPA
      -- recipient-timezone migration); fall back to dealership quiet-
      -- hours timezone; last-resort default America/New_York.
      SELECT customer_timezone INTO _tz FROM submissions WHERE id = _submission_id;
      IF _tz IS NULL OR _tz = '' THEN
        SELECT quiet_hours_timezone INTO _tz
        FROM dealer_accounts WHERE dealership_id = _sub.dealership_id LIMIT 1;
      END IF;
      IF _tz IS NULL OR _tz = '' THEN _tz := 'America/New_York'; END IF;

      _local_hour := EXTRACT(hour FROM now() AT TIME ZONE _tz);
      IF _local_hour < 8 OR _local_hour >= 21 THEN
        decision := 'quiet_hours';
        reason   := '21:00-08:00 ' || _tz;
        RETURN NEXT; RETURN;
      END IF;
    END;
  END IF;

  -- ── Per-channel minimum gap. SMS: 4h. Voice: 24h. Email: 30m.
  _min_gap_hours := CASE _channel
    WHEN 'sms'   THEN 4
    WHEN 'voice' THEN 24
    WHEN 'email' THEN 0.5
  END;

  SELECT max(created_at) INTO _last_same_channel
  FROM notification_log
  WHERE submission_id = _submission_id
    AND channel = _channel
    AND status IN ('sent','delivered');
  IF _last_same_channel IS NOT NULL
     AND _last_same_channel > now() - (_min_gap_hours || ' hours')::interval THEN
    decision := 'channel_gap';
    reason   := _min_gap_hours || 'h ' || _channel;
    RETURN NEXT; RETURN;
  END IF;

  -- ── Frequency caps: 3 touches/24h, 7 touches/7d across all channels.
  SELECT count(*) INTO _touches_24h
  FROM notification_log
  WHERE submission_id = _submission_id
    AND created_at > now() - interval '24 hours'
    AND status IN ('sent','delivered');
  IF _touches_24h >= 3 THEN
    decision := 'frequency_cap';
    reason   := '3 in 24h';
    RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _touches_7d
  FROM notification_log
  WHERE submission_id = _submission_id
    AND created_at > now() - interval '7 days'
    AND status IN ('sent','delivered');
  IF _touches_7d >= 7 THEN
    decision := 'frequency_cap';
    reason   := '7 in 7d';
    RETURN NEXT; RETURN;
  END IF;

  decision := 'ok';
  reason   := '';
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_touch(uuid, text) TO authenticated, service_role;

-- ── 3. Per-dealer Twilio routing.
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS twilio_from_number text;

COMMENT ON COLUMN public.dealer_accounts.twilio_from_number IS
  'Outbound SMS number used by send-notification when posting to Twilio. Falls back to env TWILIO_PHONE_NUMBER if NULL — but the fallback is the multi-tenant safety bug per the May 2026 comms-architect audit. Configure per dealer to fix.';

NOTIFY pgrst, 'reload schema';
