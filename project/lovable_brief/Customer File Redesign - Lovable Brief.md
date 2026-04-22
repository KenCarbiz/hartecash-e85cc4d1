# Customer File Redesign — Lovable Brief

**For:** Lovable AI working on the `hartecash-e85cc4d1` project.
**From:** Ken (owner). This is the single source of truth — follow it exactly.
**Goal:** Refresh the visual design of ONE component. No database changes, no routing changes, no auth changes.

---

## 🚨 GROUND RULES — READ FIRST

1. **Work on a new branch, not `main`.** Create a branch called `customer-file-refresh` off `main` and make all commits there. Do NOT commit directly to `main`. Open a Draft PR from `customer-file-refresh` → `main` so I can review before merging.
2. **Change ONE component.** `src/components/admin/SubmissionDetailSheet.tsx` (+ a `.legacy.tsx` sibling copy). Nothing else.
3. **No database migrations.** No new columns. No schema changes. If you think you need one, STOP and ask me.
4. **No new dependencies.** No new npm packages.
5. **No refactoring unrelated code.** No "while I'm here" cleanups.
6. **Feature-flagged so I can roll back in 1 minute.** See §4 below.
7. **If you're unsure about anything, ASK before coding.**

---

## What this change is

The **customer file detail sheet** — the big slide-out panel that opens when a manager clicks the 🔍 eye icon on a row in the pipeline — gets a visual refresh. Same data, same tabs, same behavior. Just a calmer, cleaner look.

**Component:** `src/components/admin/SubmissionDetailSheet.tsx`
- 2,272 lines, default export, lazy-loaded from `AdminDashboard.tsx`
- Opens via `SubmissionsTable.tsx:587 → onView(sub)`
- Two-column layout: sticky LEFT (~40%) with deal money/status/actions, scrollable RIGHT (~60%) with 16 stacked `<SectionCard>` sections
- `<SectionCard>` is defined locally in the same file (~line 100) — fair game to restyle
- `BDCActionStrip`, `QuickSummary`, `DLAtAGlance`, `InspectionVitals`, `DetailRow` are also local to this file — fair game

---

## What changes (visual only)

### 1. Header band
Replace the current header with a blue gradient band.

- Background: `bg-gradient-to-r from-[#003b80] to-[#005bb5]`
- Text color: white
- Customer name: `font-display text-[28px]` (DM Serif Display — add Google Fonts import if not already present)
- Vehicle + VIN underneath: `text-sm text-white/80` in Inter
- Close button: `X` icon, top-right, `text-white/70 hover:text-white`
- Add `data-customer-header` attribute on the header div so future tweaks can target it

### 2. Section card wrapper — `<SectionCard>`
Restyle the OUTER chrome only. Do NOT change what's inside each card.

- Container: `rounded-xl bg-white border border-slate-200 p-5 space-y-3`
- Section label (top of each card): `text-xs font-semibold uppercase tracking-wider text-slate-500`
- Cards stack with `space-y-4` between them
- Keep the current flex / grid layout INSIDE each card exactly as it is today

### 3. Left sticky column (deal / money / status / actions)
Restyle the container chrome + typography.

- Container: `bg-white border-r border-slate-200 p-6`
- Status pills: use current colors but rounded-full with `text-xs font-semibold px-3 py-1`
- Money values: `font-semibold text-slate-900`, big ones `text-2xl`
- Subtle dividers `border-t border-slate-100` between sub-groups

### 4. Primary / secondary action buttons
- Primary: `bg-[#003b80] text-white h-10 px-5 rounded-lg font-semibold hover:bg-[#002a5c]`
- Secondary: `border border-slate-300 bg-white text-slate-700 h-10 px-5 rounded-lg font-medium hover:bg-slate-50`
- Danger: `bg-red-600 text-white` (only where already danger today)

### 5. Typography scale (applies everywhere in the sheet)
- Page title: `font-display text-[28px] text-slate-900`
- Section labels: `text-xs font-semibold uppercase tracking-wider text-slate-500`
- Body: `text-sm text-slate-700`
- Values: `font-semibold text-slate-900`
- Tiny / hints: `text-xs text-slate-500`

