-- Persist the resolved offer mode (firm vs estimate) onto the submission so
-- the public, token-addressed offer pages (/offer/:token, legacy + Clarity)
-- can present firm-offer wording WITHOUT reading offer_settings — which is
-- (correctly) not anonymous-readable for tenant isolation. The offer engine
-- already resolves the mode at persist time (resolveOfferMode in
-- src/lib/offerTerms.ts); this column simply carries that decision to the
-- customer's offer page.
--
-- Idempotent.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS offer_is_firm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.offer_is_firm IS
  'True when the dealer presents this as a firm offer (firm_offer_enabled AND a firm %% configured at offer time). Drives firm-vs-estimate wording on the public offer page without exposing offer_settings to anonymous customers.';

NOTIFY pgrst, 'reload schema';
