# Customer File Redesign — Scoped Handoff for Claude Code

**Stack:** Claude Code commits to a branch on GitHub → Lovable picks up the branch and builds a preview → you review → merge to `main` → Lovable ships production.

**This is a single-screen change. Start here.** It's the safest possible first merge: no database migration, no sidebar changes, no routing changes, no role logic. One component gets a visual refresh. That's it.

**Repo:** `KenCarbiz/hartecash-e85cc4d1`
**Work on branch:** `customer-file-refresh` (create it first — do NOT commit to `main`)
**Reference design:** `design_files/Customer File Redesign.html` (approved)
**Reference screenshots:**
- `screenshots/01-pipeline.png` — pipeline table view (unchanged, for context)
- `screenshots/02-file-open.png` — refreshed customer file, standard state
- `screenshots/03-file-arrived.png` — refreshed customer file with "Customer Arrived" banner

---

## 🚨 READ BEFORE STARTING

1. **Commit to a feature branch, never to `main`.** Create `customer-file-refresh` first, work there. Lovable will auto-build a preview from the branch so Ken can review before merging.
2. **Do not touch anything outside the one component listed below.**
3. **Do not rename files, props, routes, or database columns.**
4. **Do not refactor unrelated code.** No "while I'm here" cleanups.
5. **Work behind a feature flag** so Ken can roll back instantly (see §4).
6. **Open a Draft PR after §2** (the legacy copy step) so Ken can see the branch exists and Lovable starts building a preview immediately.
7. **Stop after each numbered section and wait for approval** before continuing. Push after each section so Lovable's preview updates.
8. **If you're not sure, ASK — don't guess.**

---

## What changes (ONE thing)

The **customer file detail sheet** — the big panel that slides in from the right when a manager clicks 🔍 on a row in the pipeline — gets a visual refresh.

**Component:** `src/components/admin/SubmissionDetailSheet.tsx`
*(If the filename is slightly different in the codebase, it's the component rendered by `SubmissionsTable.tsx`'s `onView` handler. Find it, confirm with me, then edit.)*

### What stays identical
- The slide-in animation
- The route / URL / how it's opened
- All props, all handlers (`onClose`, `onUpdate`, etc.)
- Every tab inside the sheet (Customer, Vehicle, Offer, Notes, Activity, etc.) — same tabs, same data
- All save/cancel/submit buttons and their onClick logic
- Supabase reads and writes — not a single query changes
- Permission gating (who can edit what) — unchanged
- The underlying data model — zero database changes

### What changes (visual only)
1. **Header band** — restyled. See `screenshots/02-file-open.png`. New header uses a blue gradient background (`bg-gradient-to-r from-[#003b80] to-[#005bb5]`) with white text. Customer name is large serif `DM Serif Display`, vehicle/VIN underneath in Inter. Close button is an `X` in the top-right with a subtle hover state.
2. **Status banner below header** — when `progress_status === 'arrived'`, a red banner shows: `● Customer Arrived · {timestamp} — Go greet them now`. See `screenshots/03-file-arrived.png`. When `progress_status === 'on_the_way'` show the amber equivalent. Otherwise no banner.
3. **Section cards** — each tab's content is now grouped into `rounded-xl bg-white border border-slate-200` cards with a clear section label at the top. Padding is `p-5`. See the design file for exact layout.
4. **Typography scale** — page title `font-display text-[28px]`, section labels `text-xs font-semibold uppercase tracking-wider text-slate-500`, body `text-sm text-slate-700`, values `font-semibold text-slate-900`.
5. **Action buttons at the bottom** — primary action is `bg-[#003b80] text-white h-10 px-5 rounded-lg font-semibold`. Secondary is `border border-slate-300 bg-white text-slate-700`.

Everything else inside the sheet — field labels, form inputs, dropdowns, tab behavior — stays exactly as it is today.

---

## 1. Read first, confirm scope

Before touching code:

1. Locate the current customer-file sheet component. Likely `src/components/admin/SubmissionDetailSheet.tsx`. Confirm by searching for where `SubmissionsTable`'s `onView` callback opens.
2. Read the existing component end to end. List back to me:
   - The exact file path
   - The props it accepts
   - The tabs it renders
   - Any child components it composes
3. **Stop. Wait for me to confirm that's the right file before editing.**

---

## 2. Extract the current version as a safety copy

Before any edits:

```bash
cp src/components/admin/SubmissionDetailSheet.tsx \
   src/components/admin/SubmissionDetailSheet.legacy.tsx
```

Inside `SubmissionDetailSheet.legacy.tsx`, rename the exported component to `SubmissionDetailSheetLegacy`. Keep everything else byte-identical.

This is our rollback: if the refresh breaks something, we can swap the import back in 30 seconds.

---

## 3. Apply the visual refresh

Edit `SubmissionDetailSheet.tsx`. Replicate the visuals in `design_files/Customer File Redesign.html`:

- Header band (§ "What changes" item 1)
- Status banner (§ "What changes" item 2) — read `progress_status`, `arrived_at`, `on_the_way_at` from the submission prop. If `arrived_at` or `on_the_way_at` don't exist on the submission type yet, **skip the banner entirely** and tell me — we'll wire that up in a separate PR when we do the DB migration. Do NOT add those columns yourself.
- Section cards (§ item 3)
- Typography (§ item 4)
- Action buttons (§ item 5)

