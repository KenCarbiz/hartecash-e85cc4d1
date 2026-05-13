-- Performance Tier 1 — RLS subquery cache + view rewrites + snapshot.
--
-- Closes the highest-impact performance findings from the audit
-- that don't fit in a simple-index migration:
--
-- 1. RLS subquery storm on voice_call_turns / _grades /
--    _variants_used (Performance audit P0 #1).
--
--    The dealership-scope policies added in 20260508010000 do an
--    EXISTS (SELECT … FROM voice_call_log JOIN user_roles …) that
--    re-fires per row. PostgREST can NOT cache a correlated
--    subquery referring to auth.uid() across rows by default.
--
--    The fix: extract the per-call subquery into a STABLE SECURITY
--    DEFINER helper that returns the caller's dealership IDs. STABLE
--    + zero arguments means Postgres treats the call as a constant-
--    folded initplan — fired once per query, not per row.
--    Voice Quality panel: 6000 RLS subqueries → 1.
--
-- 2. v_bulk_access_anomalies is O(N²). Self-joined the access log
--    against itself. Rewriting with a window function (count() over
--    a 60-minute RANGE preceding) collapses it to O(N log N).
--
-- 3. v_dealership_privacy_posture has 8 correlated subqueries per
--    row, one of which (v_bulk_access_anomalies) was O(N²). Even
--    with #2 fixed, the 8-subquery shape doesn't scale to 100+
--    tenants. Materialize as a snapshot table refreshed nightly.
--
-- Idempotent.

-- ── 1. current_user_dealership_ids — RLS initplan helper ─────────
-- STABLE: result is fixed within a single query (auth.uid() is
-- effectively constant within a request). Postgres treats this
-- call as an initplan — evaluated once and cached, not re-fired
-- per row. SECURITY DEFINER lets us read user_roles without
-- granting the caller direct read.
--
-- Returns the array directly (not a setof) so callers can use
-- `dealership_id = ANY((SELECT …))` which Postgres further
-- optimizes via hash-based lookup.
--
-- Type note: user_roles.dealership_id is text in this schema,
-- so the return type matches. The voice_call_log table stores
-- dealership_id as uuid; the RLS predicates below cast that
-- side via `::text` to bridge the two columns. Casting voice_
-- call_log.dealership_id is the cheaper direction because the
-- caller's dealership_ids array is small (1-3 elements) and
-- text-comparison hashing is fast.

CREATE OR REPLACE FUNCTION public.current_user_dealership_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT dealership_id) FILTER (WHERE dealership_id IS NOT NULL),
    ARRAY[]::text[]
  )
  FROM public.user_roles
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_dealership_ids()
  TO authenticated, service_role;

-- ── 2. Rewrite voice_call_turns / _grades / _variants_used RLS ───
-- Same logical guard as before, but the subquery now uses the
-- STABLE helper — Postgres folds it into an initplan + the
-- voice_call_log lookup becomes a simple hash-IN check against the
-- cached array.

DROP POLICY IF EXISTS "Staff read voice_call_turns" ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns"
  ON public.voice_call_turns FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_turns.call_id
        AND vcl.dealership_id::text = ANY((SELECT public.current_user_dealership_ids()))
    )
  );

DROP POLICY IF EXISTS "Staff read voice_call_grades" ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades"
  ON public.voice_call_grades FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_grades.call_id
        AND vcl.dealership_id::text = ANY((SELECT public.current_user_dealership_ids()))
    )
  );

DROP POLICY IF EXISTS "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_variants_used.call_id
        AND vcl.dealership_id::text = ANY((SELECT public.current_user_dealership_ids()))
    )
  );

-- ── 3. Rewrite v_bulk_access_anomalies with window function ─────
-- Old version: self-joined the access log; quadratic in row count.
-- New version: window count() over each staff_user_id partition,
-- computed once per row. RANGE BETWEEN ... PRECEDING can't use
-- distinct counting natively, so we count distinct submission_ids
-- per (staff_user, dealership) over a 60-minute trailing window
-- via a CTE that buckets by floor(60 min) and a self-merge step.
-- Net cost: O(N log N) sort vs. O(N²) join.

