
-- Rate limiting table for customer lookup
CREATE TABLE public.lookup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for efficient cleanup and lookups
CREATE INDEX idx_lookup_attempts_ip_time ON public.lookup_attempts (ip_hash, attempted_at);

-- Enable RLS (deny all direct access - only used by RPC)
ALTER TABLE public.lookup_attempts ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup old attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_lookup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM lookup_attempts WHERE attempted_at < now() - interval '1 hour';
$$;

-- Replace the lookup function with rate-limited version
CREATE OR REPLACE FUNCTION public.lookup_submission_by_contact(_email text, _phone text)
RETURNS TABLE(token text, vehicle_year text, vehicle_make text, vehicle_model text, name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ip_hash text;
  _attempt_count integer;
BEGIN
  -- Generate a hash from email+phone combo as rate limit key
  _ip_hash := encode(digest(_email || _phone, 'sha256'), 'hex');

  -- Clean up old attempts
  PERFORM cleanup_old_lookup_attempts();

  -- Count recent attempts for this combo
  SELECT COUNT(*) INTO _attempt_count
  FROM lookup_attempts
  WHERE ip_hash = _ip_hash
    AND attempted_at > now() - interval '15 minutes';

  -- Rate limit: max 5 attempts per 15 minutes per combo
  IF _attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many lookup attempts. Please try again later.';
  END IF;

  -- Record this attempt
  INSERT INTO lookup_attempts (ip_hash) VALUES (_ip_hash);

  -- Perform the lookup
  RETURN QUERY
  SELECT s.token, s.vehicle_year, s.vehicle_make, s.vehicle_model, s.name
  FROM submissions s
  WHERE LOWER(s.email) = LOWER(_email)
    AND REPLACE(REPLACE(REPLACE(s.phone, '-', ''), ' ', ''), '(', '') = REPLACE(REPLACE(REPLACE(_phone, '-', ''), ' ', ''), '(', '')
  ORDER BY s.created_at DESC
  LIMIT 5;
END;
$$;
