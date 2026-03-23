
-- Fix 1: Drop the mislabeled anon policy on opt_outs
DROP POLICY "Service role can read opt-outs" ON public.opt_outs;

-- Fix 2: Replace public read policy on notification_settings with staff-only
DROP POLICY "Anyone can read notification settings" ON public.notification_settings;

CREATE POLICY "Staff can read notification settings"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));
