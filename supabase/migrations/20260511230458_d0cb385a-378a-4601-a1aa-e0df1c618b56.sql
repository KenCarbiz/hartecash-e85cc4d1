-- pickup_customer_data_purge_jobs — atomic claim helper for the
-- customer-data purge worker.
--
-- Why this is in its own migration: the original 20260509060000
-- bundled this RPC with a cron.schedule() call. Lovable skipped
-- that whole file because production already had the cron job
-- registered with a different (working) authorization header
-- pattern, and the migration's current_setting('app.supabase_
-- service_role_key', true) would have resolved to empty string
-- and broken the working schedule. The RPC itself never landed.
--
-- This migration applies ONLY the RPC. The cron schedule is
-- managed by Lovable's cron tool, not by static migration files
-- (per CLAUDE.md guidance).
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.pickup_customer_data_purge_jobs(
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  id              uuid,
  submission_id   uuid,
  contact_phone   text,
  contact_email   text,
  attempt_count   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM customer_data_purge_queue j
    WHERE j.status = 'pending'
      AND j.attempt_count < 5
    ORDER BY j.enqueued_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE customer_data_purge_queue j
  SET status        = 'processing',
      attempt_count = j.attempt_count + 1
  FROM picked p
  WHERE j.id = p.id
  RETURNING j.id, j.submission_id, j.contact_phone,
            j.contact_email, j.attempt_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pickup_customer_data_purge_jobs(integer)
  TO service_role;

NOTIFY pgrst, 'reload schema';