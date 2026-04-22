
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS onboarding_answers jsonb DEFAULT '{}'::jsonb;
