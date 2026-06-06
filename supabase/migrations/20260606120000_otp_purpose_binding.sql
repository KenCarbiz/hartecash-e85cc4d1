-- OTP purpose-binding + single-use, to prevent cross-flow code replay.
--
-- Problem this closes: customer_otp_codes was shared by the public /sell-flow
-- login (verify-customer-otp) and the data-rights export/delete action
-- (self-service-data-action), bound only to a phone number. A challenge_id a
-- customer verified merely to use the sell flow could be replayed against the
-- data-rights action. We now:
--   * tag each code with the purpose it was issued for ('sell_flow' default,
--     'data_rights' for export/delete), so a code issued for one flow cannot
--     authorize the other; and
--   * record consumed_at so a data-rights code is single-use.
--
-- The edge functions are written to tolerate this column being absent (they
-- fall back gracefully), so applying this migration is safe in any order
-- relative to the function deploy.
--
-- Idempotent.

ALTER TABLE public.customer_otp_codes
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'sell_flow';

ALTER TABLE public.customer_otp_codes
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

COMMENT ON COLUMN public.customer_otp_codes.purpose IS
  'Flow the code was issued for: sell_flow (phone verify in /sell) or data_rights (export/delete in /my-data-rights). A verifier must require a matching purpose so a code from one flow cannot authorize the other.';
COMMENT ON COLUMN public.customer_otp_codes.consumed_at IS
  'Set when a data_rights code has been used to run an export/delete, making it single-use.';

NOTIFY pgrst, 'reload schema';
