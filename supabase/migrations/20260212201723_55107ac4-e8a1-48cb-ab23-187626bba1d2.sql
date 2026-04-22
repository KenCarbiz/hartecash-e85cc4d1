
CREATE POLICY "Deny anonymous access to user roles"
ON public.user_roles AS RESTRICTIVE FOR SELECT
TO anon
USING (false);
