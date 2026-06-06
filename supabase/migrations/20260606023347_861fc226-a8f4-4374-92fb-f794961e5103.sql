
-- 1. Fix customer_otp_codes RLS: tighten service_role policy + add restrictive deny for client roles
DROP POLICY IF EXISTS customer_otp_codes_service_role ON public.customer_otp_codes;

CREATE POLICY "customer_otp_codes_service_role_only"
  ON public.customer_otp_codes
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customer_otp_codes_deny_anon"
  ON public.customer_otp_codes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2. Allow non-admin staff to update submissions within their scope (mirrors SELECT visibility)
CREATE POLICY "Staff can update scoped submissions"
  ON public.submissions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND public.can_view_submission(auth.uid(), dealership_id, store_location_id)
    AND public.can_act_in_state(auth.uid(), COALESCE(state, ''::text))
  )
  WITH CHECK (
    public.is_staff(auth.uid())
    AND public.can_view_submission(auth.uid(), dealership_id, store_location_id)
    AND public.can_act_in_state(auth.uid(), COALESCE(state, ''::text))
  );

NOTIFY pgrst, 'reload schema';
