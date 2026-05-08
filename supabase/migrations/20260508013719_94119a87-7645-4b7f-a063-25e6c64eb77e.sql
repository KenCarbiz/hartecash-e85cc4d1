ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS appraisal_started_at timestamptz;

CREATE INDEX IF NOT EXISTS submissions_appraisal_started_idx
  ON public.submissions (appraisal_started_at DESC)
  WHERE appraisal_started_at IS NOT NULL AND acv_value IS NULL;

NOTIFY pgrst, 'reload schema';