-- Comprehensive Platform Updates backfill — every user-facing change
-- shipped between 2026-04-06 and 2026-05-01 that customers should see
-- on /admin?section=changelog.
--
-- This migration is IDEMPOTENT — uses NOT EXISTS guards on
-- (entry_date, title) so it's safe to apply against any DB state,
-- including ones that already have prior partial seeds. Anything
-- already in changelog_entries with the same date+title is left
-- untouched.
--
-- Coverage: ~25 high-leverage entries grouped by theme rather than
-- one-per-commit. Bug fixes and internal refactors aren't listed —
-- the changelog is for dealer-visible product moves, not engineering
-- log noise.

DO $$
DECLARE
  -- Helper: only insert when no row exists for the same date+title.
  -- Done as a DO block with PERFORM-NOT-EXISTS guards so the migration
  -- runs cleanly even when prior backfills (20260420* and 20260501040000)
  -- have already populated some entries.
  _r RECORD;
BEGIN

-- ── Apr 7-13 — Prospect Demo phases 1-6 ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-07', 'Prospect Demo — standalone sales-pitch tool',
  'New tool for sales reps pitching dealers who aren''t customers yet. Capture screenshots of any dealer site, layer Autocurb assets on top, share the result.',
  ARRAY[
    'Configure prospect brand (dealer name, button color, banner copy) without needing a tenant login.',
    'Capture homepage / listing / VDP via microlink with junk-page detection (SSL warnings, 404s, CF challenges all auto-rejected).',
    'Eight asset overlays (iframe modal, hero banner, widget tab, sticky bar, VDP/listing ghosts, button CTA, PPT badge) with brand-color theming.',
    'Phase 2: AI-driven color palette + accent-color recommender.',
    'Phase 3: Vision-LLM senior-rep recommendations per page.',
    'Phase 4: Auto-detect listing/VDP URLs from the homepage.',
    'Phase 5: Shareable /demo/:token URLs with view tracking.',
    'Phase 6: Dynamic embed loader — install once, change forever.'
  ],
  'Sparkles', 'feature', 100
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-07' AND title = 'Prospect Demo — standalone sales-pitch tool');

-- ── Apr 8 — Sidebar redesign ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-08', 'Sidebar redesign — Work / Queues / Floor Tools / Grow / Measure / Setup',
  'Reorganized the left navigation into purposeful groups so dealers and reps find what they need without hunting. Icons refreshed across the board with no duplicates.',
  ARRAY[
    'Work group anchored by Today + personal items (My Lead Link, My Availability, My Referrals).',
    'Queues group: All Leads, Appraiser Queue, Appointments, BDC Priority Queue.',
    'Floor Tools group: Inspection Check-In, Service Quick Entry, Vehicle Images.',
    'Grow group: Equity Mining, Voice AI.',
    'Measure group: Performance, GM HUD, Reports, Compliance.',
    'Setup split into Dealer (identity + capture) and Process (customer-facing flow + comms).',
    'Account group at the bottom: Staff & Permissions, Plan, Dealer Setup, System Settings, Platform Updates.',
    'Renamed Appearance → Appearance & Access to reflect the role-visibility toggles it now houses.'
  ],
  'Layout', 'feature', 99
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-08' AND title = 'Sidebar redesign — Work / Queues / Floor Tools / Grow / Measure / Setup');

-- ── Apr 8 — Queue redesigns ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-08', 'Appraiser Queue + BDC Priority Queue — four-tile dashboards',
  'Both queues got the same approved redesign: top tiles for at-a-glance pipeline state, ranked single-list below. Clickable bucket tiles filter the list inline.',
  ARRAY[
    'Four-tile dashboard: Needs Appraisal / In Review / Flagged / Done Today.',
    'Auto-route stale offers (>1h, no acceptance) into Flagged automatically.',
    'Ranked single-list redesign with priority signals.',
    'Search box filters the list.',
    'Front-desk panel on Appointments — Today / Right Now / On the Way + check-in flow.'
  ],
  'RotateCcw', 'feature', 98
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-08' AND title = 'Appraiser Queue + BDC Priority Queue — four-tile dashboards');

