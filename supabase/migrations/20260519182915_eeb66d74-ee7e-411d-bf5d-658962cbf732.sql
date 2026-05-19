DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'site_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_config;
  END IF;
END$$;

ALTER TABLE public.site_config REPLICA IDENTITY FULL;