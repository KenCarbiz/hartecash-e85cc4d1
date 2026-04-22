
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS onboarding_signature_dealer text,
  ADD COLUMN IF NOT EXISTS onboarding_signature_staff text,
  ADD COLUMN IF NOT EXISTS onboarding_signed_at timestamptz;
