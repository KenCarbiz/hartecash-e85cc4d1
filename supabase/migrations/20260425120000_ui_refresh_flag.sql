-- UI Refresh — kill switch + customer self check-in support
-- See frontend-redesign/CLAUDE_CODE_BRIEF.md §6 and §7.
--
-- Adds:
--   1. site_config.ui_refresh_enabled — per-tenant kill switch for the refreshed UI.
--   2. submissions.on_the_way_at / arrived_at — timestamps for customer self check-in.
--   3. Allows activity_log.submission_id to be NULL so we can audit non-submission
--      events (e.g. the kill-switch toggle itself).
--
-- progress_status is a free TEXT column with role enforcement via the
-- enforce_submission_update_roles() trigger; no enum/CHECK changes are required
-- to allow the new "arrived" / "on_the_way" values.

-- 1. Kill switch column on site_config (default OFF — dealers opt in)
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ui_refresh_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_config.ui_refresh_enabled IS
  'When true, this tenant''s admins see the refreshed UI (new sidebar, Today page, lead table, appraiser queue). Toggled per-tenant by platform admins. Default false.';

-- 2. Customer self check-in timestamps on submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS arrived_at    TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.submissions.on_the_way_at IS
  'Stamped when the customer taps "I''m on my way" on /check-in/:token.';
COMMENT ON COLUMN public.submissions.arrived_at IS
  'Stamped when the customer taps "I''m here" on /check-in/:token.';

-- 3. Allow non-submission audit entries (kill-switch toggle, future platform events)
ALTER TABLE public.activity_log
  ALTER COLUMN submission_id DROP NOT NULL;

COMMENT ON COLUMN public.activity_log.submission_id IS
  'Submission this entry belongs to. NULL for tenant- or platform-scoped events (e.g. ui_refresh_toggled).';
