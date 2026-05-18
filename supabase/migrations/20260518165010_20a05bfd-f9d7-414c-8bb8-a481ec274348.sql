-- Idempotent prune function for processed_webhook_calls
-- Deletes deduplication records older than 30 days.
CREATE OR REPLACE FUNCTION public.prune_processed_webhook_calls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.processed_webhook_calls
  WHERE processed_at < now() - interval '30 days';
END;
$$;

-- Grant execute so the cron job (runs as postgres) can call it
GRANT EXECUTE ON FUNCTION public.prune_processed_webhook_calls() TO postgres;

NOTIFY pgrst, 'reload schema';
