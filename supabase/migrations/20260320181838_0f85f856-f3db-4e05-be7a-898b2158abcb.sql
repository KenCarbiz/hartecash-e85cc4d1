
-- Fix consent_log: replace broken permissive deny with proper restrictive deny for anon
DROP POLICY IF EXISTS "Deny anonymous access to consent_log" ON public.consent_log;

CREATE POLICY "Deny anonymous access to consent_log"
  ON public.consent_log
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (false);
