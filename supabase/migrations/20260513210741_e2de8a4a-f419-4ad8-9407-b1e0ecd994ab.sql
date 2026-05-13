-- Per-user Manager PIN — server-side hashed verification
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_pin_hash text,
  ADD COLUMN IF NOT EXISTS manager_pin_set_at timestamptz;

-- Rate-limit table for verify attempts
CREATE TABLE IF NOT EXISTS public.manager_pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_pin_attempts_user_time_idx
  ON public.manager_pin_attempts (user_id, attempted_at DESC);

ALTER TABLE public.manager_pin_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manager_pin_attempts_no_client ON public.manager_pin_attempts;
CREATE POLICY manager_pin_attempts_no_client
  ON public.manager_pin_attempts FOR ALL
  TO authenticated
  USING (false) WITH CHECK (false);

-- Helper: is current user authorized to hold a manager PIN?
CREATE OR REPLACE FUNCTION public.user_can_hold_manager_pin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.is_appraiser = true
        OR ur.role IN ('admin','used_car_manager','gsm_gm','gm')
        OR ur.is_platform_admin = true
      )
  );
$$;

-- Set/change own PIN (must be 4 digits)
CREATE OR REPLACE FUNCTION public.set_my_manager_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be 4 digits';
  END IF;
  IF NOT public.user_can_hold_manager_pin(uid) THEN
    RAISE EXCEPTION 'not authorized to set a manager PIN';
  END IF;
  UPDATE public.profiles
     SET manager_pin_hash = crypt(_pin, gen_salt('bf', 10)),
         manager_pin_set_at = now()
   WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, manager_pin_hash, manager_pin_set_at)
    VALUES (uid, crypt(_pin, gen_salt('bf', 10)), now());
  END IF;
END;
$$;

-- Whether current user has a PIN set
CREATE OR REPLACE FUNCTION public.has_my_manager_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND manager_pin_hash IS NOT NULL
  );
$$;

-- Verify PIN with simple rate limit (>=5 failures in last 5 min blocks)
CREATE OR REPLACE FUNCTION public.verify_my_manager_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  recent_fails int;
  stored_hash text;
  ok boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;

  SELECT count(*) INTO recent_fails
  FROM public.manager_pin_attempts
  WHERE user_id = uid
    AND succeeded = false
    AND attempted_at > now() - interval '5 minutes';
  IF recent_fails >= 5 THEN
    RAISE EXCEPTION 'too many attempts — try again in a few minutes';
  END IF;

  SELECT manager_pin_hash INTO stored_hash
  FROM public.profiles WHERE user_id = uid;

  IF stored_hash IS NULL THEN
    INSERT INTO public.manager_pin_attempts (user_id, succeeded) VALUES (uid, false);
    RETURN false;
  END IF;

  ok := stored_hash = crypt(_pin, stored_hash);
  INSERT INTO public.manager_pin_attempts (user_id, succeeded) VALUES (uid, ok);
  RETURN ok;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_manager_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_my_manager_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_my_manager_pin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_hold_manager_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_manager_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_my_manager_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_my_manager_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_hold_manager_pin(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';