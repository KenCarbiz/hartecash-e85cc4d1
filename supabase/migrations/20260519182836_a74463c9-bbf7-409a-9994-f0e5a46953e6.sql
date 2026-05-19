ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS hero_tuner_config jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';