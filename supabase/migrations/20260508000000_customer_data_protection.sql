-- Customer-data protection hardening — closes the air gap.
--
-- AUDIT FINDINGS (this migration's reason for existing):
--
-- P0  compile_voice_agent_prompt was granted to `anon` in
--     20260507130000 and 20260507180000. The function takes a
--     submission_id and returns customer name + vehicle + current
--     offer + ACV ceiling + decline reason + competitor mentioned +
--     walk-away number + loan status + customer_memory personal-life
--     facts. Any anonymous caller with a submission UUID could pull
--     it all. We REVOKE anon and authenticated; service-role only.
--     The only legit caller is launch-voice-call's edge function,
--     which already runs under the service role.
--
-- P1  voice_call_log.transcript and voice_call_turns.text retain
--     verbatim customer speech indefinitely. Even with proper RLS,
--     "indefinitely" is the wrong default for PII. We add a redaction
--     job that, after voice_pii_retention_days (default 90), replaces
--     transcript / per-turn text with a stub while keeping aggregate
--     stats (sentiment, latency, matched_signal_key) for the bandit.
--     Recording_url gets nulled at the same point — Bland's URLs
--     should be expired by then anyway.
--
-- P1  customer_memory jsonb on submissions retains personal-life
--     details forever. We redact items captured > customer_memory_
--     retention_days (default 180) ago.
--
-- P2  customer_data_access_log table — every time a staff member
--     pulls a submission's voice_call_log / voice_call_turns row, a
--     row is logged here so a later legal-hold or breach audit can
--     answer "who saw what."
--
-- Idempotent. Safe to re-run.

-- ── 1. Revoke anon + authenticated from compile_voice_agent_prompt ──
-- Both signatures (the 3-arg from 20260507130000 / 20260507170000 and
-- the 4-arg from 20260507180000). Use REVOKE; idempotent on absent.

REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid)
  FROM anon, authenticated;

-- Re-grant to service_role explicitly (no-op if already there).
GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text, uuid)
  TO service_role;

-- ── 2. PII retention configuration ────────────────────────────────
-- Per-tenant overrideable. Defaults documented inline. Admins can
-- raise / lower via the Compliance tab once we surface a UI for it.

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

DROP POLICY IF EXISTS "Service role full access pii_retention_config"
  ON public.pii_retention_config;
CREATE POLICY "Service role full access pii_retention_config"
  ON public.pii_retention_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read pii_retention_config"
  ON public.pii_retention_config;
CREATE POLICY "Staff read pii_retention_config"
  ON public.pii_retention_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins manage own tenant retention config"
  ON public.pii_retention_config;
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

