# MotoAcquire — Competitive Response

*Compiled May 2026. Companion to `HARTECASH_INVESTOR_BRIEF.md`. Source notes
at the bottom of the file.*

> **Method.** `sellyourcar.online`, `motoacquire.com`, and `motoacquireapp.com`
> all 403 against headless fetch from our build environment, so this profile
> is reconstructed from MotoAcquire's LinkedIn posts, the LVL UP Auto /
> DealerRefresh "Super Review" interview, founder social, and the company's
> own marketing copy surfaced via search. Where a fact comes from a single
> source it is flagged with `[†]`.

---

## 1. Who they are

- **Brand.** MOTO(acquire), stylized lowercase. Consumer-facing surface lives
  on `sellyourcar.online`; dealer marketing lives on `motoacquire.com`; the
  app at `motoacquireapp.com`.
- **Founder / CEO.** Mike Crothers (co-founder). Indianapolis-area, on
  Instagram as `@motoacquiremike`.
- **Funding.** Bootstrapped. No venture capital raised `[†]` (Crothers, LVL
  UP Auto interview).
- **Distribution.** Heavy content-marketing partnership with LVL UP Auto and
  DealerRefresh — "Super Review" series with Jordan Cox. Claims hockey-stick
  growth (vendor-reported).
- **Disclosed customer.** Porsche Detroit North (single public testimonial).

## 2. Product surface

### Consumer flow (`sellyourcar.online`)

1. **Instant valuation range** — year/make/model + zip → range in seconds.
   Valuation engine is pluggable: KBB and Black Book ship by default; dealer
   can plug in proprietary data. "More providers being onboarded."
2. **Firm offer upgrade** — condition Q&A → hard number.
3. **Monthly value-tracking emails** — auto opt-in. "Zillow-for-your-car":
   up / flat / down. This is their retention play.
4. **Creator marketplaces** — co-branded landing pages for automotive
   YouTubers / TikTokers / IG creators. Their audience submits valuations;
   leads route to the local dealer in that creator's network.

### Dealer flow

Lead capture + nurture. **No public evidence** of photo workflow, document
OCR, appointment scheduling, inspection, manager appraisal, check-request
generation, or DMS write-back. They appear to stop where TradePending
stops — at "lead delivered."

## 3. Where they slot in the HarteCash competitive table

Insert into the table in `HARTECASH_INVESTOR_BRIEF.md` §2:

| Competitor | What They Do | Monthly Cost | Key Weakness |
|---|---|---|---|
| **MotoAcquire** | Trade-in widget + monthly value-tracking emails + influencer "creator marketplaces" for lead-gen | Undisclosed (private pricing page) | Stops at lead capture — no photo/doc/appointment/inspection/check-request pipeline. Bootstrapped → no enterprise integration team. Single disclosed customer. |

They are positionally closest to **TradePending** in the existing table, but
add two mechanics TradePending lacks.

## 4. The two genuine threats

Everything else about MotoAcquire is widget parity we already beat. The two
mechanics that are net-new and worth a deliberate response:

### Threat A — Monthly value-tracking emails

The retention surface. A seller who isn't ready today gets a monthly nudge
showing what their car is worth, with the dealer's brand on it. By the time
intent flips, MotoAcquire owns the relationship.

**HarteCash gap.** Our "Watch My Car" portal (`/watch-my-car/<token>`)
exists, but it's pull-only — the seller has to remember to come back.
There's no automated outbound to revive a cold lead.

**Counter-move.** Promote watch-my-car from a portal page to a recurring
email program:

- New `watch_my_car_subscriptions` table keyed on submission_id + email.
  Auto-enroll on every offer where the customer didn't accept within 7d.
- Monthly cron (Resend or SendGrid) sends a dealer-branded email with:
  - Current estimated value (recomputed against the same valuation engine
    the original offer used)
  - Delta vs. last month, with up/down arrow
  - "Refresh my offer" CTA back into the existing offer flow
  - Unsubscribe + portal link
- Owner: pipeline team. Effort estimate: ~2 weeks for table + cron + email
  template + admin toggle. Reuse the existing offer-engine for the recompute.
- KPI: revival rate — % of "cold" sellers (>30d since offer, no acceptance)
  who re-engage. Target: match MotoAcquire's claimed engagement (they
  haven't disclosed numbers, but anchor against Zillow's owner-dashboard
  open rates of ~25%).

### Threat B — Creator marketplaces

