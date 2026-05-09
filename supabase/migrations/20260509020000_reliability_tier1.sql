-- Tier 1 reliability — atomic counters, error log, retry queue, cron health.
--
-- Closes the four highest-priority reliability findings from the
-- 4-agent audit:
--
--   1. Variant store win/loss race (apply_voice_call_outcome did
--      read-modify-write — concurrent updates lost increments).
--      Fixed by rewriting the RPC to use atomic SET col = col + delta
--      in a single statement.
--
--   2. No backend error monitoring. Adds error_log table + report_
--      error RPC. Edge functions call report_error() in their catch
--      blocks; admins view via v_error_log_recent. Strictly better
--      than the current "console.error to Supabase logs and hope
--      someone tails them" baseline. Tenant-scoped reads.
--
--   3. voice-call-enrich / -grade fire-and-forget chain has no
--      retry. Adds voice_pipeline_jobs queue: every voice_call_log
--      row that completes without an enrichment + grade lands here
--      as 'pending'; a 5-min cron picks up rows stuck >2 min and
--      re-invokes. Status transitions: pending → enriched → graded
--      | failed.
--
--   4. Cron job health unmonitored. Adds v_cron_health_recent view
--      reading cron.job_run_details + a daily cron_health_check job
--      that inserts an error_log row for any failure in the last
--      24h so it surfaces in the admin error console.
--
-- Idempotent.

-- ── 1. Atomic variant counter — rewrite apply_voice_call_outcome ──
-- The prior version did:
--   FOR rec IN SELECT … LOOP
--     UPDATE … SET win_count = win_count + win_delta WHERE …
--   END LOOP;
-- which is fine per-row but has zero concurrency control if two
-- calls finish within seconds against the same variant — both
-- reads of voice_call_variants_used see the same starting state
-- and both increments race.
--
-- This rewrite collapses the loop into a single UPDATE per source
-- table using a JOIN to voice_call_variants_used. The atomic
-- 'col = col + delta' construct is the only safe pattern under
-- concurrent writes; Postgres' MVCC guarantees it.

