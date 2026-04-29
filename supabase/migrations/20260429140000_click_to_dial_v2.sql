-- Click-to-dial v2: per-rep quiet-hours / DND + tenant recording opt-in.
--
-- v1 caveats addressed:
--   1. "No off-hours guard" — reps got rung at 11pm. Quiet-hours window
--      on user_roles lets each rep set local hours during which the
--      bridge call refuses with a friendly message instead of ringing.
--   2. "Recording is OFF" — added an explicit per-tenant opt-in. When
--      enabled, the TwiML response records the call AND the customer
--      hears a consent disclosure before the bridge. This satisfies
--      the two-party-consent states (CA, FL, IL, MA, MD, MT, NH, PA,
--      WA + others) by recording only after notification.
--
-- All columns default to safe values (DND off, recording off, no quiet
-- window) so existing dealers keep working without admin action.

-- ── Per-rep DND + quiet hours ─────────────────────────────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS click_to_dial_dnd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_start time,    -- e.g. '21:00:00' for 9pm
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_end time,      -- e.g. '07:00:00' for 7am
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_tz text;       -- IANA, e.g. 'America/New_York'

COMMENT ON COLUMN public.user_roles.click_to_dial_dnd IS
  'Hard do-not-disturb. When true, click-to-dial refuses to ring this rep regardless of time.';
COMMENT ON COLUMN public.user_roles.click_to_dial_quiet_start IS
  'Start of the rep''s quiet window in their local timezone. NULL means no window.';
COMMENT ON COLUMN public.user_roles.click_to_dial_quiet_end IS
  'End of the rep''s quiet window in their local timezone. NULL means no window. Window may wrap midnight (start>end → window is start→24:00 plus 00:00→end).';
COMMENT ON COLUMN public.user_roles.click_to_dial_quiet_tz IS
  'IANA timezone the quiet hours are evaluated in. Falls back to America/New_York when null.';

-- ── Tenant recording opt-in ───────────────────────────────────────
-- Lives on dealer_accounts (the per-tenant settings home) rather than
-- tenant_channels because it's a sub-setting of click_to_dial, not a
-- separate channel. Default off for backwards-compat.
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS click_to_dial_record_calls boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dealer_accounts.click_to_dial_record_calls IS
  'When true, click-to-dial records the bridged call AND prepends a "this call may be recorded" disclosure so the customer hears it before the bridge connects (two-party-consent compliant).';

-- ── Helper: is rep available for click-to-dial right now? ─────────
-- Returns true unless DND is on, or the rep is currently inside their
-- quiet-hours window. SECURITY DEFINER so the edge function can call
-- it through the user-scoped client without RLS gymnastics.
CREATE OR REPLACE FUNCTION public.click_to_dial_rep_available(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  local_now time;
  tz text;
BEGIN
  SELECT click_to_dial_dnd, click_to_dial_quiet_start, click_to_dial_quiet_end, click_to_dial_quiet_tz
    INTO r
    FROM public.user_roles
   WHERE user_id = _user_id
   LIMIT 1;

  IF NOT FOUND THEN
    -- No row at all means no rules; default available.
    RETURN true;
  END IF;

  IF r.click_to_dial_dnd THEN
    RETURN false;
  END IF;

  IF r.click_to_dial_quiet_start IS NULL OR r.click_to_dial_quiet_end IS NULL THEN
    RETURN true;
  END IF;

  tz := COALESCE(r.click_to_dial_quiet_tz, 'America/New_York');
  local_now := (now() AT TIME ZONE tz)::time;

  -- Same-day window (e.g. 12:00–14:00).
  IF r.click_to_dial_quiet_start < r.click_to_dial_quiet_end THEN
    RETURN NOT (local_now >= r.click_to_dial_quiet_start AND local_now < r.click_to_dial_quiet_end);
  END IF;

  -- Wraparound (e.g. 21:00–07:00 next day).
  RETURN NOT (local_now >= r.click_to_dial_quiet_start OR local_now < r.click_to_dial_quiet_end);
END;
$$;

COMMENT ON FUNCTION public.click_to_dial_rep_available(uuid) IS
  'Returns true unless the rep has DND on or is currently within their quiet-hours window. Used by the twilio-click-to-dial edge function before initiating the bridge.';