-- ── Apr 14 — Channels (SMS/Email/AI-call toggles) ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-14', 'Communication Channels — SMS / Email / AI-Call toggles',
  'New Setup · Dealer · Communication Channels page lets the dealer flip on / off each customer-facing channel at the corporate level OR per rooftop. Every send surface in the admin honors the toggle.',
  ARRAY[
    'Per-tenant + per-store toggles — Hartford INFINITI can run AI-Calls while Wallingford runs SMS only.',
    'Enforced at every staff send surface: notification triggers, manual SMS, voice-AI campaign launch, click-to-dial.',
    'Audit-pass-1 wiring closed before APIs go live so no surface bypasses the toggle.',
    'Twilio click-to-dial bridge across all customer phones — rep-side ring then bridge to customer.'
  ],
  'Phone', 'feature', 97
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-14' AND title = 'Communication Channels — SMS / Email / AI-Call toggles');

-- ── Apr 15 — Click-to-Dial v2 ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-15', 'Click-to-Dial v2 — off-hours guard, per-rep DND, recording consent',
  'Reps click a customer phone number anywhere in the customer file and the system rings the rep first, then bridges to the customer with consent recording.',
  ARRAY[
    'Off-hours guard refuses dials outside the dealer''s configured calling hours.',
    'Per-rep DND toggle — reps set their own do-not-disturb status from My Availability.',
    'Tenant call recording with explicit consent prompt at start.',
    'Bridges all customer phone numbers (cell, home, work) — rep picks before connecting.'
  ],
  'Phone', 'feature', 96
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-15' AND title = 'Click-to-Dial v2 — off-hours guard, per-rep DND, recording consent');

-- ── Apr 15 — My Availability ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-15', 'My Availability — self-serve DND + quiet hours for reps',
  'Reps now manage their own click-to-dial availability without admin intervention. Quiet-hours window blocks calls in their local timezone; DND toggle is a hard block.',
  ARRAY[
    'Cell phone, DND toggle, quiet-hours window, and timezone — all editable by the rep.',
    'New SECURITY DEFINER RPC limits self-serve writes to safe columns only (no role / dealership escalation).',
    'Available in the My group of the sidebar.'
  ],
  'Clock', 'feature', 95
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-15' AND title = 'My Availability — self-serve DND + quiet hours for reps');

-- ── Apr 16 — Comms inbox ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-16', 'Comms inbox — inbound email + live SMS timeline + voice in customer file',
  'Every conversation now flows through one timeline on the customer file. Customer email replies route back to the originating submission via the +tag in Reply-To.',
  ARRAY[
    'Outbound emails set per-submission Reply-To so customer replies land on the right submission.',
    'Inbound email webhook closes the email loop — replies post into the timeline like SMS.',
    'Live timeline updates: inbound SMS appears without refresh (Supabase Realtime).',
    'Voice calls appear in the customer file timeline alongside SMS / email — full conversation history in one view.',
    'V2 unified comms tab uses VoiceCallCard + manual Log-a-call form.',
    'Inline audio + transcript expand on voice call rows.'
  ],
  'MessageSquareQuote', 'feature', 94
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-16' AND title = 'Comms inbox — inbound email + live SMS timeline + voice in customer file');

-- ── Apr 17 — Voice AI production ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-17', 'Voice AI — campaign suite + voicemail drop + analytics',
  'Voice AI is now production-ready. Campaign builder, dynamic script preview, voicemail drop, and per-campaign analytics drill-down all ship together.',
  ARRAY[
    'Campaign builder with target rules, calling-hours guard, and per-campaign script overrides.',
    'Live script preview shows exactly what the AI will say with sample variables filled in.',
    'Voicemail drop — when answering machine detection fires, AI reads the dealer''s voicemail script.',
    'Per-campaign analytics drill-down on row expand — connected rate, conversion, est. cost.',
    'Inline edit for existing campaigns.',
    'Test-call-to-my-cell + pause-all kill-switch for safety.',
    'TCPA / consent / opt-out audit log under Compliance.',
    'Calling hours / retries / script all exposed in campaign edit.'
  ],
  'Mic', 'feature', 93
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-17' AND title = 'Voice AI — campaign suite + voicemail drop + analytics');

