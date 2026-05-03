-- ─────────────────────────────────────────────────────────────────────────
--  Platform Updates — paste-ready seed for Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────
--
--  WHY THIS FILE EXISTS
--  The migrations under supabase/migrations/ that backfill the changelog
--  for Apr 7 → May 3 are merged to main but Lovable's deploy pipeline
--  hasn't run them against production yet. This file is a one-shot
--  copy-paste version you can run in the Supabase Dashboard's SQL
--  Editor to land the rows immediately.
--
--  HOW TO RUN
--  1. Open https://supabase.com/dashboard
--  2. Select project: ptiwdwfdckfqivoocyvp (Hartecash production)
--  3. Left sidebar → SQL Editor → "+ New query"
--  4. Copy this whole file's contents into the editor
--  5. Click Run
--
--  Idempotent — every INSERT is guarded by NOT EXISTS on (entry_date,
--  title), so re-running this is safe.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
BEGIN

-- ── May 3 ──────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Admin sidebar — consolidated hubs, fewer destinations, faster work',
  'Three-pass logic audit collapsed ~52 sidebar items into ~31. Related surfaces are now one tabbed page, not three separate routes.',
  ARRAY[
    'Communications hub: Channels + Notifications + Compliance on tabs.',
    'Branding hub: Identity + Appearance + Landing on tabs.',
    'Capture & Inspection hub: Lead Form + Inspection Sheet + Photos + Standards on tabs.',
    'Marketing hub: Promotions + Referrals + Testimonials on tabs.',
    'Performance hub: KPI + GM HUD on role-aware tabs.',
    'BDC Queue hub: Priority + Calls Today on tabs.',
    'Integrations hub (enterprise): Status + API Access + vAuto + White Label on tabs.',
    'Daily / personal context (Today + My) promoted to the top of the sidebar.',
    'All legacy URLs and role-permission grants keep working — deep links land on the right tab automatically.'
  ],
  'Layout', 'improvement', 200
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Admin sidebar — consolidated hubs, fewer destinations, faster work');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Sidebar labels cleaned up — what each thing does is now obvious',
  'Same audit pass renamed a handful of items so a brand-new admin can find what they need without translating dev language.',
  ARRAY[
    '"Floor Tools" → "Lane Tools" (it''s about the service drive, not the showroom floor).',
    '"Dealer Setup" → "Onboarding Wizard" (it''s the wizard, distinct from System Settings).',
    'Platform "Pricing Model" → "SaaS Pricing" so it doesn''t collide with dealer-side "Pricing Rules".',
    '"Vehicle Images" → "Vehicle Image Cache" and moved to Account, since it''s a backend cache inspector, not a customer photo collection.',
    '"Platform Updates" moved to the Platform group (super-admin only) — it''s a release feed, not an account-level surface.'
  ],
  'Sparkles', 'improvement', 199
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Sidebar labels cleaned up — what each thing does is now obvious');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Trade pages — auto-fallback to Demo Mode when Black Book is unreachable',
  'When Black Book credentials are missing, the public Trade and Trade-In pages now auto-engage Demo Mode instead of returning a vehicle-lookup error.',
  ARRAY[
    'bb-lookup edge function detects missing credentials and serves the synthetic vehicle automatically.',
    'Sell-form + Quick-offer-form clamp the offer to the configured demo amount.',
    'Admin "Save demo mode" button now self-heals through a SECURITY-DEFINER RPC if it hits the PostgREST schema-cache error.',
    'Net result: Trade and Trade-In pages keep working end-to-end through any BB outage.'
  ],
  'ShieldCheck', 'fix', 198
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Trade pages — auto-fallback to Demo Mode when Black Book is unreachable');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Sell-flow competitive audit (internal) — what every other player is doing',
  'Side-by-side audit of every major sell-your-car / trade flow (Carvana, CarMax, Cars.com, CarGurus, AutoNation, Peddle, KBB ICO, Edmunds, TradePending, AccuTrade) with design wins, losses, and a concrete landing-page recipe for Autocurb-powered dealer pages. Three default color palettes that work behind any dealer logo.',
  ARRAY[
    'Manager-facing report at docs/sell-flow-competitive-audit.html (or .pdf).',
    'Side-by-side table: first input, steps to a number, firm-vs-range, hold time.',
    'Three palette presets — Institutional Blue (default), Premium Minimalist (luxury / import), Approachable Domestic (mainstream).',
    'Recommended landing-page recipe — plate-first, two screens to a number, firm offer with 7-day hold.'
  ],
  'ScrollText', 'improvement', 197
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Sell-flow competitive audit (internal) — what every other player is doing');

