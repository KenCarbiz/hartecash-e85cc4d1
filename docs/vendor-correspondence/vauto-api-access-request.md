# vAuto API access request — draft email

**Status:** Draft, ready to send
**Audience:** vAuto rep (currently routing us to website-feeds team by mistake)
**Goal:** Get connected to the Cox Automotive Bridge / Cox Auto Connect integration partner program for push/pull API access to vAuto Provision, starting with Harte Infiniti, Hartford, CT.

Replace the bracketed placeholders before sending:
- `[rep's name]` — the vAuto rep on the prior thread
- `[Your name]`, `[Your title]`, `[Direct phone]`, `[Email]` — sender signature

---

**Subject:** Clarification — push/pull API access request for Harte Auto Group (not a website feed)

Hi [rep's name],

Thanks for following up after I reached out through my Cox / vAuto rep. I want to clear up a misunderstanding from the last exchange before we go further: **we're not asking for a website feed.** What we need is **push/pull API access** to our existing vAuto inventory so our internal acquisition software can integrate directly with vAuto Provision.

Here's the concrete use case so the right team at your end sees this:

## What we're building

Harte Auto Group operates a proprietary off-street vehicle acquisition platform that we use to buy cars directly from consumers — separate from trade-ins and auction sourcing. The platform handles every step from initial customer submission through final check request and title transfer. Once we've acquired the vehicle, it becomes newly acquired inventory at the store that bought it.

We need our platform to talk to vAuto in two directions:

### 1. Push — newly acquired inventory into vAuto

When we finalize a purchase from a consumer (check request issued, title in hand), our system needs to push that vehicle into vAuto Provision as new inventory with:

- VIN, year, make, model, trim, drivetrain, mileage
- Acquisition cost (what we paid the consumer)
- Acquisition date and source flag (off-street vs trade vs auction)
- Initial photo set captured during our intake / inspection flow
- Condition report from our in-person inspection
- Stocking store / rooftop assignment

Today this is being keyed in manually after our team finalizes the buy, which is both slow and error-prone. A direct push closes the gap between purchase and the vehicle being merchandised.

### 2. Pull — current inventory back into our platform for editing

For vehicles already in vAuto, we need the ability to pull the live inventory record into our software, modify fields (descriptions, equipment lists, condition notes, photos, internal flags) inside our tooling, and push the updated record back to vAuto so vAuto remains the system of record.

The fields we'd most likely be updating from our side are:

- Vehicle description / merchandising copy
- Equipment / options
- Photos and ordering
- Condition grade / notes
- Internal notes and stocking flags

Effectively we want our software to act as an authorized client of the vAuto inventory API — read, edit, write — for vehicles owned by our rooftops.

## Why we need API access vs a one-way feed

A one-way feed (vAuto → website, or website → vAuto) wouldn't solve either side of this. The work we do on a vehicle inside our platform — appraisal output, photo curation, description edits — has to land back in vAuto because vAuto is the source of truth for the rest of the operation (pricing, syndication, FI). Same the other way: we need to see the live vAuto record before we modify it, not a daily-stale snapshot.

## Stores in scope

Harte Auto Group operates four rooftops today, with a fifth opening soon. Full integration rollout target is all five rooftops, but **we want to start with one store first**:

- **Harte Infiniti, Hartford, CT** — pilot store

Once we've validated push/pull end-to-end at Harte Infiniti, we'll roll out to the remaining rooftops.

## What we need from vAuto

1. Connection to the right team (vAuto Integration Partners / Cox Auto Bridge / whatever the current product name is — we keep getting routed to website-feed support, which is not the right group).
2. API documentation and OAuth credentials scoped to Harte Infiniti, Hartford, CT.
3. Sandbox / test rooftop if available, so we can validate the push flow before pointing it at live inventory.
4. Pricing and timeline for API access, scoped per rooftop.

If there's a Cox Automotive Bridge or Cox Auto Connect partner program that handles this, please route us there. We are happy to sign whatever data-handling agreement is required — our platform already operates under a documented privacy posture and we can provide that on request.

Happy to jump on a 20-minute call this week with whoever owns the integration product so we can get this moving. Mornings work best on my end.

Thanks,

[Your name]
[Your title]
Harte Auto Group
[Direct phone]
[Email]

---

## Tactical notes (do not send)

A few choices that are deliberate in the draft above:

1. **Cox Automotive Bridge / Cox Auto Connect named explicitly.** That's the partner-integration program Cox uses for API access to vAuto / Manheim / Dealertrack. Naming it explicitly forces the recipient to forward the email to the right team rather than answering themselves — even if the exact product name has changed, naming it gets the message out of the website-feeds queue.

2. **Opens with "we're not asking for a website feed."** Direct correction in the first sentence. Polite but unmistakable.

3. **One pilot store first.** Makes the ask feel small ("just Harte Infiniti to start") instead of a 5-rooftop enterprise rollout that gets bounced to enterprise sales. The expansion intent is mentioned but not the headline ask.

4. **"vAuto remains the system of record"** is called out explicitly because integration teams worry about source-of-truth conflicts with two-way sync. Telling them up front that vAuto wins disarms that objection.

5. **Privacy-posture reference** is intentional because the platform now has a printable privacy-posture page (`/admin → Communications → Compliance → Privacy Posture`) that can be handed to their legal/integration team as the one-page summary. If they ask, you have the artifact.

## If they ask follow-up questions

Likely vAuto follow-ups and the short answer to each:

| They might ask | Reply with |
|---|---|
| "What's your software's architecture?" | React + Supabase Postgres, Anthropic / OpenAI / Bland AI as named sub-processors. Multi-tenant; RLS-isolated per dealership. |
| "What identity / auth model?" | TOTP MFA enforced for staff; backup codes; per-staff PII-view audit log. Happy to share the privacy posture sheet. |
| "How many calls / records per day?" | Low single-digit thousand inventory events per rooftop per month at full operation. API call budget is well below any normal partner-program ceiling. |
| "Will you re-sell the data?" | No. Customer-owned data is processed only for the dealership that captured it. No cross-tenant sharing, no marketing resale. |
| "What's your error / retry behavior?" | Idempotent writes keyed on VIN + acquisition_date. Failed pushes land in a retry queue (5-min cron, exponential backoff, 5-attempt cap, abandonment alerts in the admin error log). |

These reassurances mostly land in the integration partner's risk-screening — the same questions any partner asks any vendor wiring into their core inventory system.
