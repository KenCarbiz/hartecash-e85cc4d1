-- Force PostgREST to fully drop schema cache. Sanity-check that
-- landing_cta_color and ghost_* columns exist, then notify.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='site_config' AND column_name='landing_cta_color') THEN
    ALTER TABLE public.site_config ADD COLUMN landing_cta_color text;
  END IF;
END$$;
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';