-- ── May 2 ──────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Customer cadence engine — automated multi-touch follow-up',
  'Every fresh lead now gets a built-in follow-up sequence (SMS / email / AI voice) that fires on its own schedule until the customer responds, accepts, declines, or the cadence runs out.',
  ARRAY[
    'Per-tenant cadence: choose touch order (SMS → email → call), per-step delays, and total runtime.',
    'BDC fallback when voice_ai_enabled = false — cadence drops a Calls-Today task instead of a robot call.',
    'TCPA consent capture hardened across the whole pipeline; quiet-hours + recipient-timezone guard built in.',
    'Cadence engine logs every fire to compliance audit so you can prove what was sent and when.',
    'Decline reason capture so opt-outs don''t re-enter the queue.'
  ],
  'Send', 'feature', 196
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Customer cadence engine — automated multi-touch follow-up');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Communication Channels — cadence + TCPA controls in one place',
  'New dealer-facing controls expose the cadence engine and TCPA disclosure UI directly in the Channels tab so admins can tune both without filing a ticket.',
  ARRAY[
    'TCPA disclosure editor with version-bumping — every save is auditable.',
    'Cadence touch-order + per-step delay sliders.',
    'Per-tenant TCPA opt-in capture toggle.',
    'Channel toggles still control the master on/off; cadence respects every toggle automatically.'
  ],
  'Phone', 'feature', 195
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Communication Channels — cadence + TCPA controls in one place');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Demo Mode — keep the demo flow working when Black Book is unavailable',
  'New per-tenant kill-switch that bypasses Black Book and serves a synthetic vehicle + a flat customer-facing offer (default $23,599) so prospect demos and acceptance tests keep running while BB credentials are renegotiated.',
  ARRAY[
    'Toggle lives in Setup · Dealer · Communication Channels at the top.',
    'Configurable demo offer amount.',
    'Cadence engine, TCPA capture, and AI voice scheduling continue firing normally on demo leads.',
    'Lead source gets a "-demo" suffix so reporting can filter or exclude demo submissions.',
    'Off by default — flipping it off restores the live Black Book pipeline byte-for-byte.'
  ],
  'Sparkles', 'feature', 194
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Demo Mode — keep the demo flow working when Black Book is unavailable');

-- ── May 1 ──────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Sidebar polish + new tenants inherit your defaults',
  'Two demo-prep wins: clearer sidebar labels, and new dealers automatically inherit your platform permission defaults instead of starting from scratch.',
  ARRAY[
    '"Channels" → "Communication Channels" so it''s self-explanatory.',
    '"Offer Logic" → "Pricing Rules" — dealers think pricing, not logic.',
    'My Availability got its own Clock icon.',
    'Wholesale Marketplace pulled from sidebar pending real product spec.',
    'Onboarding now seeds the permission cascade from your platform default rows.'
  ],
  'Layout', 'feature', 178
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Sidebar polish + new tenants inherit your defaults');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Tires + brakes — split input modes per type, per rooftop',
  'Tires and brakes now have independent measurement / pass-fail toggles, and multi-rooftop dealers can override either one for individual stores.',
  ARRAY[
    'Setup · Dealer · Inspection Sheet → Tires & Brakes section now has two toggles.',
    'Per-rooftop overrides section appears for multi-rooftop tenants.',
    'Inspection runtime renders tires and brakes independently.'
  ],
  'Gauge', 'feature', 180
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Tires + brakes — split input modes per type, per rooftop');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-01', 'Voice AI provider choice — Bland.ai or OpenAI Realtime',
  'New selector in Voice AI settings lets dealers choose between Bland.ai (default, built-in dialing) and OpenAI Realtime (lower latency + cost, needs Twilio for dialing).',
  ARRAY[
    'Setup · Process · Voice AI → Voice Provider picker with two cards.',
    'OpenAI option surfaces an explicit setup checklist instead of pretending to call.',
    'Bland.ai stays the working default.'
  ],
  'Mic', 'feature', 179
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-01' AND title = 'Voice AI provider choice — Bland.ai or OpenAI Realtime');

