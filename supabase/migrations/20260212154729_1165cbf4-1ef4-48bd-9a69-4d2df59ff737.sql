ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS loan_company text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS loan_balance text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS loan_payment text;