The acquisition surface. Automotive YouTubers / TikTokers / IG creators with
seven-figure audiences get a co-branded `sellyourcar.online/<creator>`
landing page. Their fans submit cars; leads route to participating dealers.

This is genuinely novel. None of TradePending, KBB ICO, AccuTrade, or
Carvana does it.

**HarteCash gap.** We have multi-tenant dealer branding but no creator-tier
template, no influencer-specific revenue share, no creator dashboard.

**Counter-move — two-phase.**

- *Phase 1 (defensive, 4 weeks).* Stand up `creator_partners` as a new
  tenant type alongside `dealer_tenants`. A creator partner is essentially
  a thin tenant whose offers route to one or more partnered dealers based
  on the seller's zip. Reuse the existing branding system for logo / colors
  / domain mapping. Build a `/creator/<slug>` landing route. **Effort:**
  ~3 weeks if we lift the dealer-tenant model verbatim.
- *Phase 2 (offensive, 8–12 weeks).* Build a creator dashboard: leads
  generated, fan-vehicle-list, revenue share, embeddable widget for their
  own site. Pay creators per-acquired-vehicle, not per-lead — flips the
  incentive from spam to quality and is the opposite of MotoAcquire's
  per-lead structure `[†]` (their model not publicly disclosed; assumed
  per-lead based on widget-vendor norms).

This is the bigger investment. Worth pursuing only if Phase 1 shows lead
volume from even a single mid-size creator (say, ~50k subs).

## 5. What we should NOT copy

- **Stylized lowercase "MOTO(acquire)" branding.** It looks startup-y. Our
  positioning is enterprise-grade dealer software; HarteCash should look
  closer to Cox Automotive than to a SaaS landing page.
- **"Influencer marketplace" as primary marketing copy.** Use the *channel*,
  don't lean on the *phrase*. Franchise dealers in particular respond
  poorly to creator-economy language. Internal feature; external
  positioning stays "dealer acquisition platform."
- **Bootstrap-only operating model.** MotoAcquire's lack of an enterprise
  integration team is their biggest weakness vs HarteCash. We should lean
  into vAuto / DealerSocket / Reynolds integrations as the moat that
  bootstrap competitors structurally can't match.

## 6. Reconnaissance plan

The continuing watch on MotoAcquire that is worth running:

1. **Manual seller walkthrough** of one of their creator subdomains every
   quarter. ~20 minutes. See `scripts/recon-motoacquire.ts` for the
   automation. Captures form fields, network calls, the firm-offer logic,
   and the value-tracking email cadence.
2. **Track Crothers on LinkedIn / IG.** He announces customer wins and
   feature launches there before the marketing site catches up.
3. **DealerRefresh thread on MotoAcquire** — subscribe. Dealers post real
   complaints there; will surface ToS / contract / pricing details that
   their marketing won't.
4. **Domain enumeration.** Whenever we hear of a new creator partnership,
   check whether they have a dedicated subdomain on `sellyourcar.online`.
   `sitemap.xml` likely lists them.
5. **Pricing.** Their `/pricing` page exists but content isn't crawled
   by Google. A single manual visit per quarter is enough.

## 7. Decision points for the next investor update

- Are we authorizing the watch-my-car email program? (~2 weeks, low cost,
  defensive.)
- Are we committing to the creator-tier tenant model? (Phase 1 is cheap,
  Phase 2 is a real product bet.)
- Do we want to add MotoAcquire to the competitive table in the live
  investor brief, or keep it in this companion doc for now? (Recommend:
  add to the table once we have a clearer read on their dealer count —
  right now Porsche Detroit North is the only one we can name.)

---

## Sources

- MotoAcquire site: `https://www.motoacquire.com/`
- Consumer surface: `https://sellyourcar.online/`
- App domain: `https://www.motoacquireapp.com/`
- LVL UP Auto Super Review (Crothers interview):
  `https://www.lvlupauto.com/super-reviews/motoacquire`
- DealerRefresh thread: `https://forum.dealerrefresh.com/threads/super-review-motoacquire.10976/`
- Mike Crothers LinkedIn: `https://www.linkedin.com/in/mike-crothers-6070a52b/`
- MOTO(acquire) LinkedIn company page: `https://www.linkedin.com/company/motoacquire`
- "How MotoAcquire Connects Creators and Dealers" — YouTube: `https://www.youtube.com/watch?v=hjf_d-ynsAY`
