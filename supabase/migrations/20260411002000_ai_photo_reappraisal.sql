-- AI Photo Re-Appraisal — Manual Mode (Commit 1)
--
-- When a customer uploads vehicle photos, the existing
-- analyze-vehicle-damage edge function already runs Gemini 2.5 Flash
-- over each image and writes ai_condition_score + ai_damage_summary
-- back to the submission. What's been missing is a second step: take
-- that AI condition assessment, compare it to what the customer
-- self-reported, and if the AI sees better condition than the
-- customer claimed, RECOMMEND a higher offer.
--
-- This migration adds the plumbing for "suggest only" mode. A second
-- migration (ai_auto_bump) will add the toggles that let the AI
-- automatically apply the bump without human review.
--
-- Every re-appraisal run gets logged to ai_reappraisal_log with full
-- context so the appraiser queue can surface it, and so the audit
-- trail is intact regardless of whether auto-apply ever runs.

-- ── ai_reappraisal_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_reappraisal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',

  -- Numbers
  old_offer integer,
  suggested_offer integer NOT NULL,
  delta integer NOT NULL,              -- suggested_offer - old_offer (can be negative)

  -- AI signal used to produce this recommendation
  reported_condition text,              -- what the customer said
  ai_condition_score text,              -- what Gemini decided
  ai_damage_summary text,               -- "AI detected 2 minor issues: ..."
  ai_confidence integer,                -- 0-100, from damage_reports
  photos_analyzed integer NOT NULL DEFAULT 0,

  -- Reasoning (human-readable, shown in the queue row)
  reason text NOT NULL,

  -- Lifecycle
  status text NOT NULL DEFAULT 'suggested',
  -- one of: 'suggested' | 'accepted' | 'dismissed' | 'auto_applied' | 'blocked_cap' | 'blocked_confidence'
  decided_at timestamptz,
  decided_by text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_reappraisal_submission
  ON public.ai_reappraisal_log (submission_id, created_at DESC);

-- Partial index for the queue query — only open suggestions
CREATE INDEX IF NOT EXISTS idx_ai_reappraisal_open
  ON public.ai_reappraisal_log (dealership_id, created_at DESC)
  WHERE status = 'suggested';

ALTER TABLE public.ai_reappraisal_log ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can read + write
DROP POLICY IF EXISTS "ai_reappraisal_service_all" ON public.ai_reappraisal_log;
CREATE POLICY "ai_reappraisal_service_all"
  ON public.ai_reappraisal_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── site_config flag (Commit 1 scope) ───────────────────────────────
-- Per-dealer master toggle. When false, the ai-photo-reappraisal
-- edge function is a no-op even if something calls it.
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ai_photo_reappraisal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_config.ai_photo_reappraisal IS
  'Master toggle for AI photo re-appraisal. When true, uploaded customer photos trigger a Gemini-based re-evaluation of vehicle condition and a recommended offer adjustment. Recommendations always appear in the Appraiser Queue for review. Auto-apply is controlled separately by ai_auto_bump_enabled.';
