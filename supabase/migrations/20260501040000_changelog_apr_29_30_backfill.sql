-- Catch Platform Updates up to everything shipped Apr 29–May 1.
-- The previous changelog seed ended on Apr 20 and ~250 commits have
-- shipped since. These entries cover the major user-facing themes
-- so dealers viewing /admin/platform-updates see the platform's been
-- actively shipping, not silent.

INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
VALUES
  (
    '2026-04-29',
    'Permissions overhaul — per-role matrix + per-user grants',
    'Redesigned the permissions system as a four-layer cascade so dealers can set platform defaults, override per-tenant, override per-store, and grant individual sections to specific staff members.',
    ARRAY[
      'Per-role × per-section visibility matrix in Setup · Dealer · Staff & Permissions.',
      'Appraiser is now a first-class additive role — give any staff member is_appraiser=true to layer appraiser-only sections on top of their primary role.',
      'Per-store overrides for multi-rooftop dealers — one store can differ from the corporate default.',
      'Per-user individual_sections grants for one-off "give Jane access to Reports" needs without changing her role.',
      'Sidebar honors the full cascade automatically — staff see only what they should, and "Request Access" surfaces locked items.'
    ],
    'Shield',
    'feature',
    1
  ),
  (
    '2026-04-29',
    'Compliance audit trail — cross-submission staff activity',
    'Two new compliance views give dealer admins a full audit trail of staff actions across the entire tenant, plus a separate log of any super-admin View-As-Tenant sessions.',
    ARRAY[
      'Cross-submission activity browser with filters by staff member, action type, and date range.',
      'Tenant View-As audit log — every super-admin session into a tenant is recorded with start time, duration, and reason.',
      'Both logs export to CSV for record-keeping.'
    ],
    'ShieldCheck',
    'feature',
    2
  ),
  (
    '2026-04-29',
    'Voice AI production suite — campaigns, scripts, voicemail',
    'Voice AI is now production-ready. Campaign management, dynamic script preview, voicemail drop, and per-campaign analytics drill-down all ship together.',
    ARRAY[
      'Campaign builder with target rules, calling-hours guard, and per-campaign script overrides.',
      'Live script preview shows exactly what the AI will say with sample variables filled in.',
      'Voicemail drop — when answering machine detection fires, the AI reads the dealer''s voicemail script.',
      'Per-rep DND toggle, quiet hours, and TCPA-compliant calling hours by ZIP timezone.',
      'Twilio bridge for click-to-dial v2 with consent recording.'
    ],
    'Mic',
    'feature',
    3
  ),
  (
    '2026-04-29',
    'Comms inbox — inbound email, live timeline, in-customer-file calls',
    'All customer communication now flows through a single timeline on the customer file. Inbound replies (email + SMS) attach to the originating submission automatically.',
    ARRAY[
      'Inbound email webhook — customer replies to dealer-branded notify@ addresses route back to the submission via the +tag in Reply-To.',
      'Live timeline updates — SMS, email, and voice calls appear in the customer file in near real-time via Supabase Realtime.',
      'Voice calls are visible alongside SMS/email so the rep sees the full conversation history.'
    ],
    'MessageSquareQuote',
    'feature',
    4
  ),
  (
    '2026-04-29',
    'Admin analytics — Performance, GM HUD, Reports with date presets',
    'Reports got an executive-ready upgrade: instant date-range presets, per-rep cards, and a flexible custom range picker.',
    ARRAY[
      'Quick-range presets: Today, 7d, 30d, 90d, This Month, Last Month, YTD.',
      'GM HUD adds profit-spread breakdown and AI-call summary cards.',
      'Performance page splits per-rep, per-store, and per-source rollups.',
      'Notification log got the same date presets + accurate per-channel stats.'
    ],
    'LineChart',
    'feature',
    5
  ),
  (
    '2026-04-29',
    'Customer portal — appointment calendar, directions, what-to-bring',
    'Customers see a richer post-acceptance portal with calendar export, dealer directions, and a checklist of what to bring to the inspection.',
    ARRAY[
      'Appointment calendar card on /my-submission with iCal / Google / Outlook export.',
      'Get-Directions card pre-filled to the assigned store from the customer''s ZIP.',
      'Pre vs post-acceptance progress steps with clearer next-action language.',
      'Photo gallery shows the customer their own uploaded photos so they know they arrived.'
    ],
    'CalendarCheck',
    'feature',
    6
  ),
  (
    '2026-04-29',
    'Lead form quality-of-life — autosave, mileage check, equity export',
    'Three small fixes that compound: customers don''t lose their form on page reloads, sales reps catch mileage typos before they hit the offer engine, and equity-mining exports clean to spreadsheet.',
    ARRAY[
      'Sell-form draft autosaves to localStorage — page refresh restores the customer''s answers.',
      'Mileage sanity check warns when typed mileage implies <3k mi/yr or >25k mi/yr for the vehicle''s age.',
      'Equity Mining results export to CSV with one click.'
    ],
    'Sparkles',
    'feature',
    7
  ),
  (
    '2026-04-29',
    'Inspection Standards — depth-policy preview before applying',
    'Changing tire/brake threshold policies now shows a live preview of which submissions would flip pass→fail and vice versa before the dealer commits the change.',
    ARRAY[
      'Side-by-side preview: current pass/fail counts vs proposed.',
      'Per-policy OEM brand list (luxury thresholds for select brands, conservative defaults elsewhere).',
      'Preview updates as the dealer drags the threshold slider.'
    ],
    'Gauge',
    'feature',
    8
  ),
  (
    '2026-04-30',
    'Quick Offer landing flow — Carvana-style 60-second wedge',
    'New one-screen public sell-form for dealers who want max conversion. Plate or VIN + ZIP + mileage + two yes/no condition questions hands the customer a real offer page in seconds.',
    ARRAY[
      'Pick the variant in Setup · Process · Landing & Flow → Public Sell Flow (Detailed step-by-step or 60-second one-screen).',
      'Auto-firm offer rule: when set, offered_price = estimated_high × your % so the customer sees a firm number, not a range. Configure in Setup · Dealer · Pricing Rules.',
      'Photo-bump CTA promoted to a hero panel on the offer page — direct competitive wedge vs Carvana''s take-it-or-leave-it model.',
      'Three-essential-uploads (odometer + title + ID) inline on Deal Accepted — no page hop required.'
    ],
    'Zap',
    'feature',
    9
  ),
  (
    '2026-04-30',
    'Mobile inspection — "Inspector comes to you" toggle',
    'New per-tenant mobile-inspection mode. Dealers who run a mobile inspector enable the option, and customers see a "where would you like to be inspected?" choice on Schedule Visit.',
    ARRAY[
      'Toggle in Setup · Dealer · Branding → "Mobile Inspection" off by default.',
      'When enabled, customers pick "At the dealership" or "Inspector comes to you" with an address field.',
      'Stored as inspection_mode + inspection_address on the appointment row.'
    ],
    'MapPin',
    'feature',
    10
  ),
  (
    '2026-04-30',
    'Tires + brakes — split input modes per type, per rooftop',
    'Tires and brakes now have independent measurement / pass-fail toggles, and multi-rooftop dealers can override either one for individual stores.',
    ARRAY[
      'Setup · Dealer · Inspection Sheet → Tires & Brakes section now has two toggles: tire input mode + brake input mode.',
      'Per-rooftop overrides section appears for multi-rooftop tenants — each store can inherit corporate or override either toggle.',
      'Inspection runtime renders tires and brakes independently, so a dealer can have measurement tires + pass/fail brakes on the same vehicle.'
    ],
    'Gauge',
    'feature',
    11
  ),
  (
    '2026-04-30',
    'Voice AI provider choice — bland.ai or OpenAI Realtime',
    'New selector in Voice AI settings lets dealers choose between bland.ai (default, built-in dialing) and OpenAI Realtime (lower latency + cost, needs Twilio for dialing).',
    ARRAY[
      'Setup · Process · Voice AI → Voice Provider picker with two cards.',
      'OpenAI option surfaces an explicit setup checklist (OPENAI_API_KEY in Edge Function secrets + Twilio creds) instead of pretending to call.',
      'Bland.ai stays the working default — switch to OpenAI when the bridge function is enabled.'
    ],
    'Mic',
    'feature',
    12
  ),
  (
    '2026-04-30',
    'Sidebar polish — labels clarified, icon collisions resolved',
    'Labels in the left sidebar now match how dealers actually talk. Cleared internal jargon and an icon collision so a fresh user can navigate without a glossary.',
    ARRAY[
      '"Channels" → "Communication Channels" so it''s self-explanatory.',
      '"Offer Logic" → "Pricing Rules" — dealers think pricing, not logic.',
      'My Availability got its own Clock icon (was duplicating the Phone icon used by Communication Channels).',
      'Wholesale Marketplace pulled from sidebar pending real product spec — no more InDevelopmentBadge clutter.'
    ],
    'Layout',
    'feature',
    13
  ),
  (
    '2026-05-01',
    'New tenants auto-inherit your platform permission defaults',
    'Onboarding now seeds the permission cascade from your platform default rows so a new dealer signs up with the same matrix you''ve already built — no manual setup step.',
    ARRAY[
      'Wired into the onboard-tenant edge function — runs after inspection_config is created.',
      'Best-effort: skips silently if the seed RPC isn''t deployed in the environment yet.',
      'Onboarding response now includes "permission_defaults_seeded (N rows)" in steps for the platform admin to verify.'
    ],
    'Users',
    'feature',
    14
  );
