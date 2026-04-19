-- Landing page templates + offer flow configuration
--
-- Lets each dealer (and each location) pick one of several landing-page layouts,
-- plus configure how/when offers are revealed and when contact info is collected.
-- All eleven existing Black Book tier values are reused as-is for the range
-- anchors; no new tier names are introduced.

-- ─── site_config (corporate defaults) ────────────────────────────────────
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_template text NOT NULL DEFAULT 'classic';

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (landing_template IN ('classic','video','inventory','trust','editorial'));

-- ─── dealership_locations (per-location override, nullable = inherit) ────
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS landing_template text;

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (landing_template IS NULL OR landing_template IN ('classic','video','inventory','trust','editorial'));

-- ─── offer_settings (pricing reveal + range + payment timing) ────────────
ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS pricing_reveal_mode text NOT NULL DEFAULT 'price_first',
  ADD COLUMN IF NOT EXISTS show_range_before_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS range_low_source text NOT NULL DEFAULT 'wholesale_avg',
  ADD COLUMN IF NOT EXISTS range_high_mode text NOT NULL DEFAULT 'percent_above_low',
  ADD COLUMN IF NOT EXISTS range_high_source text,
  ADD COLUMN IF NOT EXISTS range_high_percent numeric(5,2) DEFAULT 8.0,
  ADD COLUMN IF NOT EXISTS payment_selection_timing text NOT NULL DEFAULT 'with_final_offer';

ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_pricing_reveal_mode_check
  CHECK (pricing_reveal_mode IN ('price_first','range_then_price','contact_first'));

ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_high_mode_check
  CHECK (range_high_mode IN ('bb_value','percent_above_low'));

ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_low_source_check
  CHECK (range_low_source IN (
    'wholesale_xclean','wholesale_clean','wholesale_avg','wholesale_rough',
    'tradein_clean','tradein_avg','tradein_rough',
    'retail_xclean','retail_clean','retail_avg','retail_rough'
  ));

ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_high_source_check
  CHECK (range_high_source IS NULL OR range_high_source IN (
    'wholesale_xclean','wholesale_clean','wholesale_avg','wholesale_rough',
    'tradein_clean','tradein_avg','tradein_rough',
    'retail_xclean','retail_clean','retail_avg','retail_rough'
  ));

ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_payment_selection_timing_check
  CHECK (payment_selection_timing IN ('before_final_offer','with_final_offer','none_before_final_offer'));

COMMENT ON COLUMN public.site_config.landing_template IS
  'Which landing-page layout to render at /. One of classic, video, inventory, trust, editorial.';
COMMENT ON COLUMN public.dealership_locations.landing_template IS
  'Per-location override for landing_template. NULL = inherit from site_config.';
COMMENT ON COLUMN public.offer_settings.pricing_reveal_mode IS
  'price_first: show exact offer immediately. range_then_price: show estimated range, capture contact, then reveal exact. contact_first: gate all pricing behind contact form.';
COMMENT ON COLUMN public.offer_settings.show_range_before_final IS
  'If true, show an estimated range before the customer sees the final offer (regardless of reveal mode).';
COMMENT ON COLUMN public.offer_settings.range_low_source IS
  'Which Black Book tier anchors the LOW end of the displayed range.';
COMMENT ON COLUMN public.offer_settings.range_high_mode IS
  'bb_value: pull high from a second BB tier. percent_above_low: compute high as low * (1 + range_high_percent/100).';
COMMENT ON COLUMN public.offer_settings.range_high_source IS
  'Which Black Book tier anchors the HIGH end. Required when range_high_mode = ''bb_value''.';
COMMENT ON COLUMN public.offer_settings.range_high_percent IS
  'Percent above low used when range_high_mode = ''percent_above_low''. Default 8.';
COMMENT ON COLUMN public.offer_settings.payment_selection_timing IS
  'When the customer picks how the dealer pays them. before_final_offer | with_final_offer | none_before_final_offer.';
