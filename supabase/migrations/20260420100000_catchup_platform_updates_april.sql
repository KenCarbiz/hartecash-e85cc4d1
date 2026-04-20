-- ─── Master April catch-up ──────────────────────────────────────────
-- Consolidated seed of every Platform Update shipped between Apr 15 and
-- Apr 20, 2026. Replaces the piecemeal seeds from the earlier migrations
-- so the /updates page reflects the full catalog in one shot, regardless
-- of which earlier migrations have run on this database.
--
-- Idempotent: wipes the dealership_id='default' entries in the April
-- window first, then re-inserts. dealership-scoped custom entries on
-- other tenants are left alone.

BEGIN;

DELETE FROM public.changelog_entries
WHERE dealership_id = 'default'
  AND entry_date >= '2026-04-15'
  AND entry_date <= '2026-04-20';

INSERT INTO public.changelog_entries
  (dealership_id, entry_date, title, description, items, icon, tag, sort_order, is_active)
VALUES
  -- ── April 20 ─────────────────────────────────────────────────────
  ('default','2026-04-20',
    'Customer file cleanup — QuickSummary, Inspection Vitals, shadows & alignment',
    'Major readability pass on the customer detail sheet for BDC, sales, and managers.',
    ARRAY[
      'New pinned QuickSummary strip: name, click-to-call, SMS, email, pipeline stage, lead source, last-activity.',
      'Driver''s license front thumbnail visible at a glance (click to zoom).',
      'Inspection Vitals tile replaces the old auto-generated "[INSPECTION...]" text dump. Green/amber/red state for each wheel position.',
      'Right-column noise collapsed under a single "Research & Automation" section.',
      'DetailRow labels no longer collide with long values on desktop.',
      'Header trimmed from 4 actions to 3 (redundant Inspection button removed).',
      'Eyeball button now opens the detail sheet reliably (Radix animation regression fixed).'
    ],
    'Users', 'improvement', 1, true),

  ('default','2026-04-20',
    'Inspection Check-In — last 6 of VIN shortcut',
    'Staff can now type the last 6 digits of a VIN on /inspection-checkin to jump straight to an existing customer''s inspection.',
    ARRAY[
      'Manual Entry input accepts 17-char VIN (existing flow) OR last 6 digits.',
      'Single match → navigates straight to the inspection page.',
      'Multiple matches → inline picker (vehicle + customer).',
      '/checkin is now an alias for /inspection-checkin.'
    ],
    'ScanLine', 'feature', 2, true),

  ('default','2026-04-20',
    'Appraiser Queue — provisioned + 3-hour auto-flag',
    'The "Send to Appraiser" button now writes; a cron auto-queues stale offers.',
    ARRAY[
      'Provisions needs_appraisal on submissions + partial index.',
      'pg_cron job auto_queue_stale_offers() runs every 15 minutes.',
      'Any submission with a generated offer sitting untouched for 3+ hours is auto-flagged.',
      'Each flip writes an activity_log row for audit.'
    ],
    'Gauge', 'feature', 3, true),

  ('default','2026-04-20',
    'OBD repair-cost estimator (layers 1–3)',
    'New seed of ~60 common OBD codes + vehicle-class multipliers + inspector-note AI overlay feeds recon cost into the offer engine.',
    ARRAY[
      'obd_repair_estimates table seeded with common P0xxx / P07xx / U0xxx / C00xx codes.',
      'Deterministic vehicle multiplier (make_class × age band × mileage band).',
      'estimate-inspector-note edge function turns free-text observations into adjustment %.',
      'Feeds offer_settings.recon_cost so dealer offers auto-net out expected repair.'
    ],
    'Wrench', 'feature', 4, true),

  ('default','2026-04-20',
    'Platform Updates moved out of System Settings',
    'The changelog editor now has its own Admin → Platform Updates page with a "View public page" link.',
    ARRAY[
      'Footer duplicate removed — Admin → Platform Updates is the single source of truth.',
      'Editor heading updated to match the public page name.'
    ],
    'Layout', 'improvement', 5, true),

  ('default','2026-04-20',
    'Fifteen landing-page templates (10 OEM-style added)',
    'Built on top of the five originals, ten new templates match the visual signatures of the major OEM-certified dealer site providers.',
    ARRAY[
      'Cinema (Dealer Inspire / Toyota T3 / Honda HDDP).',
      'Portal (Dealer.com / GM iMR / BMW / Mercedes).',
      'Carousel (CDK / Sincro).',
      'Slab (DealerOn / Overfuel).',
      'Diagonal (DealerSocket / DealerFire).',
      'Pickup (FordDirect / GM truck dealers).',
      'Magazine (Stream Companies / Lincoln).',
      'Circular (Force Marketing).',
      'Motion (fusionZONE).',
      'Mosaic (Jazel).',
      'Schematic SVG thumbnails for each in the admin picker.'
    ],
    'Layout', 'feature', 6, true),

  ('default','2026-04-20',
    'Non-default landing templates refreshed',
    'Video / Inventory / Trust / Editorial were rebuilt as Bold / Minimal / Elegant / Showroom with sharper visual identities. Classic (default) unchanged.',
    ARRAY[
      'Bold — dark cinematic asymmetric (Carvana / Tesla feel).',
      'Minimal — almost-empty hero with a giant search pill (Apple-clean).',
      'Elegant — cream + dark with gold rule motifs and serif accents.',
      'Showroom — inventory-grid hero with translucent form overlay.',
      'Migration preserves every dealer''s prior choice.'
    ],
    'Palette', 'improvement', 7, true),

  ('default','2026-04-20',
    'AI photos toggle moved to Lead Form admin',
    'The AI photo scoring step toggle now lives with the other form step toggles.',
    ARRAY[
      'New "Step 3.5 — AI Condition Scoring" row in Lead Form.',
      'Inline min-photos input (default 4).',
      'step_ai_photos column added to form_config.'
    ],
    'ListChecks', 'improvement', 8, true),

  ('default','2026-04-20',
    'Pre-launch security & UX hardening',
    'Four-agent audit pass. Closed cross-tenant gaps and tightened the customer flow.',
    ARRAY[
      'Service-role edge functions now enforce tenant isolation (ai-text-agent, ai-photo-reappraisal, analyze-vehicle-damage, book-appointment).',
      'Customer offer flow honors the dealer''s pricing reveal mode (price-first / range-then-price / contact-first).',
      'Email validation regex replaces trivial .trim() checks.',
      'Abandoned form auto-resumes via ?resume=<id> URL or localStorage.',
      'Testimonials section hides itself for new dealers (no fallback CT reviews).',
      'Section error boundary shows "temporarily unavailable" instead of going blank.',
      'AdminDashboard chunk shrunk ~80 KB by lazy-loading SubmissionDetailSheet.'
    ],
    'Shield', 'security', 9, true),

  ('default','2026-04-20',
    'Per-rooftop websites for dealer groups',
    'Multi-store dealers can give each rooftop its own URL, custom domain, and landing page while sharing one admin inbox.',
    ARRAY[
      'Each location can opt into its own subdomain + optional custom domain.',
      'New "Rooftop Websites" admin panel.',
      'Onboarding wizard collects rooftop URL + template per location.',
      'Review screen summarizes rooftop URLs before provisioning.'
    ],
    'Globe', 'feature', 10, true),

  ('default','2026-04-20',
    'SVG thumbnails in template pickers',
    'Dealers picking a landing template now see a schematic preview using theme CSS vars.',
    ARRAY[
      'Wired into Landing & Flow picker, per-location override, and the Embed Toolkit.',
      'Schematic SVGs — no screenshots to maintain across template edits.'
    ],
    'Palette', 'improvement', 11, true),

  ('default','2026-04-20',
    'Watch My Car''s Worth — customer value tracking',
    'Customers who don''t sell today can opt into tracking. We email when the vehicle''s value moves more than $200.',
    ARRAY[
      '/watch-my-car/:token customer dashboard with value-over-time history.',
      'Schema for watched_vehicles + watched_vehicle_history.',
      'Opt-in CTA component.',
      'Weekly recompute cron is the next piece.'
    ],
    'Bell', 'feature', 12, true),

  ('default','2026-04-20',
    'Talk to our appraiser — outbound AI call',
    'Customer clicks the offer-page button and Bland AI calls them within seconds with full submission context.',
    ARRAY[
      'TalkToAppraiserButton on the offer page.',
      'New appraiser_qa campaign type in launch-voice-call with an inline script template.',
      'Answers questions about the offer, inspection, pickup — any hour.'
    ],
    'Phone', 'feature', 13, true),

  ('default','2026-04-20',
    'AI Condition Scoring + Inspection Confidence Score',
    'Optional photo-upload step in the sell-form, with an in-offer badge that shows how confident we are the in-person number will match.',
    ARRAY[
      'StepPhotos with 4 required + 4 optional exterior shots.',
      'analyze-vehicle-damage prompt hardened and aligned to the platform''s 4-tier condition scale.',
      'Inspection Confidence Score (50–99%) beside the cash offer on /offer — pre-empts the "slashed at inspection" complaint that hurts KBB ICO and Carvana.'
    ],
    'Camera', 'feature', 14, true),

  ('default','2026-04-20',
    'Per-rooftop SEO + subdirectory routing',
    'Each rooftop now emits full LocalBusiness schema with city/state/geo, and a subdirectory URL that pools SEO authority to the main domain.',
    ARRAY[
      'LocalBusinessJsonLd emits AutoDealer + LocalBusiness on rooftop pages.',
      'New /locations/:rooftopSlug routes resolve to the same tenant.',
      'NearestRooftopBanner on the corporate group hub suggests the closest rooftop via browser geolocation.'
    ],
    'Globe', 'improvement', 15, true),

  -- ── April 19 ─────────────────────────────────────────────────────
  ('default','2026-04-19',
    'Five dealer-selectable landing-page templates + offer flow',
    'Dealers pick Classic, Bold, Minimal, Elegant, or Showroom. Each template uses the same lead-capture form, so VIN / plate+state / year-make-model entry works everywhere.',
    ARRAY[
      'Pricing reveal mode: price-first / range-then-price / contact-first.',
      'Dealer picks Black Book tier anchors for the displayed range.',
      'Payment selection timing is also dealer-configurable.',
      'Per-location overrides honored via dealership_locations.landing_template.'
    ],
    'Layout', 'feature', 1, true),

  ('default','2026-04-19',
    'Central Stripe billing hub for the Autocurb Suite',
    'Unified billing surface. One place to manage subscriptions, add-ons, and ops reconciliation.',
    ARRAY[
      'billing-portal-session, billing-replay, billing-add-app, billing-checkout, billing-downgrade edge functions.',
      'tenant_id resolves via Stripe customer.metadata (not subscription).',
      'Volume-tiered pricing respected across onboarding, billing, and the picker.'
    ],
    'CreditCard', 'feature', 2, true),

  -- ── April 16 ─────────────────────────────────────────────────────
  ('default','2026-04-16',
    'Pricing Model rebuild — base block + volume sliders',
    'Platform-admin pricing model now architecture-aware; dealer groups, multi-store, and single-store all price correctly.',
    ARRAY[
      'Base-block + volume-tier model that auto-shifts as rooftops are added.',
      'Architecture drives pricing across onboarding, billing, and the picker.',
      'Dealer-group discounts applied automatically.',
      'Onboarding adds a store-count dropdown that updates pricing in real time.',
      'Pricing-model availability toggles per product.'
    ],
    'DollarSign', 'feature', 1, true),

  ('default','2026-04-16',
    'Admin sidebar restructure (7 → 6 → reorganized)',
    'First pass at consolidating the admin sidebar; later finished in a full regrouping.',
    ARRAY[
      'Settings split into Insights, Admin, Integrations, and Platform.',
      'Promotions + Referral Program grouped under Configuration.',
      'Icon collisions fixed (Branding → Palette, Appraiser Queue → UserCheck, My Referrals → Award, Website Embed → Code2).',
      'Replaced window.location.href navigation with React Router.'
    ],
    'Layout', 'improvement', 2, true),

  ('default','2026-04-16',
    'AutoCurb.io platform brand + B2B pitch page',
    'New brand styling and a public /platform page for prospective dealers.',
    ARRAY[
      'AutoCurb.io colors (green + charcoal) applied platform-wide.',
      '/platform pitch page targeting franchise and group buyers.',
      'Reduced logo image sizes for faster initial paint.'
    ],
    'Palette', 'feature', 3, true),

  ('default','2026-04-16',
    'OBDLink CX is now the supported BLE adapter',
    'Standardized hardware recommendation so inspection check-ins use a single vetted device.',
    ARRAY[
      'OBD scan flow + customer-facing copy aligned to the OBDLink CX.',
      'Removes ambiguity for service writers and BDC during onboarding.'
    ],
    'ScanLine', 'improvement', 4, true),

  -- ── April 15 ─────────────────────────────────────────────────────
  ('default','2026-04-15',
    'Pricing picker overhaul: monthly/annual + cumulative totals',
    'The plan picker now shows the right number for every selection state; per-tier cycle choices no longer flip each other.',
    ARRAY[
      'Per-tier monthly vs. annual cycles toggle independently.',
      'Three-box summary: cumulative monthly, annual, Due-Today bubble.',
      'Live preview of in-flight selection at the top of Current Plan.',
      'Annual prepaid totals respect per-product cycles without rounding drift.',
      'Complimentary Basic plan handled correctly across variants.',
      'Fallback catalog merged in so bundle/tier cards always render.'
    ],
    'DollarSign', 'improvement', 1, true);

COMMIT;
