# Admin V2 — migration & coexistence plan

## Objective

Ship V2 without disrupting a single current user. V1 stays the default
and fully operational until V2 reaches parity + stability, then we flip
the default and retire V1.

## Phase 0 — Coexistence (this increment) ✅

- V1 lives at `/admin` (default, **unchanged**).
- V2 lives at `/admin/v2` (opt-in by direct URL).
- Both render through the same `ProtectedRoute` (auth + MFA gates apply
  equally) and the same `useAdminDashboard` data layer.
- Escape hatch: V2's header has a **"Classic admin"** link back to
  `/admin`, so beta users are never stuck.
- **Data flow:** identical. V2 reads/writes the same Supabase tables and
  storage buckets through the shared hook and section renderer. No new
  schema, no migration required for this phase.

## Phase 1 — Internal beta (flagged)

Introduce an explicit flag so we can route specific users to V2 by
default without changing the URL they bookmark.

Recommended flag, in order of preference:

1. **`site_config.admin_v2_enabled`** (per-tenant boolean) — lets us turn
   V2 on for a whole pilot dealership. Read via the existing
   `useSiteConfig()` hook. Add as an **idempotent** migration
   (`ADD COLUMN IF NOT EXISTS admin_v2_enabled boolean DEFAULT false`),
   then `NOTIFY pgrst, 'reload schema';` — see repo `CLAUDE.md`.
2. **`user_roles.admin_v2_optin`** (per-user) — for individual internal
   testers across tenants.
3. **`localStorage["autocurb:admin-v2"]`** — zero-backend toggle for
   ad-hoc QA.

Resolution at `/admin`: if any flag is on for the current user/tenant,
`AdminDashboard` can `<Navigate to="/admin/v2" replace>` (or render V2
inline). Until Phase 1 lands, `/admin` always renders V1 — no behaviour
change.

> Migrations are **not** auto-applied on merge in this project. After
> merging any flag migration, apply it manually (Lovable Push /
> `supabase db push` / SQL editor) — see `CLAUDE.md`.

## Phase 2 — Parity hardening

Track parity per section. Each classic section already renders in V2 via
the shared renderer, so functional parity is inherited; the work is
visual/UX polish, sub-tab consolidation, and the new V2-only surfaces
(configurable dashboard, analytics). Keep a checklist in
`docs/admin-v2/README.md` and close items as they land.

Acceptance to exit Phase 2:
- All sidebar links open and operate identically in V2.
- Command Center headline KPIs backed by exact aggregates (not the
  loaded-page snapshot).
- No V2-only regressions reported by the pilot tenant for two weeks.

## Phase 3 — Default flip

- Default `/admin` to V2 (flip the flag default to `true`, or swap the
  route element). Keep V1 reachable at `/admin/classic` for one release
  as a rollback path.
- Announce via the existing changelog surface.

## Phase 4 — Retire V1

- Once telemetry shows negligible `/admin/classic` traffic, delete the V1
  page, `AdminSidebar`, `AdminHeader`, and the now-duplicated overlay
  block in `AdminDashboard` (V2's `AdminOverlays` supersedes it).
- `useAdminDashboard` and `AdminSectionRenderer` remain — they were
  always shared.

## Rollback

At every phase the previous surface is one flag flip / one URL away.
Because V2 adds no schema and no destructive data paths beyond the same
handlers V1 already uses, rollback is purely a routing concern.

## Risk notes

- **Dark mode:** V1 persists `admin-dark-mode` and toggles `.dark` on
  `<html>`. V2 is a light design using literal colours, so its custom
  surfaces are unaffected, but shared shadcn overlays (dialogs, dropdown)
  will follow the dark class. Before the default flip, either force-light
  the V2 subtree or add a proper V2 dark palette.
- **Loaded-page KPIs:** clearly labelled as a "recent snapshot" until the
  aggregate RPCs land (Phase 2), so numbers never silently mislead.
