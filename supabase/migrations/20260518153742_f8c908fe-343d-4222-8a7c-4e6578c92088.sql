-- ============================================================
-- Part 1: 20260502010000_tcpa_recipient_timezone.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.tcpa_timezone_for_state(_state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(coalesce(_state, ''))
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
    WHEN 'FL' THEN 'America/New_York'
    WHEN 'IN' THEN 'America/New_York'
    WHEN 'KY' THEN 'America/New_York'
    WHEN 'MI' THEN 'America/New_York'
    WHEN 'TN' THEN 'America/New_York'
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
    WHEN 'KS' THEN 'America/Chicago'
    WHEN 'NE' THEN 'America/Chicago'
    WHEN 'TX' THEN 'America/Chicago'
    WHEN 'ND' THEN 'America/Chicago'
    WHEN 'SD' THEN 'America/Chicago'
    WHEN 'CO' THEN 'America/Denver'
    WHEN 'MT' THEN 'America/Denver'
    WHEN 'NM' THEN 'America/Denver'
    WHEN 'UT' THEN 'America/Denver'
    WHEN 'WY' THEN 'America/Denver'
    WHEN 'AZ' THEN 'America/Phoenix'
    WHEN 'ID' THEN 'America/Denver'
    WHEN 'CA' THEN 'America/Los_Angeles'
    WHEN 'NV' THEN 'America/Los_Angeles'
    WHEN 'OR' THEN 'America/Los_Angeles'
    WHEN 'WA' THEN 'America/Los_Angeles'
    WHEN 'AK' THEN 'America/Anchorage'
    WHEN 'HI' THEN 'Pacific/Honolulu'
    WHEN 'PR' THEN 'America/Puerto_Rico'
    WHEN 'VI' THEN 'America/St_Thomas'
    WHEN 'GU' THEN 'Pacific/Guam'
    WHEN 'AS' THEN 'Pacific/Pago_Pago'
    ELSE 'America/New_York'
  END;
$$;

COMMENT ON FUNCTION public.tcpa_timezone_for_state(text) IS
  'IANA timezone lookup for TCPA quiet-hours enforcement. Cross-tz states default to the easternmost zone so the quiet-hours window is conservative — never calls a recipient *too late* (8pm Central = 9pm Eastern).';

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

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS customer_timezone text;

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

UPDATE public.submissions
   SET customer_timezone = public.tcpa_timezone_for_state(state)
 WHERE customer_timezone IS NULL;

GRANT EXECUTE ON FUNCTION public.tcpa_timezone_for_state(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tcpa_quiet_hour(text, timestamptz) TO anon, authenticated, service_role;

-- ============================================================
-- Part 2: 20260515120000_preserve_browser_customer_tz.sql
-- (refines the trigger to preserve caller-supplied tz)
-- ============================================================

CREATE OR REPLACE FUNCTION public.submissions_set_customer_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
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