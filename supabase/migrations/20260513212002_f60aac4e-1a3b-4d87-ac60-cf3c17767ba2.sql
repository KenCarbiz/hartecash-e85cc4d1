DO $$
DECLARE v text;
BEGIN
  FOR v IN SELECT unnest(ARRAY[
    'v_bulk_access_anomalies',
    'v_cron_health_recent',
    'v_dealership_mfa_status',
    'v_dealership_privacy_posture',
    'v_error_log_recent',
    'v_login_attempts_recent',
    'v_unmatched_customer_phrases',
    'v_voice_call_quality',
    'v_voice_call_quality_with_nps'
  ]) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v AND c.relkind='v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';