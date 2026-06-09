# Admin V2 — sleek/minimal redesign

V2 is the next-generation dealer admin portal, built **alongside** the
classic admin (V1) as its eventual replacement. It is opt-in at
**`/admin/v2`**; V1 remains the default at `/admin` and is untouched, so
current users are not disrupted during the beta.

## Design principle

> Keep every classic capability. Replace only the chrome.

V2 reuses V1's exact data layer (`useAdminDashboard`) and content
renderer (`AdminSectionRenderer`). That means **every left-bar link and
all module functionality is retained verbatim** — only the sidebar,
header, and landing page are new. New surfaces (the Command Center) read
from the same data sources, so V1 and V2 never drift.

## What's in this folder

| Doc | Purpose |
| --- | --- |
| [`design-system.md`](./design-system.md) | Colours, typography, spacing, and reusable component spec |
| [`implementation-plan.md`](./implementation-plan.md) | Component breakdown, state model, API/integration points, roadmap |
| [`migration-plan.md`](./migration-plan.md) | How V1 and V2 coexist, feature flagging, data flow, gradual rollout |

## Code map

```
src/components/admin/v2/
  theme.tsx           Design-system primitives (PageShell, Card, StatCard, Pill, buttons)
  adminNavV2.ts        Navigation model — mirrors every V1 section key
  AdminSidebarV2.tsx   Sleek, minimal left rail (retains all links)
  AdminHeaderV2.tsx    Minimal top bar + "Classic admin" escape hatch
  CommandCenter.tsx    Unified KPI + quick-actions landing page (configurable widgets)
  useDashboardLayout.ts  Per-user widget order + visibility (localStorage)
  AdminOverlays.tsx    Shared customer-file slide-out + delete dialogs + ⌘K palette
src/pages/AdminDashboardV2.tsx   Page shell wiring the above to useAdminDashboard
```

## Status (this increment)

- [x] V2 chrome: sidebar, header, page shell (sleek/minimal, purple/teal)
- [x] Unified Command Center landing (KPIs, quick actions, trend chart, recent leads)
- [x] All classic sections reachable + functional via the shared renderer
- [x] Beta route `/admin/v2`, V1 untouched
- [x] Configurable Command Center — drag-to-reorder + show/hide widgets, persisted per user (`useDashboardLayout`)
- [ ] Module sub-tab consolidation (planned)
- [ ] Advanced analytics (funnels, cohorts, ROI, multi-store) (planned)
- [ ] Add-on marketplace surface (planned)
