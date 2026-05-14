# Competitive research drop folder

Each competitor gets a subfolder. Drop raw artifacts here — screenshots, page exports, screen recordings, vendor PDFs, pricing sheets, anything you want HarteCash to be able to react to.

## Conventions

- One subfolder per competitor (lowercase, no spaces): `motoacquire/`, `tradepending/`, `accutrade/`, etc.
- Inside each subfolder, group by capture type:
  ```
  competition/<vendor>/
    landing/          — screenshots of their marketing site
    flow/             — screenshots/recordings of the consumer flow
    emails/           — value-tracking / nurture emails received as a fake seller
    pricing/          — pricing sheets, contract terms
    notes.md          — running notes, observations
  ```
- File names should be sortable: `01-landing-desktop.png`, `02-vin-entry.png`, `03-condition-q1.png`, etc.
- Don't commit anything that identifies a real person or real customer.

## Why it lives in the repo

So we can reference specific screenshots from `docs/<vendor>-competitive-response.md` and from PR descriptions when shipping counter-features. Keeping it in git also gives us a dated record of how their UX has shifted over time.

## Current folders

- `motoacquire/` — see `docs/motoacquire-competitive-response.md` for the strategic write-up.
