ALTER TABLE public.site_config
ADD COLUMN IF NOT EXISTS landing_cta_color TEXT;

NOTIFY pgrst, 'reload schema';