# MotoAcquire — captures

Drop images, screen recordings, and reference files here. The plan is to study them and build our own landing page + consumer flow that beats theirs.

## Suggested layout

```
competition/motoacquire/
  landing/          — sellyourcar.online + motoacquire.com marketing screenshots
  flow/             — step-by-step screenshots of the consumer offer flow
  emails/           — value-tracking emails (the monthly Zillow-for-cars cadence)
  creator/          — examples of co-branded creator landing pages
  notes.md          — your running observations as you collect
```

## What to capture (priority order)

1. **The landing page above the fold** — desktop + mobile. Their hero, their CTA copy, their valuation form layout, their social proof.
2. **The first form step** — VIN vs plate vs year/make/model. Note which is the default and what's required.
3. **Every subsequent step** — one screenshot per screen, until they ask for contact info.
4. **The instant range screen** — how they present the low/high number, what disclaimers they show, the upgrade-to-firm-offer CTA.
5. **The firm-offer condition flow** — every question they ask (condition, tires, accidents, modifications, etc.) and how they ask it (slider, radio, dropdown).
6. **The "save my offer / email it to me" screen** — exactly what fields, exactly what consent language.
7. **The post-submission emails** — sign up with a clean throwaway address; capture the welcome email and 1–2 monthly value-tracking emails.
8. **A creator landing page** — if you can find one (search YouTube/IG bios of automotive creators for `sellyourcar.online/<slug>` links). This is their differentiator.

## What to do with what you drop

When the folder has enough material, ping me and I'll:

1. Catalog the flow into a step-by-step spec in `notes.md`.
2. Diff their fields/copy against our `/sell` flow.
3. Draft a HarteCash landing page + flow that adopts what's good and beats what's weak (the dealer-y tells from `docs/sell-flow-design-audit.md` still apply).
4. Produce a side-by-side mockup before any code lands in `src/`.

## Reminders

- Don't include any real seller PII in screenshots — if you submit your own VIN, blur it.
- Don't republish their marketing copy verbatim in our landing page. Use it as a reference for *what to communicate*, not *how to phrase it*.
- See `docs/motoacquire-competitive-response.md` for the strategic context.
