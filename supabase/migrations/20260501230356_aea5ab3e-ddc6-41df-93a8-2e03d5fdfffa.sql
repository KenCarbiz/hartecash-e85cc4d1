-- Remove anonymous read access to referrals table (PII exposure)
DROP POLICY IF EXISTS "Anyone can read referral by code" ON public.referrals;

-- Remove public DELETE policy on opt_outs (anyone could re-enable marketing for opted-out users)
DROP POLICY IF EXISTS "Anyone can delete own opt-out by token" ON public.opt_outs;

-- Allow staff to delete opt-out records (e.g. for compliance corrections)
CREATE POLICY "Staff can delete opt-outs"
  ON public.opt_outs
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));