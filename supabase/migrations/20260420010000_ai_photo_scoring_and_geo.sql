-- AI photo condition scoring + per-rooftop SEO foundations.
--
-- Photo scoring: a dealer-controlled toggle on site_config plus per-shot
-- flags on photo_config so the dealer picks which angles the customer must
-- upload before the AI runs. Defaults match industry guidance — front,
-- rear, driver side, passenger side are required for the AI score.
--
-- Geo-targeting: dealership_locations gains a center_lat/lng pair so the
-- public site can suggest the nearest rooftop without a third-party
-- geocoding call at request time. center_zip → lat/lng can be backfilled
-- later via a one-shot ZIP geocode.

-- ─── site_config: AI scoring toggle ─────────────────────────────────────
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ai_condition_scoring_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_condition_scoring_min_required int NOT NULL DEFAULT 4;

COMMENT ON COLUMN public.site_config.ai_condition_scoring_enabled IS
  'Master switch: when true, the customer sell-form shows the AI photo step (between Condition and History). Photos are uploaded and analyzed; AI condition score feeds the offer engine.';
COMMENT ON COLUMN public.site_config.ai_condition_scoring_min_required IS
  'How many ai_scoring_required photos the customer must upload before they can advance. Default 4 (front, rear, driver side, passenger side).';

-- ─── photo_config: per-shot AI flag ─────────────────────────────────────
ALTER TABLE public.photo_config
  ADD COLUMN IF NOT EXISTS ai_scoring_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.photo_config.ai_scoring_required IS
  'When true, this shot is part of the AI condition scoring set the customer must complete. Distinct from is_required which governs full appraiser sheet completion.';

-- Mark the four mandatory exterior angles for AI scoring on every existing
-- dealer. These match industry guidance for damage detection coverage.
UPDATE public.photo_config
SET ai_scoring_required = true
WHERE shot_id IN ('front', 'rear', 'driver_side', 'passenger_side');

-- ─── dealership_locations: geo coordinates for nearest-rooftop lookup ──
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS center_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS center_lng numeric(9,6);

COMMENT ON COLUMN public.dealership_locations.center_lat IS
  'Approximate latitude of this rooftop (from center_zip or address). Used to suggest the nearest rooftop on the corporate landing page only — never on a rooftop-specific page.';
COMMENT ON COLUMN public.dealership_locations.center_lng IS
  'Approximate longitude of this rooftop. See center_lat.';
