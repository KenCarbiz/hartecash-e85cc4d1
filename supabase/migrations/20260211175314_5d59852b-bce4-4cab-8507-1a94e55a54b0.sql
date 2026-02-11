
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can read submission by token" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can update photos_uploaded by token" ON public.submissions;

-- Create an RPC function for token-based read (limited columns only)
CREATE OR REPLACE FUNCTION public.get_submission_by_token(_token text)
RETURNS TABLE(
  id uuid,
  vehicle_year text,
  vehicle_make text,
  vehicle_model text,
  name text,
  photos_uploaded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, vehicle_year, vehicle_make, vehicle_model, name, photos_uploaded
  FROM submissions
  WHERE token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.get_submission_by_token TO anon, authenticated;

-- Create an RPC function for token-based photo upload status update
CREATE OR REPLACE FUNCTION public.mark_photos_uploaded(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE submissions SET photos_uploaded = true WHERE token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.mark_photos_uploaded TO anon, authenticated;
