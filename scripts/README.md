# Screenshot tour

`screenshot-tour.ts` captures the HarteCash customer journey and admin panel as PNGs against any deployment. Useful for investor decks, marketing site lifts, visual regression spot-checks, and OEM screenshare prep.

## One-time setup

```bash
npm install                         # picks up playwright + tsx
npx playwright install chromium     # downloads the headless browser (~150MB)
cp .env.screenshot.example .env.screenshot
# edit .env.screenshot with your target URL + admin creds
```

`.env.screenshot` and `screenshots/` are git-ignored — credentials and captured PII stay local.

## Running

```bash
npm run screenshots
```

Output lands in `screenshots/<run-timestamp>/`:

```
screenshots/2026-05-13T18-30-00Z/
  INDEX.md
  01-public-home-desktop.png
  01-public-home-mobile.png
  ...
  20-admin-dealer-tenants-desktop.png
```

`INDEX.md` lists every file with the route it came from.

## Configuration knobs (`.env.screenshot`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `BASE_URL` | yes | — | `https://hartecash.com`, a Lovable preview URL, or `http://localhost:8080` |
| `ADMIN_EMAIL` | no | — | Skip admin tour if omitted |
| `ADMIN_PASSWORD` | no | — | Used by the standard `/auth` form, not a service-role key |
| `DEMO_TOKEN` | no | — | Submission token for `/portal/<token>` and `/offer/<token>` — see `DEMO_MODE.md` |
| `VIEWPORTS` | no | `both` | `desktop`, `mobile`, or `both` |

## What gets captured

**Public (always):** `/`, `/sell`, `/how-it-works`, `/about`, `/faq`, `/trade`, `/service`, `/group`, `/quick-offer`, `/docs`, `/updates`, `/privacy`, `/terms`

**Pitch + marketing (always):** `/pitch`, `/platform` — refresh investor-deck imagery whenever the pitch pages change

**Customer portal (when `DEMO_TOKEN` is set):** `/portal/<token>`, `/offer/<token>`, `/deal/<token>`, `/watch-my-car/<token>`

**Admin (when admin creds are set):** dashboard, pipeline, equity mining, voice AI, performance, reports, branding, pricing rules, integrations, staff, dealer tenants, audit log, executive, super-admin

**AutoCurb marketing landing (always):** captured separately by spoofing `window.location.hostname` to `autocurb.io` so the `isAutocurbHost()` check in `App.tsx` flips `RootLanding` from `Index` to `AutocurbLanding`.

Edit `PUBLIC_TOUR`, `PITCH_TOUR`, `PORTAL_TOUR`, `ADMIN_TOUR`, or `AUTOCURB_LANDING` in `scripts/screenshot-tour.ts` to add or remove routes.

## Troubleshooting

- **Login fails:** confirm credentials work in a regular browser at `<BASE_URL>/auth` first. The script targets `input[type="email"]` and `input[type="password"]` — if the form changes structurally, update the selectors in `loginAdmin()`.
- **Timeouts on production:** prod has more network chatter than localhost. The script falls back from `networkidle` to `domcontentloaded` automatically.
- **Mobile screenshots look identical to desktop:** the page may not implement a mobile breakpoint. Check the dev tools at the same viewport size.
- **Blank admin pages:** the admin requires a real user record in `user_roles`. A freshly-created auth user without a row in `user_roles` will land on `/admin` but render empty.

---

# MotoAcquire recon

`recon-motoacquire.ts` walks `sellyourcar.online` (or any creator/dealer subdomain) with Playwright and captures screenshots, form fields, and the network calls behind the valuation widget. Companion to `docs/motoacquire-competitive-response.md`.

## When to run

Quarterly, manually, **from your personal machine** — not from the Lovable build environment. The build environment's egress proxy 403s `sellyourcar.online` and `motoacquire.com`, so the script can't reach the target from there.

## One-time setup

```bash
npm install
npx playwright install chromium
cp .env.recon.example .env.recon
# edit .env.recon — TARGET_URL, plus a VIN or plate/state for a vehicle you own
```

## Running

```bash
npm run recon:motoacquire
```

Output lands in `recon/<run-timestamp>/`:

```
recon/2026-05-14T13-45-00Z/
  INDEX.md
  00-landing.png
  01-vehicle-identifier.png
  02-vehicle-details.png
  03-valuation.png
  04-firm-offer-prompt.png
  network.json     — every XHR/fetch the page made
  fields.json      — visible form fields per step
  valuation.json   — best-guess valuation API response (if found)
```

`.env.recon` and `recon/` are git-ignored.

## Ethics / scope

- One vehicle per run. The script does not loop, does not submit contact info, does not opt into nurture emails.
- Their ToS almost certainly prohibits automated access. Treat this as a one-off competitive walkthrough, not a continuous scraper. Run it ~quarterly.
- Do not republish their copy or screenshots. The output is input to our positioning, not marketing material.
