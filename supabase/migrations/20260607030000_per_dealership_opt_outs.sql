-- Per-dealership opt-out scoping.
--
-- opt_outs has been GLOBAL: UNIQUE(phone,channel) / UNIQUE(email,channel),
-- no dealership_id. A STOP to one dealer therefore suppressed the customer
-- at EVERY dealer on the platform (can_touch + the cadence-pause trigger
-- matched on phone/email alone). Each dealer is a separate controller, so
-- opt-out should be per-tenant.
--
-- Fail-safe design (never silently re-enables contact):
--   * Add nullable dealership_id; NEW writes stamp the tenant
--     (sms-webhook / handle-unsubscribe).
--   * Existing rows keep dealership_id = NULL, which can_touch + the
--     trigger treat as a GLOBAL opt-out (suppress everywhere) — so prior
--     suppressions are preserved exactly until they age out.
--   * Replace the global (phone,channel)/(email,channel) uniques with
--     tenant-scoped ones so two dealers can each hold their own opt-out
--     for the same contact.
--
-- Idempotent.

ALTER TABLE public.opt_outs
  ADD COLUMN IF NOT EXISTS dealership_id text;

-- Drop ONLY the global (phone,channel) / (email,channel) unique constraints
-- (leave the primary key, token unique, etc. untouched).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname,
           ARRAY(
             SELECT a.attname FROM unnest(c.conkey) k
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
           ) AS cols
    FROM pg_constraint c
    WHERE c.conrelid = 'public.opt_outs'::regclass AND c.contype = 'u'
  LOOP
    IF (r.cols @> ARRAY['phone','channel'] OR r.cols @> ARRAY['email','channel'])
       AND array_length(r.cols, 1) = 2 THEN
      EXECUTE format('ALTER TABLE public.opt_outs DROP CONSTRAINT IF EXISTS %I', r.conname);
    END IF;
  END LOOP;
END $$;

-- Tenant-scoped uniqueness (non-partial so supabase-js ON CONFLICT can use
-- them if needed; NULLs are distinct, so legacy NULL-tenant rows and
-- phone-only / email-only rows do not over-dedupe).
CREATE UNIQUE INDEX IF NOT EXISTS opt_outs_tenant_phone_channel_uq
  ON public.opt_outs (dealership_id, phone, channel);
CREATE UNIQUE INDEX IF NOT EXISTS opt_outs_tenant_email_channel_uq
  ON public.opt_outs (dealership_id, email, channel);

-- ── can_touch: scope the opt-out check to the submission's tenant ──
-- (NULL dealership_id = legacy global opt-out, still suppresses.)
CREATE OR REPLACE FUNCTION public.can_touch(
  _submission_id uuid,
  _channel text
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

  IF _sub.paused IS NOT NULL AND _sub.paused > now() THEN
    decision := 'paused';
    reason   := 'cadence_paused_until ' || _sub.paused::text;
    RETURN NEXT; RETURN;
  END IF;

  -- Tenant-scoped opt-out check: a row suppresses only when it belongs to
  -- this submission's dealership, or is a legacy global (NULL) opt-out.
  SELECT count(*) INTO _opt_count
  FROM opt_outs
  WHERE (dealership_id IS NULL OR dealership_id = _sub.dealership_id::text)
    AND (
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

  IF _channel IN ('sms','voice') THEN
    DECLARE
      _tz text;
      _local_hour int;
    BEGIN
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

-- ── cadence_pause_on_optout: pause only the opting-out tenant's submissions ──
-- (NULL dealership_id = legacy global opt-out, pauses across all tenants.)
CREATE OR REPLACE FUNCTION public.cadence_pause_on_optout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.submissions
     SET cadence_paused_until = now() + interval '10 years'
   WHERE ((NEW.phone IS NOT NULL AND phone = NEW.phone)
       OR (NEW.email IS NOT NULL AND email = NEW.email))
     AND (NEW.dealership_id IS NULL OR dealership_id::text = NEW.dealership_id);
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
