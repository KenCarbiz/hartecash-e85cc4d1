
-- Rate limit: max 3 appointments per email per hour
CREATE OR REPLACE FUNCTION public.check_appointment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM appointments
  WHERE customer_email = NEW.customer_email
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many appointment requests. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_rate_limit
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_rate_limit();
