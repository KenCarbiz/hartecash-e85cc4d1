-- TCPA quiet-hours engine: lead-local timezone enforcement.
--
-- Background: send-notification already honors the dealer's configured
-- quiet hours (9pm–8am dealer-tz) but TCPA requires the RECIPIENT'S
-- local time, not the sender's. Late-2024 class actions specifically
-- target quiet-hours-by-sender-tz violations.
--
-- This migration adds:
--   1. tcpa_timezone_for_state(state) — IANA tz lookup with a
--      conservative default for cross-tz states (returns the
--      EASTERNMOST tz so we never call/text *too late* for a recipient
--      who happens to be in the eastern part of a multi-tz state).
--   2. is_tcpa_quiet_hour(state, ts) — boolean helper, returns true
--      if `ts` falls outside 8am–9pm recipient-local. Used by
--      send-notification, voice-call-webhook, launch-voice-call.
--   3. submissions.customer_timezone — denormalized cache of the
--      computed tz so we can index/filter without re-running the
--      function for every cadence tick.
--
-- Idempotent throughout (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS).

-- ── 1. State → IANA timezone lookup ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.tcpa_timezone_for_state(_state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_state, ''))
    -- Eastern
    WHEN 'CT' THEN 'America/New_York'
    WHEN 'DE' THEN 'America/New_York'
    WHEN 'DC' THEN 'America/New_York'
    WHEN 'GA' THEN 'America/New_York'
    WHEN 'ME' THEN 'America/New_York'
    WHEN 'MD' THEN 'America/New_York'
    WHEN 'MA' THEN 'America/New_York'
    WHEN 'NH' THEN 'America/New_York'
    WHEN 'NJ' THEN 'America/New_York'
    WHEN 'NY' THEN 'America/New_York'
    WHEN 'NC' THEN 'America/New_York'
    WHEN 'OH' THEN 'America/New_York'
    WHEN 'PA' THEN 'America/New_York'
    WHEN 'RI' THEN 'America/New_York'
    WHEN 'SC' THEN 'America/New_York'
    WHEN 'VT' THEN 'America/New_York'
    WHEN 'VA' THEN 'America/New_York'
    WHEN 'WV' THEN 'America/New_York'
    -- Florida spans ET/CT (panhandle is Central) — default Eastern
    WHEN 'FL' THEN 'America/New_York'
    -- Indiana mostly Eastern; small western chunk Central — default Eastern
    WHEN 'IN' THEN 'America/New_York'
    -- Kentucky spans ET/CT — default Eastern (most pop in ET)
    WHEN 'KY' THEN 'America/New_York'
    -- Michigan spans ET/CT (a few western counties) — default Eastern
    WHEN 'MI' THEN 'America/New_York'
    -- Tennessee spans ET/CT — default Eastern (Knoxville/Chattanooga)
    WHEN 'TN' THEN 'America/New_York'
    -- Central
    WHEN 'AL' THEN 'America/Chicago'
    WHEN 'AR' THEN 'America/Chicago'
    WHEN 'IL' THEN 'America/Chicago'
    WHEN 'IA' THEN 'America/Chicago'
    WHEN 'LA' THEN 'America/Chicago'
    WHEN 'MN' THEN 'America/Chicago'
    WHEN 'MS' THEN 'America/Chicago'
    WHEN 'MO' THEN 'America/Chicago'
    WHEN 'OK' THEN 'America/Chicago'
    WHEN 'WI' THEN 'America/Chicago'
    -- Kansas spans CT/MT — default Central
    WHEN 'KS' THEN 'America/Chicago'
    -- Nebraska spans CT/MT — default Central
    WHEN 'NE' THEN 'America/Chicago'
    -- Texas spans CT/MT — default Central (El Paso is the only MT chunk)
    WHEN 'TX' THEN 'America/Chicago'
    -- North Dakota spans CT/MT — default Central
    WHEN 'ND' THEN 'America/Chicago'
    -- South Dakota spans CT/MT — default Central
    WHEN 'SD' THEN 'America/Chicago'
    -- Mountain
    WHEN 'CO' THEN 'America/Denver'
    WHEN 'MT' THEN 'America/Denver'
    WHEN 'NM' THEN 'America/Denver'
    WHEN 'UT' THEN 'America/Denver'
    WHEN 'WY' THEN 'America/Denver'
    -- Arizona doesn't observe DST (except Navajo Nation) — special tz
    WHEN 'AZ' THEN 'America/Phoenix'
    -- Idaho spans MT/PT — default Mountain (Boise/Idaho Falls are MT)
    WHEN 'ID' THEN 'America/Denver'
    -- Pacific
    WHEN 'CA' THEN 'America/Los_Angeles'
    WHEN 'NV' THEN 'America/Los_Angeles'
    WHEN 'OR' THEN 'America/Los_Angeles'
    WHEN 'WA' THEN 'America/Los_Angeles'
    -- Alaska
    WHEN 'AK' THEN 'America/Anchorage'
    -- Hawaii (no DST)
    WHEN 'HI' THEN 'Pacific/Honolulu'
    -- US territories
    WHEN 'PR' THEN 'America/Puerto_Rico'
    WHEN 'VI' THEN 'America/St_Thomas'
    WHEN 'GU' THEN 'Pacific/Guam'
    WHEN 'AS' THEN 'Pacific/Pago_Pago'
    -- Unknown / international — fall back to Eastern as the most
    -- restrictive default (caller will be safe regardless of true tz).
    ELSE 'America/New_York'
  END;