### 6. Status banner (DEFER)
The mockup shows a red "Customer Arrived" banner below the header when `progress_status === 'arrived'`. The database doesn't have `arrived_at` / `on_the_way_at` columns yet, so **SKIP the banner in this PR**. Leave a code comment at the intended insertion point:

```tsx
{/* TODO(ui-refresh-arrived-banner): Wire up when submissions.arrived_at
    and submissions.on_the_way_at columns exist. Will render a red
    banner below the header when progress_status === 'arrived'. */}
```

We'll wire that up in a separate PR with a proper DB migration.

---

## What STAYS THE SAME (do not touch)

- All 28 props on `SubmissionDetailSheet`
- The default export shape (must stay lazy-loadable from `AdminDashboard.tsx`)
- Every `useEffect`
- Every Supabase fetcher / mutator
- Every `onSubmit` / form handler
- The 16 sections' CONTENTS (fields, inputs, dropdowns, photo grids, conversation thread, document upload) — only the `<SectionCard>` wrapper changes
- External child components — do NOT restyle or pass new props to:
  - `Sheet` (shadcn)
  - `VehicleImage`
  - `StaffFileUpload`
  - `FollowUpPanel`
  - `RetailMarketPanel`
  - `HistoricalInsightPanel`
  - `EscalateToManagerDialog`
  - `DeclinedReasonDialog`
  - `SaveTheDealDialog`
  - `ConversationThread`
  - `QRCodeSVG`
  - `Tooltip`, `Select`, `Textarea`, `Input`, `Checkbox`, `Badge`, `Button`
- Permission gating (`canSetPrice`, `canApprove`, `canDelete`, etc.)
- The database schema (zero changes)
- Routing
- Any file other than `SubmissionDetailSheet.tsx` and its new `.legacy.tsx` sibling

---

## Step-by-step execution

### Step 1 — Branch
```bash
git checkout main
git pull
git checkout -b customer-file-refresh
```

### Step 2 — Safety copy (legacy fallback)
1. Copy `src/components/admin/SubmissionDetailSheet.tsx` to `src/components/admin/SubmissionDetailSheet.legacy.tsx`.
2. In the copy, rename the exported component from `SubmissionDetailSheet` to `SubmissionDetailSheetLegacy`. Keep every other line byte-identical.
3. Change the default export at the bottom to `export default SubmissionDetailSheetLegacy;`.
4. Add a named export too: `export { SubmissionDetailSheetLegacy };`.
5. Commit: `git commit -am "Legacy copy of SubmissionDetailSheet before UI refresh"`
6. **Open a Draft PR now** so I can see the branch exists and follow along.

### Step 3 — Feature flag scaffold
In `SubmissionDetailSheet.tsx`, add this near the top of the file, before the component definition:

```tsx
import { SubmissionDetailSheetLegacy } from "./SubmissionDetailSheet.legacy";

const ENABLE_REFRESH = import.meta.env.VITE_CUSTOMER_FILE_REFRESH === "true";
```

Then wrap the current default export so the flag can route between old and new:

```tsx
// OLD (end of file):
// export default SubmissionDetailSheet;

// NEW:
const SubmissionDetailSheet = (props) => {
  if (!ENABLE_REFRESH) return <SubmissionDetailSheetLegacy {...props} />;
  return <RefreshedSubmissionDetailSheet {...props} />;
};
export default SubmissionDetailSheet;
```

Rename the current component function from `SubmissionDetailSheet` (the 2,272-line one) to `RefreshedSubmissionDetailSheet`. This is ONLY a function rename — its props and behavior stay identical. The refresh will happen inside it.

Commit: `git commit -am "Add VITE_CUSTOMER_FILE_REFRESH flag; route to legacy by default"`

