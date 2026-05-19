-- rate_limit_hits
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_key_created_idx
  ON public.rate_limit_hits (key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_hits_deny_all" ON public.rate_limit_hits;
CREATE POLICY "rate_limit_hits_deny_all"
  ON public.rate_limit_hits
  AS RESTRICTIVE
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- customer_otp_codes
CREATE TABLE IF NOT EXISTS public.customer_otp_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text        NOT NULL,
  code_hash    text        NOT NULL,
  attempts     integer     NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  challenge_id uuid        NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS customer_otp_codes_phone_idx
  ON public.customer_otp_codes (phone_e164, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_otp_codes_challenge_idx
  ON public.customer_otp_codes (challenge_id);

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
