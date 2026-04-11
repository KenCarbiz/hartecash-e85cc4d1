-- Part 1 cleanup (item #20):
-- Referral payout reconciliation. Today the referrals table only tracks
-- a status enum and a reward_amount, so there is no way to prove WHICH
-- check was cut, WHEN it was delivered, or to claw back a payout if the
-- underlying deal unwinds. This migration adds the columns needed for a
-- real payout ledger.

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS payout_notes text,
  ADD COLUMN IF NOT EXISTS payout_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by text,
  ADD COLUMN IF NOT EXISTS clawed_back_at timestamptz,
  ADD COLUMN IF NOT EXISTS clawback_reason text,
  ADD COLUMN IF NOT EXISTS clawback_by text;

COMMENT ON COLUMN public.referrals.payout_method IS
  'How the referral reward was delivered: check, gift_card, ach, store_credit, cash, other.';
COMMENT ON COLUMN public.referrals.payout_reference IS
  'Check number, gift-card ID, ACH trace, or other external reference for the payout.';
COMMENT ON COLUMN public.referrals.clawback_reason IS
  'Reason the payout was reversed. Required when clawed_back_at is set.';

-- Index for fast payout reporting
CREATE INDEX IF NOT EXISTS idx_referrals_payout_at
  ON public.referrals (payout_at DESC)
  WHERE payout_at IS NOT NULL;
