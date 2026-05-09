-- Purge-customer-storage cron + pickup helper.
--
-- Schedules the purge-customer-storage edge function to run every
-- minute, draining the customer_data_purge_queue. Adds a
-- pickup_customer_data_purge_jobs RPC that atomically claims
-- pending rows with FOR UPDATE SKIP LOCKED (mirrors the voice
-- pipeline retry pattern from 20260509020000).
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

-- Schedule the edge function — every minute.
SELECT cron.unschedule('purge_customer_storage')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_customer_storage');

SELECT cron.schedule(
  'purge_customer_storage',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true)
             || '/functions/v1/purge-customer-storage',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer '
          || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

NOTIFY pgrst, 'reload schema';
