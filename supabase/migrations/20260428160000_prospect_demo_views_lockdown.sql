-- Audit follow-up: drop the anon-insert policy on prospect_demo_views.
-- The get-prospect-demo edge function already inserts via the service role,
-- which bypasses RLS — the public INSERT policy was never needed and let
-- competitors poison "open" analytics or inject XSS payloads via referrer.

DROP POLICY IF EXISTS "Anyone can log a demo view" ON public.prospect_demo_views;
