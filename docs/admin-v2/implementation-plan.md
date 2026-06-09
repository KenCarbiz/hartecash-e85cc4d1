# Admin V2 — front-end implementation plan

## Stack

Same as the rest of the app — no new framework. **React 18 + TypeScript +
Vite + Tailwind + shadcn/ui + TanStack Query + Supabase.** Charts via
**recharts**; motion via **framer-motion**. Both already in `package.json`
and used by the customer portal.

## Architecture: chrome-swap, shared core

The single most important decision: **V2 does not fork the data layer.**

```
                 useAdminDashboard()  ← one hook, all data + handlers
                          │
        ┌─────────────────┴─────────────────┐
   AdminDashboard (V1)              AdminDashboardV2 (V2)
   classic chrome                  sleek chrome
        │                                   │
        └──────────► AdminSectionRenderer ◄─┘   (shared section content)
```

- `useAdminDashboard` (`src/hooks/useAdminDashboard.ts`) owns fetching,
  permissions, filters, selection, and all mutation handlers. Both
  dashboards consume its return value (`db`) unchanged.
- `AdminSectionRenderer` renders the actual module for `db.activeSection`.
  V2 passes the identical prop set, so every section behaves exactly as
  in V1.
- The synthetic section key **`command-center`** (defined in
  `adminNavV2.ts`) renders the new `CommandCenter` landing instead of the
  renderer. The renderer treats unknown keys as a no-op, so this is safe.

### State management

- **Server/derived state:** `useAdminDashboard` + the existing TanStack
  Query usage inside individual sections. No change.
- **V2 UI-local state:** only ephemeral chrome state lives in the page —
  `mobileNavOpen`, and the one-time "land on Command Center" init. The
  active section remains the single source of truth in `db.activeSection`
  (so the ⌘K command palette, breadcrumb, and sidebar all stay in sync).
- **Per-user preferences** (future: dashboard widget layout, density,
  pinned modules) will persist to `localStorage` first, then graduate to
  a `user_preferences` table when multi-device sync is needed.

## Component breakdown

| Component | Responsibility | Status |
| --- | --- | --- |
| `theme.tsx` | Design-system primitives | ✅ done |
| `adminNavV2.ts` | Nav model mirroring all V1 section keys | ✅ done |
| `AdminSidebarV2` | Sleek rail, all links, badges, mobile drawer | ✅ done |
| `AdminHeaderV2` | Minimal top bar, ⌘K, user menu, classic-admin link | ✅ done |
| `CommandCenter` | KPI grid, quick actions, trend + distribution, recent leads | ✅ done |
| `useDashboardLayout` | Per-user widget order + visibility (localStorage) | ✅ done |
| `AdminOverlays` | Customer-file sheet, delete dialogs, ⌘K palette | ✅ done |
| `AdminDashboardV2` | Page shell wiring all of the above to `db` | ✅ done |

## Integration points (existing APIs — unchanged)

- **Supabase** via `useAdminDashboard` (submissions, appointments,
  locations, pending requests) and `AdminSectionRenderer`'s per-section
  queries.
- **Customer file** reuses `SubmissionDetailSheet` / `CustomerFileV2`
  (chosen by `site_config.file_layout`).
- **Command palette** reuses `AdminCommandPalette` (⌘K).
- **Storage** deletes (photos/docs) reuse the same `supabase.storage`
  buckets as V1.

## Roadmap (next increments)

1. **Module sub-tabs.** Several V1 hubs already tab internally
   (Communications, Integrations, Performance). Surface those as in-page
   sub-tabs in V2 so the sidebar can collapse further without losing
   links.
2. **Configurable dashboard.** ✅ Shipped — Command Center widgets are
   reorderable (drag) and toggle-able via "Customize", persisted per user
   in `useDashboardLayout` (localStorage). Built on framer-motion
   `Reorder` (no new dependency). Widgets are a registry keyed by
   `WidgetId`, so new widgets drop in and saved layouts reconcile
   automatically. Next: graduate persistence to a `user_preferences`
   table for multi-device sync, and add finer-grained (per-tile) widgets.
3. **Enhanced analytics.** A dedicated Analytics surface: funnel
   (status → status conversion), cohort retention by intake week,
   marketing ROI by `source`, and multi-store comparison. Build on
   recharts; drill-down opens the filtered Leads section in place.
4. **Full-book KPIs.** Today the pipeline/conversion tiles derive from
   the loaded leads page (labelled "recent snapshot"). Add lightweight
   aggregate RPCs (`get_admin_kpis`) so headline numbers are exact
   without paging all rows. Idempotent migration; see CLAUDE.md rules.
5. **Marketplace shell.** A Settings → Add-ons surface listing modules
   (AI Voice, Equity Mining, analytics connectors) with enable/disable
   toggles, wired to existing entitlement flags. Pricing stays as-is;
   the UI is structured to support modular pricing later.

## Testing

- `npm run typecheck`, `npm run lint`, `npm run build` all pass for this
  increment.
- Add Vitest coverage for `adminNavV2.buildNavGroups` (permission/role
  gating) and `CommandCenter` KPI math as those grow.