-- ── Apr 18 — Appearance live preview ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-18', 'Appearance & Access — live theme preview + sidebar repaint',
  'Theme picks now preview in real-time with the sidebar updating as you change colors. No more save-and-reload dance.',
  ARRAY[
    'Live preview pane shows the active color combination on a sample sidebar.',
    'Sidebar repaints with the dealer''s sidebar_active_color on every selection.',
    'Loop the schema-cache retry so multi-column saves persist even when PostgREST is mid-reload.'
  ],
  'Sparkles', 'feature', 92
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-18' AND title = 'Appearance & Access — live theme preview + sidebar repaint');

-- ── Apr 19 — Landing templates ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-19', 'Fifteen landing templates — five originals + ten OEM-style designs',
  'The dealer picks a landing-page layout from fifteen options matching the visual signatures of the major OEM-certified dealer site providers. Per-rooftop overrides supported.',
  ARRAY[
    'Originals: Classic, Bold, Minimal, Elegant, Showroom.',
    'OEM-style: Cinema (Dealer Inspire), Portal (Dealer.com), Carousel (CDK / Sincro), Slab (DealerOn / Overfuel), Diagonal (DealerSocket), Pickup (FordDirect), Magazine (Stream), Circular (Force), Motion (fusionZONE), Mosaic (Jazel).',
    'Schematic SVG thumbnails for each template in the admin picker.',
    'Per-location overrides via the dealership_locations table.'
  ],
  'Layout', 'feature', 91
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-19' AND title = 'Fifteen landing templates — five originals + ten OEM-style designs');

-- ── Apr 20 — Pricing Model rebuild ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-20', 'Pricing Model rebuild — strategy modes + market data + condition tiers',
  'Complete rebuild of the offer engine with named strategy modes (conservative / balanced / aggressive / custom), live market data, and per-condition tier multipliers.',
  ARRAY[
    'Strategy mode preset selector with one-click switching.',
    'Live market data integration — Black Book ListingsStatistics for days-supply + sold/asking averages.',
    'Per-condition tier multipliers (excellent / very good / good / fair).',
    'Archetype-specific deduction overrides (luxury vs mainstream brands).',
    'Manager-PIN-gated overrides with reason capture.',
    'Tier-policy preview before applying — see which submissions flip pass/fail.'
  ],
  'DollarSign', 'feature', 90
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-20' AND title = 'Pricing Model rebuild — strategy modes + market data + condition tiers');

-- ── Apr 22 — Per-rooftop websites ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-22', 'Per-rooftop websites — each store gets its own subdomain',
  'Multi-rooftop dealers can give each store a distinct landing site at /locations/<slug>. Each rooftop overrides corporate branding and content.',
  ARRAY[
    'Subdomain or path-based per-rooftop landing pages.',
    'Each rooftop inherits corporate defaults but can override hero copy, colors, logo, channel toggles, landing template.',
    'Live preview from the Locations admin — see exactly what the rooftop will show.'
  ],
  'Globe', 'feature', 89
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-22' AND title = 'Per-rooftop websites — each store gets its own subdomain');

-- ── Apr 25 — Reports + analytics ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-25', 'Admin analytics — Reports / Performance / Exec HUD with date presets',
  'Reports got an executive-ready upgrade: instant date-range presets, per-rep cards, and a custom range picker.',
  ARRAY[
    'Quick-range presets across Reports + Notification Log: Today / 7d / 30d / 90d / This Month / Last Month / YTD.',
    'Per-rep performance breakdown card on Exec HUD.',
    'User-selectable custom date range on Exec HUD (7d / 30d / 90d / YTD).',
    'Notification Log accurate per-channel stats + CSV export.'
  ],
  'LineChart', 'feature', 88
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-25' AND title = 'Admin analytics — Reports / Performance / Exec HUD with date presets');

