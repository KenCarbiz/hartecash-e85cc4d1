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

**Public (always):** `/`, `/sell`, `/how-it-works`, `/about`, `/faq`

**Customer portal (when `DEMO_TOKEN` is set):** `/portal/<token>`, `/offer/<token>`

**Admin (when admin creds are set):** dashboard, pipeline, equity mining, voice AI, performance, reports, branding, pricing rules, integrations, staff, dealer tenants, audit log.

Edit `PUBLIC_TOUR`, `PORTAL_TOUR`, or `ADMIN_TOUR` in `scripts/screenshot-tour.ts` to add or remove routes.

## Troubleshooting

- **Login fails:** confirm credentials work in a regular browser at `<BASE_URL>/auth` first. The script targets `input[type="email"]` and `input[type="password"]` — if the form changes structurally, update the selectors in `loginAdmin()`.
- **Timeouts on production:** prod has more network chatter than localhost. The script falls back from `networkidle` to `domcontentloaded` automatically.
- **Mobile screenshots look identical to desktop:** the page may not implement a mobile breakpoint. Check the dev tools at the same viewport size.
- **Blank admin pages:** the admin requires a real user record in `user_roles`. A freshly-created auth user without a row in `user_roles` will land on `/admin` but render empty.
