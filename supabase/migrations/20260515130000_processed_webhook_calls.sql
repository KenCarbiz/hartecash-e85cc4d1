-- Webhook replay-protection dedupe table.
--
-- Bland.ai and other providers occasionally fire the same webhook
-- payload twice (network retry after we returned 5xx, redrive after
-- a transient timeout, etc). The voice-call-webhook in particular
-- runs heavy side-effects per call (campaign counter increments,
-- SMS sends, submission status flips, opt-out inserts) — replay
-- meant double-counting, duplicate SMS to the customer, and on rare
-- occasions a customer who'd opted out getting re-contacted because
-- a stale "accepted" callback re-flipped progress_status.
--
-- This table records the (provider, provider_call_id, payload_hash)
-- tuple after a webhook has been processed. The webhook handlers
-- attempt an INSERT first; ON CONFLICT → return 200 with a
-- {deduplicated: true} body and skip all side-effects.
--
-- We hash the full body (SHA-256 hex) rather than just the call_id
-- because Bland fires distinct callbacks for in-progress vs final
-- states for the same call_id — those are NOT replays, they're
-- different events. A byte-identical payload is the replay signal.
--
-- Retention: 30 days. The 30-day cutoff is enforced by a separate
-- pg_cron job (registered via Lovable cron tool per CLAUDE.md) —
-- this migration only creates the table + indexes, no cron.
--
-- Idempotent throughout.

CREATE TABLE IF NOT EXISTS public.processed_webhook_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_call_id text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  -- Optional pointer back to the row we created/updated, for audit
  -- forensics ("which call_log did this hash correspond to?").
  call_log_id uuid NULL,
  CONSTRAINT processed_webhook_calls_unique
    UNIQUE (provider, provider_call_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS processed_webhook_calls_processed_at_idx
  ON public.processed_webhook_calls (processed_at);

COMMENT ON TABLE public.processed_webhook_calls IS
  'Dedupe ledger for inbound provider webhooks (Bland, Twilio). Handlers attempt INSERT with (provider, provider_call_id, payload_hash); ON CONFLICT they short-circuit and return 200. Prevents replay-induced double-counts, double-SMS, and resurrected opt-outs.';

-- RLS: only the service role writes here; no end-user reads. Lock it down.
ALTER TABLE public.processed_webhook_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS processed_webhook_calls_service_only ON public.processed_webhook_calls;
CREATE POLICY processed_webhook_calls_service_only
  ON public.processed_webhook_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
