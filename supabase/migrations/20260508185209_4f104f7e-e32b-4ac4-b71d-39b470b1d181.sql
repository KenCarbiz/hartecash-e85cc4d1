-- Customer-data protection hardening (20260508000000)

REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid)
  FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.pii_retention_config (
  dealership_id text PRIMARY KEY,
  voice_transcript_retention_days   integer NOT NULL DEFAULT 90,
  customer_memory_retention_days    integer NOT NULL DEFAULT 180,
  notification_log_retention_days   integer NOT NULL DEFAULT 365,
  recording_url_retention_days      integer NOT NULL DEFAULT 90,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (voice_transcript_retention_days  BETWEEN 7 AND 3650),
  CHECK (customer_memory_retention_days   BETWEEN 7 AND 3650),
  CHECK (notification_log_retention_days  BETWEEN 7 AND 3650),
  CHECK (recording_url_retention_days     BETWEEN 7 AND 3650)
);

INSERT INTO public.pii_retention_config (dealership_id)
VALUES ('default')
ON CONFLICT (dealership_id) DO NOTHING;

ALTER TABLE public.pii_retention_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access pii_retention_config" ON public.pii_retention_config;
CREATE POLICY "Service role full access pii_retention_config"
  ON public.pii_retention_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read pii_retention_config" ON public.pii_retention_config;
CREATE POLICY "Staff read pii_retention_config"
  ON public.pii_retention_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage own tenant retention config" ON public.pii_retention_config;
CREATE POLICY "Admins manage own tenant retention config"
  ON public.pii_retention_config FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

ALTER TABLE public.voice_call_log
  ADD COLUMN IF NOT EXISTS pii_redacted_at timestamptz;

ALTER TABLE public.voice_call_turns
  ADD COLUMN IF NOT EXISTS pii_redacted_at timestamptz;

ALTER TABLE public.voice_call_grades
  ADD COLUMN IF NOT EXISTS pii_redacted_at timestamptz;

CREATE OR REPLACE FUNCTION public.redact_old_voice_pii()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transcript_count int := 0;
  _turn_count       int := 0;
  _grade_count      int := 0;
  _recording_count  int := 0;
BEGIN
  WITH cfg AS (
    SELECT dealership_id, voice_transcript_retention_days, recording_url_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_log vcl
  SET transcript = '[redacted per retention policy]',
      summary = NULL,
      pii_redacted_at = now()
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcl.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days) || ' days'
    )::interval
    AND vcl.transcript IS NOT NULL
    AND vcl.transcript NOT LIKE '[redacted%]';
  GET DIAGNOSTICS _transcript_count = ROW_COUNT;

  WITH cfg AS (SELECT dealership_id, voice_transcript_retention_days FROM pii_retention_config),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_turns vct
  SET text = '[redacted]', pii_redacted_at = now()
  FROM voice_call_log vcl
  CROSS JOIN default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vct.call_id = vcl.id
    AND vct.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days) || ' days'
    )::interval;
  GET DIAGNOSTICS _turn_count = ROW_COUNT;

  WITH cfg AS (SELECT dealership_id, voice_transcript_retention_days FROM pii_retention_config),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_grades vcg
  SET rationale = '[redacted]', pii_redacted_at = now()
  FROM voice_call_log vcl
  CROSS JOIN default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcg.call_id = vcl.id
    AND vcg.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days) || ' days'
    )::interval
    AND vcg.rationale IS NOT NULL
    AND vcg.rationale != '[redacted]';
  GET DIAGNOSTICS _grade_count = ROW_COUNT;

  WITH cfg AS (SELECT dealership_id, recording_url_retention_days FROM pii_retention_config),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_log vcl
  SET recording_url = NULL
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcl.recording_url IS NOT NULL
    AND vcl.created_at < now() - (
      coalesce(t.recording_url_retention_days, d.recording_url_retention_days) || ' days'
    )::interval;
  GET DIAGNOSTICS _recording_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'transcripts_redacted',  _transcript_count,
    'turns_redacted',        _turn_count,
    'grades_redacted',       _grade_count,
    'recording_urls_nulled', _recording_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redact_old_voice_pii() TO service_role;

CREATE OR REPLACE FUNCTION public.redact_old_customer_memory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
BEGIN
  WITH cfg AS (
    SELECT dealership_id, customer_memory_retention_days FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE submissions s
  SET customer_memory = (
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    FROM jsonb_array_elements(s.customer_memory) item
    WHERE (item->>'captured_at')::timestamptz >= now() - (
      coalesce(t.customer_memory_retention_days, d.customer_memory_retention_days) || ' days'
    )::interval
  )
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = s.dealership_id::text
  WHERE s.customer_memory IS NOT NULL
    AND jsonb_typeof(s.customer_memory) = 'array'
    AND jsonb_array_length(s.customer_memory) > 0
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.customer_memory) item
      WHERE (item->>'captured_at')::timestamptz < now() - (
        coalesce(t.customer_memory_retention_days, d.customer_memory_retention_days) || ' days'
      )::interval
    );
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN jsonb_build_object('submissions_pruned', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redact_old_customer_memory() TO service_role;

CREATE TABLE IF NOT EXISTS public.customer_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text,
  staff_user_id uuid,
  staff_label text,
  submission_id uuid,
  voice_call_id uuid,
  resource_kind text NOT NULL,
  request_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_data_access_log_dealership_idx
  ON public.customer_data_access_log (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_access_log_staff_idx
  ON public.customer_data_access_log (staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_access_log_submission_idx
  ON public.customer_data_access_log (submission_id, created_at DESC)
  WHERE submission_id IS NOT NULL;

ALTER TABLE public.customer_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role write data access log" ON public.customer_data_access_log;
CREATE POLICY "Service role write data access log"
  ON public.customer_data_access_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read own tenant data access log" ON public.customer_data_access_log;
CREATE POLICY "Admins read own tenant data access log"
  ON public.customer_data_access_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.log_customer_data_access(
  _submission_id uuid,
  _voice_call_id uuid,
  _resource_kind text,
  _request_path  text DEFAULT NULL,
  _metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  uuid := auth.uid();
  _dealer   text;
  _label    text;
BEGIN
  IF _user_id IS NULL OR NOT public.is_staff(_user_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT s.dealership_id::text INTO _dealer
  FROM submissions s
  WHERE s.id = _submission_id;

  SELECT COALESCE(ur.display_name, ur.email)
  INTO _label
  FROM user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  INSERT INTO customer_data_access_log
    (dealership_id, staff_user_id, staff_label, submission_id,
     voice_call_id, resource_kind, request_path, metadata)
  VALUES
    (_dealer, _user_id, _label, _submission_id,
     _voice_call_id, _resource_kind, _request_path, _metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_customer_data_access(uuid, uuid, text, text, jsonb)
  TO authenticated, service_role;

SELECT cron.unschedule('redact_old_voice_pii')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'redact_old_voice_pii');
SELECT cron.schedule('redact_old_voice_pii', '30 3 * * *', $$ SELECT public.redact_old_voice_pii() $$);

SELECT cron.unschedule('redact_old_customer_memory')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'redact_old_customer_memory');
SELECT cron.schedule('redact_old_customer_memory', '40 3 * * *', $$ SELECT public.redact_old_customer_memory() $$);

NOTIFY pgrst, 'reload schema';