-- Performance + reliability indexes — Tier 0 + 1 highlights.
-- Idempotent.

CREATE INDEX IF NOT EXISTS submissions_phone_idx
  ON public.submissions (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_email_idx
  ON public.submissions (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS voice_call_log_unredacted_created_idx
  ON public.voice_call_log (created_at)
  WHERE pii_redacted_at IS NULL;

CREATE INDEX IF NOT EXISTS voice_call_turns_unredacted_call_idx
  ON public.voice_call_turns (call_id)
  WHERE pii_redacted_at IS NULL;

CREATE INDEX IF NOT EXISTS voice_call_grades_call_recent_idx
  ON public.voice_call_grades (call_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_log_submission_idx
  ON public.notification_log (submission_id)
  WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_roles_user_dealership_idx
  ON public.user_roles (user_id, dealership_id);

NOTIFY pgrst, 'reload schema';