
DROP POLICY IF EXISTS "Service role can insert damage reports" ON public.damage_reports;
CREATE POLICY "Staff can insert damage reports"
  ON public.damage_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
