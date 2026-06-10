-- Returning-customer engine, layer 2: offer expiry + verified resume.
--
-- (1) submissions.offer_expires_at column + one-time backfill for
--     existing priced offers (7-day window from when the offer was set).
-- (2) a minimal BEFORE trigger that stamps a 7-day expiry the first time
--     an offer price is set — only touches the new column, only when it
--     is NULL and a price exists; never alters other fields, never resets
--     an existing expiry.
-- (3) get_my_saved_offer(): a RATE-LIMITED, SECURITY DEFINER RPC that
--     lets a customer retrieve their OWN most-recent active offer by
--     email/phone (powers the widget "welcome back" / "resume my offer").
--     Mirrors the throttle used by lookup_submission_by_contact so it is
--     not bulk-enumerable.
--
-- Idempotent. Migrations are NOT auto-applied on merge — apply manually
-- and verify (see CLAUDE.md). The V2 Re-engagement client reads
-- offer_expires_at with a fallback, so there is no deploy-order window.

-- (1) column + backfill ------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;

UPDATE public.submissions
SET offer_expires_at = COALESCE(status_updated_at, created_at) + interval '7 days'
WHERE offer_expires_at IS NULL
  AND offered_price IS NOT NULL
  AND offered_price > 0;

-- (2) stamp expiry when an offer price is first set --------------------
CREATE OR REPLACE FUNCTION public.set_offer_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.offered_price IS NOT NULL
     AND NEW.offered_price > 0
     AND NEW.offer_expires_at IS NULL THEN
    NEW.offer_expires_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_offer_expiry ON public.submissions;
CREATE TRIGGER trg_set_offer_expiry
  BEFORE INSERT OR UPDATE OF offered_price ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_expiry();

-- (3) rate-limited customer offer retrieval ---------------------------
CREATE OR REPLACE FUNCTION public.get_my_saved_offer(_dealership_id text, _email text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _ip_hash text;
  _attempts int;
  _phone_norm text;
  _row record;
BEGIN
  -- Throttle: max 5 attempts / 15 min per email+phone hash (same pattern
  -- as lookup_submission_by_contact). Prevents bulk enumeration.
  _ip_hash := encode(digest(coalesce(_email,'') || coalesce(_phone,''), 'sha256'), 'hex');
  PERFORM cleanup_old_lookup_attempts();
  SELECT COUNT(*) INTO _attempts
    FROM lookup_attempts
    WHERE ip_hash = _ip_hash AND attempted_at > now() - interval '15 minutes';
  IF _attempts >= 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;
  INSERT INTO lookup_attempts (ip_hash) VALUES (_ip_hash);

  _phone_norm := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  IF length(_phone_norm) = 11 AND left(_phone_norm, 1) = '1' THEN
    _phone_norm := substring(_phone_norm from 2);
  END IF;

  SELECT s.token, s.name, s.vehicle_year, s.vehicle_make, s.vehicle_model,
         s.offered_price, s.progress_status,
         COALESCE(s.offer_expires_at, COALESCE(s.status_updated_at, s.created_at) + interval '7 days') AS expires
    INTO _row
  FROM submissions s
  WHERE s.dealership_id::text = _dealership_id
    AND s.offered_price IS NOT NULL AND s.offered_price > 0
    AND s.progress_status NOT IN ('purchase_complete', 'dead_lead')
    AND (
      (coalesce(_email,'') <> '' AND lower(s.email) = lower(_email))
      OR (_phone_norm <> '' AND
          (CASE WHEN length(regexp_replace(coalesce(s.phone,''), '\D','','g')) = 11
                 AND left(regexp_replace(coalesce(s.phone,''), '\D','','g'), 1) = '1'
                THEN substring(regexp_replace(coalesce(s.phone,''), '\D','','g') from 2)
                ELSE regexp_replace(coalesce(s.phone,''), '\D','','g') END) = _phone_norm)
    )
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _row.token IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'token', _row.token,
    'name', _row.name,
    'vehicle', trim(concat_ws(' ', _row.vehicle_year, _row.vehicle_make, _row.vehicle_model)),
    'offered_price', _row.offered_price,
    'status', _row.progress_status,
    'expires_at', _row.expires,
    'days_left', greatest(0, ceil(extract(epoch from (_row.expires - now())) / 86400))::int,
    'expired', (_row.expires < now())
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_saved_offer(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
