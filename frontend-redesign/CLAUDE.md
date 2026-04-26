# Autocurb Admin Refresh — Project Guide for Claude (Code & Web)

This project is the **design source of truth** for the Autocurb admin refresh.
The implementation lives in repo `KenCarbiz/hartecash-e85cc4d1` (branch `main`).

**The authoritative implementation brief is `handoff/CLAUDE_CODE_BRIEF.md`.** Read it first.
This file is the project-level companion: pointers, conventions, and what changed
in the latest design pass that the brief doesn't yet cover.

---

## Files that matter

| Path | Purpose |
|---|---|
| `Admin Refresh.html` | **Approved** end-to-end admin prototype. Single file, embedded JSX. |
| `Customer Check-In.html` | **Approved** mobile self-check-in screen. |
| `Customer File Redesign.html` | Customer file slide-out (V2). Approved separately. |
| `handoff/CLAUDE_CODE_BRIEF.md` | The implementation brief. Section IDs, role gates, kill-switch, migration. |
| `handoff/screenshots/` | Reference screenshots called out by the brief. |
| `archive/` | Older / superseded prototypes — do not edit, do not reference. |

When iterating on UI, edit `Admin Refresh.html` directly. Don't fork copies — use
Tweaks for variations or a new `<DCArtboard>` if you need side-by-side comparison.

---

## Section-key map (prototype ⇄ production)

The prototype's sidebar `id`s have been **renamed to match production keys 1:1**
so Claude Code can wire them straight through `AdminSectionRenderer.tsx` without
a translation layer. Every id in `Admin Refresh.html → sidebarForRole()` already
matches a key in `src/components/admin/AdminSidebar.tsx`.

### Existing keys (map straight through)
```
today                     submissions               accepted-appts
bdc-queue                 appraiser-queue           inspection-checkin
service-quick-entry       image-inventory           equity-mining
voice-ai                  wholesale-marketplace     executive
gm-hud                    reports                   compliance
appearance                site-config               locations
offer-settings            form-config               inspection-config
my-lead-link              my-referrals              tenants
pricing-model             platform-billing
```

### NEW section keys (don't exist yet — add to AdminSectionRenderer)
| Key | Where | Notes |
|---|---|---|
| `channels` | Setup · Dealer | New consolidated page combining notification + comm-channel config. See "Channels page" below. |
| `killswitch` | Platform (super_admin only) | Tenant-by-tenant `ui_refresh_enabled` toggle UI. Brief §6. |

Do **not** invent new keys. If a section needs a new key, add it here first.

---

## Roles in the prototype

`ROLES` in `Admin Refresh.html` mirrors the production roles. Production role
names from `adminConstants.ts` are the source of truth — the prototype labels
are display strings only:

| Prototype key | Production check |
|---|---|
| `super_admin` | `canManageAccess && dealership_id === 'default'` |
| `admin` | `canManageAccess` |
| `gsm_gm` / `owner` / `sales_director` | `isManagerRole(userRole)` |
| `used_car_mgr` / `sales_mgr_appraiser` | `isAppraiser` and/or manager |
| `bdc` | `userRole === 'sales_bdc'` |
| `appraiser` | `isAppraiser === true` |
| `receptionist` | `userRole === 'receptionist'` |

The role switcher in the header is gated to `role === 'super_admin'` only.
In production, that means **only Ken (`ken@ken.cc`)** sees it. Don't expose
the switcher to anyone else.

---

## Channels page (new)

A new admin section consolidating what's currently scattered between
`Notifications`, `email config`, `SMS templates`, and outbound channel setup.
Single page with three tabs:

1. **Inbound** — sources of leads (form embeds, web chat, phone numbers, vAuto).
2. **Outbound** — staff-facing notifications (push, email digest, Slack).
3. **Customer** — customer-facing notifications (SMS templates, email templates,
   "I'm here" / "On my way" routing).

Wire this as `key: "channels"` in the Setup · Dealer group, admin-only.
Lives at `src/components/admin/ChannelsConfig.tsx` — new file. Pull existing
notification/email/SMS subcomponents into it; do not duplicate them.

---

## Recent design changes (since the brief was written)

These are real edits already shipped to `Admin Refresh.html` that the brief
hasn't been amended for. Treat them as additive requirements.

1. **Push-permission help modal.** When push is `denied`, the bell icon opens
   an inline modal (not `alert()`) with the unblock instructions. Pattern: small
   centered modal, dismiss on backdrop click or "Got it" button.
   Match this pattern for any future "system told us no" message — never `alert()`.

2. **Role switcher visibility.** The `<select>` in the header is rendered only
   when `role === 'super_admin'`. The legacy header path (`role-switcher` in
   `AdminHeader.tsx`) must also be gated to `canManageAccess && dealership_id === 'default'`.

3. **Ken display name.** When `userName === 'Super Admin'`, render as `Ken` in
   the avatar tooltip / header dropdown. Production should map super-admin
   identity through `auth.users.email === 'ken@ken.cc'` and surface "Ken" the
   same way.

4. **Dark mode.** Default to `prefers-color-scheme`, persist to
   `localStorage('admin-dark-mode')`, toggle via header icon **and** `⌘⇧D`.
   Tweaks panel exposes the same toggle. All refreshed components must respect
   the `dark` class on `<html>`.

---

## Conventions

- **Section keys:** lowercase, kebab-case, identical between prototype and prod.
- **Modals:** never `alert()` / `confirm()` / `prompt()`. Always inline modals
  using the pattern in the push-help modal.
- **Toasts:** use the existing `useToast` from `@/components/ui/toaster`. Don't
  introduce a new toast system.
- **Colors:** use the `--refresh-*` tokens listed in the brief. No new hex
  values in component code.
- **Icons:** lucide-react in production. Prototype uses inline SVG for
  portability; map 1:1 to lucide names when implementing.

---

## Out of scope reminders

- Don't touch `SubmissionDetailSheet.tsx` or `CustomerFileV2.tsx` (the customer
  file slide-out was its own handoff; that work is complete).
- Don't refactor `AppraisalTool`, `InspectionSheet`, `OfferPage`, or
  `DealAccepted` — customer-facing flows.
- Don't rename routes. The brief lists every legal touch.

---

## When you're stuck

If the brief and this file disagree, the brief wins.
If both are silent, **stop and ask Ken** — don't guess at section semantics,
role gates, or DB schema.
