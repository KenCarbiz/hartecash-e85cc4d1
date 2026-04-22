
-- Add validation constraints to submissions table
ALTER TABLE public.submissions
  ADD CONSTRAINT check_email_format CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT check_zip_format CHECK (zip IS NULL OR zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  ADD CONSTRAINT check_mileage_numeric CHECK (mileage IS NULL OR mileage ~ '^[0-9,]+$'),
  ADD CONSTRAINT check_name_length CHECK (name IS NULL OR length(name) <= 200),
  ADD CONSTRAINT check_phone_length CHECK (phone IS NULL OR length(phone) <= 30),
  ADD CONSTRAINT check_email_length CHECK (email IS NULL OR length(email) <= 255);

-- Add validation constraints to appointments table
ALTER TABLE public.appointments
  ADD CONSTRAINT check_appt_email_format CHECK (customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT check_appt_name_length CHECK (length(customer_name) <= 200),
  ADD CONSTRAINT check_appt_phone_length CHECK (length(customer_phone) <= 30);

-- Update mark_photos_uploaded to validate token exists
CREATE OR REPLACE FUNCTION public.mark_photos_uploaded(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE token = _token) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  UPDATE submissions SET photos_uploaded = true WHERE token = _token;
END;
$$;

-- Update mark_docs_uploaded to validate token exists
CREATE OR REPLACE FUNCTION public.mark_docs_uploaded(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM submissions WHERE token = _token) THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  UPDATE submissions SET docs_uploaded = true WHERE token = _token;
END;
$$;

-- Limit lookup_submission_by_contact results to prevent mass enumeration
CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text)
RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token, vehicle_year, vehicle_make, vehicle_model, name
  FROM submissions
  WHERE LOWER(email) = LOWER(_email) AND REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '(', '') = REPLACE(REPLACE(REPLACE(_phone, '-', ''), ' ', ''), '(', '')
  ORDER BY created_at DESC
  LIMIT 5;
$$;
