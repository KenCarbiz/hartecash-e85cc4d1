-- Retention prune for processed_webhook_calls.
--
-- The processed_webhook_calls table from 20260515130000 records every
-- inbound provider webhook payload hash for replay-protection dedupe.
-- Each row is ~150 bytes; at ~5k voice events/day across the network
-- that's ~275MB/year of nothing-useful. We only need recent history
-- — by the time a webhook is 30 days old, no provider is going to
-- replay it.
--
-- This migration adds a SECURITY DEFINER RPC that deletes rows older
-- than the retention window (default 30 days, callable with a custom
-- window for one-off audits). The RPC is the cron target; per
-- CLAUDE.md, the pg_cron schedule itself is registered via Lovable's
-- cron tool, NOT in this migration.
--
-- Why a function instead of a one-line DELETE in cron:
--   * SECURITY DEFINER lets us call from a cron job without the
--     service-role JWT plumbing the older "app.supabase_service_role_key"
--     pattern (which CLAUDE.md flags as broken in this project).
--   * Returns the deleted count so cron logs surface "pruned N rows"
--     instead of a silent success.
--   * Centralizes the retention window so changing 30→90 is a one-line
--     edit, not a cron-tool update.
--
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.prune_processed_webhook_calls(
  _retention_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF _retention_days IS NULL OR _retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be >= 1, got %', _retention_days;
  END IF;

  DELETE FROM public.processed_webhook_calls
   WHERE processed_at < now() - make_interval(days => _retention_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'prune_processed_webhook_calls: deleted % rows older than % days',
    deleted_count, _retention_days;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_processed_webhook_calls(integer) IS
  'Retention prune for the webhook-replay dedupe ledger. Default 30d window. Returns the deleted count. Target for a daily pg_cron job — register via the Lovable cron tool, not in a migration.';

-- Lock down execution. The cron job runs as a privileged role; no
-- reason for any client or end user to invoke this directly.
REVOKE ALL ON FUNCTION public.prune_processed_webhook_calls(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_processed_webhook_calls(integer) TO service_role;

NOTIFY pgrst, 'reload schema';
