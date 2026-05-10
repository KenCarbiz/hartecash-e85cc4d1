-- Tighten RLS policies that were defined as `USING (true)` without a `TO`
-- clause. With no role specified, those policies apply to PUBLIC, which
-- includes the anon role — meaning anyone in possession of the publishable
-- anon key (i.e. anyone) could read these tables.
--
-- Tables addressed:
--   • voice_call_log         — call records w/ phone numbers, transcripts, recordings
--   • voice_campaigns        — campaign config and target criteria
--   • voice_script_templates — AI script bodies
--   • revaluation_log        — per-submission valuation history
--   • dealer_subscriptions   — billing relationships
--
-- For each, we DROP the offending policy (idempotent) and replace it with one
-- restricted to authenticated staff. This is intentionally a coarser gate
-- than the per-dealership scoping used elsewhere; voice_* and
-- dealer_subscriptions use `dealership_id uuid` while the rest of the schema
-- uses text dealership IDs, so a clean cross-table scoping pass is a
-- separate task. This migration's only job is to close the anon hole.
--
-- Service-role policies (TO service_role USING (true)) are left untouched —
-- service_role bypasses RLS already, so those are no-ops for authorization.

-- ── voice_call_log ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view call log"   ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can insert calls"  ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can update calls"  ON public.voice_call_log;

CREATE POLICY "Staff can view call log"
  ON public.voice_call_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert call log"
  ON public.voice_call_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update call log"
  ON public.voice_call_log FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ── voice_campaigns ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view campaigns"  ON public.voice_campaigns;
DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.voice_campaigns;

CREATE POLICY "Staff can view campaigns"
  ON public.voice_campaigns FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage campaigns"
  ON public.voice_campaigns FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── voice_script_templates ────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read templates" ON public.voice_script_templates;
DROP POLICY IF EXISTS "Admin can manage templates" ON public.voice_script_templates;

CREATE POLICY "Staff can read templates"
  ON public.voice_script_templates FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage templates"
  ON public.voice_script_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── revaluation_log ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log;
DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log;

CREATE POLICY "Staff can view revaluation log"
  ON public.revaluation_log FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert revaluation"
  ON public.revaluation_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- ── dealer_subscriptions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can read subscriptions"   ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;

CREATE POLICY "Staff can read subscriptions"
  ON public.dealer_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage subscriptions"
  ON public.dealer_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

NOTIFY pgrst, 'reload schema';
