-- Enable Supabase realtime replication on conversation_events so the
-- customer-file comms surfaces (ConversationThread, ClassicCommsCard,
-- ClassicCommsFullView, CustomerFileV2 conversation tab) refresh
-- automatically when sms-webhook or any other writer inserts a new
-- row. Without this, reps had to manually refresh to see customer
-- inbound replies.
--
-- The hook `useConversationRealtime(submissionId, onInsert)` listens
-- for INSERT events filtered by submission_id. We only need INSERTs
-- since rows aren't UPDATEd or DELETEd in normal operation.
--
-- Wrapped in DO blocks for idempotency — same pattern as
-- 20260415130000_platform_pricing_model_realtime.sql. Never fail the
-- migration on realtime setup; the app degrades gracefully (timeline
-- shows what was loaded on mount until the user refreshes).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'conversation_events'
    ) THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_events;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add conversation_events to supabase_realtime: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- REPLICA IDENTITY DEFAULT is fine — we filter by submission_id which
-- is part of the primary key path and present in the INSERT payload's
-- `new` record without REPLICA IDENTITY FULL. Setting FULL would ship
-- larger payloads (body_text, metadata) on every change which is
-- unnecessary for our INSERT-only listener.