-- ── Apr 30 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-30', 'Carvana wedge — Quick Offer + auto-firm offer + photo bump hero',
  'Conversion-tuned upgrades to the public sell-flow.',
  ARRAY[
    'Quick Offer — single-screen flow toggle in Setup · Process · Landing & Flow.',
    'Auto-firm-offer percentage — when set, the system commits to a firm number above the threshold.',
    'Hero copy wedges Carvana''s 7-day hold + CarMax in-store-required.',
    'Photo bump — exterior shots prompt above the fold so AI condition-scoring has signal earlier.'
  ],
  'Zap', 'feature', 175
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-30' AND title = 'Carvana wedge — Quick Offer + auto-firm offer + photo bump hero');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-30', 'Mobile inspection — "Inspector comes to you" toggle',
  'Per-tenant toggle for dealers that send inspectors out instead of bringing the customer in.',
  ARRAY[
    'Setup · Dealer · Inspection Sheet → Mobile Inspection toggle.',
    'When on, the customer experience shifts from "bring it in" to "we come to you" copy.',
    'Inspection check-in flow accepts a partial VIN + last-6 lookup for quick on-site identification.'
  ],
  'Truck', 'feature', 174
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-30' AND title = 'Mobile inspection — "Inspector comes to you" toggle');

-- ── Apr 29 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-29', 'Permissions Phase A/B/C — cascade resolver + per-user grants',
  'Massive overhaul of the permission system. Role defaults now inherit from a platform-wide cascade with per-tenant + per-user override layers.',
  ARRAY[
    'Phase A — defaultAllowedForRole moved into the cascade resolver as the source of truth.',
    'Phase B — per-tenant overrides UI in Staff & Permissions.',
    'Phase C — per-user grants + request-access flow with badge counts.'
  ],
  'Shield', 'feature', 170
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-29' AND title = 'Permissions Phase A/B/C — cascade resolver + per-user grants');

-- ── Apr 28 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-28', 'Compliance — cross-submission staff activity + tenant View-As audit log',
  'New compliance views for super admins. Staff Activity shows every staff action across every customer file. Tenant View-As Log captures when an admin views the platform as another dealer.',
  ARRAY[
    'Staff Activity Log — filter by user, action, customer.',
    'Tenant View-As Log — every cross-tenant impersonation captured.',
    'Both surfaces respect per-tenant + per-rooftop scoping.'
  ],
  'ShieldCheck', 'feature', 165
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-28' AND title = 'Compliance — cross-submission staff activity + tenant View-As audit log');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-28', 'Promotions + Testimonials — filter pills, search, counts, pause-all',
  'Both pages got the same polish treatment.',
  ARRAY[
    'Filter pills (active / paused / archived).',
    'Inline search by name or content.',
    'Live counts per filter pill.',
    'Pause-all toggle for emergency comms freezes.'
  ],
  'Megaphone', 'improvement', 164
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-28' AND title = 'Promotions + Testimonials — filter pills, search, counts, pause-all');

-- ── Apr 27 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-27', 'Autosave + CSV export + offer-page polish',
  'Lead form and inspection sheet autosave so a partial customer entry never gets lost. Reports export to CSV.',
  ARRAY[
    'Lead form autosaves to localStorage every change — survives page refresh.',
    'Inspection sheet autosaves to the database every field edit.',
    'Reports → Export CSV button on every report.',
    'Offer page typography + accent color refresh.'
  ],
  'FileText', 'improvement', 160
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-27' AND title = 'Autosave + CSV export + offer-page polish');

-- ── Apr 26 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-26', 'Customer portal — appointment calendar + directions + photo gallery',
  'Customer-facing portal at /my-submission/:token now shows the appointment calendar invite, directions, and the customer''s uploaded photo gallery.',
  ARRAY[
    'Appointment .ics download.',
    'One-tap directions to the dealership location.',
    'Photo gallery with full-size lightbox.',
    'Watch My Car''s Worth — value tracker pages at /watch-my-car/:token.'
  ],
  'CalendarDays', 'feature', 155
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-26' AND title = 'Customer portal — appointment calendar + directions + photo gallery');

