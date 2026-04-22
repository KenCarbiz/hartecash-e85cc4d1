
-- Drop the overly permissive anon INSERT policy
DROP POLICY "Service role can insert notification logs" ON public.notification_log;

-- Re-create as a policy that allows authenticated staff OR service_role inserts
-- Edge functions use service_role key which bypasses RLS, so we just need
-- to ensure anon role cannot insert
CREATE POLICY "Staff can insert notification logs" ON public.notification_log
FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));
