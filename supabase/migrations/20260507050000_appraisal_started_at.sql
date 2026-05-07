-- Phase 2 / item 13: appraisal-in-progress signal.
--
-- When the appraiser opens the appraisal page for a submission, we
-- stamp `appraisal_started_at`. The customer-file slide-out reads
-- this + acv_value to show a live pill back to the salesperson:
--
--   appraisal_started_at IS NOT NULL AND acv_value IS NULL
--     -> "Appraiser working on it (started 12m ago)"
--
-- Once the appraiser writes acv_value the existing trigger fires
-- (NEW.appraised_by + NEW.appraised_by_user_id from
--  20260507040000_appraised_by_user_id.sql) and the pill flips off
-- because acv_value is now populated.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS appraisal_started_at timestamptz;

CREATE INDEX IF NOT EXISTS submissions_appraisal_started_idx
  ON public.submissions (appraisal_started_at DESC)
  WHERE appraisal_started_at IS NOT NULL AND acv_value IS NULL;

NOTIFY pgrst, 'reload schema';
