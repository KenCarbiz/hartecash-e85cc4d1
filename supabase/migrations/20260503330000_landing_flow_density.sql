-- Landing Flow Density — dealer-controlled "how many condition
-- questions does the customer see" preset.
--
-- Per the May-2026 sell-flow design audit (docs/sell-flow-design-audit.md),
-- the goal is a 3-page customer journey:
--   Landing → "We found your car" → Condition prompts → Offer
--
-- The number of condition prompts on screen 3 is a dealer choice. This
-- migration adds the column the admin UI writes; the SellCarForm
-- consumption (collapse to N questions, branch to a 2nd condition page
-- when N > 5) is the next sprint's surgery.
--
-- Values:
--   'simple'    → 3 questions on one card (mileage + condition + ownership).
--                 Tightest flow, ~3 pages total. Recommended default.
--   'standard'  → 5 questions on one card (+ accidents + mechanical).
--                 Still 3 pages. Audit's "radical-simplicity" recipe.
--   'detailed'  → All available questions (current ~9-step flow).
--                 4-5 pages depending on how many condition fields the
--                 dealer has enabled in their Form Configuration.
--
-- Default 'simple' so new dealers land on the audit-recommended flow.
-- Existing dealers stay on whatever they had until they actively change
-- it in Branding → Landing.
--
-- IDEMPOTENT — ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_form_density text NOT NULL DEFAULT 'simple'
    CHECK (landing_form_density IN ('simple', 'standard', 'detailed'));

COMMENT ON COLUMN public.site_config.landing_form_density IS
  'How many condition questions the public sell-flow asks. simple=3 (mileage/condition/ownership), standard=5 (+accidents/mechanical), detailed=full (all enabled fields). Default simple per the May-2026 design audit recommendation. SellCarForm reads this to skip optional steps.';

-- Per-location override.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dealership_locations') THEN
    EXECUTE 'ALTER TABLE public.dealership_locations
              ADD COLUMN IF NOT EXISTS landing_form_density text
                CHECK (landing_form_density IS NULL OR landing_form_density IN (''simple'', ''standard'', ''detailed''))';
    EXECUTE $cmt$ COMMENT ON COLUMN public.dealership_locations.landing_form_density IS
      'Per-location override for the corporate landing_form_density. NULL = inherit corporate.' $cmt$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
