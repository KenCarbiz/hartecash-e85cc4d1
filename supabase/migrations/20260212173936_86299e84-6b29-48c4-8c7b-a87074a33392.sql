
-- Full submission details for customer portal (secure, token-based)
CREATE OR REPLACE FUNCTION public.get_submission_portal(_token text)
RETURNS TABLE(
  id uuid,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  name text,
  email text,
  phone text,
  mileage text,
  exterior_color text,
  overall_condition text,
  progress_status text,
  offered_price numeric,
  acv_value numeric,
  photos_uploaded boolean,
  docs_uploaded boolean,
  created_at timestamptz,
  loan_status text,
  token text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, email, phone,
         mileage, exterior_color, overall_condition, progress_status,
         offered_price, acv_value, photos_uploaded, docs_uploaded, created_at,
         loan_status, token
  FROM submissions
  WHERE submissions.token = _token;
$$;

-- Lookup submission by email + phone, returns token
CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text)
RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token, vehicle_year, vehicle_make, vehicle_model, name
  FROM submissions
  WHERE LOWER(email) = LOWER(_email) AND phone = _phone
  ORDER BY created_at DESC;
$$;
