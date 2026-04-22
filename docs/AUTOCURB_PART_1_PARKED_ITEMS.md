# Part 1 — Parked Items Scope & Plan

Five items from the Part 1 punch list were too large to ship inside a
single-session cleanup pass. Each of them is a named initiative with its
own design question, its own risk, and its own engineering budget. This
document captures what we'd build, what the open questions are, and
roughly how much work each one represents — so they can be prioritized
independently of the 15 items that shipped in Waves 1-6.

---

## #1 — ExecutiveDashboard rebuild

**What exists today:** `src/pages/ExecutiveDashboard.tsx` is a ~500-line
page that a GM or dealer principal sees first. It risks looking thin in
a demo because the tiles and charts don't tell a clean story.

**What the punch list asked for:**
- Load in under 1 second
- MTD acquisitions
- Gross-per-copy
- Pipeline velocity (avg days per stage)
- Aging buckets (how long leads sit in each stage)
- Source ROI (which lead source produces the best gross)
- Staff leaderboard (who closes the most deals)

**Proposed build:**

1. **Data layer** — New `executive_metrics` SQL view (or set of views)
   that pre-aggregates the numbers per dealership_id. Query:
   ```sql
   CREATE MATERIALIZED VIEW executive_metrics_mtd AS
     SELECT dealership_id, date_trunc('month', created_at) AS month, ...
   ```
   Refreshed every 15 minutes via pg_cron or a scheduled edge function.
   This is what keeps load time under 1 second instead of running
   N aggregate queries from the client.

2. **Page layout** — Six sections stacked:
   - **Hero KPI strip** (4 tiles): MTD units acquired, MTD gross,
     avg gross-per-copy, conversion rate. Each tile has a sparkline
     and a MoM delta chip.
   - **Pipeline velocity board** — horizontal Sankey showing how many
     leads are in each stage and the average time-in-stage.
   - **Aging heatmap** — rows are stages, cells are age buckets
     (< 24h, 1-3 days, 4-7 days, > 7 days), color-coded by count.
   - **Source ROI table** — lead_source × submissions × converted ×
     avg gross × ROI. Sortable.
   - **Store leaderboard** — if multi-location, one row per store with
     units, gross, conversion, ranked.
   - **Staff leaderboard** — rows per user, units closed this month,
     avg gross, last-touch activity.

3. **Print-ready** — The whole page should respect the new
   `data-print-section` hook so a dealer can print it for a morning
   meeting.

**Open questions:**
- Do we want a materialized view (needs refresh) or a real view
  (slower but always fresh)?
- Gross-per-copy requires knowing both the offered_price AND the
  eventual retail sale price. The outcome_* fields on submissions
  are nullable — we need a rule for when a deal is "counted."
- Staff leaderboard requires an `owning_staff_id` on submissions,
  which is partially wired today via referrals + My Lead Link but
  not uniformly.

**Engineering budget:** 2-3 focused days, including the SQL migration,
page rebuild, and print styling. Highest-leverage item on the list for
the investor demo.

---

## #4 — Wholesale Marketplace

**What exists today:** A single boolean flag on dead leads indicating
whether the dealer wants the car offered to a wholesale network.
Nothing consumes the flag.

**What the punch list asked for:**
- Real inter-dealer feed
- Bid / ask mechanics
- Expiration logic

**Proposed build (this is a multi-sprint product, not a punch-list fix):**

1. **Data model:**
   ```
   wholesale_listings
     id, dealership_id, submission_id, vehicle snapshot fields,
     asking_price, reserve_price, expires_at, status, created_at
   wholesale_bids
     id, listing_id, bidder_dealership_id, bid_amount, notes,
     status (pending/accepted/rejected/withdrawn), created_at
   wholesale_network_membership
     dealer_id, tier, subscription_started_at
   ```

2. **Publishing flow:** When a UCM marks a dead lead as
   "wholesale eligible," generate a listing with a 72-hour expiration.
   Photos, condition, Black Book, and ACV go into the listing snapshot
   so bidders have context.

