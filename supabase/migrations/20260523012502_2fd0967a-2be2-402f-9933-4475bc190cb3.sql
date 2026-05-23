CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text)
 RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _ip_hash text;
  _attempt_count integer;
  _phone_norm text;
BEGIN
  _ip_hash := encode(digest(_email || _phone, 'sha256'), 'hex');

  PERFORM cleanup_old_lookup_attempts();

  SELECT COUNT(*) INTO _attempt_count
  FROM lookup_attempts
  WHERE ip_hash = _ip_hash
    AND attempted_at > now() - interval '15 minutes';

  IF _attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;

  INSERT INTO lookup_attempts (ip_hash) VALUES (_ip_hash);

  -- Digits-only, then strip leading "1" on 11-digit US numbers.
  _phone_norm := regexp_replace(_phone, '\D', '', 'g');
  IF length(_phone_norm) = 11 AND left(_phone_norm, 1) = '1' THEN
    _phone_norm := substring(_phone_norm from 2);
  END IF;

  RETURN QUERY
  SELECT s.token, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name
  FROM submissions s
  WHERE LOWER(s.email) = LOWER(_email)
    AND (
      CASE
        WHEN length(regexp_replace(s.phone, '\D', '', 'g')) = 11
             AND left(regexp_replace(s.phone, '\D', '', 'g'), 1) = '1'
        THEN substring(regexp_replace(s.phone, '\D', '', 'g') from 2)
        ELSE regexp_replace(s.phone, '\D', '', 'g')
      END
    ) = _phone_norm
  ORDER BY s.created_at DESC
  LIMIT 5;
END;
$function$;

NOTIFY pgrst, 'reload schema';