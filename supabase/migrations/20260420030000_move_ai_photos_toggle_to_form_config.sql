-- Move the AI photo step toggle from site_config to form_config so it lives
-- alongside the other step/question toggles dealers already manage in
-- the Lead Form admin (step_vehicle_build, step_condition_history, q_*).
-- Cleaner UX — one place for "what's in the form" decisions.

ALTER TABLE public.form_config
  ADD COLUMN IF NOT EXISTS step_ai_photos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_photos_min_required int NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.form_config.step_ai_photos IS
  'When true, the customer sell-form shows the AI photo upload step between Condition and History. The step itself has a Skip button so this is "show the offer-boost CTA" rather than "force photo upload".';
COMMENT ON COLUMN public.form_config.ai_photos_min_required IS
  'How many ai_scoring_required photos the customer must upload before they can advance with AI scoring. Default 4 (front, rear, driver side, passenger side). They can always Skip.';

-- Carry forward any value the dealer already saved on site_config so we
-- don't reset their choice. The site_config columns shipped one commit
-- earlier; if a dealer has already toggled them, preserve the intent.
UPDATE public.form_config fc
SET
  step_ai_photos = COALESCE(sc.ai_condition_scoring_enabled, fc.step_ai_photos),
  ai_photos_min_required = COALESCE(sc.ai_condition_scoring_min_required, fc.ai_photos_min_required)
FROM public.site_config sc
WHERE fc.dealership_id = sc.dealership_id;

-- Drop the now-redundant site_config columns. The data lived there for a
-- single deploy cycle; nothing else reads them.
ALTER TABLE public.site_config
  DROP COLUMN IF EXISTS ai_condition_scoring_enabled,
  DROP COLUMN IF EXISTS ai_condition_scoring_min_required;
