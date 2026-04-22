-- Bland.AI appointment webhook — schema extensions
--
-- The existing `appointments` table (from 20260212175520_*) already stores
-- customer info + preferred_date/time + status. We're extending it so the
-- Bland.AI voice agent can write appointment rows directly via webhook
-- when a customer agrees on a date/time/location for an in-person
-- inspection or deal-finalization visit.
--
-- Customers come from three paths (user direction, 2026-04-14):
--   1. Agreed to an offer on the site but never came in → Bland calls to
--      schedule the inspection
--   2. Bland called them cold, they accepted the offer on the phone →
--      now needs to come in to finalize
--   3. Offer is ballpark and we need to see the car in person before we
--      firm up the number
--
-- The `appointment_type` column below captures that distinction.

-- ── 1. Add FK + workflow columns ────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_log_id   uuid REFERENCES public.voice_call_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'inspection',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- `appointment_type` values:
--   'inspection'       – dealer needs to see the car before finalizing
--   'finalization'     – price is set, customer is coming in to sign + get paid
--   'firm_up_offer'    – offer is tentative, inspection will set the number
--
-- `source` values:
--   'web'              – booked via the public site form
--   'bland_ai'         – booked by the voice agent
--   'staff'            – booked manually by a human
--
-- `external_ref` holds the Bland call_id or external booking ID so the
-- webhook is idempotent on retries.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_appointment_type_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_appointment_type_check
    CHECK (appointment_type IN ('inspection', 'finalization', 'firm_up_offer'));

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_source_check
    CHECK (source IN ('web', 'bland_ai', 'staff'));

-- Normalize the status vocabulary so admin UIs can filter consistently.
-- The original default was 'pending'; we keep that value and add
-- scheduled / confirmed / completed / cancelled / no_show.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('pending', 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'));

-- Keep legacy `customer_email` nullable — Bland won't always capture an
-- email on the call, and we don't want to reject a valid appointment.
ALTER TABLE public.appointments ALTER COLUMN customer_email DROP NOT NULL;

-- Same for preferred_time — Bland may only get a date, not a specific
-- time slot, and we'd rather save a pending appointment than lose it.
ALTER TABLE public.appointments ALTER COLUMN preferred_time DROP NOT NULL;

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.appointments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointments_set_updated_at();

-- ── 2. Indexes for admin views + idempotency ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_dealership_date
  ON public.appointments (dealership_id, preferred_date);
CREATE INDEX IF NOT EXISTS idx_appointments_submission
  ON public.appointments (submission_id);
CREATE INDEX IF NOT EXISTS idx_appointments_call_log
  ON public.appointments (call_log_id);

-- Idempotency: one appointment per external ref per dealership. Bland
-- retries the webhook on network blips, and we don't want duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_external_ref
  ON public.appointments (dealership_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- ── 3. Service-role write policy ────────────────────────────────────────
-- The edge function uses the service role key, which bypasses RLS, but
-- we tighten the existing "anyone can insert" policy so it only permits
-- public web-form inserts (source='web'). The Bland webhook writes via
-- service role and is unaffected.
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;
CREATE POLICY "Public can create web appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (source = 'web');

COMMENT ON COLUMN public.appointments.submission_id      IS 'FK to submissions. Null when Bland books for a customer we have no prior record of.';
COMMENT ON COLUMN public.appointments.call_log_id        IS 'FK to voice_call_log. Set when this appointment was booked during a Bland call.';
COMMENT ON COLUMN public.appointments.appointment_type   IS 'inspection | finalization | firm_up_offer';
COMMENT ON COLUMN public.appointments.source             IS 'web | bland_ai | staff — who booked it';
COMMENT ON COLUMN public.appointments.external_ref       IS 'Bland call_id or partner-supplied booking ID; used for idempotent upserts.';
COMMENT ON COLUMN public.appointments.scheduled_at       IS 'Authoritative timestamptz for the appointment; derived from preferred_date+preferred_time when Bland sends a full timestamp.';
