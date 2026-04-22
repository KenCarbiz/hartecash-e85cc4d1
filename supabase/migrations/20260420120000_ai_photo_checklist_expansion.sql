-- AI photo checklist expansion.
--
-- The analyze-vehicle-damage edge function now returns verification
-- findings beyond "damage detected": odometer reading, illuminated
-- warning lights, tire tread depth, paint-mismatch (prior-accident signal),
-- cabin concerns, and a plain-English inspector note per photo. This
-- migration provisions the storage + updates the photo_config to match
-- the expanded customer baseline (dashboard + driver interior are now
-- required for AI scoring; rear interior is a new optional shot).

-- ─── damage_reports: structured verification findings ─────────────────
ALTER TABLE public.damage_reports
  ADD COLUMN IF NOT EXISTS verification_findings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.damage_reports.verification_findings IS
  'Per-photo AI verification signals. Shape: { mileage_reading, warning_lights[], tire_tread_32nds, tire_issues[], paint_mismatch_detected, accident_repair_signs[], cabin_concerns[], inspector_note }. Populated by analyze-vehicle-damage.';

-- ─── submissions: AI-read odometer (fraud + mileage verification) ─────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_detected_mileage integer;

COMMENT ON COLUMN public.submissions.ai_detected_mileage IS
  'Mileage the AI read off the dashboard photo. Never overwrites the customer-entered mileage; surfaced to the inspector so they can eyeball any discrepancy.';

-- ─── photo_config: add rear interior slot + widen AI baseline ─────────
-- Add the new rear_interior shot to every existing dealer that doesn't
-- already have it. sort_order 5.5 -> place it right after the driver
-- interior shot in the default ordering.
INSERT INTO public.photo_config
  (dealership_id, shot_id, label, description, orientation, is_enabled, is_required, sort_order, ai_scoring_required)
SELECT DISTINCT
  dealership_id,
  'interior_rear',
  'Rear Interior',
  'Rear seats and floor — catches stains, pet damage, and car-seat wear',
  'landscape',
  true,
  false,
  6,
  false
FROM public.photo_config pc
WHERE NOT EXISTS (
  SELECT 1 FROM public.photo_config x
  WHERE x.dealership_id = pc.dealership_id
    AND x.shot_id = 'interior_rear'
);

-- Expand the AI scoring baseline: dashboard and interior now count
-- toward the required set (was just the four exterior angles). This
-- matches the new customer-facing StepPhotos baseline.
UPDATE public.photo_config
SET ai_scoring_required = true
WHERE shot_id IN ('dashboard', 'interior');

-- Bump the min_required default so ai_condition_scoring_min_required
-- aligns with the new 6-photo baseline. Dealers who overrode it keep
-- their override.
UPDATE public.site_config
SET ai_condition_scoring_min_required = 6
WHERE ai_condition_scoring_min_required = 4;

-- ─── Schema cache reload ──────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