$$;

COMMENT ON FUNCTION public.tcpa_timezone_for_state(text) IS
  'IANA timezone lookup for TCPA quiet-hours enforcement. Cross-tz states default to the easternmost zone so the quiet-hours window is conservative — never calls a recipient *too late* (8pm Central = 9pm Eastern).';

-- ── 2. Quiet-hours boolean helper ────────────────────────────────────
-- TCPA windows are 8:00am – 9:00pm recipient local time. This is a
-- HARD floor — cannot be widened by the dealer's notification settings.
CREATE OR REPLACE FUNCTION public.is_tcpa_quiet_hour(_state text, _ts timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXTRACT(HOUR FROM (_ts AT TIME ZONE public.tcpa_timezone_for_state(_state)))::int < 8
      OR EXTRACT(HOUR FROM (_ts AT TIME ZONE public.tcpa_timezone_for_state(_state)))::int >= 21;
$$;

COMMENT ON FUNCTION public.is_tcpa_quiet_hour(text, timestamptz) IS
  'TCPA quiet-hours check: returns true when _ts falls outside 8am-9pm recipient-local. Use to gate ALL outbound SMS and voice to customers.';

-- ── 3. Denormalized cache on submissions ─────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS customer_timezone text;

COMMENT ON COLUMN public.submissions.customer_timezone IS
  'Cached IANA tz for the customer, derived from submissions.state. Populated by trigger on insert/update of state. Used by cadence engine and voice-call-webhook to avoid recomputing on every tick.';

-- Trigger to keep customer_timezone in sync with state.
CREATE OR REPLACE FUNCTION public.submissions_set_customer_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.customer_timezone := public.tcpa_timezone_for_state(NEW.state);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_customer_tz_trg ON public.submissions;
CREATE TRIGGER submissions_customer_tz_trg
  BEFORE INSERT OR UPDATE OF state ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.submissions_set_customer_timezone();

-- Backfill existing rows.
UPDATE public.submissions
   SET customer_timezone = public.tcpa_timezone_for_state(state)
 WHERE customer_timezone IS NULL;

GRANT EXECUTE ON FUNCTION public.tcpa_timezone_for_state(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tcpa_quiet_hour(text, timestamptz) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
