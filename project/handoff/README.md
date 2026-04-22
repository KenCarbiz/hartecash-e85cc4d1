# Autocurb Admin Refresh — Handoff Package

This folder is everything Claude Code needs to apply a **scoped, reversible UI refresh** to the existing `/admin` experience. Nothing outside what's described in `CLAUDE_CODE_BRIEF.md` should change.

## How to use this with Claude Code

1. Drop this whole folder into the repo root (or anywhere Claude Code can read it).
2. Open Claude Code and say:

   > Read `handoff/CLAUDE_CODE_BRIEF.md` and follow it exactly. Only change the files listed in the "touch list" section. Ask me before doing anything not listed. Start with the database migration in §6A, then work through sections 1 → 7 in order. Show me the diff for each section before moving on.

3. Review diffs section by section. Push back hard if Claude Code wants to change anything not on the list — that's the whole point of this brief.

## Contents

- `CLAUDE_CODE_BRIEF.md` — the surgical spec. Single source of truth.
- `design_files/Admin Refresh.html` — interactive mockup with role switcher + kill-switch toggle in the Tweaks panel.
- `design_files/Customer Check-In.html` — approved mobile check-in flow.
- `screenshots/*.png` — reference images for each view.

## Scope summary (what's changing)

✅ Sidebar: 9 groups → 5 (Work / Grow / Measure / Setup / Account)
✅ New "Today" home page for managers
✅ Refreshed All Leads table (6 cols + alert banner + contextual actions)
✅ Refreshed Appraiser Queue
✅ Refreshed Appointments / Front Desk view
✅ Super Admin kill switch (`site_config.ui_refresh_enabled`)
✅ Customer self check-in (`/check-in/:token`)

## Scope summary (what's NOT changing)

❌ Header component
❌ Submission detail slide-out sheet
❌ Executive HUD / KPI Hub / BDC Priority Queue internals
❌ All Setup destinations (Offer Logic, Branding, Forms, Inspection, etc.)
❌ All customer-facing pages except `/check-in/:token`
❌ Routing, auth, Supabase schema beyond the one migration
❌ Role-gating logic

**Default state of the flag is OFF.** Nothing changes for any tenant until a platform admin opts them in. This is a zero-risk rollout.