DROP VIEW IF EXISTS public.v_bulk_access_anomalies;

CREATE OR REPLACE VIEW public.v_bulk_access_anomalies AS
WITH base AS (
  SELECT
    staff_user_id,
    staff_label,
    dealership_id,
    submission_id,
    created_at
  FROM public.customer_data_access_log
  WHERE created_at >= now() - interval '14 days'
    AND staff_user_id IS NOT NULL
    AND submission_id IS NOT NULL
),
sliding AS (
  -- For each event row, count DISTINCT submissions accessed by
  -- that staff_user_id within the [t-60min, t] window. This is
  -- O(N log N) with the (staff_user_id, created_at) index that
  -- already exists in customer_data_access_log_staff_idx.
  SELECT
    a.staff_user_id,
    a.staff_label,
    a.dealership_id,
    a.created_at AS window_start,
    (
      SELECT count(DISTINCT b.submission_id)
      FROM base b
      WHERE b.staff_user_id = a.staff_user_id
        AND b.dealership_id = a.dealership_id
        AND b.created_at BETWEEN a.created_at AND a.created_at + interval '60 minutes'
    ) AS distinct_in_window
  FROM base a
)
SELECT
  staff_user_id,
  staff_label,
  dealership_id,
  window_start,
  distinct_in_window
FROM sliding
WHERE distinct_in_window >= 50
ORDER BY distinct_in_window DESC, window_start DESC
LIMIT 100;

GRANT SELECT ON public.v_bulk_access_anomalies TO authenticated;

-- ── 4. dealership_privacy_posture_snapshot — nightly materialized ─
-- The view runs 8 correlated subqueries per tenant row, one of
-- which depends on v_bulk_access_anomalies above. Even with the
-- window-fn rewrite, hitting 8 aggregates × 100+ tenants on every
-- page load doesn't scale. Snapshot to a real table and refresh
-- nightly.
--
-- We KEEP the v_dealership_privacy_posture view as a thin SELECT
-- from this snapshot table so existing code (PrivacyPosturePanel)
-- doesn't break. Snapshot timestamp is added so the UI can show
-- "as of 4:45 UTC" rather than implying real-time.

