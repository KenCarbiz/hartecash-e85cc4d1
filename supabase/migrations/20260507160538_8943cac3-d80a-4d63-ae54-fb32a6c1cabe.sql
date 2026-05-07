-- ============================================================
-- 20260507090000_comms_compliance_pass.sql
-- ============================================================

-- 1. notification_log.idempotency_key
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Backfill existing rows so the unique constraint doesn't choke
UPDATE public.notification_log
   SET idempotency_key = COALESCE(
     idempotency_key,
     'backfill:' || id::text
   )
 WHERE idempotency_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_idempotency_key_uniq
  ON public.notification_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. dealer_accounts.twilio_from_number
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS twilio_from_number text;

-- 3. can_touch(submission_id, channel) RPC
CREATE OR REPLACE FUNCTION public.can_touch(_submission_id uuid, _channel text)
RETURNS TABLE(decision text, reason text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub          record;
  _now          timestamptz := now();
  _local_now    timestamptz;
  _hour         int;
  _last_touch   timestamptz;
  _touches_7d   int;
  _channel_ok   boolean;
BEGIN
  SELECT s.id, s.dealership_id, s.location_id, s.email, s.phone,
         s.unsubscribed_at, s.sms_opt_out_at, s.do_not_contact,
         s.progress_status
    INTO _sub
    FROM submissions s
   WHERE s.id = _submission_id;

  IF _sub.id IS NULL THEN
    RETURN QUERY SELECT 'block'::text, 'not_found'::text, 'submission missing'::text;
    RETURN;
  END IF;

  -- Channel enabled at tenant/location level
  BEGIN
    _channel_ok := public.channel_enabled(_sub.dealership_id, _sub.location_id, _channel);
  EXCEPTION WHEN OTHERS THEN
    _channel_ok := true;
  END;
  IF NOT _channel_ok THEN
    RETURN QUERY SELECT 'block'::text, 'paused'::text, 'channel disabled for tenant/location'::text;
    RETURN;
  END IF;

  -- Opt-outs
  IF _sub.do_not_contact = true THEN
    RETURN QUERY SELECT 'block'::text, 'opted_out'::text, 'do_not_contact flag set'::text;
    RETURN;
  END IF;

  IF _channel = 'email' AND _sub.unsubscribed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'block'::text, 'opted_out'::text, 'email unsubscribe'::text;
    RETURN;
  END IF;

  IF _channel = 'sms' AND _sub.sms_opt_out_at IS NOT NULL THEN
    RETURN QUERY SELECT 'block'::text, 'opted_out'::text, 'sms STOP received'::text;
    RETURN;
  END IF;

  -- Quiet hours (8pm–8am local; assume America/New_York unless tenant has tz)
  _local_now := _now AT TIME ZONE 'America/New_York';
  _hour := EXTRACT(HOUR FROM _local_now)::int;
  IF _hour < 8 OR _hour >= 20 THEN
    RETURN QUERY SELECT 'block'::text, 'quiet_hours'::text,
      ('local hour=' || _hour::text)::text;
    RETURN;
  END IF;

  -- Channel gap: don't repeat the same channel within 4 hours
  SELECT MAX(created_at) INTO _last_touch
    FROM notification_log
   WHERE submission_id = _submission_id
     AND channel = _channel
     AND status IN ('sent','delivered','queued');

  IF _last_touch IS NOT NULL AND _last_touch > _now - interval '4 hours' THEN
    RETURN QUERY SELECT 'block'::text, 'channel_gap'::text,
      ('last ' || _channel || ' at ' || _last_touch::text)::text;
    RETURN;
  END IF;

  -- Frequency cap: max 3 touches across all channels per 7 days
  SELECT COUNT(*) INTO _touches_7d
    FROM notification_log
   WHERE submission_id = _submission_id
     AND created_at > _now - interval '7 days'
     AND status IN ('sent','delivered','queued');

  IF _touches_7d >= 3 THEN
    RETURN QUERY SELECT 'block'::text, 'frequency_cap'::text,
      ('touches in last 7d=' || _touches_7d::text)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'ok'::text, NULL::text, NULL::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_touch(uuid, text) TO authenticated, service_role;

-- ============================================================
-- 20260507100000_trade_up_incentives.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.trade_up_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  trigger_moment text NOT NULL CHECK (trigger_moment IN ('pre_acceptance','post_acceptance')),
  headline text NOT NULL,
  description text,
  bonus_amount numeric NOT NULL DEFAULT 0,
  inventory_scope text NOT NULL DEFAULT 'all'
    CHECK (inventory_scope IN ('all','new_only','used_only','certified_only')),
  inventory_price_floor numeric,
  inventory_price_ceiling numeric,
  inventory_url text,
  is_active boolean NOT NULL DEFAULT true,
  active_until timestamptz,
  disclaimer text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_up_incentives_dealer_active_idx
  ON public.trade_up_incentives (dealership_id, is_active, trigger_moment, sort_order);

ALTER TABLE public.trade_up_incentives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active trade-up incentives" ON public.trade_up_incentives;
CREATE POLICY "Public can read active trade-up incentives"
  ON public.trade_up_incentives
  FOR SELECT
  USING (is_active = true AND (active_until IS NULL OR active_until > now()));

DROP POLICY IF EXISTS "Admins manage own tenant trade-up incentives" ON public.trade_up_incentives;
CREATE POLICY "Admins manage own tenant trade-up incentives"
  ON public.trade_up_incentives
  FOR ALL
  USING (
    is_platform_admin(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND get_user_dealership_id(auth.uid()) = dealership_id)
  )
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND get_user_dealership_id(auth.uid()) = dealership_id)
  );

DROP TRIGGER IF EXISTS trg_trade_up_incentives_updated_at ON public.trade_up_incentives;
CREATE TRIGGER trg_trade_up_incentives_updated_at
  BEFORE UPDATE ON public.trade_up_incentives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
