-- Landing form variant — pick the public sell-flow per dealer.
--
-- 'detailed' = the 8-step SellCarForm (existing default).
-- 'quick'    = the 1-screen QuickOfferForm (Carvana-style entry).
--
-- Picked in Setup · Process → Landing & Flow next to the template
-- chooser. Default is 'detailed' so existing tenants don't change
-- behavior on deploy — opt in per tenant.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_form_variant text NOT NULL DEFAULT 'detailed';

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_form_variant_check;
ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_form_variant_check
  CHECK (landing_form_variant IN ('detailed', 'quick'));

NOTIFY pgrst, 'reload schema';
