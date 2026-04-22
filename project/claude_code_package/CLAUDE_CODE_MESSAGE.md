# Message to paste into Claude Code (web)

Copy everything below the line into Claude Code. It's written as if you're talking to it directly. Attach the three files listed at the top when you send it.

---

Hi Claude Code. I want you to redesign the **Customer Detail / Customer File** page in my repo to match the new design I'm attaching. Please do this carefully and in a single PR so I can review before merging.

## Files I'm attaching

1. `CLAUDE_CODE_BRIEF.md` — full spec (layout, components, spacing, colors, states)
2. `01-pipeline.png` — pipeline table (context, unchanged)
3. `02-file-open.png` — screenshot of the new design (default state)
4. `03-file-arrived.png` — screenshot with the "Customer Arrived" banner visible

These come from `handoff_customer_file/` in my AutoCurb design project. Treat the screenshots as the source of truth for visual look; treat the brief as the source of truth for behavior, states, and naming.

## What I want you to do

1. **Find the existing customer detail / customer file component** in my repo. It's probably named something like `CustomerDetail`, `CustomerFile`, `CustomerSheet`, `CustomerDrawer`, or lives under a `customers/` or `pipeline/` folder. Look for the page/component that opens when you click a customer row in the pipeline. **Show me the file path before editing** so I can confirm you found the right one.

2. **Redesign that component** to match the new design in the screenshots and brief. Keep the existing data model, props, API calls, routing, and state management — only change the UI/layout/styling. Do not rename exported components or break imports.

3. **Reuse components from my existing UI library** (shadcn/ui, Tailwind, whatever is already in the repo) rather than introducing new dependencies. If the brief mentions a component I don't already have, build it with my existing primitives.

4. **Preserve all existing functionality.** Every action, button, field, and data binding that works today must still work. If you're unsure whether something in the old design should carry over, ask me before removing it.

5. **Put everything on a new branch** called `redesign/customer-file` and open a **draft PR** against my default branch. Include in the PR description:
   - The file(s) you changed
   - Anything from the old UI you removed and why
   - Anything from the brief you couldn't implement and why
   - Screenshots of the new component running locally if you can

6. **Do not touch** the pipeline list, admin shell, sidebar, check-in flow, or anything outside the customer detail component. Scope is just the customer file view.

## Ground rules

- If the brief and the current code conflict on a behavior (not a visual), **ask me** — don't guess.
- If you can't find the component after a reasonable search, **stop and ask me where it lives** rather than creating a new one.
- Match Tailwind class patterns already used in the repo. Don't introduce inline styles or a new styling system.
- Keep the commit history clean: one commit per logical change, good messages.

When the PR is up, reply with the branch name and PR link. Thanks!
