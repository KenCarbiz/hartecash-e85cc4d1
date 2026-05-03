
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-egress', 'data-egress', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='data-egress platform admin read') THEN
    CREATE POLICY "data-egress platform admin read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'data-egress' AND public.is_platform_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='data-egress platform admin write') THEN
    CREATE POLICY "data-egress platform admin write"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'data-egress' AND public.is_platform_admin(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
