
CREATE POLICY "Staff can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
