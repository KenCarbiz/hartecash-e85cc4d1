DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE OR REPLACE FUNCTION public.get_submission_portal(_token text)
 RETURNS TABLE(id uuid, vehicle_year text, vehicle_make text, vehicle_model text, name text, email text, phone text, mileage text, exterior_color text, overall_condition text, progress_status text, offered_price numeric, acv_value numeric, photos_uploaded boolean, docs_uploaded boolean, created_at timestamp with time zone, loan_status text, token text, vin text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, email, phone,
         mileage, exterior_color, overall_condition, progress_status,
         offered_price, acv_value, photos_uploaded, docs_uploaded, created_at,
         loan_status, token, vin
  FROM submissions
  WHERE submissions.token = _token;
$function$;