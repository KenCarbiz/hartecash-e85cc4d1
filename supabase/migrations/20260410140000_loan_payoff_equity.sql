-- Dedicated loan payoff field for equity calculations (separate from loan_balance which may be estimated)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS loan_payoff_amount numeric,
  ADD COLUMN IF NOT EXISTS loan_payoff_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loan_payoff_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_equity numeric;

-- Index for equity mining queries
CREATE INDEX IF NOT EXISTS idx_submissions_service_equity
  ON public.submissions(lead_source, estimated_equity DESC)
  WHERE lead_source = 'service' AND estimated_equity > 0;
