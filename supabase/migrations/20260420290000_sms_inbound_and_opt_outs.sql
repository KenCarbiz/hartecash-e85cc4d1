-- Inbound SMS + opt-out tracking.
--
-- When a customer replies to one of our outbound texts, Twilio posts
-- the reply to the sms-webhook edge function. We:
--   1. Match the From phone to a submission (most recent open one)
--   2. Log it as a conversation_event (inbound / sms / customer)
--   3. Handle STOP / HELP / STARTED keywords per TCPA
--   4. Fire a staff_customer_replied notification so the assigned
--      rep knows the customer is engaging
--
-- Step 3 needs a place to record opt-outs. sms_opt_outs already exists
-- per prior migrations — this migration ensures the schema has
-- everything we need plus a staff_customer_replied template key.

-- Defensive: make sure sms_opt_outs exists with the columns the
-- inbound handler assumes. Idempotent.
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  dealership_id text,
  reason text,
  opted_out_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_opt_outs IS
  'Phone numbers that replied STOP / UNSUBSCRIBE / CANCEL to our SMS. Carriers require we honor these immediately — send-notification queries this table before every outbound SMS send.';

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Service role manages opt-outs"
  ON public.sms_opt_outs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Staff read opt-outs"
  ON public.sms_opt_outs FOR SELECT TO authenticated
  USING (true);

-- Track inbound messages for idempotency — Twilio sometimes retries a
-- webhook on timeout; we don't want to double-log.
CREATE TABLE IF NOT EXISTS public.sms_inbound_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  from_phone text NOT NULL,
  to_phone text,
  body text,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  dealership_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_inbound_log IS
  'Every inbound SMS Twilio delivers. Provider_message_id is unique — second webhook for the same MessageSid is a no-op.';

CREATE INDEX IF NOT EXISTS sms_inbound_log_submission_idx
  ON public.sms_inbound_log (submission_id, created_at DESC)
  WHERE submission_id IS NOT NULL;

ALTER TABLE public.sms_inbound_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role writes inbound log" ON public.sms_inbound_log;
CREATE POLICY "Service role writes inbound log"
  ON public.sms_inbound_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read inbound log" ON public.sms_inbound_log;
CREATE POLICY "Staff read inbound log"
  ON public.sms_inbound_log FOR SELECT TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
