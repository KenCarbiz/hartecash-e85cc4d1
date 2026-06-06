ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS offer_is_firm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.offer_is_firm IS
  'True when the dealer presents this as a firm offer (firm_offer_enabled AND a firm %% configured at offer time). Drives firm-vs-estimate wording on the public offer page without exposing offer_settings to anonymous customers.';

NOTIFY pgrst, 'reload schema';