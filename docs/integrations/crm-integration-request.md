# Integration Request — Dealer CRM

**Send a copy of this letter to each of the CRMs you use:**
- **VinSolutions** (Cox Automotive) — partner.integrations@coxautoinc.com
- **DealerSocket / Solera** — partnerintegrations@dealersocket.com
- **Elead / CDK** — integrations@cdk.com

---

**To:** [CRM Name] Integration / Partnership Team
**From:** [Dealer Principal Name], [Dealer Group]
**Subject:** Bidirectional API integration with Hartecash vehicle acquisition platform
**Date:** [DD Month YYYY]

---

## Who we are

Hartecash is the vehicle acquisition platform we use to source consumer trade-ins and direct-buy units from our service drive, our website, and the showroom floor. It runs alongside [CRM Name] as the appraisal-and-offer layer.

We are formally requesting a **bidirectional API integration between [CRM Name] and Hartecash** so that (a) Hartecash can identify our existing customers who are in an equity position and trigger a personalized offer to them, and (b) every new consumer that submits a vehicle to Hartecash lands in [CRM Name] as a fully-formed lead.

---

## What we need to PULL from [CRM Name] into Hartecash

For every customer in our [CRM Name] database, read-only access to:

### Contact identity
- Full name, email, phone(s), mailing address
- Communication consent flags (SMS opt-in, email opt-in, call opt-out)
- Preferred channel and language

### Deal history (current and prior)
- VIN, year, make, model, trim, current mileage estimate
- Deal type — **cash, finance, lease**
- Purchase / delivery date
- Selling price (gross + net)
- F&I products attached (warranty, GAP, etc.)

### Finance terms (where deal type = finance)
- Lender name
- Term length (months)
- APR
- Monthly payment
- Original amount financed
- Estimated current payoff (real-time if available, last-known otherwise)
- Maturity date

### Lease terms (where deal type = lease)
- Lessor name
- Residual value
- Money factor
- Allowed miles / current mileage estimate
- Lease maturity date
- Estimated lease-end disposition fee

### Equity / opportunity flags
- "Hot equity" flag if [CRM Name] computes one
- "Lease-end approaching" flag (within 90/60/30 days)
- "Negative equity warning" flag

### Service history (where attached to the customer record)
- Last service date and mileage
- Open recalls

---

## Why we need this

Hartecash uses this data to identify customers who are sitting in an **equity position** — where the current market value of their vehicle exceeds their payoff — and triggers a one-click personalized offer to them at the moment they're most reachable (service-lane visit, lease-end window, payment-shock window).

This is the only reliable way to **catch our existing customers before they drift to CarMax, Carvana, or AutoNation USA**. Without CRM data flowing into Hartecash, our acquisition platform is blind to anyone who isn't actively on our website that day.

---

## What we need to PUSH from Hartecash into [CRM Name]

Every time a consumer submits a vehicle on our Hartecash landing page, push the lead into [CRM Name] as:

- **Lead source:** "Hartecash — Direct Buy" (or a custom source label you provide)
- **Customer contact info:** name, email, phone, ZIP
- **Vehicle interested in selling:** VIN if collected, otherwise year/make/model + mileage
- **Estimated offer range** and **firm offer** if reached
- **Submission deep-link** so the BDC can re-open the customer's Hartecash file in one click
- **Status updates** when the customer accepts, declines, or schedules pickup

This way the BDC keeps a single source of truth, follow-ups don't fall through the cracks, and Hartecash submissions count toward the CRM's standard lead-aging reports.

---

## Technical requirements

- API credentials with **Customer Read**, **Deal Read**, **Lead Write**, and **Activity Write** scopes
- **Webhook subscription** on customer record changes (new payoff, new lease end date, new service appointment)
- **Per-rooftop / per-store ID mapping** — we operate [N] rooftops
- **OAuth 2.0** preferred; API key acceptable
- **Sandbox / test environment** for the integration build-out
- **Data residency / PII handling documentation** so we can hand it to our compliance team

---

## Business case

- Industry benchmarks show that **a customer with $3K+ in positive equity is 4–6x more likely to repurchase from the originating dealer** when the equity is surfaced to them proactively — versus drifting to a competitor when it isn't.
- Across our [N] rooftops, we estimate ~[X]K customers in our [CRM Name] database are in an equity window at any given time. Even a 1% incremental capture rate represents [Y] additional units acquired and resold per month, at an average gross of $[Z].
- A bidirectional integration means **every Hartecash submission stays inside [CRM Name]'s workflow** — your reporting, your follow-up cadences, your BDC scripts continue to govern the deal. We don't bypass the CRM; we enrich it.

---

## Next step

We'd like to schedule a 30-minute technical scoping call between [CRM Name]'s integration team and Hartecash's engineering lead in the next ten business days.

**Dealer technical contact:** [Name, Email, Phone]
**Hartecash technical contact:** [Name, Email, Phone]

Thank you,

[Dealer Principal Name]
[Dealer Group]
[Phone] · [Email]