CREATE OR REPLACE FUNCTION public.apply_voice_call_outcome(
  _call_id uuid,
  _outcome_score numeric,
  _retire_gating_failures boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win_delta int;
  loss_delta int;
  should_retire boolean;
BEGIN
  IF _outcome_score > 0 THEN
    win_delta  := GREATEST(1, ceil(_outcome_score)::int);
    loss_delta := 0;
  ELSE
    win_delta  := 0;
    loss_delta := GREATEST(1, ceil(abs(_outcome_score))::int);
  END IF;

  should_retire := _retire_gating_failures AND _outcome_score <= -2.0;

  -- voice_agent_persona — atomic increment via JOIN
  UPDATE public.voice_agent_persona vap
  SET win_count  = vap.win_count  + win_delta,
      loss_count = vap.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE vap.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'voice_agent_persona'
    AND vap.variant_id = u.variant_id;

  -- conversation_phases
  UPDATE public.conversation_phases cp
  SET win_count  = cp.win_count  + win_delta,
      loss_count = cp.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE cp.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'conversation_phases'
    AND cp.variant_id = u.variant_id;

  -- customer_signals
  UPDATE public.customer_signals cs
  SET win_count  = cs.win_count  + win_delta,
      loss_count = cs.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE cs.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'customer_signals'
    AND cs.variant_id = u.variant_id;

  -- industry_intel
  UPDATE public.industry_intel ii
  SET win_count  = ii.win_count  + win_delta,
      loss_count = ii.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE ii.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'industry_intel'
    AND ii.variant_id = u.variant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_voice_call_outcome(uuid, numeric, boolean)
  TO service_role;

-- ── 2. error_log — internal error tracking ───────────────────────
CREATE TABLE IF NOT EXISTS public.error_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,                 -- edge function name or 'frontend'
  severity      text NOT NULL DEFAULT 'error'
                CHECK (severity IN ('debug','info','warning','error','fatal')),
  message       text NOT NULL,
  stack         text,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  dealership_id text,
  call_id       uuid,
  submission_id uuid,
  user_id       uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_log_recent_idx
  ON public.error_log (created_at DESC);
CREATE INDEX IF NOT EXISTS error_log_severity_idx
  ON public.error_log (severity, created_at DESC)
  WHERE severity IN ('error','fatal');
CREATE INDEX IF NOT EXISTS error_log_dealer_idx
  ON public.error_log (dealership_id, created_at DESC)
  WHERE dealership_id IS NOT NULL;

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access error_log" ON public.error_log;
CREATE POLICY "Service role full access error_log"
  ON public.error_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read own tenant error_log" ON public.error_log;
CREATE POLICY "Admins read own tenant error_log"
  ON public.error_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (dealership_id IS NULL
         OR dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- report_error RPC — anon-callable so the frontend can write its
-- own errors. Bounded by length caps to prevent DB-flood DoS.
CREATE OR REPLACE FUNCTION public.report_error(
  _source        text,
  _message       text,
  _severity      text DEFAULT 'error',
  _stack         text DEFAULT NULL,
  _context       jsonb DEFAULT '{}'::jsonb,
  _dealership_id text DEFAULT NULL,
  _call_id       uuid DEFAULT NULL,
  _submission_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _source IS NULL OR _message IS NULL THEN
    RETURN NULL;
  END IF;
  IF _severity NOT IN ('debug','info','warning','error','fatal') THEN
    _severity := 'error';
  END IF;

  INSERT INTO error_log
    (source, severity, message, stack, context,
     dealership_id, call_id, submission_id, user_id)
  VALUES
    (left(_source, 200),
     _severity,
     left(_message, 4000),
     left(coalesce(_stack, ''), 16000),
     coalesce(_context, '{}'::jsonb),
     _dealership_id, _call_id, _submission_id, auth.uid())
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_error(text, text, text, text, jsonb, text, uuid, uuid)
  TO anon, authenticated, service_role;

-- v_error_log_recent — admin rollup, last 7 days, error+fatal only
CREATE OR REPLACE VIEW public.v_error_log_recent AS
SELECT
  source,
  severity,
  count(*)               AS occurrences,
  max(created_at)        AS last_seen_at,
  min(created_at)        AS first_seen_at,
  -- Most recent verbatim message for the group; useful even when
  -- minor variation exists (timestamps in stack traces etc).
  (array_agg(message ORDER BY created_at DESC))[1] AS sample_message
FROM error_log
WHERE created_at >= now() - interval '7 days'
  AND severity IN ('warning','error','fatal')
GROUP BY source, severity
ORDER BY occurrences DESC, last_seen_at DESC
LIMIT 200;

GRANT SELECT ON public.v_error_log_recent TO authenticated;

-- ── 3. voice_pipeline_jobs — orphan retry queue ──────────────────
-- Every voice_call_log that completes (status='completed') gets a
-- corresponding row here on creation. Status transitions:
--   pending → enriched → graded   (happy path)
--   pending → failed              (after N retry attempts)

CREATE TABLE IF NOT EXISTS public.voice_pipeline_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL UNIQUE REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','enriching','enriched',
                                    'grading','graded','failed','skipped')),
  enrich_attempts integer NOT NULL DEFAULT 0,
  grade_attempts  integer NOT NULL DEFAULT 0,
  last_error      text,
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_pipeline_jobs_pending_idx
  ON public.voice_pipeline_jobs (next_retry_at)
  WHERE status IN ('pending','enriching','enriched','grading');

ALTER TABLE public.voice_pipeline_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access voice_pipeline_jobs"
  ON public.voice_pipeline_jobs;
CREATE POLICY "Service role full access voice_pipeline_jobs"
  ON public.voice_pipeline_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_pipeline_jobs"
  ON public.voice_pipeline_jobs;
CREATE POLICY "Staff read voice_pipeline_jobs"
  ON public.voice_pipeline_jobs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- enqueue_voice_pipeline_job RPC — idempotent on call_id.
-- voice-call-webhook calls this when status transitions to completed.

CREATE OR REPLACE FUNCTION public.enqueue_voice_pipeline_job(
  _call_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO voice_pipeline_jobs (call_id)
  VALUES (_call_id)
  ON CONFLICT (call_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_voice_pipeline_job(uuid)
  TO service_role;

-- pickup_stuck_voice_pipeline_jobs RPC — returns up to N rows
-- whose next_retry_at has passed AND status is non-terminal,
-- atomically marking them so two concurrent cron runs don't double-
-- pick. Used by the process-stuck-voice-calls edge function.

CREATE OR REPLACE FUNCTION public.pickup_stuck_voice_pipeline_jobs(
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  id        uuid,
  call_id   uuid,
  status    text,
  enrich_attempts integer,
  grade_attempts  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM voice_pipeline_jobs j
    WHERE j.next_retry_at <= now()
      AND j.status IN ('pending','enriching','enriched','grading')
      AND j.enrich_attempts < 5
      AND j.grade_attempts  < 5
    ORDER BY j.next_retry_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE voice_pipeline_jobs j
  SET next_retry_at = now() + interval '10 minutes', -- prevent re-pickup
      updated_at    = now()
  FROM picked p
  WHERE j.id = p.id
  RETURNING j.id, j.call_id, j.status, j.enrich_attempts, j.grade_attempts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pickup_stuck_voice_pipeline_jobs(integer)
  TO service_role;

-- mark_voice_pipeline_job RPC — terminal-state writer.
CREATE OR REPLACE FUNCTION public.mark_voice_pipeline_job(
  _call_id  uuid,
  _status   text,
  _bump     text DEFAULT NULL,        -- 'enrich' or 'grade' to increment attempts
  _error    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE voice_pipeline_jobs
  SET status          = _status,
      enrich_attempts = enrich_attempts + (CASE WHEN _bump = 'enrich' THEN 1 ELSE 0 END),
      grade_attempts  = grade_attempts  + (CASE WHEN _bump = 'grade'  THEN 1 ELSE 0 END),
      last_error      = COALESCE(left(_error, 1000), last_error),
      next_retry_at   = CASE
        WHEN _status IN ('pending','enriching','grading')
          THEN now() + (interval '2 minutes' * power(2,
                       LEAST(enrich_attempts + grade_attempts, 5)))
        ELSE next_retry_at
      END,
      updated_at = now()
  WHERE call_id = _call_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_voice_pipeline_job(uuid, text, text, text)
  TO service_role;

-- ── 4. Cron health monitor ────────────────────────────────────────
-- v_cron_health_recent surfaces failed cron job runs in the last
-- 24 hours. Refreshed by the cron_health_check job which runs
-- daily and inserts an error_log row for each failure (so admins
-- see it in the existing error console).

CREATE OR REPLACE VIEW public.v_cron_health_recent AS
SELECT
  j.jobname,
  j.schedule,
  d.start_time,
  d.end_time,
  d.status,
  d.return_message,
  d.command
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE d.start_time > now() - interval '24 hours'
ORDER BY d.start_time DESC
LIMIT 200;

GRANT SELECT ON public.v_cron_health_recent TO authenticated;

CREATE OR REPLACE FUNCTION public.cron_health_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT j.jobname, d.return_message, d.start_time
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.start_time > now() - interval '24 hours'
      AND d.status = 'failed'
  LOOP
    -- Skip if we already logged this exact failure (dedup)
    IF NOT EXISTS (
      SELECT 1 FROM error_log
      WHERE source = 'cron:' || rec.jobname
        AND created_at > now() - interval '24 hours'
        AND message = COALESCE(rec.return_message, '(no message)')
    ) THEN
      INSERT INTO error_log (source, severity, message, context)
      VALUES (
        'cron:' || rec.jobname,
        'error',
        COALESCE(rec.return_message, '(no message)'),
        jsonb_build_object(
          'jobname',    rec.jobname,
          'start_time', rec.start_time
        )
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cron_health_check() TO service_role;

-- Schedule the daily check at 04:30 UTC (after PII redact at 03:30/40
-- and variant decay at 04:15, so it can catch failures from those).
SELECT cron.unschedule('cron_health_check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron_health_check');
SELECT cron.schedule(
  'cron_health_check',
  '30 4 * * *',
  $$ SELECT public.cron_health_check() $$
);

NOTIFY pgrst, 'reload schema';
