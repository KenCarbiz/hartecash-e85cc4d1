-- Per-tenant TCPA consent — required for FCC 2024 one-to-one rule.
-- Each dealership must capture its own consent; consent collected on
-- behalf of "AutoCurb" (or any other multi-tenant umbrella) is not
-- transferable to the dealer who actually wants to call.
--
-- This migration adds:
--   1. site_config.tcpa_disclosure — per-tenant disclosure text shown
--      under the lead-gen form. Defaults sane.
--   2. site_config.tcpa_disclosure_version — bumped when copy
--      changes; lets the cadence engine detect "old consent" and
--      gate re-engagement.
--   3. submissions.tcpa_consent_at + tcpa_consent_version — written
--      at form submit time, captures what they actually saw.
--   4. submissions.tcpa_consent_text — a snapshot of the disclosure
--      copy at consent time. Belt-and-suspenders for legal — if the
--      tenant edits the copy later, we can still prove what the
--      customer agreed to.
--
-- Idempotent — ADD COLUMN IF NOT EXISTS / DEFAULT.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tcpa_disclosure text NOT NULL DEFAULT
    'By submitting this form, I consent to receive automated and prerecorded calls, texts, and emails from this dealership and its agents about my vehicle inquiry, including via autodialer, even if my number is on a Do Not Call list. Consent is not a condition of any purchase. Standard message and data rates may apply. Reply STOP to opt out at any time.',
  ADD COLUMN IF NOT EXISTS tcpa_disclosure_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.site_config.tcpa_disclosure IS
  'Per-tenant TCPA consent language shown under the lead-gen form. FCC 2024 one-to-one rule requires tenant-specific consent — cannot be shared across dealerships.';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS tcpa_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS tcpa_consent_version integer,
  ADD COLUMN IF NOT EXISTS tcpa_consent_text text,
  ADD COLUMN IF NOT EXISTS tcpa_consent_ip text;

COMMENT ON COLUMN public.submissions.tcpa_consent_at IS
  'When the customer agreed to receive automated communications. Used by cadence engine to gate 12-month reactivation re-consent.';
COMMENT ON COLUMN public.submissions.tcpa_consent_text IS
  'Snapshot of the exact disclosure copy the customer saw at submit time. Legal evidence for any TCPA dispute.';

NOTIFY pgrst, 'reload schema';
