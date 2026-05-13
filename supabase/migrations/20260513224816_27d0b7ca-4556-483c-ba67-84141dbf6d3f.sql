-- Re-key the process-follow-ups-daily cron job to authenticate with the
-- service-role key from Vault (instead of the anon key). The
-- process-follow-ups edge function now requires service-role / platform-admin
-- auth as part of the open-endpoint hardening pass — anon-keyed cron calls
-- would 401.
--
-- Idempotent: only runs cron.alter_job when the job exists. Safe to re-apply.
DO $$
DECLARE
  jid bigint;
  svc_key text;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'process-follow-ups-daily';
  IF jid IS NULL THEN
    RAISE NOTICE 'process-follow-ups-daily cron job not registered — skipping';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF svc_key IS NULL OR length(svc_key) = 0 THEN
    RAISE EXCEPTION 'Vault secret email_queue_service_role_key missing — cannot re-key cron';
  END IF;

  PERFORM cron.alter_job(
    job_id  := jid,
    command := format($cmd$
      SELECT net.http_post(
        url := 'https://ptiwdwfdckfqivoocyvp.supabase.co/functions/v1/process-follow-ups',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{"time": "scheduled"}'::jsonb
      ) AS request_id;
    $cmd$, svc_key)
  );
END $$;