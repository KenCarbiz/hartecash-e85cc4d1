ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ui_refresh_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ NULL;

ALTER TABLE public.activity_log
  ALTER COLUMN submission_id DROP NOT NULL;