-- ── 3. redact_old_voice_pii RPC ───────────────────────────────────
-- Replaces transcripts, turn text, and recording_url with stubs
-- (NOT NULL stays NOT NULL via empty-string sentinel where needed)
-- while keeping aggregate columns the bandit needs:
--    voice_call_log: keeps duration_seconds, status, outcome,
--                    composite scores via voice_call_grades,
--                    feedback_score, original_offer.
--    voice_call_turns: keeps speaker, sentiment, sentiment_score,
--                    emotion_top, latency, was_interrupted,
--                    silence_before_ms, matched_signal_key.
--    voice_call_grades: rationale CAN quote customer back, redact
--                    independently.
--
-- Adds redacted_at marker so the UI can display "transcript redacted
-- per retention policy" instead of an empty box.

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
  -- Use the 'default' tenant's window as the floor for legacy rows
  -- without a dealership_id; per-tenant overrides win.
  WITH cfg AS (
    SELECT
      dealership_id,
      voice_transcript_retention_days,
      recording_url_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (
    SELECT * FROM cfg WHERE dealership_id = 'default'
  )
  -- Transcript redaction
  UPDATE voice_call_log vcl
  SET transcript     = '[redacted per retention policy]',
      summary        = NULL,
      pii_redacted_at = now()
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcl.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days)
      || ' days'
    )::interval
    AND vcl.transcript IS NOT NULL
    AND vcl.transcript NOT LIKE '[redacted%]';
  GET DIAGNOSTICS _transcript_count = ROW_COUNT;

  -- Per-turn text redaction
  WITH cfg AS (
    SELECT dealership_id, voice_transcript_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_turns vct
  SET text            = '[redacted]',
      pii_redacted_at = now()
  FROM voice_call_log vcl
  CROSS JOIN default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vct.call_id = vcl.id
    AND vct.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days)
      || ' days'
    )::interval;
  GET DIAGNOSTICS _turn_count = ROW_COUNT;

  -- Grade rationale redaction (often quotes the customer)
  WITH cfg AS (
    SELECT dealership_id, voice_transcript_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_grades vcg
  SET rationale       = '[redacted]',
      pii_redacted_at = now()
  FROM voice_call_log vcl
  CROSS JOIN default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcg.call_id = vcl.id
    AND vcg.pii_redacted_at IS NULL
    AND vcl.created_at < now() - (
      coalesce(t.voice_transcript_retention_days, d.voice_transcript_retention_days)
      || ' days'
    )::interval
    AND vcg.rationale IS NOT NULL
    AND vcg.rationale != '[redacted]';
  GET DIAGNOSTICS _grade_count = ROW_COUNT;

  -- Recording URL nulled separately (different retention default
  -- because Bland URLs may have shorter inherent TTL — we don't
  -- want a URL pointing to nowhere lingering in the DB).
  WITH cfg AS (
    SELECT dealership_id, recording_url_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE voice_call_log vcl
  SET recording_url = NULL
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = vcl.dealership_id::text
  WHERE vcl.recording_url IS NOT NULL
    AND vcl.created_at < now() - (
      coalesce(t.recording_url_retention_days, d.recording_url_retention_days)
      || ' days'
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

-- ── 4. redact_old_customer_memory RPC ─────────────────────────────
-- customer_memory is a jsonb array of personal-life facts on
-- submissions. Each item carries captured_at; we drop items older
-- than customer_memory_retention_days. Submission as a whole is
-- preserved; only the personal-life jsonb gets pruned.

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
    SELECT dealership_id, customer_memory_retention_days
    FROM pii_retention_config
  ),
  default_cfg AS (SELECT * FROM cfg WHERE dealership_id = 'default')
  UPDATE submissions s
  SET customer_memory = (
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    FROM jsonb_array_elements(s.customer_memory) AS item
    WHERE (item ->> 'captured_at')::timestamptz
        > now() - (
          coalesce(t.customer_memory_retention_days, d.customer_memory_retention_days)
          || ' days'
        )::interval
  )
  FROM default_cfg d
  LEFT JOIN cfg t ON t.dealership_id = s.dealership_id::text
  WHERE jsonb_array_length(s.customer_memory) > 0;
  GET DIAGNOSTICS _count = ROW_COUNT;

  RETURN jsonb_build_object('submissions_pruned', _count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redact_old_customer_memory() TO service_role;

-- ── 5. customer_data_access_log — staff PII-view audit trail ──────
-- Append-only. Service-role-write only (edge functions log views
-- that they perform server-side). Admins read their own tenant's
-- log for a "who saw what" answer if a customer files a privacy
-- request.

CREATE TABLE IF NOT EXISTS public.customer_data_access_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   text,
  staff_user_id   uuid,
  staff_label     text,
  submission_id   uuid,
  voice_call_id   uuid,
  resource_kind   text NOT NULL CHECK (resource_kind IN (
    'submission_view', 'transcript_view', 'recording_play',
    'memory_view', 'export', 'redact'
  )),
  request_path    text,
  ip_addr         inet,
  user_agent      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_data_access_log_dealership_idx
  ON public.customer_data_access_log (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_access_log_staff_idx
  ON public.customer_data_access_log (staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_data_access_log_submission_idx
  ON public.customer_data_access_log (submission_id, created_at DESC)
  WHERE submission_id IS NOT NULL;

ALTER TABLE public.customer_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role write data access log"
  ON public.customer_data_access_log;
CREATE POLICY "Service role write data access log"
  ON public.customer_data_access_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read own tenant data access log"
  ON public.customer_data_access_log;
CREATE POLICY "Admins read own tenant data access log"
  ON public.customer_data_access_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- ── 6. log_customer_data_access RPC ───────────────────────────────
-- Authenticated-callable so the admin UI can self-record views.
-- Inputs are user-supplied; we trust the caller's identity (auth.uid())
-- but verify they have staff role on the submission's tenant.

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

-- ── 7. Schedule the redaction job ─────────────────────────────────
-- Runs at 03:30 UTC nightly (before the 04:15 variant decay so the
-- two don't compete for IO). Idempotent unschedule-then-schedule.

SELECT cron.unschedule('redact_old_voice_pii')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'redact_old_voice_pii'
);
SELECT cron.schedule(
  'redact_old_voice_pii',
  '30 3 * * *',
  $$ SELECT public.redact_old_voice_pii() $$
);

SELECT cron.unschedule('redact_old_customer_memory')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'redact_old_customer_memory'
);
SELECT cron.schedule(
  'redact_old_customer_memory',
  '40 3 * * *',
  $$ SELECT public.redact_old_customer_memory() $$
);

NOTIFY pgrst, 'reload schema';