-- ── Apr 25 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-25', 'Admin analytics — Reports / Performance / Exec HUD with date presets',
  'Three analytics surfaces with shared date presets and tenant-scoped filters.',
  ARRAY[
    'Reports — exportable per-rooftop tables.',
    'Performance — KPI hub with month-over-month deltas.',
    'GM HUD — live today / week / month at-a-glance dashboard.',
    'Date presets: Today, This Week, MTD, Last 30, QTD, YTD.'
  ],
  'BarChart3', 'feature', 150
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-25' AND title = 'Admin analytics — Reports / Performance / Exec HUD with date presets');

-- ── Apr 22 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-22', 'Per-rooftop websites — each store gets its own subdomain',
  'Multi-rooftop tenants can spin up a dedicated subdomain per store with its own branding, hero, and inventory.',
  ARRAY[
    'Setup · Process · Rooftop Websites lets you map subdomains to locations.',
    'Per-rooftop overrides on logo, colors, hero copy, business hours.',
    'Subdirectory rooftop URLs (/locations/:slug) for SEO authority pooling.'
  ],
  'Globe', 'feature', 145
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-22' AND title = 'Per-rooftop websites — each store gets its own subdomain');

-- ── Apr 20 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-20', 'Pricing Model rebuild — strategy modes + market data + condition tiers',
  'Pricing engine got a foundation rebuild.',
  ARRAY[
    'Strategy modes: Conservative / Market / Aggressive — per-rooftop selectable.',
    'Auto-firm offer percentage — commits to firm number when threshold is met.',
    'Tire / brake split — separate measurement vs pass/fail per type.',
    'Per-tenant condition tier overrides.'
  ],
  'SlidersHorizontal', 'feature', 140
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-20' AND title = 'Pricing Model rebuild — strategy modes + market data + condition tiers');

-- ── Apr 19 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-19', 'Fifteen landing templates — five originals + ten OEM-style designs',
  'Fifteen landing-page templates the dealer can pick in Setup · Dealer · Landing.',
  ARRAY[
    'Originals: Classic, Bold, Minimal, Elegant, Showroom.',
    'OEM-style: Cinema (Toyota/Honda), Portal (GM/BMW), Carousel (CDK), Slab (DealerOn), Diagonal (DealerSocket), Pickup (Ford/GM truck), Magazine (Stream), Circular (Force), Motion (fusionZONE), Mosaic (Jazel).'
  ],
  'Layout', 'feature', 135
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-19' AND title = 'Fifteen landing templates — five originals + ten OEM-style designs');

-- ── Apr 18 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-18', 'Appearance & Access — live theme preview + sidebar repaint',
  'New Appearance & Access page combines theme controls and role-visibility toggles.',
  ARRAY[
    'UI / text / content scale sliders.',
    'Top-bar style picker (solid / gradient / 3-stop).',
    'Sidebar active color picker.',
    'Per-role section visibility toggles.'
  ],
  'Sparkles', 'feature', 130
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-18' AND title = 'Appearance & Access — live theme preview + sidebar repaint');

-- ── Apr 17 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-17', 'Voice AI — campaign suite + voicemail drop + analytics',
  'Voice AI productionized.',
  ARRAY[
    'Campaign builder with target audience filters.',
    'Voicemail drop fallback for unanswered calls.',
    'Per-campaign analytics: connect rate, talk time, outcomes.',
    'Atomic campaign totals so concurrent calls never double-count.'
  ],
  'Mic', 'feature', 125
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-17' AND title = 'Voice AI — campaign suite + voicemail drop + analytics');

-- ── Apr 16 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-16', 'Comms inbox — inbound email + live SMS timeline + voice in customer file',
  'Customer file unified communications view. Inbound and outbound on one timeline, voice transcripts inline.',
  ARRAY[
    'Inbound email parsing into the customer thread.',
    'Live SMS timeline with delivery status.',
    'Voice call transcripts attached to the customer file.',
    'One unified scrollable timeline across all channels.'
  ],
  'Inbox', 'feature', 120
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-16' AND title = 'Comms inbox — inbound email + live SMS timeline + voice in customer file');

