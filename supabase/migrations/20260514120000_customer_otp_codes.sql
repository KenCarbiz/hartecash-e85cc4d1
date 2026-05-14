-- Customer-facing SMS OTP for the /sell MotoAcquire-style flow.
--
-- We don't want to put consumers through Supabase Auth just to
-- verify a phone number (it would create an auth user per lead and
-- couple them to MFA / RLS chains they have no reason to be in).
-- Instead this table holds short-lived 6-digit codes hashed at rest;
-- the send/verify edge functions are the only callers.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_otp_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text        NOT NULL,
  code_hash    text        NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Surrogate that the front-end keeps so the verify call doesn't
  -- need the raw phone number on the wire again.
  challenge_id uuid        NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS customer_otp_codes_phone_idx
  ON public.customer_otp_codes (phone_e164, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_otp_codes_challenge_idx
  ON public.customer_otp_codes (challenge_id);

-- Only the service role (edge functions) touches this table.
ALTER TABLE public.customer_otp_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_otp_codes'
      AND policyname = 'customer_otp_codes_service_role'
  ) THEN
    CREATE POLICY customer_otp_codes_service_role
      ON public.customer_otp_codes
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
