# Autocurb Admin Refresh — Scoped Handoff for Claude Code

**Purpose:** Apply a **surgical set of UX/UI changes** to the existing `/admin` experience. This is NOT a full rewrite. Keep every feature, component, database schema, API route, and permission check that isn't explicitly called out below.

**Repo:** `KenCarbiz/hartecash-e85cc4d1`, branch `main`
**Reference designs:** `design_files/Admin Refresh.html` (approved) and `design_files/Customer Check-In.html` (approved)
**Reference screenshots:** `screenshots/*.png`

---

## 🚨 GROUND RULES — READ FIRST

1. **Do not touch anything not listed in this brief.** If you're unsure whether a file is in scope, it is not.
2. **Do not rename files, routes, or database columns.** Edit in place.
3. **Do not refactor unrelated code.** No "while I'm here" cleanups.
4. **Do not delete components that are being replaced.** Keep the legacy versions around behind the kill switch (see §6).
5. **Every change must be gated by the kill switch** (`site_config.ui_refresh_enabled`) so a Super Admin can turn it off per tenant.
6. **Role-gating logic stays identical** to what's in `AdminSidebar.tsx` today. The groups are renamed and consolidated, but `canManageAccess`, `isManager`, `isAppraiser`, `isReceptionist` etc. still determine who sees what.
7. **When in doubt — ask, don't guess.**

---

## What is IN scope (the only things to change)

| # | Change | Files primarily touched |
|---|---|---|
| 1 | Consolidate 9 sidebar groups → **Work · Grow · Measure · Setup · Account** | `src/components/admin/AdminSidebar.tsx` |
| 2 | New **"Today"** home page (landing at `/admin` for managers) | NEW: `src/components/admin/home/TodayHome.tsx`, wire in `AdminDashboard.tsx` |
| 3 | Refreshed **All Leads** table layout (6 columns + alert banner + contextual actions) | `src/components/admin/SubmissionsTable.tsx` |
| 4 | Refreshed **Appraiser Queue** layout (calmer, same data) | `src/components/admin/AppraiserQueue.tsx` |
| 5 | Refreshed **Appointments** layout (front-desk style) | `src/components/admin/AppointmentManager.tsx` |
| 6 | **Super Admin kill switch** (`site_config.ui_refresh_enabled`) | DB migration + `SiteConfiguration.tsx` + all refreshed components |
| 7 | Customer self **Check-In** flow — already designed in `Customer Check-In.html`, wire it to the existing `/check-in/:token` route | NEW page + existing `submissions` schema |

## What is OUT of scope (leave it alone)

- Header / `AdminHeader.tsx` — keep the current gradient header for now. We'll simplify later.
- `ExecutiveKPIHub.tsx`, `ExecutiveHUD.tsx`, `BDCPriorityQueue.tsx`
- `SubmissionDetailSheet.tsx` — the big slide-out detail panel. Untouched.
- All `Setup` destinations (Offer Logic, Branding, Forms, Inspection, Locations, etc.)
- All `Account` destinations (Staff, Plan, Permissions)
- All `Integrations` / `Platform` destinations
- `AppraisalTool.tsx`, `InspectionSheet.tsx`, `OfferPage.tsx`, `DealAccepted.tsx` — customer-facing pages
- Routing, auth, Supabase schema beyond the one migration in §6

---

## 1. Sidebar consolidation

**File:** `src/components/admin/AdminSidebar.tsx`

The current sidebar has 9 groups (Pipeline / Acquisition / Configuration / Storefront / My Tools / Insights / Admin / Integrations / Platform). Collapse to **5**:

