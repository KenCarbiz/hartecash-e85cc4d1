DROP FUNCTION IF EXISTS public.get_submission_by_token(text);

CREATE FUNCTION public.get_submission_by_token(_token text)
 RETURNS TABLE(id uuid, vehicle_year text, vehicle_make text, vehicle_model text, name text, photos_uploaded boolean, state text, zip text, vin text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, photos_uploaded, state, zip, vin
  FROM submissions
  WHERE token = _token;
$$;