**What not to change inside this component:**
- Any `useEffect`
- Any fetcher / mutator (`supabase.from(...)...`)
- Any `onSubmit` / form wiring
- Any tab state machine
- Any child component (if the sheet composes `<OfferEditor>`, `<InspectionNotes>`, etc., leave those alone — only change how they're laid out on the page)

If a child component's styling clashes visibly with the new header/cards, **stop and tell me** — we'll decide together whether to scope the refresh into that child or accept the visual seam for now.

---

## 4. Feature flag

Add one feature flag so Ken can toggle the refresh on and off without a redeploy.

### Option A — simplest (recommended for this first PR)
Environment variable check. Lovable exposes env vars through its Project Settings → Environment, and Vite surfaces them via `import.meta.env`:

```tsx
// at the top of SubmissionDetailSheet.tsx
import { SubmissionDetailSheetLegacy } from "./SubmissionDetailSheet.legacy";

const ENABLE_REFRESH = import.meta.env.VITE_CUSTOMER_FILE_REFRESH === "true";

export default function SubmissionDetailSheet(props) {
  if (!ENABLE_REFRESH) return <SubmissionDetailSheetLegacy {...props} />;
  return <RefreshedSheet {...props} />;
}

function RefreshedSheet(props) {
  // ... the new implementation
}
```

**Default: OFF.** Ken will set `VITE_CUSTOMER_FILE_REFRESH=true` in Lovable's Environment settings when he's ready to flip the switch. Preview deploys can have the flag on; production stays off until Ken says so.

**Important:** Vite env vars are compiled into the bundle at build time, so flipping the flag requires Lovable to rebuild. Lovable rebuilds automatically when env vars change, so this is still a ~1 min round trip.

### Option B — tenant-level (skip for this PR)
Don't add a database-backed flag for this first change. One env var is enough. We'll introduce per-tenant flags in a later PR when we do the full admin refresh.

---

## 5. Test plan (do this before asking Ken to merge)

Lovable will build a preview of the `customer-file-refresh` branch automatically. Ken will review there.

In the Lovable preview with `VITE_CUSTOMER_FILE_REFRESH` **unset or `false`**:

- [ ] Click 🔍 on any lead in the pipeline → sheet opens and looks **identical to production today**
- [ ] All tabs work, all save buttons work, permissions work
- [ ] Nothing else on the page looks different

In the Lovable preview with `VITE_CUSTOMER_FILE_REFRESH=true`:

- [ ] Click 🔍 → refreshed sheet opens, matches `screenshots/02-file-open.png`
- [ ] All tabs still work (Customer, Vehicle, Offer, Notes, Activity, whatever exists today)
- [ ] All save/submit buttons still work
- [ ] Closing the sheet (X, Escape, click-outside) still works
- [ ] Switching to another lead (close → click 🔍 on different row) still works
- [ ] All permission-gated buttons still respect roles
- [ ] No console errors
- [ ] Mobile / narrow viewport doesn't break (sheet should still scroll cleanly)

---

## 6. PR checklist

Before asking Ken to merge the `customer-file-refresh` branch:

- [ ] `git diff --stat main...customer-file-refresh` shows changes to **at most 2 files**: `SubmissionDetailSheet.tsx` + the new `.legacy.tsx`
- [ ] No DB migration files added
- [ ] No new dependencies in `package.json`
- [ ] No changes to `tailwind.config.*` beyond adding the two named hex colors (`#003b80`, `#005bb5`) if they aren't already referenced as design tokens
- [ ] Env var `VITE_CUSTOMER_FILE_REFRESH` documented in the PR description
- [ ] Screenshot of the refreshed view (captured from the Lovable preview) attached to the PR
- [ ] Lovable preview URL for the branch linked in the PR description

---

## 7. Rollback

If anything is wrong **after merge**:

1. In Lovable → Project Settings → Environment, set `VITE_CUSTOMER_FILE_REFRESH=false` (or delete the var). Lovable rebuilds automatically (~1 min).
2. Users immediately see the legacy sheet. Zero data loss.

If a harder rollback is needed:

1. `git revert <merge commit> && git push origin main` — Lovable picks it up and redeploys the previous state.

If the Lovable preview looks bad **before merge**:

1. Don't merge the PR. `main` is untouched. Close the PR or keep iterating on the branch. Done.

---

## File map — touch list

**Edit in place:**
- `src/components/admin/SubmissionDetailSheet.tsx`

**New file:**
- `src/components/admin/SubmissionDetailSheet.legacy.tsx` (copy of the current `.tsx`, renamed export)

**Nothing else.**

---

## Questions to ask Ken before starting

1. Confirm the filename of the current customer-file sheet component.
2. Confirm the env var name `VITE_CUSTOMER_FILE_REFRESH` — or propose a better convention if the codebase already uses another pattern.
3. If the sheet is composed of child components whose internals need restyling, flag each one before touching it.
4. Confirm which branch to base the work on (should be `main`, but confirm in case Lovable has been auto-committing to a different branch).