```
WORK          (everyone — role-gated items still apply)
  Today                              — NEW item, points at TodayHome
  All Leads                          — was "submissions"
  BDC Priority Queue                 — existing, keep key "bdc-queue"
  Appraiser Queue                    — existing, keep key "appraiser-queue"
  Appointments                       — was "accepted-appts"
  Inspection Check-In                — existing
  Service Quick Entry                — existing

GROW          (manager+, same role gates as today)
  Equity Mining
  Voice AI
  Vehicle Images
  Wholesale Marketplace (if beta)

MEASURE       (manager+ for Performance/GM HUD, everyone for Compliance)
  Performance                        — was "executive"
  GM HUD                             — keep canViewExecutiveHUD gate
  Reports & Export
  Compliance

SETUP         (admin-only unless noted)
  Offer Logic                        — manager+ (unchanged gate)
  Lead Form
  Inspection Sheet
  Photo Requirements
  Inspection Standards
  Promotions
  Referral Program
  Notifications
  Branding                           — was "site-config"
  Landing & Flow
  Locations                          — only if locationCount > 1
  Rooftop Websites                   — only if locationCount > 1
  Testimonials
  Website Embed

ACCOUNT       (admin-only unless noted)
  My Lead Link                       — everyone
  My Referrals                       — everyone
  Staff & Permissions                — admin
  System Settings                    — admin
  My Plan                            — admin (non-platform)
  Platform Updates                   — admin
  Integrations                       — admin + enterprise beta
  API Access                         — admin + enterprise beta
  vAuto Integration                  — admin + enterprise beta
  White Label                        — admin + enterprise beta
  Dealer Setup                       — admin
```

**Platform** group stays as-is for platform admins (Tenants, Pricing Model, Platform Billing).

### Implementation notes
- Keep all existing `key` strings identical so `AdminSectionRenderer.tsx` continues to work. **Do not rename the keys themselves — only the group labels and order.**
- Receptionist sidebar stays **exactly as it is today** (Appointments + Inspection Check-In + My Tools only).
- The `renderGroup()` + `Collapsible` pattern stays. Only the arrays feeding into `groupEntries` change.
- Gate the whole consolidation behind `ui_refresh_enabled` — when OFF, render the original 9-group structure.

---

## 2. Today home page

**File:** `src/components/admin/home/TodayHome.tsx` (new)
**Wired from:** `AdminSectionRenderer.tsx` — add `if (activeSection === "today") return <TodayHome … />`
**Default landing:** `AdminDashboard` should default `activeSection` to `"today"` (instead of `"submissions"`) when `ui_refresh_enabled` is true AND `allowedSections` includes it.

### Layout (see `screenshots/01-home-today.png`)

