-- Firm-offer opt-in: lets a dealership explicitly choose to present a *firm*
-- offer (a commitment to honor the stated amount, subject to in-person
-- inspection confirming the vehicle is as described) instead of a non-binding
-- estimate. Default is FALSE so the safe, non-binding "estimate" wording is
-- used until a dealer deliberately turns this on.
--
-- The existing auto_firm_offer_pct column already produces a single firm
-- number; firm_offer_enabled is the legal/verbiage switch layered on top of
-- it. The app treats the offer as firm only when BOTH are set (see
-- resolveOfferMode in src/lib/offerTerms.ts).
--
-- Idempotent.

ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS firm_offer_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.offer_settings.firm_offer_enabled IS
  'Dealer opt-in to present a firm (binding-subject-to-inspection) offer rather than a non-binding estimate. Requires auto_firm_offer_pct to be set to take effect.';

NOTIFY pgrst, 'reload schema';
