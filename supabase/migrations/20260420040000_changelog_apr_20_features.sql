-- Catch the public Platform Updates page up to today.
-- Adds entries for the work shipped on Apr 20 that the prior seed missed.

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
VALUES
  (
    '2026-04-20',
    'Watch My Car''s Worth — customer value tracking',
    'Customers who don''t sell today can opt into long-term tracking. We watch their vehicle''s value over time and email them when it changes more than $200.',
    ARRAY[
      'New /watch-my-car/:token customer dashboard with value-over-time history.',
      'Opt-in CTA designed for the offer page (separate from existing offer-watch).',
      'Schema for watched_vehicles + watched_vehicle_history with notification prefs.',
      'Cron worker to recompute weekly via Black Book is the next piece.'
    ],
    'Bell',
    'feature',
    1
  ),
  (
    '2026-04-20',
    'Talk to our appraiser now — outbound AI call from the offer page',
    'Customer hits a button on their offer; Bland AI calls them within seconds with full submission context. The AI knows the vehicle, the offer, and the deductions — and answers questions any hour without waiting until morning.',
    ARRAY[
      'New TalkToAppraiserButton component on the offer page.',
      'launch-voice-call gains an "appraiser_qa" campaign type with an inline script template — no pre-authoring needed.',
      'Bland call seeded with vehicle summary + cash offer for accurate Q&A.'
    ],
    'Phone',
    'feature',
    2
  ),
  (
    '2026-04-20',
    'AI Condition Scoring — photo upload step in the lead form',
    'Optional photo step between Condition and History. Customer uploads four exterior shots, the AI scores actual condition, and the offer engine bumps the offer up to ±$1,500 when the photos beat the self-report.',
    ARRAY[
      'New StepPhotos component with 4 mandatory + 4 optional shots.',
      'Each upload streams to storage and triggers analyze-vehicle-damage (Gemini 2.5 Flash, vehicle-specific prompt with 4-tier scale).',
      'Toggle lives in Lead Form admin (with the other step toggles), not buried in Landing & Flow.',
      'Customer can always skip — the step is a value-add, not a blocker.'
    ],
    'Camera',
    'feature',
    3
  ),
  (
    '2026-04-20',
    'Inspection Confidence Score on the offer page',
    'Pre-empts the "offer slashed at inspection" complaint that hurts KBB ICO and Carvana. Shows a transparent 50–99% score derived from photo count + AI confidence + condition match, with a tooltip explaining the math.',
    ARRAY[
      'New InspectionConfidence component beside the cash offer.',
      'Math: base 70% + 5% per AI photo + 10% if AI condition matches self-report − penalty for low AI confidence.',
      'Self-hides if no AI photo data exists on the submission.'
    ],
    'ShieldCheck',
    'improvement',
    4
  ),
  (
    '2026-04-20',
    'Per-rooftop SEO + subdirectory routing',
    'Each rooftop gets full LocalBusiness schema with city/state/geo, and a /locations/:slug subdirectory URL that pools SEO authority to the main domain (subdirectories outrank subdomains for local search).',
    ARRAY[
      'LocalBusinessJsonLd emits AutoDealer + LocalBusiness on rooftop pages, Organization-only on the group hub.',
      'New /locations/:rooftopSlug routes — same TenantContext resolves both subdomains and subdirectories.',
      'Geo coordinates added to dealership_locations (center_lat / center_lng).'
    ],
    'Globe',
    'improvement',
    5
  ),
  (
    '2026-04-20',
    'Nearest-rooftop banner on the corporate group hub',
    'Visitors landing on the corporate site see a gentle suggestion to visit their nearest rooftop. Self-hides on rooftop-specific pages, on single-location dealers, and after dismissal.',
    ARRAY[
      'New NearestRooftopBanner component using browser geolocation (no third-party IP service).',
      'Only renders on the corporate group hub (no location_id) — never on a rooftop URL.',
      'Dismissible per session.'
    ],
    'MapPin',
    'feature',
    6
  );
