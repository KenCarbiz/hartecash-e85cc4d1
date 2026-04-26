-- 1. Add ui_refresh_enabled toggle to site_config
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ui_refresh_enabled boolean NOT NULL DEFAULT false;

-- 2. Add lot-arrival tracking timestamps to submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS on_the_way_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS arrived_at    timestamp with time zone;

-- 3. Make activity_log.submission_id nullable so system-level events can be logged
ALTER TABLE public.activity_log
  ALTER COLUMN submission_id DROP NOT NULL;