```
┌─ Header (existing) ───────────────────────────────────────┐
│                                                           │
│  Tuesday, April 21                                        │
│  Good afternoon, {firstName}.                             │
│  Here's what needs you today.                             │
│                                                           │
│  ┌─ RIGHT NOW ──────────────────────────────────────────┐ │
│  │  [Arrival card]        [On-the-way card]             │ │
│  │  Jenna Whitcomb        Marcus Lee                    │ │
│  │  2020 Outback          2019 Accord · Appt 10:30 AM   │ │
│  │  [Greet now] [Open]    [Prep file] [Call]            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ KPI row ────────────────────────────────────────────┐ │
│  │  TODAY      MTD GROSS    OPEN LEADS   AVG RESPONSE   │ │
│  │  3          $47.2k       84           38m            │ │
│  │  +12% MoM   +12% MoM     12 need act. goal < 2h      │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### Data sources
- **Right-now cards:** submissions where `progress_status = 'arrived'` (customer tapped "I'm here" in the self check-in) or where `progress_status = 'on_the_way'` or `portal_view_count >= 1` AND an appointment is in the next 60 min.
- **KPIs:**
  - **TODAY** = count of submissions where `progress_status = 'purchase_complete'` AND `updated_at::date = today`
  - **MTD GROSS** = sum of `final_price - acv_value` for submissions with `progress_status = 'purchase_complete'` in current month
  - **OPEN LEADS** = count of submissions where `progress_status NOT IN ('purchase_complete', 'dead_lead')`. Sub-count: same filter WHERE `created_at < now() - 24h AND offered_price IS NULL`
  - **AVG RESPONSE** = avg of (first contact timestamp - created_at) over last 30 days; goal is 2h

### Role variants (all gated behind `ui_refresh_enabled`)
- **GM / UCM / Admin** → full layout above
- **BDC / Sales** → Today page replaced with **BDC Priority Queue** as landing (already exists, just make it the default). See `screenshots/bdc.png`.
- **Appraiser** → Today page replaced with **Appraiser Queue** as landing. See `screenshots/appraiser.png`.
- **Receptionist** → Today page replaced with **Front Desk / Appointments** view. See `screenshots/reception.png`. No sidebar groups other than Work.
- **Super Admin** → stays on the platform home (Tenants / Command Center). Not touched.

### Routing for "default home"
Inside `AdminDashboard.tsx` after `useAdminDashboard()`, compute `defaultHome` based on `userRole + isAppraiser`:
- `admin` / `gsm_gm` / `used_car_manager` / `new_car_manager` → `"today"`
- `sales_bdc` / `sales` / `internet_manager` → `"bdc-queue"`
- `isAppraiser === true` → `"appraiser-queue"`
- `receptionist` → `"accepted-appts"`
- fallback → first item in `allowedSections` (same as today)

Set `activeSection` to `defaultHome` only on first mount (not on every render).

---

## 3. All Leads — refreshed SubmissionsTable

**File:** `src/components/admin/SubmissionsTable.tsx`
**See:** `screenshots/02-all-leads.png`

### What changes

**A. Columns collapse from 11 → 6**
```
CUSTOMER & VEHICLE    STATUS    OFFER    AGE    SCORE    [action]
```
- Merge Name + Vehicle into one cell (two lines: `name` on top, `year make model · mileage mi` below). Keep avatar/initials circle left.
- Keep Status as a pill (read-only in the row — no inline dropdown anymore).
- Keep Offer right-aligned, formatted `$18,400` or `~$24,500` (tilde when it's an `estimated_offer_high`, not a real offer).
- Age: smart format (`6m`, `18m`, `2h`, `5h`, `3d`).
- Score: 0–100 badge from `scoreBdcLead()`.
- Actions column: **one primary contextual button per row** (see §5 below).

**B. Alert banner above the table**
When any submission in the current page has `progress_status = 'arrived'`, render a sticky banner above the filters:
```
● Jenna Whitcomb just arrived on the lot
  2020 Subaru Outback · 10:00 AM appointment · Go greet now    [+2 more] [Greet now] [×]
