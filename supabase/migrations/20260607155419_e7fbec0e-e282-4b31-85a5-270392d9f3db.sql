-- 1. site_config.governing_law_state
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS governing_law_state text NOT NULL DEFAULT 'Connecticut';

-- 2. site_config.legal_entity_name + dealer_license_number
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS legal_entity_name text;
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS dealer_license_number text;

-- 3. Backfill consent_log.dealership_id from submissions via submission_token
UPDATE public.consent_log cl
SET    dealership_id = s.dealership_id
FROM   public.submissions s
WHERE  cl.submission_token IS NOT NULL
  AND  cl.submission_token = s.token
  AND  cl.dealership_id = 'default'
  AND  s.dealership_id IS NOT NULL
  AND  s.dealership_id <> 'default';

-- 4. Per-dealership opt_outs
ALTER TABLE public.opt_outs
  ADD COLUMN IF NOT EXISTS dealership_id text;

UPDATE public.opt_outs o
SET    dealership_id = s.dealership_id
FROM   public.submissions s
WHERE  o.submission_id = s.id
  AND  o.dealership_id IS NULL
  AND  s.dealership_id IS NOT NULL;

ALTER TABLE public.opt_outs DROP CONSTRAINT IF EXISTS opt_outs_email_channel_key;
ALTER TABLE public.opt_outs DROP CONSTRAINT IF EXISTS opt_outs_phone_channel_key;

CREATE UNIQUE INDEX IF NOT EXISTS opt_outs_phone_channel_tenant_uniq
  ON public.opt_outs (phone, channel, dealership_id)
  WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS opt_outs_email_channel_tenant_uniq
  ON public.opt_outs (email, channel, dealership_id)
  WHERE email IS NOT NULL;

-- Rewrite can_touch() so opt-out lookup is tenant-scoped. Legacy
-- NULL-tenant rows still suppress globally.
CREATE OR REPLACE FUNCTION public.can_touch(_submission_id uuid, _channel text)
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

  SELECT count(*) INTO _opt_count
  FROM opt_outs
  WHERE (dealership_id IS NULL OR dealership_id = _sub.dealership_id)
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
  IF _touches_7d >= 8 THEN
    decision := 'frequency_cap';
    reason   := '8 in 7d';
    RETURN NEXT; RETURN;
  END IF;

  decision := 'ok';
  reason   := '';
  RETURN NEXT;
END;
$function$;

NOTIFY pgrst, 'reload schema';