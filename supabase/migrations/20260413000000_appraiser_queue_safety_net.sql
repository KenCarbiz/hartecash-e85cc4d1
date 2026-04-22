-- Appraiser Queue safety-net migration
--
-- A production environment surfaced "column submissions.needs_appraisal
-- does not exist" even though 20260411001000_appraiser_queue.sql should
-- have added it. The original migration uses ADD COLUMN IF NOT EXISTS so
-- it should be idempotent, but something in that migration (possibly
-- the BEFORE trigger on submissions or the partial index) may have
-- caused the whole statement to roll back without surfacing an error.
--
-- This migration does nothing but the column adds, with no dependencies,
-- no triggers, and no indexes. If the columns already exist, it's a
-- no-op. If they don't, they land cleanly and nothing else runs.
-- Everything from 20260411001000 that depends on the columns (trigger,
-- function, index, comments) is re-applied defensively at the end.

-- ── Column adds ──────────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS needs_appraisal boolean NOT NULL DEFAULT false;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS offer_subject_to_inspection boolean NOT NULL DEFAULT false;

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS auto_route_appraiser_queue boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_appraiser boolean NOT NULL DEFAULT false;

-- ── Re-apply trigger and function defensively ───────────────────
-- CREATE OR REPLACE is idempotent so this is safe to run every time.
CREATE OR REPLACE FUNCTION public.auto_flag_subject_to_inspection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL
     AND NEW.estimated_offer_high IS NOT NULL
     AND NEW.offered_price > NEW.estimated_offer_high
  THEN
    NEW.offer_subject_to_inspection := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_subject_to_inspection ON public.submissions;
CREATE TRIGGER trg_submissions_subject_to_inspection
  BEFORE INSERT OR UPDATE OF offered_price, estimated_offer_high
  ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.auto_flag_subject_to_inspection();

-- ── Re-apply partial index defensively ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_submissions_needs_appraisal
  ON public.submissions (needs_appraisal, created_at DESC)
  WHERE needs_appraisal = true;
