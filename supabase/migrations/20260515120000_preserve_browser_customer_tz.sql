-- Preserve browser-reported customer_timezone over state-derivation.
--
-- The original trigger (20260502010000_tcpa_recipient_timezone.sql)
-- overwrote customer_timezone with tcpa_timezone_for_state(state) on
-- every insert and on every state change. This was needed because the
-- form didn't capture the customer's true tz, only the state.
--
-- SellCarForm now sends the browser's IANA tz (e.g. America/Chicago)
-- in the insert payload — that value is far more accurate than the
-- state-derived fallback for split-TZ states (FL, IN, KY, MI, TN, KS,
-- NE, TX, ND, SD, OR, ID). This trigger now only fills the column
-- when the caller didn't supply one.
--
-- Manual edits by staff are also preserved — if a rep overrides the
-- tz on a submission, subsequent state changes won't blow it away.
--
-- Idempotent via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.submissions_set_customer_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only derive from state when:
  --   1. INSERT and the caller didn't supply a tz, OR
  --   2. UPDATE that changed state AND tz is currently NULL
  -- This preserves browser-reported and staff-edited values.
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_timezone IS NULL THEN
      NEW.customer_timezone := public.tcpa_timezone_for_state(NEW.state);
    END IF;
  ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.customer_timezone IS NULL THEN
      NEW.customer_timezone := public.tcpa_timezone_for_state(NEW.state);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.submissions.customer_timezone IS
  'IANA tz for the customer. Seeded from browser Intl when available (more accurate than state-derivation for split-TZ states); otherwise derived from submissions.state. Staff can override manually — the trigger will not overwrite a non-null value.';

NOTIFY pgrst, 'reload schema';