```
- Color: use `--danger-soft` background, `--danger` left border (4px), ink for text.
- Dismiss (`×`) sets a session flag; reappears next page load.
- If >1 arrived lead, show first + `+N more` button that opens a modal with all arrivals.
- Banner replaces old "SLA breached" toast behavior — but the toast stays for non-arrival events.

**C. Filter chips above table**
Replace the current filter drawer with inline chips:
```
[All · 12] [New · 12] [Hot · 6] [Appointments · 7] [Accepted · 4] [Stuck > 24h · 3]
```
- Counts pulled from the current submission set.
- Clicking filters in place. "All" clears filter.
- Keep the detailed filter drawer but move it behind a **[Filter]** button to the right of search (same row as search + "New lead").

**D. Remove inline status dropdown from rows**
Status is now display-only in the row. Status changes happen inside the `SubmissionDetailSheet` (already does — just remove the inline `<Select>` from the table).

### What stays the same
- Pagination, search input, bulk-action bar (checkbox select), empty state, loading skeleton, density toggle. Keep all of these.
- `onView`, `onDelete`, `onInlineStatusChange` handlers stay — the last one just loses its inline trigger but is still called from the detail sheet.
- Sorting by column header stays.

---

## 4. Appraiser Queue — refresh

**File:** `src/components/admin/AppraiserQueue.tsx`
**See:** `screenshots/appraiser-queue.png`

### What changes

- The reason chips at top become a clean 4-card KPI row: **WALK-INS · SERVICE DRIVE · FLAGGED · DECLINED**, big numerals, small labels. Remove icon-in-chip for calm.
- The queue list: each row is a clean card with vehicle image placeholder (left), year/make/model + VIN last-8 + mileage (middle), single `[Open appraisal]` primary button (right).
- Move the "AI auto-route ON/OFF" banner INTO the header area, shrunk to a single-line pill: `✨ AI auto-route ON` or `AI auto-route OFF · Enable in Branding → AI`.
- AI re-appraisal suggestion row (the violet/emerald inline card) — KEEP IT, just restyle to match the calmer palette. Same accept/dismiss actions.

### What stays the same
- All data fetching, `classifyRow()`, sort order, schema-fallback fallback, `acceptSuggestion()`, `dismissSuggestion()`, `dismissFromQueue()`, `canAccess` gate.
- Role gating (admin, manager, isAppraiser).

---

## 5. Status → contextual action button

**Applies to:** All lead rows (SubmissionsTable) and Today's action list.

Replace the status dropdown with a **single primary action button** that changes based on `progress_status`:

| progress_status | Primary action | Onclick |
|---|---|---|
| `arrived` | `Greet now` (red primary) | Open detail sheet, log activity |
| `on_the_way` | `Prep file` (dark primary) | Open detail sheet |
| `new` | `Call` (dark primary, phone icon) | `tel:{phone}` + log activity |
| `contacted` | `Follow up` (ghost, phone icon) | `tel:{phone}` or open SMS composer |
| `inspected` | `Make offer` (accent filled) | Open detail sheet at Offer tab |
| `offer_sent` | `Follow up` (ghost) | `tel:{phone}` |
| `accepted` | `Book appt` (dark primary) | Open appointment dialog |
| `purchase_complete` | `View` (ghost) | Open detail sheet |
| `dead_lead` | `Revive` (ghost) | Open detail sheet with revive confirmation |
| anything else | `Open` (ghost) | Open detail sheet |

- Secondary actions (view file, delete, call, SMS) move into a `⋯` overflow menu to the right of the primary button.
- Button heights: 28px (`h-7`), text `text-[12px]`, icon 14px.

Put the mapping in a shared helper so Today + SubmissionsTable + BDCPriorityQueue all call it:
```ts
// src/lib/leadNextAction.ts
export function nextActionForLead(lead: Submission): {
  label: string;
  variant: "primary" | "accent" | "ghost" | "danger";
  icon: "phone" | "dollar" | "calendar" | "check" | null;
  onClick: () => void;
}
```

---

## 6. Super Admin kill switch

**The most important part of this handoff.** Every refresh change must be reversible per-dealer.

### A. Database migration

Add a column to `site_config`:
```sql
ALTER TABLE site_config
  ADD COLUMN ui_refresh_enabled BOOLEAN NOT NULL DEFAULT false;
```

Default `false` — dealers opt IN. We'll flip it on for the launch cohort manually.

### B. Context / hook plumbing

`useSiteConfig()` already hydrates `site_config`. Extend its typed return so consumers can read `config.ui_refresh_enabled`.

Add a convenience hook:
```ts
// src/hooks/useUIRefresh.ts
export const useUIRefresh = (): boolean => {
  const { config } = useSiteConfig();
  return Boolean((config as any).ui_refresh_enabled);
};
```

### C. Component gating

Every refreshed component checks this once at the top and renders either the new layout or delegates to the legacy implementation:

```tsx
const AdminSidebar = (props) => {
  const refreshed = useUIRefresh();
  return refreshed ? <RefreshedSidebar {...props} /> : <LegacySidebar {...props} />;
};
```

Same pattern for `SubmissionsTable`, `AppraiserQueue`, `AppointmentManager`, and the `TodayHome` default-landing logic in `AdminDashboard`.

**Do not delete the legacy implementations.** Extract them into `*.legacy.tsx` sibling files and export them. The kill switch must toggle cleanly.

### D. Super Admin toggle UI

In **System Settings** (platform admin only, `dealership_id === 'default'` scope via tenant override), add a section:

```
UI Refresh Program
──────────────────
☐ Enable refreshed UI for {tenant.display_name}
    When ON, this dealer's staff see the new sidebar, Today page,
    lead table, and appraiser queue layouts. When OFF, they see
    the existing UI.

    Rolled out {date_enabled or "not yet"}.
    [Save]