-- ── Apr 26 — Customer portal + deal accepted ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-26', 'Customer portal — appointment calendar + directions + photo gallery',
  'Customers now see a richer post-acceptance portal with calendar export, dealer directions, and a checklist of what to bring to the inspection.',
  ARRAY[
    'Appointment calendar card with iCal / Google / Outlook export on /my-submission.',
    'Get-Directions card pre-filled to the assigned store from the customer''s ZIP.',
    'Photo gallery shows the customer their own uploaded photos so they know they arrived.',
    'Pre vs post-acceptance progress steps with clearer next-action language.',
    'Deal Accepted page got Outlook calendar + Get-directions buttons.'
  ],
  'CalendarCheck', 'feature', 87
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-26' AND title = 'Customer portal — appointment calendar + directions + photo gallery');

-- ── Apr 27 — Lead form + inspection autosave ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-27', 'Autosave + CSV export + offer-page polish',
  'Three quality-of-life wins for daily users: customers don''t lose their form on page reloads, inspectors don''t lose work mid-vehicle, equity mining exports clean to spreadsheet.',
  ARRAY[
    'Sell-form draft autosaves to localStorage — page refresh restores answers.',
    'Inspection sheet autosaves draft to localStorage on iPad and desktop.',
    'Equity Mining exports filtered leads to CSV with one click.',
    'Offer page shows uploaded photos inline — customers see their pics arrived.',
    'Three offer-page conversion-polish wins: trade-in calculator card, mobile sticky CTA, photo bump prominence.',
    'Notifications page got search + bulk-toggle + sticky save bar.'
  ],
  'Sparkles', 'feature', 86
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-27' AND title = 'Autosave + CSV export + offer-page polish');

-- ── Apr 28 — Compliance audit trail ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-28', 'Compliance — cross-submission staff activity + tenant View-As audit log',
  'Two new compliance views give dealer admins a full audit trail of staff actions across the entire tenant, plus a separate log of any super-admin View-As-Tenant sessions.',
  ARRAY[
    'Cross-submission activity browser with filters by staff member, action type, and date range.',
    'Tenant View-As audit log — every super-admin session into a tenant is recorded.',
    'Both logs export to CSV for record-keeping.'
  ],
  'ShieldCheck', 'feature', 85
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-28' AND title = 'Compliance — cross-submission staff activity + tenant View-As audit log');

-- ── Apr 28 — Promotions + testimonials polish ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-28', 'Promotions + Testimonials — filter pills, search, counts, pause-all',
  'Both admin pages got the same upgrade pass: filter pills, search box, accurate counts, and a pause-all toggle.',
  ARRAY[
    'Filter pills group items by status (active / paused / draft).',
    'Search box with live filter.',
    'Pause-all toggle for promotions — turn the entire promo set off without deleting anything.',
    'Status counts visible on each pill.'
  ],
  'Megaphone', 'feature', 84
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-28' AND title = 'Promotions + Testimonials — filter pills, search, counts, pause-all');

-- ── Apr 29 — Permissions Phase A/B/C ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-29', 'Permissions overhaul — per-role matrix + per-store + per-user grants',
  'Redesigned the permissions system as a four-layer cascade so dealers can set platform defaults, override per-tenant, override per-store, and grant individual sections to specific staff members.',
  ARRAY[
    'Per-role × per-section visibility matrix in Setup · Dealer · Staff & Permissions.',
    'Appraiser is now a first-class additive role — give any staff member is_appraiser=true to layer appraiser-only sections on top of their primary role.',
    'Per-store overrides for multi-rooftop dealers — one store can differ from corporate default.',
    'Per-user individual_sections grants for one-off "give Jane access to Reports" needs without changing her role.',
    'Sidebar honors the full cascade automatically — staff see only what they should, and "Request Access" surfaces locked items.'
  ],
  'Shield', 'feature', 83
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-29' AND title = 'Permissions overhaul — per-role matrix + per-store + per-user grants');

