# Admin V2 — design system

A sleek, minimal SaaS aesthetic adapted from the Autocurb **customer
portal** (`src/components/portal/PortalPageShell.tsx`). The goal is calm,
airy, premium: soft-gray canvas, white rounded cards, generous spacing,
restrained accent colour, and quiet typography.

To avoid re-theming the global shadcn tokens (which V1 depends on), V2
expresses its look as a small set of **self-contained primitives** in
`src/components/admin/v2/theme.tsx` using literal palette values. The
look is therefore additive and fully scoped to `/admin/v2`.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `ink` | `#06194A` | Headings, primary text |
| `muted` | `#53627A` | Secondary text, hints |
| `line` | `#E6EAF0` | Hairline borders, dividers |
| `canvas` | `#F4F6FA` | Page background |
| `purple` | `#6D28D9` | Primary accent (active nav, primary buttons, charts) |
| `teal` | `#0D9488` | Secondary accent (gradients, "active deal" status) |

**Status tones** (`Pill`): purple (info/new), teal (in-progress),
green (won/closed), amber (attention), red (urgent/dead), gray (neutral).

Accents are used sparingly — a single purple→teal gradient appears on the
brand mark, avatar, and progress bars; everything else is ink-on-white.

## Typography

- **Sans:** Inter (already loaded globally in `src/index.css`).
- Page title: 24–28px / bold / tight tracking, `ink`.
- Section label: 10px / uppercase / `0.16em` tracking / `purple`.
- Body: 13px; hints/captions: 11–12px, `muted`.
- KPI value: 28px / bold.

No serif display face in V2 — the editorial `DM Serif Display` used on
some V1/marketing surfaces is intentionally dropped for a cleaner,
product-grade feel.

## Spacing & shape

- Card radius: `rounded-2xl` (16px); buttons/inputs `rounded-xl` (12px).
- Card border: 1px `line`; shadow: `0 1px 2px rgba(15,23,42,0.04)`,
  lifting to `0 10px 30px -12px rgba(15,23,42,0.18)` on hover for
  clickable cards.
- Grid gap: 16px (`gap-4`). Content max-width: 1320px, centered.
- Page padding: 24px mobile, 32px desktop.

## Motion

- Page/section entrance: framer-motion fade + 10px rise,
  `0.28s` `cubic-bezier(0.22, 1, 0.36, 1)`.
- Hover lifts: `translateY(-2px)` on interactive cards; `active:scale-0.98`
  on buttons. Respects `prefers-reduced-motion` via the global media rule.

## Components (in `theme.tsx`)

| Component | Description |
| --- | --- |
| `PageShell` | Animated wrapper with title / subtitle / actions row |
| `Card` | Soft white surface, the workhorse container |
| `SectionLabel` | Tiny uppercase accent label |
| `Pill` | Status badge with six tones |
| `StatCard` | KPI tile: label, value, hint, icon, optional click-through |
| `PrimaryButton` / `SecondaryButton` | Filled purple / outline actions |

Composite components built on these primitives:

- `AdminSidebarV2` — light rail, active item with purple left-accent bar,
  collapsible groups, count badges. Driven by `adminNavV2.ts`.
- `AdminHeaderV2` — hairline top bar: mobile menu, ⌘K search trigger,
  user menu, "Classic admin" escape hatch.
- `CommandCenter` — KPI grid + quick actions + recharts area trend +
  status distribution bars + recent-leads list.

## Reuse rules

1. Prefer the V2 primitives over ad-hoc Tailwind for any new V2 surface.
2. Charts use recharts with the purple→teal palette and `#EEF1F6`
   gridlines, 12px `#9AA6BC` axis labels, rounded tooltips.
3. When a V2 screen needs a control that only exists as a shadcn
   component (dropdown, dialog, command palette), reuse the shared
   shadcn component — do not rebuild it — and keep surrounding chrome in
   the V2 palette.