### Step 4 — Apply the visual refresh
Inside `RefreshedSubmissionDetailSheet`, apply the changes in §1–5 above:
- Restyle the header band
- Restyle the `<SectionCard>` wrapper (the local component in this file)
- Restyle the left sticky column container + typography
- Restyle action buttons
- Add the arrived-banner TODO comment at the appropriate insertion point below the header

Keep everything else byte-identical. Don't reorder sections. Don't rename fields. Don't touch effects.

Commit: `git commit -am "Customer file refresh — header, section cards, buttons, typography"`

### Step 5 — Verify
- `git diff main...customer-file-refresh --stat` should show changes to exactly TWO files: `SubmissionDetailSheet.tsx` and the new `SubmissionDetailSheet.legacy.tsx`.
- No migrations. No new dependencies. No other file changes.

### Step 6 — Move PR out of Draft
Move the Draft PR to "Ready for review" and ping me. Include in the PR description:
- A screenshot of the refreshed view (from the Lovable preview of this branch)
- A link to the Lovable preview URL
- The env var name: `VITE_CUSTOMER_FILE_REFRESH`

---

## Testing (do this before moving PR out of Draft)

With `VITE_CUSTOMER_FILE_REFRESH` **unset** or `false` (the default):
- [ ] Click 🔍 on any pipeline lead → sheet opens and looks IDENTICAL to production today
- [ ] All 16 sections render
- [ ] All save/submit buttons still work
- [ ] Permissions still work (try as admin, manager, BDC, etc.)
- [ ] No console errors

With `VITE_CUSTOMER_FILE_REFRESH=true`:
- [ ] Click 🔍 → refreshed sheet opens, header is blue gradient with serif customer name
- [ ] All 16 sections render inside restyled cards
- [ ] All fields in all sections still read/write correctly
- [ ] All save/submit buttons still work
- [ ] Closing (X, Escape, click outside) still works
- [ ] Switching to a different lead still works
- [ ] Permissions still gate correctly
- [ ] No console errors
- [ ] Mobile / narrow viewport scrolls cleanly

---

## Rollback plan

If anything is wrong after merge:

1. Go to Lovable → Project Settings → Environment
2. Set `VITE_CUSTOMER_FILE_REFRESH=false` (or delete the var entirely)
3. Lovable rebuilds automatically (~1 min)
4. Users immediately see the legacy sheet. Zero data loss because no DB changes were made.

If a deeper rollback is needed:
- `git revert <merge-commit> && git push origin main`

If the branch preview looks bad before merge:
- Don't merge. `main` is untouched. Close or iterate on the PR.

---

## Final checklist before asking me to merge

- [ ] Branch `customer-file-refresh` exists, pushed to origin
- [ ] Only TWO files changed: `SubmissionDetailSheet.tsx` + new `.legacy.tsx`
- [ ] Zero database migration files
- [ ] Zero new dependencies
- [ ] Feature flag is OFF by default
- [ ] Legacy export still works when flag is off (verified in Lovable preview)
- [ ] Refreshed view matches the visual target (verified in Lovable preview)
- [ ] PR description has screenshot + preview URL + env var name
- [ ] No console errors in either state

---

## Visual target

See attached screenshots:
- `02-file-open.png` — standard refreshed sheet
- `03-file-arrived.png` — with the arrived banner (deferred in this PR, just for visual reference)

The full interactive reference is the `Customer File Redesign.html` mockup — open it in a browser to see animations and the live Tweaks panel.

---

## Questions to ask me before starting

1. Confirm the env var name `VITE_CUSTOMER_FILE_REFRESH` works for our Lovable setup, or propose an alternative if needed.
2. If any external child component visibly clashes with the new header/cards, flag it and ask before restyling it — I may prefer to accept a visual seam for this PR rather than expanding scope.
3. If the DM Serif Display font isn't already in the project, confirm whether to add it via Google Fonts import in `index.html` or via Tailwind config.

When you're ready, start with Step 1 (branch creation) and Step 2 (legacy copy + Draft PR) — stop there and wait for me to confirm before moving to Step 3.
