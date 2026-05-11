-- Group A retry
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS needs_appraisal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_subject_to_inspection boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_submissions_needs_appraisal
  ON public.submissions (needs_appraisal, created_at DESC)
  WHERE needs_appraisal = true;

CREATE OR REPLACE FUNCTION public.auto_flag_subject_to_inspection()
RETURNS trigger LANGUAGE plpgsql AS $$
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

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS auto_route_appraiser_queue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_photo_reappraisal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_pct integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_dollars integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_daily_cap integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_confidence_floor integer NOT NULL DEFAULT 70;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_appraiser boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_reappraisal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',
  old_offer integer,
  suggested_offer integer NOT NULL,
  delta integer NOT NULL,
  reported_condition text,
  ai_condition_score text,
  ai_damage_summary text,
  ai_confidence integer,
  photos_analyzed integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'suggested',
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_reappraisal_submission
  ON public.ai_reappraisal_log (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_reappraisal_open
  ON public.ai_reappraisal_log (dealership_id, created_at DESC)
  WHERE status = 'suggested';

ALTER TABLE public.ai_reappraisal_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_reappraisal_service_all" ON public.ai_reappraisal_log;
CREATE POLICY "ai_reappraisal_service_all"
  ON public.ai_reappraisal_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.auto_queue_stale_offers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  WITH flipped AS (
    UPDATE public.submissions
    SET needs_appraisal = true
    WHERE needs_appraisal = false
      AND estimated_offer_high IS NOT NULL
      AND estimated_offer_high > 0
      AND created_at < now() - interval '3 hours'
      AND (
        progress_status IS NULL
        OR progress_status NOT IN (
          'deal_finalized','check_request_submitted','purchase_complete','dead_lead'
        )
      )
    RETURNING id, dealership_id
  )
  INSERT INTO public.activity_log (submission_id, action, old_value, new_value, performed_by)
  SELECT id, 'Auto-flagged for Appraiser Queue (3h no accept)', NULL, NULL, 'system'
  FROM flipped;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-queue-stale-offers');
EXCEPTION WHEN undefined_function THEN NULL; WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('auto-queue-stale-offers','*/15 * * * *',
  $$SELECT public.auto_queue_stale_offers();$$);

SELECT public.auto_queue_stale_offers();

NOTIFY pgrst, 'reload schema';