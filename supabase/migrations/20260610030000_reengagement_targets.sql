-- Re-engagement journey, foundation (INERT — selects, never sends).
--
-- get_reengagement_targets(): returns the customers due for a re-
-- engagement touch right now — priced, non-closed offers that are
-- expiring soon (≤3 days) or recently expired (≤90 days), with the
-- compliance + cadence filters applied:
--   • excluded if opted out (opt_outs any channel, or sms_opt_outs phone)
--   • excluded if touched by a re-engagement trigger in the last 8 days
--   • capped at 11 touches (~90 days / 8-day cadence)
-- It returns a suggested trigger_key per row; the actual send still goes
-- through send-notification (which re-checks consent/opt-out at send
-- time) and is logged to notification_log (which closes the cadence
-- loop). The SENDER edge function + the Lovable-registered cron are the
-- final, separately-enabled step — nothing here sends a message.
--
-- Read-only function, idempotent (CREATE OR REPLACE). Manual-apply.

CREATE OR REPLACE FUNCTION public.get_reengagement_targets(p_dealership_id text)
RETURNS TABLE (
  submission_id text,
  name text,
  email text,
  phone text,
  vehicle text,
  offered_price numeric,
  expires_at timestamptz,
  days_left int,
  bucket text,
  suggested_trigger text,
  touches int,
  last_touch_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      s.id,
      s.name, s.email, s.phone,
      trim(concat_ws(' ', s.vehicle_year, s.vehicle_make, s.vehicle_model)) AS vehicle,
      s.offered_price,
      COALESCE(s.offer_expires_at, COALESCE(s.status_updated_at, s.created_at) + interval '8 days') AS expires
    FROM submissions s
    WHERE s.dealership_id::text = p_dealership_id
      AND s.offered_price IS NOT NULL AND s.offered_price > 0
      AND s.progress_status NOT IN ('purchase_complete', 'dead_lead')
      AND NOT EXISTS (
        SELECT 1 FROM opt_outs o
        WHERE o.dealership_id::text = p_dealership_id
          AND (
            o.submission_id = s.id
            OR (s.email IS NOT NULL AND lower(o.email) = lower(s.email))
            OR (s.phone IS NOT NULL AND o.phone = s.phone)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM sms_opt_outs so
        WHERE so.dealership_id::text = p_dealership_id AND so.phone = s.phone
      )
  ),
  touched AS (
    SELECT nl.submission_id, count(*) AS touches, max(nl.created_at) AS last_touch_at
    FROM notification_log nl
    WHERE nl.dealership_id::text = p_dealership_id
      AND nl.trigger_key IN ('offer_expiring_soon', 'offer_expired_reengage')
    GROUP BY nl.submission_id
  )
  SELECT
    b.id::text,
    b.name, b.email, b.phone, b.vehicle, b.offered_price,
    b.expires,
    floor(extract(epoch FROM (b.expires - now())) / 86400)::int AS days_left,
    CASE WHEN b.expires >= now() THEN 'expiring' ELSE 'expired' END AS bucket,
    CASE WHEN b.expires >= now() THEN 'offer_expiring_soon' ELSE 'offer_expired_reengage' END AS suggested_trigger,
    COALESCE(t.touches, 0) AS touches,
    t.last_touch_at
  FROM base b
  LEFT JOIN touched t ON t.submission_id = b.id
  WHERE (
          (b.expires >= now() AND b.expires < now() + interval '3 days')
          OR (b.expires < now() AND b.expires > now() - interval '90 days')
        )
    AND COALESCE(t.touches, 0) < 11
    AND (t.last_touch_at IS NULL OR t.last_touch_at < now() - interval '8 days')
  ORDER BY b.expires ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_reengagement_targets(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
