# How AutoCurb Protects Your Customers' Data — and Why It Stays Yours

*A plain-English guide for dealer principals and their compliance teams.*
*Your customers. Your data. Built to keep both safe.*

---

## The two questions every dealer asks

1. **"Is my customer data safe — could it be lost or stolen?"**
2. **"Could AutoCurb take my data, sell it, or compete with me?"**

Short answer: **Your customer data is encrypted, isolated per dealership, and monitored — and it is legally *yours*, not ours.** This document answers both questions, in order.

---

## 1. You own your data (the core promise)

- **You are the data controller; AutoCurb is only your service provider / facilitator.** We hold and protect the data **on your behalf** — we do not own it.
- Contractually, AutoCurb **cannot sell, share, rent, mine, or monetize** your customer data.
- AutoCurb **does not market to your customers** and **does not compete with you** for their vehicles.
- AutoCurb **does not use your customers' data to train AI models** — our AI vendors run on your data only to serve you, under no‑training / limited‑retention terms.
- **You can export everything at any time, free**, and we delete it on request. Your data is never held hostage.

> This is backed by a written **Data Processing Agreement (DPA)** and Master Services Agreement — not just a promise. The dealer is the owner/controller; AutoCurb processes only on your documented instructions.

## 2. Walled off from every other dealership

- **Per‑dealership isolation** is enforced in the database itself (PostgreSQL Row‑Level Security): every query is automatically constrained to the caller's own dealership.
- Staff at one dealership **cannot read or modify** another dealership's customers, leads, appointments, conversations, call recordings, or audit logs.
- The **only** role that can cross dealership boundaries is a small number of AutoCurb platform super‑administrators, governed by an explicit, individually‑granted flag — **no role inherits cross‑tenant access by default**, and that access is logged.

## 3. It's safe — encryption & access

- **Encryption in transit (TLS 1.2+)** and **at rest (AES‑256)** for all customer information.
- **Multi‑factor authentication (MFA)** available and enforceable for staff accounts.
- **Least‑privilege, role‑based access** — staff see only what their job requires.
- Customer‑facing apps connect with a **restricted public key only**; privileged credentials never reach a browser.

## 4. It's safe — monitoring, backups & recovery

- **Audit logging:** a tenant‑scoped staff‑action log and a customer‑data access log answer "who saw what, and when" for any record.
- **Anomaly detection** surfaces unusual bulk‑access patterns for review.
- **Continuous backups with point‑in‑time recovery.** *(Service‑level targets: RTO 1 hour / RPO 5 minutes — see the SLA.)*
- A documented **incident‑response and breach‑notification runbook**, with recovery drills.

## 5. Compliant by design — Connecticut + GLBA

- Built to meet the **Gramm‑Leach‑Bliley Act (GLBA) Safeguards Rule** — the standard for dealers handling consumer financial information.
- Aligned with the **Connecticut Data Privacy Act (CTDPA)**, including the July 1, 2026 amendments (Public Act 25‑113): consumer rights, **right to appeal**, **Global Privacy Control** honoring, and the new "no sale / no targeted ads / no LLM‑training" disclosures.
- We're an **extension of your safeguards program**, not a gap in it.

## 6. Customer opt‑in — captured and maintained

- Before any text or call, the customer sees a **clear, plain‑language disclosure** naming your dealership, stating consent covers automated calls/texts/emails about their vehicle, offer, and appointment.
- **Always voluntary:** "Consent is not a condition of purchase," "Msg & data rates may apply," "Reply STOP to opt out."
- **We keep the receipt:** each opt‑in is recorded with a timestamp, the customer's phone, and a **verbatim, versioned snapshot** of the exact wording they agreed to — so you can prove what any customer saw on any day.
- Opt‑outs (STOP) are honored promptly, consistent with current TCPA revocation rules.

## 7. Customers stay in control

- From any page, customers can open **"Your Privacy Choices"** to get a copy of their information, correct it, opt out of any sale/sharing, or **delete it**.
- **Identity‑verified self‑service** via a one‑time code to their phone.
- Deletion is **thorough** — it removes personal identifiers from their records, call history and transcripts, appointments, and notifications, and triggers removal of uploaded photos, documents, and call recordings.
- Every request is acknowledged immediately and fulfilled within the legal window (45 days, extendable once with notice), with an auditable record and a **right to appeal**.

## 8. The firm‑offer option (your call)

- Choose **Firm Offer** (a guaranteed number, honored when the vehicle is as the customer described) or **Estimated Offer** — one admin toggle controls the wording everywhere.
- Legally defensible: **FTC CARS Rule** and state UDAP‑aware. The conditions that can change a firm number (undisclosed accident, branded title, wrong mileage, undisclosed material issues) are disclosed **clearly and adjacent to the price** — disclosed items never reduce the offer.
- The customer is **never obligated** and can always walk away at no cost.

---

## Why it stays yours (recap)

- **Yours legally** — you're the controller; AutoCurb is the processor.
- **Yours exclusively** — per‑dealership isolation; no shared lead pool.
- **Yours to take or delete** — free export anytime; deletion on demand.
- **Safe** — encryption, MFA, monitoring, audit logs, backups/DR, breach notice.
- **Compliant** — GLBA + Connecticut, with logged customer opt‑in.

---

## Appendix — Objection → Our answer

- **"My customers' data could be lost or stolen."**
  → It's encrypted in transit and at rest, protected by MFA and per‑dealership isolation, continuously monitored with access logging, and backed up with point‑in‑time recovery — plus a documented breach‑notification process if anything ever goes wrong.

- **"AutoCurb could steal my data and compete with me."**
  → You're the data controller and we're only the facilitator. We're **contractually barred** from selling, sharing, training AI on, or competing with your data, and we're **liable** if we break that. Architecturally, your data is **walled off** from every other dealer, our staff can only touch it on a **logged, least‑privilege** basis you can see, and you can **export the whole thing for free at any time**. We can't quietly take it — and if anyone tried, you'd see it in your own compliance log.

---

## Proof, not promises (links to share)

- **Data Processing Agreement** — `/dpa`
- **Security & Trust** — `/security`
- **Sub‑processors** — `/sub-processors`
- **Service Level Agreement** — `/sla`
- **Live status** — `/status`
- **Your Privacy Choices** (consumer rights/self‑delete) — `/my-data-rights`

*"Sign the DPA before you sign anything else."*

---

### Internal notes (remove before sending to a dealer)

- Confirm before publishing claims: the SLA's "multi‑region active‑active / RTO 1h / RPO 5min / quarterly restore drills" are **service commitments**, not yet independently verified in code — present them as commitments/roadmap, not facts, or soften the SLA copy.
- Before the opt‑in slide is fully true, finish wiring consent logging into the **Moto** and **embeddable widget** flows and capture the consent **IP** server‑side (currently those flows don't persist a consent record).
- "Customers delete on the spot" is fully true once `/my-data-rights` is wired to the existing verified deletion engine (OTP → `purge_customer_data`); until then deletion is an honored request fulfilled within 45 days.
- Final legal wording (DPA, MSA carve‑outs, firm‑offer terms, CTDPA/GLBA claims) should get sign‑off from qualified counsel.
</content>
