ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tracker_oem_flagships jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';