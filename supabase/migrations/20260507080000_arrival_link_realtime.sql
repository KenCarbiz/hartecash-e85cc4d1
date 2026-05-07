-- Arrival link tracking + realtime publication for submissions.
--
-- Two pieces:
-- 1. New column submissions.arrival_link_sent_at — stamped when the
--    customer_appointment_reminder_2h SMS auto-fires AND when staff
--    manually fire it from FrontDesk / the customer file. Lets the
--    UI show "already sent" state on the manual-send button without
--    a notification_log query per row.
-- 2. submissions added to the supabase_realtime publication so
--    FrontDesk + the customer-file slide-out can subscribe to live
--    progress_status changes (customer self-checks-in → receptionist
--    + greeter screens auto-update without a refresh).
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS arrival_link_sent_at timestamptz;

-- REPLICA IDENTITY FULL so realtime subscribers can see the OLD row
-- on UPDATE — required for filtering on the OLD progress_status if
-- a downstream subscriber needs the transition delta.
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
