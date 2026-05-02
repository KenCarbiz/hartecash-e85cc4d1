-- BDC fallback cadence — when voice_ai_enabled is false, every voice
-- step becomes a human-call task assigned to the dealer's BDC.
--
-- The cadence engine is otherwise identical: same touchpoints, same
-- decline-reason branching, same TCPA gating. Only the EXECUTION of
-- voice steps changes — Bland.ai vs. a human picking up the phone.
--
-- Why a separate table (vs. an enum on cadence_log)?
--   - Tasks have a lifecycle (pending → in_progress → completed) with
--     an actor on each transition; logs are append-only events.
--   - Reps need to query "show me all open calls for me today" with
--     an ORDER BY priority — that's a dedicated table query.
--   - Auto-expire after 24h so cadence isn't blocked by an unwilling rep.
--
-- Idempotent throughout (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).

-- ── 1. Tenant toggle ────────────────────────────────────────────────
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS voice_ai_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_settings.voice_ai_enabled IS
  'When false, the cadence engine creates BDC call tasks instead of invoking the AI voice agent. Default true (Bland.ai/OpenAI Realtime). Dealers without a voice-AI provider, or those who prefer their human BDC handle every call, flip this off.';

-- ── 2. BDC call tasks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bdc_call_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id   text NOT NULL,
  -- Cadence context (so we know WHY this call was queued).
  cadence_state   text NOT NULL,           -- declined | stall | reengage
  cadence_step    integer NOT NULL,
  intent          text NOT NULL,           -- voice_offer_re_engage | voice_schedule_inspection | voice_offer_refresh
  -- Assignment.
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_email  text,                     -- denormalized for display + alert routing
  assigned_role   text,                     -- 'sales_bdc' fallback when no specific user
  -- Lifecycle.
  status          text NOT NULL DEFAULT 'pending',  -- pending | in_progress | completed | skipped | expired
  priority        integer NOT NULL DEFAULT 5,        -- 1=highest, 10=lowest. Hot leads bump up; expiring offers bump up.
  due_at          timestamptz NOT NULL,              -- when this should be done by (drives sort + auto-expire)
  -- Context payload for the rep — same shape as voiceContext.ts so
  -- the rep sees what the AI would have known. Talking points
  -- pre-rendered as a string the rep can read off.
  rep_context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Outcome capture (rep fills these on completion).
  outcome         text,                     -- booked_appointment | re_quoted | customer_pushed_back | left_voicemail | no_answer | not_interested | wrong_number
  outcome_notes   text,
  completed_at    timestamptz,
  completed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Audit.
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'bdc_call_tasks' AND constraint_name = 'bdc_call_tasks_status_chk'
  ) THEN
    ALTER TABLE public.bdc_call_tasks
      ADD CONSTRAINT bdc_call_tasks_status_chk
      CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'expired'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'bdc_call_tasks' AND constraint_name = 'bdc_call_tasks_outcome_chk'
  ) THEN
    ALTER TABLE public.bdc_call_tasks
      ADD CONSTRAINT bdc_call_tasks_outcome_chk
      CHECK (outcome IS NULL OR outcome IN (
        'booked_appointment', 're_quoted', 'customer_pushed_back',
        'left_voicemail', 'no_answer', 'not_interested', 'wrong_number'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_open_for_user
  ON public.bdc_call_tasks (assigned_to, due_at)
  WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_open_for_dealership
  ON public.bdc_call_tasks (dealership_id, due_at)
  WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_expire_sweep
  ON public.bdc_call_tasks (due_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bdc_call_tasks_submission
  ON public.bdc_call_tasks (submission_id, created_at DESC);

ALTER TABLE public.bdc_call_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own tenant's BDC tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff can read own tenant's BDC tasks"
  ON public.bdc_call_tasks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Staff can update own tenant's BDC tasks" ON public.bdc_call_tasks;
CREATE POLICY "Staff can update own tenant's BDC tasks"
  ON public.bdc_call_tasks FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Service role full access to BDC tasks" ON public.bdc_call_tasks;
CREATE POLICY "Service role full access to BDC tasks"
  ON public.bdc_call_tasks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.bdc_call_tasks_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS bdc_call_tasks_updated_at_trg ON public.bdc_call_tasks;
CREATE TRIGGER bdc_call_tasks_updated_at_trg
  BEFORE UPDATE ON public.bdc_call_tasks
  FOR EACH ROW EXECUTE FUNCTION public.bdc_call_tasks_set_updated_at();

NOTIFY pgrst, 'reload schema';
