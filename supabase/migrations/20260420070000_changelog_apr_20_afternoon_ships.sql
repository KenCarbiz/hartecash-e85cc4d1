-- Catch Platform Updates up to every shipment from today (Apr 20).
-- The earlier Apr 20 seeds covered features through the morning; these three
-- shipped in the afternoon and weren't yet on /updates.

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
VALUES
  (
    '2026-04-20',
    'Fifteen landing-page templates — ten OEM-style designs added',
    'Built on top of the five originals, ten new templates match the visual signatures of the major OEM-certified dealer site providers. All fifteen use the same lead-capture flow (VIN / plate+state / year-make-model).',
    ARRAY[
      'Cinema — Dealer Inspire style (Toyota T3, Honda HDDP, Lexus L3). Full-bleed cinematic hero with a model ribbon.',
      'Portal — Dealer.com style (GM iMR, BMW, Mercedes). Photo-left, CTA-card-grid right.',
      'Carousel — CDK / Sincro classic 16:9 slider with chevrons and a four-tile shortcut row.',
      'Slab — DealerOn / Overfuel conversion-first: the search bar IS the hero.',
      'Diagonal — DealerSocket / DealerFire signature: accent-color slash with an italic accent word.',
      'Pickup — FordDirect / GM truck dealers. Truck-at-dawn gradient with brand-color ribbon nav.',
      'Magazine — Stream Companies / Lincoln editorial. Oversized headline overflows the hero photo.',
      'Circular — Force Marketing energy. Promo bursts, payment chips, vehicle cutout.',
      'Motion — fusionZONE style. Drifting Lottie-style blobs and a prominent chat trigger.',
      'Mosaic — Jazel style. No hero photo — 2x3 model-tile mosaic + sell-CTA strip.',
      'New schematic SVG thumbnails for each of the 15 templates in the admin picker.'
    ],
    'Layout',
    'feature',
    0
  ),
  (
    '2026-04-20',
    'Non-default landing templates refreshed with research-driven visuals',
    'The four non-default templates were rebuilt against current dealer site design patterns. Classic (the default with left / center / right hero option) is unchanged.',
    ARRAY[
      'Bold — dark cinematic asymmetric hero with one focused CTA (Carvana / Tesla vibe).',
      'Minimal — almost-empty hero with one giant decorative search pill (Apple-clean).',
      'Elegant — cream + dark with gold rule motifs and serif accents (Lexus / Genesis feel).',
      'Showroom — inventory grid behind a translucent form card ("we buy yours, browse ours").',
      'Migration preserves every dealer''s prior choice (video → bold, inventory → minimal, trust → elegant, editorial → showroom).'
    ],
    'Palette',
    'improvement',
    0
  ),
  (
    '2026-04-20',
    'AI Condition Scoring toggle moved into Lead Form admin',
    'The AI photo step now lives with the other step toggles in Lead Form — step_vehicle_build, step_condition_history, step_ai_photos — so "what''s in the form" is one decision surface.',
    ARRAY[
      'New "Step 3.5 — AI Condition Scoring" row in Lead Form admin with the same Active / Skipped Badge pattern as its siblings.',
      'Inline min-photos input (default 4) appears when the step is active.',
      'Platform Updates consolidated — the duplicate footer sidebar link was removed; the Admin → Platform Updates section is the single source of truth.',
      'New "View public page" button inside the editor opens /updates in a new tab.',
      'Editor heading now reads "Platform Updates" with a subline pointing at /updates.'
    ],
    'ListChecks',
    'improvement',
    0
  );
