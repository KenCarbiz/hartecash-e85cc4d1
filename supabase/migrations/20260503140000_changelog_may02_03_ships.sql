-- Platform Updates backfill — May 2-3 ships.
--
-- The /admin?section=changelog page (Platform Updates) currently
-- shows entries up to Apr 6 only on production. The Apr 7 → May 1
-- backfill (20260501050000_changelog_full_backfill_apr06_to_may01.sql)
-- is in the repo but hasn't reached production yet; this migration
-- adds everything shipped on May 2 and May 3 so when deploy catches
-- up the page jumps straight to current.
--
-- IDEMPOTENT — uses NOT EXISTS guards on (entry_date, title). Safe
-- to re-run; safe to apply alongside the prior backfill.

DO $$
BEGIN

-- ── May 2 — Customer cadence engine ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Customer cadence engine — automated multi-touch follow-up',
  'Every fresh lead now gets a built-in follow-up sequence (SMS / email / AI voice) that fires on its own schedule until the customer responds, accepts, declines, or the cadence runs out. Replaces the one-shot "send notification" model.',
  ARRAY[
    'Per-tenant cadence: choose touch order (SMS → email → call), per-step delays, and total runtime.',
    'BDC fallback when voice_ai_enabled = false — cadence drops a Calls-Today task instead of a robot call.',
    'TCPA consent capture hardened across the whole pipeline; quiet-hours + recipient-timezone guard built in.',
    'Cadence engine logs every fire to compliance audit so you can prove what was sent and when.',
    'Decline reason capture so opt-outs don''t re-enter the queue.'
  ],
  'Send', 'feature', 130
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Customer cadence engine — automated multi-touch follow-up');

-- ── May 2 — Channels tab cadence + TCPA controls ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Communication Channels — cadence + TCPA controls in one place',
  'New dealer-facing controls in Setup · Dealer · Communication Channels expose the cadence engine and TCPA disclosure UI directly so admins can tune both without filing a ticket.',
  ARRAY[
    'TCPA disclosure editor with version-bumping — every save is auditable.',
    'Cadence touch-order + per-step delay sliders.',
    'Per-tenant TCPA opt-in capture toggle.',
    'Channel toggles still control the master on/off; cadence respects every toggle automatically.'
  ],
  'Phone', 'feature', 129
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Communication Channels — cadence + TCPA controls in one place');

-- ── May 2 — Demo mode (Black Book sandbox kill-switch) ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-02', 'Demo Mode — keep the demo flow working when Black Book is unavailable',
  'New per-tenant kill-switch that bypasses Black Book and serves a synthetic vehicle + a flat customer-facing offer (default $23,599) so prospect demos, acceptance tests, and the cadence pipeline keep running end-to-end while BB credentials are renegotiated.',
  ARRAY[
    'Toggle lives in Setup · Dealer · Communication Channels at the top.',
    'Configurable demo offer amount — set whatever number the audience expects to see.',
    'Cadence engine, TCPA capture, and AI voice scheduling all continue firing normally on demo leads.',
    'Lead source gets a "-demo" suffix so reporting can filter or exclude demo submissions.',
    'Off by default — flipping it off restores the live Black Book pipeline byte-for-byte.'
  ],
  'Sparkles', 'feature', 128
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-02' AND title = 'Demo Mode — keep the demo flow working when Black Book is unavailable');

-- ── May 3 — Admin sidebar logic-audit consolidation ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Admin sidebar — consolidated hubs, fewer destinations, faster work',
  'Three-pass logic audit collapsed ~52 sidebar items into ~31. Related surfaces are now one tabbed page, not three separate routes — so a dealer admin sets up Channels, Notifications, and Compliance from one place instead of clicking around.',
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
  'Layout', 'improvement', 127
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Admin sidebar — consolidated hubs, fewer destinations, faster work');

-- ── May 3 — Renamed labels for clarity ──
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
  'Sparkles', 'improvement', 126
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Sidebar labels cleaned up — what each thing does is now obvious');

-- ── May 3 — Trade pages reliability ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Trade pages — auto-fallback to Demo Mode when Black Book is unreachable',
  'When Black Book credentials are missing, the public Trade and Trade-In pages now auto-engage Demo Mode instead of returning a vehicle-lookup error. Customers always see a usable offer; staff can flip Demo Mode off the moment BB is back.',
  ARRAY[
    'bb-lookup edge function detects missing credentials and serves the synthetic vehicle automatically.',
    'Sell-form + Quick-offer-form clamp the offer to the configured demo amount.',
    'Admin "Save demo mode" button now self-heals through a SECURITY-DEFINER RPC if it hits the PostgREST schema-cache error.',
    'Net result: Trade and Trade-In pages keep working end-to-end through any BB outage.'
  ],
  'ShieldCheck', 'fix', 125
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Trade pages — auto-fallback to Demo Mode when Black Book is unreachable');

-- ── May 3 — Competitive audit deck ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-05-03', 'Sell-flow competitive audit (internal) — what every other player is doing',
  'Side-by-side audit of every major sell-your-car / trade flow (Carvana, CarMax, Cars.com, CarGurus, AutoNation, Peddle, KBB ICO, Edmunds, TradePending, AccuTrade, etc.) with design wins, losses, and a concrete landing-page recipe for Autocurb-powered dealer pages. Includes three default color palettes that work behind any dealer logo.',
  ARRAY[
    'Manager-facing report at docs/sell-flow-competitive-audit.html (or .pdf).',
    'Side-by-side table: first input, steps to a number, firm-vs-range, hold time.',
    'Three palette presets — Institutional Blue (default), Premium Minimalist (luxury / import), Approachable Domestic (mainstream).',
    'Recommended landing-page recipe — plate-first, two screens to a number, firm offer with 7-day hold.'
  ],
  'ScrollText', 'improvement', 124
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-05-03' AND title = 'Sell-flow competitive audit (internal) — what every other player is doing');

END $$;

NOTIFY pgrst, 'reload schema';