```

Lives in `SiteConfiguration.tsx` or a new `PlatformUIRefreshToggle.tsx` — your call. Only show the toggle when the viewer is a platform admin overriding into a tenant (TenantOverrideProvider is active).

### E. Telemetry
Fire a single `ui_refresh_toggled` event to `activity_log` with `old_value` / `new_value` when the flag flips, so we have an audit trail.

---

## 7. Customer self check-in

**Status:** Already designed at `design_files/Customer Check-In.html` — mobile-first screen showing a QR / arrive / greet flow.

**Wire it to:** The existing route `/check-in/:token` (uses the submission token).

### What exists already
- Route renders inside the existing customer portal shell. Keep that.
- Customer opens link → sees **"I'm on my way"** and **"I'm here"** buttons.
- Tapping "I'm on my way" sets `submissions.progress_status = 'on_the_way'` and stamps `on_the_way_at`.
- Tapping "I'm here" sets `submissions.progress_status = 'arrived'` and stamps `arrived_at`.
- Realtime: staff admin page subscribes to `submissions` changes via Supabase realtime and the arrival banner (§3B) lights up automatically.

### What's NEW
- The "arrived" state on `progress_status` — add it to the enum / CHECK constraint if the schema uses one, and to the `STATUS_META` lookup in `src/lib/adminConstants.ts`:
  ```ts
  arrived: { label: "Arrived", color: "danger", dot: "animate-pulse" },
  on_the_way: { label: "On the way", color: "warn" },
  ```
- Columns `on_the_way_at TIMESTAMPTZ NULL` and `arrived_at TIMESTAMPTZ NULL` on `submissions`.
- Activity log entries stamped on both transitions.
- The dealer-facing alert (§3B banner) is already spec'd above.

### What stays the same
- The customer portal look/feel outside this page.
- Notification routing (`send-notification` edge function) — just add two new trigger keys: `customer_on_the_way` and `customer_arrived` pointing at the assigned salesperson/BDC rep.

---

## File map — touch list

### Edit in place
- `src/components/admin/AdminSidebar.tsx` — §1
- `src/components/admin/AdminSectionRenderer.tsx` — register Today section, route BDC/Appraiser/Reception as role home
- `src/pages/AdminDashboard.tsx` — compute `defaultHome`, seed `activeSection`
- `src/components/admin/SubmissionsTable.tsx` — §3
- `src/components/admin/AppraiserQueue.tsx` — §4
- `src/components/admin/AppointmentManager.tsx` — reception variant (§3 role variants)
- `src/components/admin/SiteConfiguration.tsx` — §6D toggle
- `src/lib/adminConstants.ts` — add `arrived`, `on_the_way` to `STATUS_META`
- `src/pages/CustomerPortal.tsx` or wherever `/check-in/:token` is rendered — §7 two buttons

### New files
- `src/components/admin/home/TodayHome.tsx`
- `src/components/admin/home/TodayKpiRow.tsx`
- `src/components/admin/home/RightNowStrip.tsx`
- `src/hooks/useUIRefresh.ts`
- `src/lib/leadNextAction.ts`
- `src/components/admin/*.legacy.tsx` (extracted old versions of the 4 refreshed components)
- Migration: `supabase/migrations/{timestamp}_ui_refresh_flag.sql`

### DB migration
```sql
-- supabase/migrations/{timestamp}_ui_refresh_flag.sql
ALTER TABLE site_config
  ADD COLUMN IF NOT EXISTS ui_refresh_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ NULL;

-- If progress_status is a CHECK constraint or enum, add the two values.
-- (Inspect current constraint first; do not drop/recreate without checking.)
```

---

## Visual design tokens (lift these verbatim)

Both reference HTML files share the same tokens. Add to `tailwind.config.ts` or a new `src/styles/refresh.css`:

```css
:root {
  --refresh-ink: 220 20% 12%;
  --refresh-ink-soft: 220 10% 40%;
  --refresh-ink-faint: 220 8% 62%;
  --refresh-surface: 40 30% 98%;   /* warm ivory */
  --refresh-surface-2: 40 20% 96%;
  --refresh-surface-3: 40 15% 93%;
  --refresh-hair: 220 15% 90%;
  --refresh-hair-soft: 220 15% 94%;
  --refresh-accent: 216 85% 48%;   /* kept from existing brand */
  --refresh-accent-soft: 216 85% 94%;
  --refresh-success: 150 55% 40%;
  --refresh-success-soft: 150 55% 92%;
  --refresh-warn: 32 85% 48%;
  --refresh-warn-soft: 32 85% 94%;
  --refresh-danger: 4 72% 52%;
  --refresh-danger-soft: 4 72% 95%;
}
```

- **Font:** `Geist` (add via `@import` from Google Fonts if not already present). Mono: `Geist Mono`.
- **Corner radius:** `rounded-xl` (12px) for cards, `rounded-lg` (8px) for buttons, `rounded-full` for pills.
- **Shadows:** none for regular cards, `shadow-sm` on hover only. No gradients anywhere in refreshed views.
- **Density:** `text-[13px]` body, `text-[12px]` secondary, `text-[11px]` tertiary. Headings `text-2xl font-bold` (page title), `text-sm font-semibold uppercase tracking-widest ink-faint` (section labels like "RIGHT NOW").

---

## Acceptance checklist

Run through this before opening the PR:

- [ ] `ui_refresh_enabled = false` on a test tenant → admin looks **identical to today**. No visual changes anywhere.
- [ ] `ui_refresh_enabled = true` → sidebar shows 5 groups (Work/Grow/Measure/Setup/Account), Today lands for managers, leads table is the 6-column version, Appraiser Queue is the refreshed card layout.
- [ ] Super Admin can toggle the flag from System Settings while tenant-overriding into a dealer. Audit logged.
- [ ] Receptionist role: sidebar still shows only Appointments + Check-In + My Tools. No other changes visible to them.
- [ ] BDC rep lands on BDC Priority Queue (not Today).
- [ ] Appraiser lands on Appraiser Queue (not Today).
- [ ] Customer visits `/check-in/{token}` → "I'm on my way" and "I'm here" buttons both set the right columns and appear as banners/rows on the staff dashboard within 2s (Supabase realtime).
- [ ] Row status column is read-only. Clicking the row still opens the detail sheet; status can be changed inside the sheet exactly as today.
- [ ] Contextual action button matches the `progress_status → label` table in §5.
- [ ] Zero regressions on: submission detail sheet, offer logic, photo config, inspection config, staff permissions, all customer-facing pages.

---

## Screenshots reference

- `screenshots/01-home-today.png` — Today home for GM
- `screenshots/02-all-leads.png` — refreshed leads table with arrival banner
- `screenshots/appraiser-queue.png` — refreshed queue
- `screenshots/appointments.png` / `screenshots/reception.png` — front-desk view
- `screenshots/bdc.png` — BDC Priority Queue as role home
- `screenshots/appraiser.png` — Appraiser role home
- `screenshots/02-legacy-killswitch.png` — what users see with `ui_refresh_enabled = false`
- `screenshots/03-customerfile-arrived.png`, `screenshots/05-checkin-all-states.png` — check-in flow reference

---

## Questions? Stop and ask before:

- Changing any file not listed in the "touch list"
- Renaming any `key` string in the sidebar/section map
- Modifying role-gate logic in `adminConstants.ts` beyond adding the two new `STATUS_META` entries
- Altering the submission detail sheet, appraisal tool, or any customer-facing page
- Dropping/renaming any existing database column
