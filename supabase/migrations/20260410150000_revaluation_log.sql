-- Revaluation log + submission tracking fields for scheduled service lead re-valuation.

CREATE TABLE IF NOT EXISTS public.revaluation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  old_retail_avg numeric,
  new_retail_avg numeric,
  old_tradein_avg numeric,
  new_tradein_avg numeric,
  value_change numeric,
  notification_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revaluation_log_submission ON public.revaluation_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_revaluation_log_run_at ON public.revaluation_log(run_at DESC);

ALTER TABLE public.revaluation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log;
CREATE POLICY "Staff can view revaluation log" ON public.revaluation_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log;
CREATE POLICY "Service can insert revaluation" ON public.revaluation_log FOR INSERT WITH CHECK (true);

-- Track when submissions were last revalued + how many times
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS last_revalued_at timestamptz,
  ADD COLUMN IF NOT EXISTS revaluation_count int DEFAULT 0;
