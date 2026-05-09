-- Performance + reliability indexes — Tier 0 + 1 highlights.
--
-- Closes the highest-leverage missing-index findings from the
-- performance audit:
--
-- 1. submissions(phone) + submissions(email) — every CCPA flow
--    (request_customer_data_action, export_customer_data,
--    purge_customer_data) AND every inbound-SMS / inbound-email
--    matcher does WHERE phone=$1 OR email=$1 against this table.
--    No index today; seq scan at 50k subs ~200ms; multi-second at 1M.
--
-- 2. voice_call_log(created_at) WHERE pii_redacted_at IS NULL —
--    the nightly redact_old_voice_pii cron does full scans without
--    this. At 1k calls/day × 365 days = 365k rows; runtime ~15-60min
--    today, multi-hour at 10k/day. Required before the cron breaks.
--
-- 3. voice_call_turns(call_id) WHERE pii_redacted_at IS NULL —
--    same problem on the per-turn redaction pass.
--
-- 4. voice_call_grades(call_id, created_at DESC) — v_voice_call_quality
--    LATERAL grade-lookup re-sorts per call; existing index is just
--    (call_id) without the timestamp-DESC component.
--
-- 5. notification_log(submission_id) — purge_customer_data + customer
--    file lookups iterate this table; no submission-id index today.
--
-- 6. user_roles(user_id, dealership_id) — every RLS policy that
--    filters by dealership joins through user_roles. Already has
--    (user_id) PK; adding the covering form lets the RLS subquery
--    return both columns from the index without a heap visit.
--
-- All indexes use IF NOT EXISTS. CREATE INDEX CONCURRENTLY would be
-- ideal in production but Supabase migration runner doesn't support
-- it inside a transaction; these are small enough to risk a brief
-- write block. Apply during a low-traffic window if 100k+ rows
-- already exist on any of these tables.
--
-- Idempotent.

-- ── 1. submissions(phone) + submissions(email) — partial ────────
CREATE INDEX IF NOT EXISTS submissions_phone_idx
  ON public.submissions (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_email_idx
  ON public.submissions (lower(email))
  WHERE email IS NOT NULL;

-- ── 2-3. voice_call_log + voice_call_turns redaction-window ─────
CREATE INDEX IF NOT EXISTS voice_call_log_unredacted_created_idx
  ON public.voice_call_log (created_at)
  WHERE pii_redacted_at IS NULL;

CREATE INDEX IF NOT EXISTS voice_call_turns_unredacted_call_idx
  ON public.voice_call_turns (call_id)
  WHERE pii_redacted_at IS NULL;

-- ── 4. voice_call_grades(call_id, created_at DESC) composite ────
CREATE INDEX IF NOT EXISTS voice_call_grades_call_recent_idx
  ON public.voice_call_grades (call_id, created_at DESC);

-- ── 5. notification_log(submission_id) ──────────────────────────
CREATE INDEX IF NOT EXISTS notification_log_submission_idx
  ON public.notification_log (submission_id)
  WHERE submission_id IS NOT NULL;

-- ── 6. user_roles(user_id, dealership_id) covering ──────────────
-- Some Supabase projects have user_roles with PK (id) + UNIQUE
-- (user_id, role) but no covering (user_id, dealership_id).
-- This adds the form the dealership-scope RLS subquery actually
-- needs. Cheap to maintain at staff-table sizes.
CREATE INDEX IF NOT EXISTS user_roles_user_dealership_idx
  ON public.user_roles (user_id, dealership_id);

NOTIFY pgrst, 'reload schema';