-- ── Apr 30 — Carvana wedge: Quick Offer + Auto-firm + photo bump hero ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-30', 'Quick Offer landing flow — Carvana-style 60-second wedge',
  'New one-screen public sell-form for dealers who want max conversion. Plate or VIN + ZIP + mileage + two yes/no condition questions hands the customer a real offer in seconds.',
  ARRAY[
    'Pick the variant in Setup · Process · Landing & Flow → Public Sell Flow (Detailed step-by-step or 60-second one-screen).',
    'Auto-firm offer rule: when set, offered_price = estimated_high × your % so the customer sees a firm number, not a range.',
    'Photo-bump CTA promoted to a hero panel on the offer page — direct competitive wedge vs Carvana''s take-it-or-leave-it model.',
    'Three-essential-uploads (odometer + title + ID) inline on Deal Accepted — no page hop required.',
    'Below-fold accordion + auto-route confirmation + wedge subtext on hero copy.'
  ],
  'Zap', 'feature', 82
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-30' AND title = 'Quick Offer landing flow — Carvana-style 60-second wedge');

-- ── Apr 30 — Mobile inspection toggle ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-30', 'Mobile inspection — "Inspector comes to you" toggle',
  'New per-tenant mobile-inspection mode. Dealers who run a mobile inspector enable the option, and customers see a "where would you like to be inspected?" choice on Schedule Visit.',
  ARRAY[
    'Toggle in Setup · Dealer · Branding → "Mobile Inspection" off by default.',
    'When enabled, customers pick "At the dealership" or "Inspector comes to you" with an address field.',
    'Stored as inspection_mode + inspection_address on the appointment row.'
  ],
  'MapPin', 'feature', 81
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-30' AND title = 'Mobile inspection — "Inspector comes to you" toggle');

-- ── May 1 — Tire/brake split ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Tires + brakes — split input modes per type, per rooftop',
  'Tires and brakes now have independent measurement / pass-fail toggles, and multi-rooftop dealers can override either one for individual stores.',
  ARRAY[
    'Setup · Dealer · Inspection Sheet → Tires & Brakes section now has two toggles: tire input mode + brake input mode.',
    'Per-rooftop overrides section appears for multi-rooftop tenants — each store can inherit corporate or override either toggle.',
    'Inspection runtime renders tires and brakes independently so a dealer can have measurement tires + pass/fail brakes on the same vehicle.'
  ],
  'Gauge', 'feature', 80
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Tires + brakes — split input modes per type, per rooftop');

-- ── May 1 — Voice provider selector ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Voice AI provider choice — Bland.ai or OpenAI Realtime',
  'New selector in Voice AI settings lets dealers choose between Bland.ai (default, built-in dialing) and OpenAI Realtime (lower latency + cost, needs Twilio for dialing).',
  ARRAY[
    'Setup · Process · Voice AI → Voice Provider picker with two cards.',
    'OpenAI option surfaces an explicit setup checklist (OPENAI_API_KEY + Twilio creds) instead of pretending to call.',
    'Bland.ai stays the working default — switch to OpenAI when the bridge function is enabled.'
  ],
  'Mic', 'feature', 79
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Voice AI provider choice — Bland.ai or OpenAI Realtime');

-- ── May 1 — Sidebar polish + onboarding seed ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Sidebar polish + new tenants inherit your defaults',
  'Two demo-prep wins: clearer sidebar labels, and new dealers automatically inherit your platform permission defaults instead of starting from scratch.',
  ARRAY[
    '"Channels" → "Communication Channels" so it''s self-explanatory.',
    '"Offer Logic" → "Pricing Rules" — dealers think pricing, not logic.',
    'My Availability got its own Clock icon (was duplicating the Phone icon used by Communication Channels).',
    'Wholesale Marketplace pulled from sidebar pending real product spec.',
    'Onboarding now seeds the permission cascade from your platform default rows so a new dealer signs up with the same matrix you''ve already built.'
  ],
  'Layout', 'feature', 78
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Sidebar polish + new tenants inherit your defaults');

END $$;

NOTIFY pgrst, 'reload schema';
