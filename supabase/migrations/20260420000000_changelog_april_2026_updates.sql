-- Seed Platform Updates for the work shipped from early April 2026 to launch.
-- Sorted newest-first on /updates. dealership_id defaults to 'default' so
-- these are platform-wide entries visible to every tenant.

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
VALUES
  -- ── April 20 ──
  (
    '2026-04-20',
    'Sidebar reorganization & cleaner labels',
    'Admin nav was regrouped to make settings easier to find and to retire icon collisions.',
    ARRAY[
      'Split the catch-all Settings group into Insights, Admin, Integrations, and Platform.',
      'Fixed three icon collisions (Branding now uses Palette, My Referrals uses Award, Appraiser Queue uses UserCheck).',
      'Renamed "Wholesale Exit" to "Wholesale Marketplace" for clarity.',
      'Renamed "Depth Policies" to "Inspection Standards".',
      'Moved the changelog editor out of System Settings into its own "Platform Updates" admin page.'
    ],
    'Layout',
    'improvement',
    1
  ),
  (
    '2026-04-20',
    'Pre-launch security & UX hardening',
    'Multi-agent audit pass before launch — closed cross-tenant gaps and polished the customer flow.',
    ARRAY[
      'Service-role edge functions now enforce tenant isolation (ai-text-agent, ai-photo-reappraisal, analyze-vehicle-damage, book-appointment).',
      'Customer offer flow now respects the dealer''s pricing reveal mode (price-first, range-then-price, contact-first).',
      'Email validation no longer accepts garbage; abandoned-lead detection uses the same rule.',
      'Abandoned form auto-resumes via ?resume=<id> URL or localStorage so customers don''t restart.',
      'Testimonials section hides itself for new dealers instead of showing fallback CT reviews.',
      'Section error boundary now shows a visible "temporarily unavailable" message instead of going blank.',
      'AdminDashboard initial chunk shrunk by ~80 KB by lazy-loading SubmissionDetailSheet.'
    ],
    'Shield',
    'security',
    2
  ),
  (
    '2026-04-20',
    'Per-rooftop websites for dealer groups',
    'Multi-store dealers can now give each rooftop its own URL and landing page while sharing one admin.',
    ARRAY[
      'Each location can opt into its own subdomain (e.g. smith-toyota.autocurb.io) and an optional custom domain.',
      'New "Rooftop Websites" admin panel to add, edit, or remove rooftop URLs after onboarding.',
      'Onboarding wizard collects the slug, custom domain, and landing template per rooftop in one step.',
      'Review screen summarizes which rooftop URLs are about to be provisioned.',
      'All rooftops share dealership_id, so leads, staff, and billing stay unified.'
    ],
    'Globe',
    'feature',
    3
  ),
  (
    '2026-04-20',
    'SVG thumbnails in template pickers',
    'Dealers picking a landing template now see a schematic preview instead of a label-only card.',
    ARRAY[
      'New TemplateThumbnail component renders schematic SVGs for all five templates.',
      'Wired into the Landing & Flow picker, the per-location override, and the Embed Toolkit.',
      'Thumbnails inherit the dealer''s colors via CSS vars — no screenshots to maintain.'
    ],
    'Palette',
    'improvement',
    4
  ),
  (
    '2026-04-20',
    'Embed your landing page on the dealer site',
    'New "Homepage" tab in Website Embed lets dealers iframe the full sell-your-car flow with any of the five templates.',
    ARRAY[
      'Pick "Dealer Default" to inherit the configured template, or pin one of the five.',
      'Snippet uses ?template= URL parameter so different stores can embed different layouts.',
      'Existing button snippet inherits the same picker when targetPage is the homepage.'
    ],
    'Code2',
    'feature',
    5
  ),

  -- ── April 19 ──
  (
    '2026-04-19',
    'Five landing-page templates with offer-flow controls',
    'Each dealer now picks one of five landing layouts and decides exactly when customers see their offer.',
    ARRAY[
      'Five templates — Classic, Video Hero, Inventory-Forward, Trust-Wall, Editorial — drop into / based on dealer choice.',
      'Pricing reveal modes — price-first / range-then-price / contact-first — configurable per dealer.',
      'Range display anchored to dealer-picked Black Book tiers (low + high, or low + percent).',
      'Payment selection timing — before, with, or after the final offer — also dealer-configurable.',
      'Per-location overrides for template, with "inheriting from corporate" badge.'
    ],
    'Layout',
    'feature',
    1
  ),
  (
    '2026-04-19',
    'Central Stripe billing hub for the Autocurb Suite',
    'New unified billing surface so dealers can manage subscriptions, add-ons, and reconciliation in one place.',
    ARRAY[
      'New billing-portal-session edge function for Stripe Customer Portal.',
      'New billing-replay edge function for ops reconciliation when webhooks miss.',
      'Tenant_id now resolves via Stripe customer.metadata, not from the subscription object.',
      'Add-on selection (billing-add-app), checkout, downgrade, and bundle-upgrade flows wired end-to-end.'
    ],
    'CreditCard',
    'feature',
    2
  ),

  -- ── April 16 ──
  (
    '2026-04-16',
    'Pricing Model rebuild — base block + volume sliders',
    'Platform-admin pricing rebuilt around an architecture-aware model so dealer groups, multi-store, and single-store all price correctly.',
    ARRAY[
      'New base-block + volume-pricing-tier model that auto-shifts as rooftops are added.',
      'Architecture (single / single+secondary / multi-location / dealer group) now drives pricing across onboarding, billing, and the picker.',
      'Dealer-group discounts applied automatically.',
      'Onboarding adds a store-count dropdown that updates pricing in real time.',
      'Pricing-model availability toggles let platform admins enable/disable specific products per architecture.'
    ],
    'DollarSign',
    'feature',
    1
  ),
  (
    '2026-04-16',
    'Admin sidebar restructure (7 groups → 6)',
    'First pass at consolidating the admin sidebar to surface daily tools faster.',
    ARRAY[
      'Merged related groups; reordered for daily-use frequency.',
      'Replaced window.location.href navigation with React Router so transitions are instant.'
    ],
    'Layout',
    'improvement',
    2
  ),
  (
    '2026-04-16',
    'AutoCurb.io platform brand & B2B pitch page',
    'New brand styling and a public B2B page for prospective dealers.',
    ARRAY[
      'AutoCurb.io brand colors (green + charcoal) applied platform-wide.',
      'New /platform pitch page targeting franchise and group buyers.',
      'Reduced logo image sizes for faster initial paint.'
    ],
    'Palette',
    'feature',
    3
  ),
  (
    '2026-04-16',
    'OBDLink CX is now the supported BLE adapter',
    'Standardized hardware recommendation so inspection check-ins use a single, vetted device.',
    ARRAY[
      'OBD scan flow + customer-facing copy aligned to the OBDLink CX.',
      'Removes ambiguity for service writers and BDC during onboarding.'
    ],
    'ScanLine',
    'improvement',
    4
  ),

  -- ── April 15 ──
  (
    '2026-04-15',
    'Pricing picker overhaul: monthly/annual cycles + cumulative totals',
    'The plan picker now shows the right number for every selection state — no more stale rollups or lost cycle choices.',
    ARRAY[
      'Per-tier monthly vs. annual cycles toggle independently; switching one no longer flips the others.',
      'New three-box summary: cumulative monthly, annual, and a Due-Today bubble.',
      'Live preview of the in-flight selection at the top of Current Plan before save.',
      'Annual prepaid totals respect per-product cycles and never drift on rounding.',
      'Complimentary Basic plan handled correctly across all variants.',
      'Fallback catalog merged in so bundle/tier cards always render even mid-load.'
    ],
    'DollarSign',
    'improvement',
    1
  );
