-- Tenant-scoped overload of lookup_submission_by_contact.
--
-- The 2-arg version matches a customer's submissions by email+phone across
-- ALL dealerships, so a person who used two dealers sees both portal tokens
-- regardless of which dealer's site they're on. It only ever returns the
-- caller's OWN records (identity-gated by their email+phone, rate-limited),
-- so it's not a cross-customer breach — but on a multi-tenant deployment it
-- cross-links a person's records across unaffiliated dealers.
--
-- Add a 3-arg overload that scopes to the current site's tenant. The
-- frontend passes the tenant and falls back to the 2-arg form if this
-- overload isn't deployed yet, so there is no deploy-order window. The 2-arg
-- version is retained for that fallback and can be dropped in a later pass.
-- Idempotent.

CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text, _dealership_id text)
 RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _ip_hash text;
  _attempt_count integer;
  _phone_norm text;
BEGIN
  _ip_hash := encode(digest(_email || _phone, 'sha256'), 'hex');
  PERFORM cleanup_old_lookup_attempts();
  SELECT COUNT(*) INTO _attempt_count FROM lookup_attempts WHERE ip_hash = _ip_hash AND attempted_at > now() - interval '15 minutes';
  IF _attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;
  INSERT INTO lookup_attempts (ip_hash) VALUES (_ip_hash);
  _phone_norm := regexp_replace(_phone, '\D', '', 'g');
  IF length(_phone_norm) = 11 AND left(_phone_norm, 1) = '1' THEN
    _phone_norm := substring(_phone_norm from 2);
  END IF;
  RETURN QUERY
  SELECT s.token, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name
  FROM submissions s
  WHERE LOWER(s.email) = LOWER(_email)
    AND (_dealership_id IS NULL OR s.dealership_id::text = _dealership_id)
    AND (CASE WHEN length(regexp_replace(s.phone, '\D', '', 'g')) = 11 AND left(regexp_replace(s.phone, '\D', '', 'g'), 1) = '1'
              THEN substring(regexp_replace(s.phone, '\D', '', 'g') from 2)
              ELSE regexp_replace(s.phone, '\D', '', 'g') END) = _phone_norm
  ORDER BY s.created_at DESC LIMIT 5;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_submission_by_contact(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
