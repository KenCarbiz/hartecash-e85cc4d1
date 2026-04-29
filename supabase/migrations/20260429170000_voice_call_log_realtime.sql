-- Enable Supabase realtime replication on voice_call_log so completed
-- Bland.ai calls (and intermediate status updates) appear in the
-- customer-file timeline without the rep refreshing.
--
-- Bland.ai's voice-call-webhook progressively updates the same row
-- (status: queued → in_progress → completed; then transcript +
-- recording_url get filled in by a later callback). The customer-file
-- realtime hook listens for all INSERTs and UPDATEs on this table so
-- every state transition shows up live.
--
-- Wrapped in DO blocks for idempotency, mirroring the
-- conversation_events realtime + pricing-model realtime migrations.
-- Falls back to mount-time fetch if the publication isn't available.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'voice_call_log'
    ) THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_call_log;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add voice_call_log to supabase_realtime: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- REPLICA IDENTITY FULL ships the complete row on UPDATE so the
-- realtime payload includes transcript / outcome / recording_url
-- without an extra fetch when those fields land asynchronously.
DO $$
BEGIN
  ALTER TABLE public.voice_call_log REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not set REPLICA IDENTITY FULL on voice_call_log: %', SQLERRM;
END $$;
