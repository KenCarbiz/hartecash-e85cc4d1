-- Platform Updates backfill — June 2026 ships (Admin V2 + reliability).
--
-- The /admin?section=changelog + Release Center feed read
-- public.changelog_entries (is_active = true) ordered by entry_date
-- desc. This migration brings the feed CURRENT through June 10 with the
-- work shipped this month: the Admin V2 redesign, the native-V2 framing
-- of every remaining platform/settings page, faster vehicle photos, and
-- the saved-offer welcome-back flow.
--
-- NOTE: this assumes the Apr 7 → May 3 backfills
-- (20260501050000_changelog_full_backfill_apr06_to_may01.sql and
-- 20260503140000_changelog_may02_03_ships.sql) have ALSO been applied —
-- if the production feed still stops at Apr 6, apply those two first so
-- the timeline has no gap.
--
-- IDEMPOTENT — NOT EXISTS guards on (entry_date, title). Safe to re-run,
-- safe to apply alongside the prior backfills.

DO $$
BEGIN

-- ── June 10 — Admin V2 ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-06-10', 'Admin, reimagined — the new AutoCurb admin experience',
  'A ground-up redesign of the dealer admin built around a single, premium design system. Same data, same workflows, calmer and faster to use — a Command Center landing page, cleaner navigation, and a consistent look across every screen.',
  ARRAY[
    'New Command Center home with at-a-glance KPIs and quick actions.',
    'Consistent cards, typography, and spacing across every section.',
    'Faster page transitions and instant scroll-to-top on navigation.',
    'All existing tools and data preserved — nothing was removed.'
  ],
  'Sparkles', 'feature', 131
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-06-10' AND title = 'Admin, reimagined — the new AutoCurb admin experience');

-- ── June 10 — Platform + settings pages refreshed ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-06-10', 'Every settings & platform page now in the new design',
  'The remaining platform and configuration screens were brought into the new design so the whole admin looks and flows the same — no more jumping between an old and new style mid-task.',
  ARRAY[
    'Locations, Rooftop Websites, Website Embed, and Image Cache refreshed.',
    'System Settings, SaaS Pricing, Platform & Billing, Stripe Webhooks, and Audit Log refreshed.',
    'Every toolbar, filter, and control kept exactly where it was.',
    'Shared loading and empty states for a calmer, more consistent feel.'
  ],
  'Wrench', 'improvement', 132
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-06-10' AND title = 'Every settings & platform page now in the new design');

-- ── June 9 — Faster vehicle photos ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-06-09', 'Faster, more reliable vehicle photos',
  'Vehicle image lookups are now coalesced and throttled so bursts of activity no longer overwhelm the image service. Pages that previously flashed a blank image under heavy load now resolve smoothly.',
  ARRAY[
    'Duplicate image requests for the same vehicle are now shared, not refetched.',
    'A short cooldown after a rate-limit prevents repeated failing calls.',
    'Cached images hydrate instantly on revisit.'
  ],
  'Zap', 'fix', 133
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-06-09' AND title = 'Faster, more reliable vehicle photos');

-- ── June 8 — Saved-offer welcome-back ──
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order)
SELECT '2026-06-08', 'Saved-offer welcome-back for returning customers',
  'Customers who started a trade-in and come back are greeted with their saved offer instead of starting over, with expiry aligned to the dealer''s price-guarantee window so the number they were promised still stands.',
  ARRAY[
    'Returning visitors resume right where they left off.',
    'Saved-offer expiry honors the 8-day price-guarantee window.',
    'No change to the first-time customer flow.'
  ],
  'Rocket', 'feature', 134
WHERE NOT EXISTS (SELECT 1 FROM public.changelog_entries WHERE entry_date = '2026-06-08' AND title = 'Saved-offer welcome-back for returning customers');

END $$;

-- Let PostgREST pick up any schema/type changes without a restart.
NOTIFY pgrst, 'reload schema';