3. **Discovery UI:** A new admin section "Wholesale Market" with:
   - Inbound listings (what other dealers are offering)
   - Your listings (what you've published, bid count, time remaining)
   - Bid modal with offer amount, payment terms, pickup logistics

4. **Settlement:** Accepting a bid triggers a transfer workflow —
   title, payment escrow, pickup scheduling. This is the scariest part
   because it touches money and titles.

5. **Notifications:** New bid on your listing, bid accepted, listing
   expiring, listing sold.

**Open questions:**
- Is this a network we operate (Autocurb takes a cut) or a pure
  peer-to-peer feed?
- Do we handle escrow or just connect buyers and sellers?
- State-by-state title rules for inter-dealer transfers are a
  regulatory minefield — we should only ship this in states we've
  verified, rolling out geographically.
- Pricing: wholesale marketplace access is probably a plan-tier
  upgrade (Standard doesn't get it, Multi-Store does).

**Engineering budget:** 4-6 weeks for an MVP that doesn't handle
escrow, 3-6 months for a full settlement-included product. This needs
its own product spec before we start writing code.

---

## #5 — Revaluation Job admin panel

**What exists today:** There is no `pg_cron`, no `supabase.cron`, no
scheduled-job infrastructure in the repo. The edge functions that
*feel* scheduled (`send-appointment-reminders`, `process-follow-ups`,
`notify-abandoned-lead`) are invoked from the Supabase Dashboard's
schedule UI, which is invisible to dealers.

**What the punch list asked for:**
- Make the equity-mining re-value job explicit and visible
- Surface it in an admin "Jobs" panel

**Proposed build:**

1. **`scheduled_jobs` table:**
   ```
   id, name, slug, function_name, cron_expression,
   last_run_at, last_run_status, last_run_message,
   next_run_at, enabled, owner_role, dealership_id
   ```
   This is a source of truth the UI can query.

2. **Runner edge function:** A single `run-scheduled-jobs` function
   that reads the table, picks anything where `next_run_at < now()`
   and `enabled = true`, invokes the target function, records the
   result, and updates `next_run_at`. Pointed at by a Supabase cron
   entry that fires every minute.

3. **Admin Jobs panel:** New admin section showing:
   - All scheduled jobs for this dealership
   - Last run time + status + message
   - Next run time
   - Manual "Run now" button (admin-only)
   - Toggle to enable/disable per job
   - Full history table with pagination

4. **Seed jobs:** Pre-populate with the existing implicit jobs:
   - `process-follow-ups` (every 5 minutes)
   - `send-appointment-reminders` (daily at 9 AM dealer time)
   - `notify-abandoned-lead` (hourly)
   - `cleanup_expired_bb_vin_cache` (daily)
   - `revaluate-equity-mined-leads` (daily — NEW, the equity-mining job)

5. **Equity mining job itself:** Re-walk submissions where
   `progress_status = 'dead_lead'` and `offered_price IS NOT NULL`,
   re-run `recalculateOffer` against the current pricing model, and
   surface any that are now +$500 better as "revaluation alerts" in
   the dealer admin. This is the "re-value" referenced in the punch
   list.

**Open questions:**
- Do jobs run per-dealership (good for transparency) or platform-wide
  (simpler infrastructure)? Probably per-dealership for visibility.
- How do we surface job failures to dealers without spamming? Alert
  threshold: 2 consecutive failures → email the admin.

**Engineering budget:** 3-5 days for the runner, table, admin panel,
and the revaluation job itself. Straightforward but not tiny.

---

## #8 — Mobile inspection offline mode

**What exists today:** `src/pages/MobileInspection.tsx` is a mobile-first
inspection checklist designed for a UCM walking around a car in the
service drive. It assumes connectivity, so every checkbox toggle
issues an immediate Supabase write.

**What the punch list asked for:** IndexedDB queueing with background
sync so a dealer can complete an inspection in a metal service bay
with zero signal.

**Proposed build:**

1. **Local store (IndexedDB via Dexie):**
   ```ts
   inspectionDraft {
     submissionId (primary key)
     condition (JSON blob of all inspection fields)
     photos (array of { blobId, angle, capturedAt })
     lastSavedAt (timestamp)
     syncStatus: 'dirty' | 'queued' | 'synced' | 'error'
   }
   ```

2. **Write path:** Every inspection change writes to IndexedDB first,
   marks the record as dirty, and schedules a background sync. If
   the network is up, the sync runs immediately. If not, it retries
   on connectivity-change events and on page load.

3. **Photo handling:** Photos need to be stored as blobs in IndexedDB
   and uploaded lazily when connectivity returns. The upload queue
   needs backoff and resumable uploads (Supabase Storage supports
   multipart via `upsert: true`).

4. **Conflict resolution:** If the inspection was edited server-side
   while the UCM was offline, we need a merge strategy. Last-write-
   wins is acceptable for MVP but we should log a conflict entry to
   activity_log so the GSM can see that a race happened.

5. **UI:** A persistent "Offline — 3 changes queued" chip at the top
   of the page, with a tap-to-retry affordance. A checkmark "All
   synced" when the queue is empty.

6. **Service Worker:** Register a service worker so the page itself
   loads offline (the JS, CSS, and HTML need to be cached). Vite-
   PWA plugin handles this well.

**Open questions:**
- What happens if the UCM completes an inspection offline and then
  a different user edits the same submission from the admin before
  the UCM reconnects? Merge rules matter here.
- Do we need offline mode for the entire admin, or just
  MobileInspection? Probably just MobileInspection for MVP.

**Engineering budget:** 1-2 weeks for a production-quality offline
mode with tests. The service worker + IndexedDB scaffolding is
straightforward; conflict resolution is where the time goes.

---

## #9 — Dark mode audit

**What exists today:** Tailwind's `dark:` variants are used throughout
the codebase. There's no single dark-mode story though — some screens
have been hand-tuned, others rely on the semantic color tokens
(`bg-card`, `text-card-foreground`, `bg-muted`) which work correctly,
and a handful still have hardcoded colors.

**What the punch list asked for:** Verify every admin screen renders
correctly in dark mode. Known trouble spots: lead pipeline, appraisal
waterfall, OBD scan screen.

**Proposed build (this is a verification pass, not a rewrite):**

1. **Snapshot every admin screen** in both light and dark mode with a
   running dev server and a headless browser (Playwright works, or
   just a manual screenshot pass).

2. **Grep for hardcoded colors** in admin components:
   ```
   bg-white, bg-black, bg-gray-*, bg-slate-*, text-white, text-black,
   text-gray-*, text-slate-*, #\w{3,8} (hex literals), rgb(...)
   ```
   Anything that isn't going through a semantic token is a potential
   problem and needs either a `dark:` counterpart or a replacement
   with the appropriate token.

3. **Known fix targets:**
   - SubmissionsTable cells — check stripe color and hover state
   - AppraisalTool waterfall block backgrounds
   - MobileInspection OBD scan screen (reportedly broken)
   - All modal backgrounds (some dialogs have hardcoded bg-white)
   - Print CSS: we just expanded this in Wave 3 — the force-white
     override is intentional for paper output, so that's not a bug

4. **Automation:** Add an ESLint rule (or a simple pre-commit grep)
   that forbids hardcoded color classes in new code going forward.

**Open questions:**
- Do we keep "auto" theme (follow OS) or force-select one? Today we
  default to light with an opt-in dark toggle.
- Printing forces a light theme regardless — we should document this.

**Engineering budget:** 1 day for the automated sweep, 2-3 days for the
manual fixes depending on how many hot spots turn up.

---

## Prioritization recommendation

For an investor demo and sales-hire onboarding, the priority order is:

1. **#1 ExecutiveDashboard rebuild** — highest-leverage for the demo
   because this is the first screen a GM opens. If this looks thin
   the whole product looks thin.
2. **#9 Dark mode audit** — quick polish that makes the product feel
   10x more expensive for the time invested.
3. **#5 Revaluation Jobs panel** — quietly powerful because it gives
   dealers "equity mining" as a real feature, not a promise.
4. **#8 Mobile inspection offline mode** — important for field use,
   but the demo usually happens in an office with wifi. Ship when
   the first real customer complains.
5. **#4 Wholesale marketplace** — biggest, furthest out. Needs a
   product spec before any code gets written. Treat as its own
   initiative, not part of Part 1.
