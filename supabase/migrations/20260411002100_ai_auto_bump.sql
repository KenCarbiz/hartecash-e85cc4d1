-- AI Auto-Bump — Commit 2
--
-- Builds on 20260411002000_ai_photo_reappraisal.sql. Commit 1 shipped
-- the re-appraisal engine in "suggest only" mode — every recommendation
-- writes to ai_reappraisal_log with status='suggested' and a human has
-- to Accept or Dismiss it from the Appraiser Queue.
--
-- This migration adds the toggles + safety limits that let the AI
-- apply bumps automatically once the dealer trusts the system. The
-- edge function ai-photo-reappraisal already reads these columns and
-- enforces every safety check — this migration just adds the columns.
--
-- Safety limits that all must pass before auto-apply:
--   1. ai_auto_bump_enabled = true (master toggle)
--   2. AI confidence >= ai_auto_bump_confidence_floor
--   3. Bump pct <= ai_auto_bump_max_pct
--   4. Bump dollars <= ai_auto_bump_max_dollars
--   5. Dealership daily cumulative bumps <= ai_auto_bump_daily_cap
--
-- Reductions (AI saw worse condition than customer claimed) are NEVER
-- auto-applied — only positive bumps. A human always has to confirm
-- a reduction so the customer doesn't see their number drop silently.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ai_auto_bump_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_pct integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_dollars integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_daily_cap integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_confidence_floor integer NOT NULL DEFAULT 70;

COMMENT ON COLUMN public.site_config.ai_auto_bump_enabled IS
  'When true, the AI automatically applies bump recommendations from ai_photo_reappraisal without requiring human approval, subject to the four safety limits below.';

COMMENT ON COLUMN public.site_config.ai_auto_bump_max_pct IS
  'Maximum percent bump the AI can auto-apply without human review. Default 15%. Bumps larger than this go to the Appraiser Queue as suggestions instead.';

COMMENT ON COLUMN public.site_config.ai_auto_bump_max_dollars IS
  'Maximum dollar bump the AI can auto-apply without human review. Default $2000. Bumps larger than this go to the Appraiser Queue as suggestions instead.';

COMMENT ON COLUMN public.site_config.ai_auto_bump_daily_cap IS
  'Maximum cumulative auto-bump dollars per day per dealership. Default $10,000. Once this cap is hit, further bumps go to the queue instead of auto-applying. Set to 0 to disable the daily cap.';

COMMENT ON COLUMN public.site_config.ai_auto_bump_confidence_floor IS
  'Minimum AI confidence score (0-100) required before auto-apply. Default 70. Recommendations below this confidence go to the queue as suggestions instead.';
