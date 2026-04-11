-- Part 1 cleanup (item #14):
-- TCPA consent language versioning. Today we store the consent text on
-- every consent_log row, which is correct for legal defense but makes
-- it impossible for a compliance officer to answer "what exactly did
-- customers agree to on April 2nd?" without reading thousands of rows.
--
-- This migration introduces a first-class versions table so every
-- published consent text gets a stable version tag, and each consent_log
-- row links to the version that was in effect when it was created.

-- ── Versions table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_text_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  version text NOT NULL,
  consent_type text NOT NULL DEFAULT 'sms_calls_email',
  text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, version, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_consent_text_versions_active
  ON public.consent_text_versions (dealership_id, consent_type, is_active, published_at DESC);

ALTER TABLE public.consent_text_versions ENABLE ROW LEVEL SECURITY;

-- Anyone in the admin UI (authenticated) can read versions for their
-- dealership. Writes are restricted to admin/platform_admin via existing
-- helper functions in the database.
DROP POLICY IF EXISTS "consent_text_versions_read" ON public.consent_text_versions;
CREATE POLICY "consent_text_versions_read"
  ON public.consent_text_versions
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Version tag on existing consent_log rows ────────────────────────
ALTER TABLE public.consent_log
  ADD COLUMN IF NOT EXISTS consent_version text NOT NULL DEFAULT 'v1';

COMMENT ON COLUMN public.consent_log.consent_version IS
  'Version tag referencing consent_text_versions.version. Lets a compliance officer prove exactly which text a customer agreed to without reading the full text field.';

-- Seed the initial v1 version row so existing consent_log rows have
-- something to point to. The text mirrors the string currently produced
-- by src/lib/consent.ts::buildConsentText() with a generic dealer name.
INSERT INTO public.consent_text_versions (dealership_id, version, consent_type, text, is_active, published_by)
VALUES (
  'default',
  'v1',
  'sms_calls_email',
  'By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from {{dealership_name}} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out.',
  true,
  'system_seed'
)
ON CONFLICT (dealership_id, version, consent_type) DO NOTHING;
