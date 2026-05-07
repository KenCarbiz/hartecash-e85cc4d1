-- Twilio status callback + per-dealer inbound matching plumbing.
--
-- 1. notification_log.provider_message_id — the Twilio MessageSid
--    we recorded at send time, used by twilio-status-webhook to
--    join carrier-status updates back to the originating row.
-- 2. notification_log.delivered_at — populated when Twilio reports
--    'delivered' or its email equivalent. Lets the support panel
--    show "delivered 3min ago" vs "queued 5min ago" instead of
--    just "sent (we don''t know if it landed)."
-- 3. submissions index on (dealership_id, phone) so the
--    sms-webhook can match inbound SMS to the right submission per
--    tenant (was matching by phone alone, allowing cross-tenant
--    contamination — architect-audit P0).
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_log_provider_message_idx
  ON public.notification_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_dealer_phone_idx
  ON public.submissions (dealership_id, phone)
  WHERE phone IS NOT NULL;

NOTIFY pgrst, 'reload schema';
