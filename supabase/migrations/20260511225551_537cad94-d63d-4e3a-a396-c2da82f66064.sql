DO $$
DECLARE _conname text;
BEGIN
  SELECT conname INTO _conname FROM pg_constraint
  WHERE conrelid = 'public.customer_data_access_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%resource_kind%'
    AND pg_get_constraintdef(oid) NOT LIKE '%photo_view%';
  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.customer_data_access_log DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customer_data_access_log'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%photo_view%'
  ) THEN
    ALTER TABLE public.customer_data_access_log
      ADD CONSTRAINT customer_data_access_log_resource_kind_check
      CHECK (resource_kind IN (
        'submission_view', 'transcript_view', 'recording_play',
        'memory_view', 'export', 'redact', 'photo_view'
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';