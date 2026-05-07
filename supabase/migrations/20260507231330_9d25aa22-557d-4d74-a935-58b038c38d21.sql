-- 20260507220000_voice_grade_runs.sql
-- Golden-100 holdout regression infrastructure.
-- Depends on voice_call_grades existing (20260507160000).

-- ── voice_grade_runs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_grade_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label       text NOT NULL,
  rubric_version  text,
  notes           text,
  baseline_run_id uuid REFERENCES public.voice_grade_runs(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  total_calls           int,
  succeeded_calls       int,
  failed_calls          int,
  gating_fail_count     int,
  avg_composite         numeric,
  avg_dim_compliance        numeric,
  avg_dim_vehicle_confirm   numeric,
  avg_dim_motivation_disco  numeric,
  avg_dim_quote_band        numeric,
  avg_dim_objection_handle  numeric,
  avg_dim_close_control     numeric,
  avg_dim_transfer_hygiene  numeric,
  avg_dim_pacing            numeric,
  avg_dim_hallucination     numeric,
  avg_dim_brand_tone        numeric,
  triggered_by    uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_grade_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "staff_read_voice_grade_runs"
    ON public.voice_grade_runs FOR SELECT
    TO authenticated
    USING (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_write_voice_grade_runs"
    ON public.voice_grade_runs FOR ALL
    TO authenticated
    USING (public.is_staff(auth.uid()))
    WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── voice_call_grades.run_id + golden_pinned ─────────────────────
ALTER TABLE public.voice_call_grades
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.voice_grade_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS golden_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_voice_call_grades_run_id
  ON public.voice_call_grades(run_id) WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_voice_call_grades_golden
  ON public.voice_call_grades(call_id, created_at DESC)
  WHERE golden_pinned = true;

-- ── mark_call_golden ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_call_golden(_call_id uuid, _pinned boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grade_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'only_staff_can_pin';
  END IF;

  SELECT id INTO _grade_id
  FROM voice_call_grades
  WHERE call_id = _call_id
    AND run_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF _grade_id IS NULL THEN
    RAISE EXCEPTION 'no_grade_for_call';
  END IF;

  UPDATE voice_call_grades
  SET golden_pinned = _pinned
  WHERE id = _grade_id;

  RETURN jsonb_build_object('ok', true, 'grade_id', _grade_id, 'pinned', _pinned);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_call_golden(uuid, boolean) TO authenticated;

-- ── finalize_voice_grade_run ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_voice_grade_run(_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stats record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    -- allow service role (auth.uid() IS NULL) to call this from the edge function
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'only_staff_can_finalize';
    END IF;
  END IF;

  SELECT
    COUNT(*)                               AS total,
    COUNT(*) FILTER (WHERE gating_failed)  AS gating_fails,
    AVG(composite_score)                   AS avg_composite,
    AVG(dim_compliance)                    AS avg_compliance,
    AVG(dim_vehicle_confirm)               AS avg_vehicle_confirm,
    AVG(dim_motivation_disco)              AS avg_motivation_disco,
    AVG(dim_quote_band)                    AS avg_quote_band,
    AVG(dim_objection_handle)              AS avg_objection_handle,
    AVG(dim_close_control)                 AS avg_close_control,
    AVG(dim_transfer_hygiene)              AS avg_transfer_hygiene,
    AVG(dim_pacing)                        AS avg_pacing,
    AVG(dim_hallucination)                 AS avg_hallucination,
    AVG(dim_brand_tone)                    AS avg_brand_tone
  INTO _stats
  FROM voice_call_grades
  WHERE run_id = _run_id;

  UPDATE voice_grade_runs
  SET finished_at              = now(),
      total_calls              = _stats.total,
      gating_fail_count        = _stats.gating_fails,
      avg_composite            = _stats.avg_composite,
      avg_dim_compliance       = _stats.avg_compliance,
      avg_dim_vehicle_confirm  = _stats.avg_vehicle_confirm,
      avg_dim_motivation_disco = _stats.avg_motivation_disco,
      avg_dim_quote_band       = _stats.avg_quote_band,
      avg_dim_objection_handle = _stats.avg_objection_handle,
      avg_dim_close_control    = _stats.avg_close_control,
      avg_dim_transfer_hygiene = _stats.avg_transfer_hygiene,
      avg_dim_pacing           = _stats.avg_pacing,
      avg_dim_hallucination    = _stats.avg_hallucination,
      avg_dim_brand_tone       = _stats.avg_brand_tone
  WHERE id = _run_id;

  RETURN jsonb_build_object(
    'ok', true,
    'run_id', _run_id,
    'total_calls', _stats.total,
    'gating_fails', _stats.gating_fails,
    'avg_composite', _stats.avg_composite
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_voice_grade_run(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';