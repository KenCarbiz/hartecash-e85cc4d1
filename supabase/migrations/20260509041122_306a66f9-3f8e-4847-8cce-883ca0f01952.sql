-- ============================================================
-- 20260509020000_reliability_tier1.sql
-- ============================================================

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

  UPDATE public.voice_agent_persona vap
  SET win_count  = vap.win_count  + win_delta,
      loss_count = vap.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE vap.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'voice_agent_persona'
    AND vap.variant_id = u.variant_id;

  UPDATE public.conversation_phases cp
  SET win_count  = cp.win_count  + win_delta,
      loss_count = cp.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE cp.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'conversation_phases'
    AND cp.variant_id = u.variant_id;

  UPDATE public.customer_signals cs
  SET win_count  = cs.win_count  + win_delta,
      loss_count = cs.loss_count + loss_delta,
      retired_at = CASE WHEN should_retire THEN now() ELSE cs.retired_at END
  FROM public.voice_call_variants_used u
  WHERE u.call_id = _call_id
    AND u.source_table = 'customer_signals'
    AND cs.variant_id = u.variant_id;

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

CREATE TABLE IF NOT EXISTS public.error_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
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

CREATE OR REPLACE VIEW public.v_error_log_recent AS
SELECT
  source,
  severity,
  count(*)               AS occurrences,
  max(created_at)        AS last_seen_at,
  min(created_at)        AS first_seen_at,
  (array_agg(message ORDER BY created_at DESC))[1] AS sample_message
FROM error_log
WHERE created_at >= now() - interval '7 days'
  AND severity IN ('warning','error','fatal')
GROUP BY source, severity
ORDER BY occurrences DESC, last_seen_at DESC
LIMIT 200;

GRANT SELECT ON public.v_error_log_recent TO authenticated;

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
  SET next_retry_at = now() + interval '10 minutes',
      updated_at    = now()
  FROM picked p
  WHERE j.id = p.id
  RETURNING j.id, j.call_id, j.status, j.enrich_attempts, j.grade_attempts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pickup_stuck_voice_pipeline_jobs(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_voice_pipeline_job(
  _call_id  uuid,
  _status   text,
  _bump     text DEFAULT NULL,
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

SELECT cron.unschedule('cron_health_check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron_health_check');
SELECT cron.schedule(
  'cron_health_check',
  '30 4 * * *',
  $$ SELECT public.cron_health_check() $$
);

NOTIFY pgrst, 'reload schema';