DROP FUNCTION IF EXISTS public.get_submission_portal(text);

CREATE FUNCTION public.get_submission_portal(_token text)
 RETURNS TABLE(id uuid, vehicle_year text, vehicle_make text, vehicle_model text, name text, email text, phone text, mileage text, exterior_color text, overall_condition text, progress_status text, offered_price numeric, acv_value numeric, photos_uploaded boolean, docs_uploaded boolean, created_at timestamp with time zone, loan_status text, token text, vin text, zip text, estimated_offer_low numeric, estimated_offer_high numeric, bb_tradein_avg numeric, appointment_set boolean, brake_lf integer, brake_rf integer, brake_lr integer, brake_rr integer, tire_lf integer, tire_rf integer, tire_lr integer, tire_rr integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT s.id, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name, s.email, s.phone,
         s.mileage, s.exterior_color, s.overall_condition, s.progress_status,
         s.offered_price, s.acv_value, s.photos_uploaded, s.docs_uploaded, s.created_at,
         s.loan_status, s.token, s.vin, s.zip,
         s.estimated_offer_low, s.estimated_offer_high, s.bb_tradein_avg,
         s.appointment_set,
         s.brake_lf, s.brake_rf, s.brake_lr, s.brake_rr,
         s.tire_lf, s.tire_rf, s.tire_lr, s.tire_rr
  FROM submissions s
  WHERE s.token = _token;
$$;