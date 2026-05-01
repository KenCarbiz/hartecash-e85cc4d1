-- Auto-firm offer rule for the QuickOffer (60-second one-screen) flow.
--
-- Background: customers using QuickOfferForm submit minimal data
-- (plate/VIN + ZIP + mileage + 2 condition Q's) and currently see only
-- an estimated range — the firm `offered_price` requires a manager to
-- bump before the customer sees a final number. To match Carvana's
-- "60-second firm offer" wedge we add a per-tenant auto-firm rule:
-- when set, the QuickOfferForm submit hook computes
--   offered_price = estimated_offer_high × auto_firm_offer_pct
-- on insert, so the customer lands on the offer page with a real
-- number instead of a range.
--
-- Default NULL = disabled (current "manager bumps later" behavior).
-- Typical values when enabled: 0.85–0.95 (i.e., 85–95% of BB-clean
-- estimate). Dealer admins set this per tenant in Setup · Offer Logic.

ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS auto_firm_offer_pct numeric DEFAULT NULL;

-- Sanity bounds. NULL allowed (feature off); numeric values must
-- be between 0.5 (firm offer at half of high estimate — extreme)
-- and 1.0 (firm offer at the top of estimate — also extreme but
-- documented). Bounds are wide on purpose; the admin UI nudges
-- toward 0.85–0.95.
ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_auto_firm_offer_pct_bounds;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_auto_firm_offer_pct_bounds
  CHECK (auto_firm_offer_pct IS NULL OR (auto_firm_offer_pct >= 0.5 AND auto_firm_offer_pct <= 1.0));

NOTIFY pgrst, 'reload schema';
