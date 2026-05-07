-- Golden-100 holdout — grader regression detection.
--
-- The training pipeline learns from every call, but the GRADER
-- itself can drift. When we tweak the rubric prompt, swap judge
-- models (Claude Sonnet 4.6 → 4.7), or change the judge schema, we
-- need a way to confirm the change didn't silently move every grade
-- down half a point. The golden-100 mechanism solves that:
--
--   1. Manager pins ~100 calls (mix of high/low/edge cases) via
--      voice_call_grades.golden_pinned (already exists, see
--      20260507160000_voice_call_turns.sql).
--   2. Manager kicks off a "regression run" — re-grades every
--      golden-pinned call against the current rubric/model.
--   3. The run's avg_composite + dimension means + gating-fail
--      count get compared to the previous run as the baseline.
--
-- This migration adds the run-tracking layer:
--   voice_grade_runs           — one row per regression batch
--   voice_call_grades.run_id   — link grades to their run
--   mark_call_golden RPC       — toggle pinned status
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voice_grade_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label          text NOT NULL,                       -- "rubric v2 trial", "claude-4.7 swap", "weekly check"
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,
  baseline_run_id    uuid REFERENCES public.voice_grade_runs(id) ON DELETE SET NULL,
  model              text,                                -- grader model used for this run
  rubric_version     text,                                -- free-text tag set by the trigger ("v2-tighter-anchors")
  -- Summary stats — populated when the run finishes.
  call_count         integer NOT NULL DEFAULT 0,
  avg_composite      numeric,
  avg_dim_compliance       numeric,
  avg_dim_vehicle_confirm  numeric,
  avg_dim_motivation_disco numeric,
  avg_dim_quote_band       numeric,
  avg_dim_objection_handle numeric,
  avg_dim_close_control    numeric,
  avg_dim_transfer_hygiene numeric,
  avg_dim_pacing           numeric,
  avg_dim_hallucination    numeric,
  avg_dim_brand_tone       numeric,
  gating_fail_count  integer NOT NULL DEFAULT 0,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_grade_runs_started_idx
  ON public.voice_grade_runs (started_at DESC);

ALTER TABLE public.voice_grade_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access voice_grade_runs"
  ON public.voice_grade_runs;
CREATE POLICY "Service role full access voice_grade_runs"
  ON public.voice_grade_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_grade_runs"
  ON public.voice_grade_runs;
CREATE POLICY "Staff read voice_grade_runs"
  ON public.voice_grade_runs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ── Link grades to the run that produced them ─────────────────────
ALTER TABLE public.voice_call_grades
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.voice_grade_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS voice_call_grades_run_idx
  ON public.voice_call_grades (run_id);

-- ── mark_call_golden RPC ──────────────────────────────────────────
-- Toggle a call into / out of the golden-100. We pin on the
-- most-recent grade row for the call (LATERAL pattern); subsequent
-- regrades inherit the pin via the regrade fn.
CREATE OR REPLACE FUNCTION public.mark_call_golden(
  _call_id uuid,
  _pinned  boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grade_id uuid;
BEGIN
  SELECT id INTO _grade_id
  FROM voice_call_grades
  WHERE call_id = _call_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _grade_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_grade_yet');
  END IF;

  UPDATE voice_call_grades
  SET golden_pinned = _pinned
  WHERE id = _grade_id;

  RETURN jsonb_build_object('ok', true, 'pinned', _pinned, 'grade_id', _grade_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_call_golden(uuid, boolean)
  TO authenticated, service_role;

-- ── finalize_voice_grade_run RPC ──────────────────────────────────
-- Called by the regrade-golden-set edge function once it's done
-- iterating the golden set. Aggregates from voice_call_grades where
-- run_id = _run_id and stamps the summary onto the run row.

CREATE OR REPLACE FUNCTION public.finalize_voice_grade_run(
  _run_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.voice_grade_runs r
  SET finished_at = now(),
      call_count        = s.call_count,
      avg_composite     = s.avg_composite,
      avg_dim_compliance       = s.avg_compliance,
      avg_dim_vehicle_confirm  = s.avg_vehicle_confirm,
      avg_dim_motivation_disco = s.avg_motivation_disco,
      avg_dim_quote_band       = s.avg_quote_band,
      avg_dim_objection_handle = s.avg_objection_handle,
      avg_dim_close_control    = s.avg_close_control,
      avg_dim_transfer_hygiene = s.avg_transfer_hygiene,
      avg_dim_pacing           = s.avg_pacing,
      avg_dim_hallucination    = s.avg_hallucination,
      avg_dim_brand_tone       = s.avg_brand_tone,
      gating_fail_count        = s.gating_fail_count
  FROM (
    SELECT
      count(*)                          AS call_count,
      avg(composite_score)              AS avg_composite,
      avg(dim_compliance)               AS avg_compliance,
      avg(dim_vehicle_confirm)          AS avg_vehicle_confirm,
      avg(dim_motivation_disco)         AS avg_motivation_disco,
      avg(dim_quote_band)               AS avg_quote_band,
      avg(dim_objection_handle)         AS avg_objection_handle,
      avg(dim_close_control)            AS avg_close_control,
      avg(dim_transfer_hygiene)         AS avg_transfer_hygiene,
      avg(dim_pacing)                   AS avg_pacing,
      avg(dim_hallucination)            AS avg_hallucination,
      avg(dim_brand_tone)               AS avg_brand_tone,
      count(*) FILTER (WHERE gating_failed) AS gating_fail_count
    FROM public.voice_call_grades
    WHERE run_id = _run_id
  ) s
  WHERE r.id = _run_id;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_voice_grade_run(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