-- ── Apr 15 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-15', 'Click-to-Dial v2 — off-hours guard, per-rep DND, recording consent',
  'Click-to-Dial got compliance + ergonomic upgrades.',
  ARRAY[
    'Off-hours guard prevents accidental late-night dials.',
    'Per-rep Do Not Disturb / quiet hours.',
    'Two-party recording consent prompt before bridging.',
    'Record bridged calls toggle in Communication Channels.'
  ],
  'Phone', 'feature', 115
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-15' AND title = 'Click-to-Dial v2 — off-hours guard, per-rep DND, recording consent');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-15', 'My Availability — self-serve DND + quiet hours for reps',
  'Reps can set their own availability without filing a ticket. Quiet hours, DND, and per-day overrides.',
  ARRAY[
    'Per-rep quiet-hours window.',
    'One-tap DND for the rest of today.',
    'Recurring per-day-of-week overrides.'
  ],
  'Clock', 'feature', 114
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-15' AND title = 'My Availability — self-serve DND + quiet hours for reps');

-- ── Apr 14 ─────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-14', 'Communication Channels — SMS / Email / AI-Call toggles',
  'New Setup · Dealer · Communication Channels page lets the dealer flip on / off each customer-facing channel at the corporate level OR per rooftop.',
  ARRAY[
    'Per-tenant + per-store toggles.',
    'Enforced at every staff send surface.',
    'TCPA disclosure editor with version-bumping.'
  ],
  'Phone', 'feature', 110
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-14' AND title = 'Communication Channels — SMS / Email / AI-Call toggles');

-- ── Apr 8 ──────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-08', 'Sidebar redesign — Work / Queues / Floor Tools / Grow / Measure / Setup',
  'Reorganized the left navigation into purposeful groups so dealers and reps find what they need without hunting.',
  ARRAY[
    'Work group anchored by Today + personal items.',
    'Queues group: All Leads, Appraiser Queue, Appointments, BDC Priority Queue.',
    'Floor Tools group: Inspection Check-In, Service Quick Entry, Vehicle Images.',
    'Grow group: Equity Mining, Voice AI.',
    'Measure group: Performance, GM HUD, Reports, Compliance.'
  ],
  'Layout', 'feature', 99
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-08' AND title = 'Sidebar redesign — Work / Queues / Floor Tools / Grow / Measure / Setup');

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-08', 'Appraiser Queue + BDC Priority Queue — four-tile dashboards',
  'Both queues got the same approved redesign: top tiles for at-a-glance pipeline state, ranked single-list below.',
  ARRAY[
    'Four-tile dashboard: Needs Appraisal / In Review / Flagged / Done Today.',
    'Auto-route stale offers into Flagged.',
    'Ranked single-list redesign with priority signals.',
    'Front-desk panel on Appointments — Today / Right Now / On the Way.'
  ],
  'RotateCcw', 'feature', 98
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-08' AND title = 'Appraiser Queue + BDC Priority Queue — four-tile dashboards');

-- ── Apr 7 ──────────────────────────────────────────────────────────────
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-04-07', 'Prospect Demo — standalone sales-pitch tool',
  'New tool for sales reps pitching dealers who aren''t customers yet. Capture screenshots of any dealer site, layer Autocurb assets on top, share the result.',
  ARRAY[
    'Configure prospect brand without needing a tenant login.',
    'Capture homepage / listing / VDP via microlink with junk-page detection.',
    'Eight asset overlays with brand-color theming.',
    'AI-driven color palette + accent-color recommender.',
    'Vision-LLM senior-rep recommendations per page.',
    'Shareable /demo/:token URLs with view tracking.'
  ],
  'Target', 'feature', 100
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-04-07' AND title = 'Prospect Demo — standalone sales-pitch tool');

END $$;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- Verify: should return ~28 rows from Apr 7 through May 3.
SELECT entry_date, title, tag
FROM public.changelog_entries
WHERE entry_date BETWEEN '2026-04-07' AND '2026-05-03'
ORDER BY entry_date DESC, sort_order DESC;
-- ─────────────────────────────────────────────────────────────────────────
