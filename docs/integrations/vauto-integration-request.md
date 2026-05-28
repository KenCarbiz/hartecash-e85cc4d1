# Integration Request — vAuto

**To:** vAuto Integration / Partnership Team
**From:** [Dealer Principal Name], [Dealer Group]
**Subject:** Bidirectional API integration with Hartecash vehicle acquisition platform
**Date:** [DD Month YYYY]

---

## Who we are

Hartecash is the vehicle acquisition platform we use to source consumer trade-ins and off-the-street direct-buy vehicles. It powers the "Sell Your Car" funnel on our dealer websites, the offer flow our managers use on the showroom floor, and the appraiser tools in our buy-center.

We are formally requesting a **bidirectional API integration between vAuto and Hartecash** so that the units we acquire through Hartecash flow into vAuto inventory without re-keying, and so our Hartecash appraisers can see vAuto's real-time market data while making offers.

---

## What we need to push FROM Hartecash TO vAuto

Every time a customer accepts an offer on Hartecash, we want the vehicle to land in vAuto's stock-in queue automatically:

- **Vehicle identification** — VIN, year, make, model, trim, body, drivetrain, exterior color, interior color
- **Condition** — odometer, condition grade (1–5), declared accident history, drivable yes/no
- **Photos** — full set, in vAuto's required aspect ratio
- **Financial** — acquisition price (what we paid the customer), payoff cleared, ACV captured at acceptance
- **Status events** — offer accepted, vehicle in-transit, vehicle received, title cleared, ready-for-recon, ready-for-front-line

The dealer's inventory team should see the unit appear in vAuto the moment the customer accepts — not 4 hours later after a clerk re-types it.

---

## What we need to pull FROM vAuto TO Hartecash

So the Hartecash appraiser sees what the front-line team sees:

- **Current inventory list** for the rooftop — VIN, status, days-on-lot, asking price
- **vAuto Provision appraisal value** for any VIN we ask about
- **Market days supply** for the vehicle's class + region
- **AutoCheck / vehicle history score**
- **Stocking guide** — segments / price bands the dealer is actively stocking vs. avoiding

This data lets our appraisers stop overpaying on units the dealer doesn't want, and bid more confidently on units the dealer is short on.

---

## Technical requirements

- API credentials with **Inventory Stock-In (write)**, **Inventory Read**, and **Appraisal Read** scopes
- **Webhook subscription** for inventory status changes (so Hartecash sees when a unit we stocked-in gets repriced, sold, or wholesaled)
- **Per-rooftop API keys** — we operate [N] rooftops and they need to be addressable separately
- **OAuth 2.0** preferred; per-call API key acceptable
- **Sandbox / staging environment** for our team to test against before production cutover

---

## Business case

- Our [N] rooftops source roughly [X] off-street vehicles per month through Hartecash. Manual re-keying into vAuto costs each lot tech ~2 hours/day and introduces stock-in errors that delay front-line readiness by 1–3 days.
- Eliminating that re-key step alone is worth ~$[X]K/year in lot-tech time across the group.
- vAuto market data flowing back into the Hartecash appraisal screen is expected to lift our average bid accuracy and acquisition capture rate by [X]%, which in turn keeps more inventory turning through vAuto — a direct retention argument for our vAuto subscription.

---

## Next step

We'd like to schedule a 30-minute technical scoping call between vAuto's integration team and Hartecash's engineering lead. Please reply with two or three slots that work in the next ten business days, or introduce us to the right partnership contact.

**Dealer technical contact:** [Name, Email, Phone]
**Hartecash technical contact:** [Name, Email, Phone]

Thank you,

[Dealer Principal Name]
[Dealer Group]
[Phone] · [Email]
