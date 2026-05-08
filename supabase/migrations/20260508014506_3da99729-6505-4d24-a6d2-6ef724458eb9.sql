ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS arrival_link_sent_at timestamptz;

ALTER TABLE public.submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';