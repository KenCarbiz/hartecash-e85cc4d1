-- OTP purpose-binding + single-use
ALTER TABLE public.customer_otp_codes
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'sell_flow';

ALTER TABLE public.customer_otp_codes
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

COMMENT ON COLUMN public.customer_otp_codes.purpose IS
  'Flow the code was issued for: sell_flow (phone verify in /sell) or data_rights (export/delete in /my-data-rights). A verifier must require a matching purpose so a code from one flow cannot authorize the other.';
COMMENT ON COLUMN public.customer_otp_codes.consumed_at IS
  'Set when a data_rights code has been used to run an export/delete, making it single-use.';

NOTIFY pgrst, 'reload schema';