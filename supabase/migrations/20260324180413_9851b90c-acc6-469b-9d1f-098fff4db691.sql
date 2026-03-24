DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid, vehicle_year text, vehicle_make text, vehicle_model text,
  name text, email text, phone text, mileage text, exterior_color text,
  overall_condition text, progress_status text, offered_price numeric,
  acv_value numeric, photos_uploaded boolean, docs_uploaded boolean,
  created_at timestamptz, loan_status text, token text, vin text, zip text,
  estimated_offer_low numeric, estimated_offer_high numeric,
  bb_tradein_avg numeric, appointment_set boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, email, phone,
         mileage, exterior_color, overall_condition, progress_status,
         offered_price, acv_value, photos_uploaded, docs_uploaded, created_at,
         loan_status, token, vin, zip,
         estimated_offer_low, estimated_offer_high, bb_tradein_avg,
         appointment_set
  FROM submissions
  WHERE submissions.token = _token;
$$;