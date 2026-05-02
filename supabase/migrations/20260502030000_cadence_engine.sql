-- Cadence engine — per-submission state machine + touch log.
--
-- The orchestrator (cadence-tick edge function) walks each
-- in-flight submission through its current state's cadence and
-- fires the next due touch. To do that idempotently it needs:
--
--   1. cadence_state — which cadence this submission is in
--      (declined, stall, reengage, completed). NOT the same as
--      progress_status which tracks the deal lifecycle; this tracks
--      the OUTREACH lifecycle.
--   2. cadence_step — last step number we fired (so we don't fire
--      day-3 twice if the cron runs twice).
--   3. cadence_last_touch_at — when we last fired anything (so we
--      don't pile-on if cron lags + recovers).
--   4. cadence_next_due_at — when the next touch is scheduled to
--      fire (lets the orchestrator query a small filtered set
--      instead of every submission).
--   5. cadence_paused_until — manual pause from staff (e.g.
--      customer asked us to stop calling, rep is handling
--      personally) — short-circuits the engine.
--   6. cadence_log — full append-only history of every fired
--      touch + outcome for audit/debug/dashboards.
--
-- Idempotent — ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
-- throughout.

-- ── 1. Per-submission cadence state ──────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS cadence_state text,
  ADD COLUMN IF NOT EXISTS cadence_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cadence_last_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_next_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS cadence_started_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'submissions' AND constraint_name = 'submissions_cadence_state_chk'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_cadence_state_chk
      CHECK (cadence_state IS NULL OR cadence_state IN (
        'declined',     -- pre-expiry, customer hasn't accepted yet
        'stall',        -- accepted but not yet scheduled
        'reengage',     -- post-expiry KBB-style 8-day drip
        'completed',    -- deal closed (terminal)
        'paused',       -- manual pause / opted-out (terminal until reset)
        'expired'       -- 90-day RE-ENGAGE window finished
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_cadence_due
  ON public.submissions (cadence_next_due_at)
  WHERE cadence_state IS NOT NULL
    AND cadence_state NOT IN ('completed', 'paused', 'expired')
    AND cadence_paused_until IS NULL;

COMMENT ON COLUMN public.submissions.cadence_state IS
  'Which cadence track this lead is in. Drives the cadence-tick orchestrator. Distinct from progress_status (deal lifecycle).';
COMMENT ON COLUMN public.submissions.cadence_step IS
  'Index of the last touch fired in the current cadence (0 = none yet).';
COMMENT ON COLUMN public.submissions.cadence_next_due_at IS
  'When the orchestrator should next consider this submission. Indexed for fast cron queries.';
COMMENT ON COLUMN public.submissions.cadence_paused_until IS
  'Manual pause set by staff. Engine skips while in this window.';

-- ── 2. Append-only touch log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cadence_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  cadence_state   text NOT NULL,
  step            integer NOT NULL,
  channel         text NOT NULL,                      -- email | sms | voice | system
  trigger_key     text,                                -- maps to send-notification trigger
  outcome         text NOT NULL DEFAULT 'fired',     -- fired | skipped_quiet | skipped_optout | skipped_consent | failed
  outcome_detail  text,                                -- short reason / error message
  fired_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadence_log_submission ON public.cadence_log (submission_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadence_log_state_step ON public.cadence_log (submission_id, cadence_state, step);

ALTER TABLE public.cadence_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read cadence log" ON public.cadence_log;
CREATE POLICY "Staff can read cadence log"
  ON public.cadence_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Service role full access to cadence log" ON public.cadence_log;
CREATE POLICY "Service role full access to cadence log"
  ON public.cadence_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Per-tenant cadence config (override default schedule) ────────
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS cadence_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cadence_authorized_bump_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS cadence_reengage_max_days integer NOT NULL DEFAULT 90;

COMMENT ON COLUMN public.notification_settings.cadence_authorized_bump_pct IS
  'Maximum % over the original quoted offer the AI voice agent can quote on a re-engage call without manager approval. Default 5% matches industry norm for "manager bump" tactics.';
COMMENT ON COLUMN public.notification_settings.cadence_reengage_max_days IS
  'How many days post-expiry to keep running the RE-ENGAGE drip. Default 90 matches KBB ICO baseline. Past this, lead moves to expired (terminal).';

NOTIFY pgrst, 'reload schema';
