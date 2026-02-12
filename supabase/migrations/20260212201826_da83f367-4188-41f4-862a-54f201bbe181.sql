
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to appointments"
ON public.appointments AS RESTRICTIVE FOR SELECT
TO anon
USING (false);
