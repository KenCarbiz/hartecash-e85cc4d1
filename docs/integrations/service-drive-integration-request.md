# Integration Request — Service Drive / Service Lane Platform

**Send a copy of this letter to each of the service-drive platforms we use or want to integrate with:**

1. **Xtime** (Cox Automotive) — integrations@xtime.com
2. **Dealer-FX / Snap-on Business Solutions** — partner-api@dealer-fx.com
3. **MyKaarma** — integrations@mykaarma.com
4. **AutoPoint / Solera** — partnerships@autopoint.com
5. **Tekion Service** (or **CDK Service**, **Reynolds ServiceWORKS**) — partners@tekion.com

---

**To:** [Service Platform] Integration / Partnership Team
**From:** [Dealer Principal Name], [Dealer Group]
**Subject:** Real-time event integration with Hartecash vehicle acquisition platform
**Date:** [DD Month YYYY]

---

## Who we are

Hartecash is the vehicle acquisition platform we use to source consumer trade-ins and direct-buy vehicles.

The **service lane is the single highest-converting source of off-street acquisitions for any franchise dealer** — the customer is already on-site, already trusts our brand, and is often unaware that their current vehicle is in a strong equity position. The window to surface that opportunity is the 90-second interval between vehicle drop-off and the customer walking to the waiting lounge.

We are formally requesting an event-driven integration between [Service Platform] and Hartecash so that we can hit that window every time, automatically.

---

## Events we need to subscribe to

Real-time webhooks (or polling fallback) for the following lifecycle events:

| Event | Why we need it |
|---|---|
| **Appointment created** | 24–72 hours of pre-visit lead time — send the customer a "want to see what your car's worth?" SMS before they show up |
| **Appointment updated / rescheduled** | Keep our offer freshness aligned with the actual visit date |
| **Appointment cancelled** | Pull the queued offer so we don't ping a no-show |
| **Customer arrived / checked in** | Trigger the advisor-tablet handoff — "show this offer to the customer at write-up" |
| **RO opened** | Lock the offer to this visit; flag for the used-car manager |
| **Vehicle mileage captured at write-up** | Re-price the offer with actual mileage, not estimated |
| **Recommended services presented** | If the repair quote exceeds [X]% of vehicle value, escalate the buy offer |
| **RO closed / customer-pay due** | Last-chance offer at cashier — "trade-in credit toward this bill?" |

---

## Data we need on each event

For every event above, the payload should include:

- **Customer identifier** matchable to our CRM / DMS (customer number, email, or phone)
- **Vehicle**: VIN, year, make, model, trim, current odometer
- **Appointment metadata**: scheduled date/time, actual arrival time, advisor name, service type (warranty / customer-pay / recall / internal)
- **Estimated completion / ETA**
- **RO number** (when applicable) so we can deep-link from Hartecash back into [Service Platform]
- **Customer wait status** — waiter / drop-off / loaner / shuttle

---

## What we'll PUSH back to [Service Platform]

- **"Vehicle is being acquired"** flag on the RO if the customer accepts a Hartecash offer at the service lane, so the advisor knows the car is being sold (not just repaired), and the parts/labor estimate doesn't get re-quoted unnecessarily.
- **Offer acceptance event** for the platform's reporting / dashboard so service-drive acquisition becomes a measurable KPI inside [Service Platform], not a parallel report.

---

## How we use the data

When an RO opens or an appointment is created, Hartecash cross-references the VIN against:

1. **Current market value** (BlackBook, KBB ICO, Manheim MMR)
2. **The customer's payoff or lease balance** (pulled from CRM integration — see companion CRM integration letter)
3. **The repair estimate** (from [Service Platform])

If the customer is in a strong equity position, or if the repair quote is uneconomical relative to vehicle value, we surface a one-click **"instant offer"** on the advisor's tablet. The advisor hands the customer an iPad with their personalized offer while the technician does the service.

Conversion rate on service-drive offers presented at write-up runs **4–8x higher than cold email or text outreach** — because the customer is already in front of us, in a vehicle-on-our-mind mindset, with the decision-fatigue lowered.

---

## Technical requirements

- API credentials with **Appointment Read**, **RO Read**, and **RO Annotation Write** scopes
- **Webhook subscription** for the events listed above (preferred), or REST polling endpoints (acceptable)
- **Per-rooftop store ID mapping** — we operate [N] rooftops
- **OAuth 2.0** preferred; API key acceptable
- **Sandbox / staging environment** for the integration build-out
- **Data dictionary** for the event payloads
- **Rate-limit and retry policy** documentation

---

## Business case

- Industry-average service-drive acquisition conversion is **0.5%–1.5%**. Hartecash dealers using real-time event triggers see **2%–6% conversion**.
- Our [N] rooftops process approximately **[X] service ROs per day**. At a conservative 2% conversion and an average acquisition gross of $2,800 per vehicle, the integration represents:
  - **~[Y] incremental acquisitions per month**
  - **~$[Z] in incremental gross profit per month, per rooftop**
  - **Direct retention argument for [Service Platform]** — dealer subscription value increases when service-drive acquisitions become a measurable, reportable KPI inside your dashboard.

---

## Next step

We'd like to schedule a 30-minute technical scoping call between [Service Platform]'s integration team and Hartecash's engineering lead in the next ten business days.

**Dealer technical contact:** [Name, Email, Phone]
**Hartecash technical contact:** [Name, Email, Phone]

Thank you,

[Dealer Principal Name]
[Dealer Group]
[Phone] · [Email]