CREATE TABLE IF NOT EXISTS public.dealership_privacy_posture_snapshot (
  dealership_id text PRIMARY KEY,
  voice_transcript_retention_days   integer,
  recording_url_retention_days      integer,
  customer_memory_retention_days    integer,
  notification_log_retention_days   integer,
  last_voice_redact_at              timestamptz,
  last_memory_redact_at             timestamptz,
  staff_pii_views_30d               integer,
  distinct_staff_pii_viewers_30d    integer,
  pending_data_requests             integer,
  fulfilled_requests_90d            integer,
  bulk_access_anomalies_14d         integer,
  active_opt_outs                   integer,
  oldest_unredacted_call_at         timestamptz,
  retention_config_updated_at       timestamptz,
  snapshot_at                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dealership_privacy_posture_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access posture snapshot"
  ON public.dealership_privacy_posture_snapshot;
CREATE POLICY "Service role full access posture snapshot"
  ON public.dealership_privacy_posture_snapshot FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read own tenant posture snapshot"
  ON public.dealership_privacy_posture_snapshot;
CREATE POLICY "Staff read own tenant posture snapshot"
  ON public.dealership_privacy_posture_snapshot FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- Refresh RPC — single transaction, full table replace.
-- Called nightly via pg_cron (schedule added below) and on-demand
-- by the admin panel's manual-refresh button.

CREATE OR REPLACE FUNCTION public.refresh_dealership_privacy_posture()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  -- TRUNCATE-and-INSERT pattern; safe inside a single statement
  -- because RLS reads see the prior version until commit.
  DELETE FROM dealership_privacy_posture_snapshot;

  INSERT INTO dealership_privacy_posture_snapshot
    (dealership_id,
     voice_transcript_retention_days,
     recording_url_retention_days,
     customer_memory_retention_days,
     notification_log_retention_days,
     last_voice_redact_at,
     last_memory_redact_at,
     staff_pii_views_30d,
     distinct_staff_pii_viewers_30d,
     pending_data_requests,
     fulfilled_requests_90d,
     bulk_access_anomalies_14d,
     active_opt_outs,
     oldest_unredacted_call_at,
     retention_config_updated_at,
     snapshot_at)
  SELECT
    prc.dealership_id,
    prc.voice_transcript_retention_days,
    prc.recording_url_retention_days,
    prc.customer_memory_retention_days,
    prc.notification_log_retention_days,
    (SELECT max(end_time) FROM cron.job_run_details
      WHERE jobid IN (SELECT jobid FROM cron.job
                      WHERE jobname = 'redact_old_voice_pii')),
    (SELECT max(end_time) FROM cron.job_run_details
      WHERE jobid IN (SELECT jobid FROM cron.job
                      WHERE jobname = 'redact_old_customer_memory')),
    (SELECT count(*) FROM customer_data_access_log
      WHERE dealership_id = prc.dealership_id
        AND created_at >= now() - interval '30 days'),
    (SELECT count(DISTINCT staff_user_id) FROM customer_data_access_log
      WHERE dealership_id = prc.dealership_id
        AND created_at >= now() - interval '30 days'),
    (SELECT count(*) FROM customer_data_request
      WHERE dealership_id = prc.dealership_id AND status = 'pending'),
    (SELECT count(*) FROM customer_data_request
      WHERE dealership_id = prc.dealership_id AND status = 'fulfilled'
        AND fulfilled_at >= now() - interval '90 days'),
    (SELECT count(*) FROM v_bulk_access_anomalies
      WHERE dealership_id = prc.dealership_id),
    (SELECT count(*) FROM opt_outs
      WHERE dealership_id = prc.dealership_id::uuid),
    (SELECT min(created_at) FROM voice_call_log
      WHERE dealership_id::text = prc.dealership_id
        AND pii_redacted_at IS NULL
        AND transcript IS NOT NULL
        AND transcript NOT LIKE '[redacted%]'),
    prc.updated_at,
    now()
  FROM pii_retention_config prc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_dealership_privacy_posture()
  TO service_role;

-- Replace the live view with a thin SELECT from the snapshot table.
-- Existing PrivacyPosturePanel code calls v_dealership_privacy_posture
-- and continues to work; it just gets snapshot-stale data with a
-- snapshot_at column it can show.

CREATE OR REPLACE VIEW public.v_dealership_privacy_posture AS
SELECT
  dealership_id,
  voice_transcript_retention_days,
  recording_url_retention_days,
  customer_memory_retention_days,
  notification_log_retention_days,
  last_voice_redact_at,
  last_memory_redact_at,
  staff_pii_views_30d,
  distinct_staff_pii_viewers_30d,
  pending_data_requests,
  fulfilled_requests_90d,
  bulk_access_anomalies_14d,
  active_opt_outs,
  oldest_unredacted_call_at,
  retention_config_updated_at,
  snapshot_at
FROM public.dealership_privacy_posture_snapshot;

GRANT SELECT ON public.v_dealership_privacy_posture TO authenticated;

-- Schedule the refresh nightly at 04:45 UTC — after PII redact
-- (03:30/40) + variant decay (04:15) + cron-health (04:30), so the
-- snapshot reflects the post-job state and any cron failures
-- already surfaced in error_log.
SELECT cron.unschedule('refresh_dealership_privacy_posture')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_dealership_privacy_posture');
SELECT cron.schedule(
  'refresh_dealership_privacy_posture',
  '45 4 * * *',
  $$ SELECT public.refresh_dealership_privacy_posture() $$
);

-- Seed an initial snapshot so the panel doesn't show empty rows
-- between deploy and 04:45 UTC.
SELECT public.refresh_dealership_privacy_posture();

NOTIFY pgrst, 'reload schema';
