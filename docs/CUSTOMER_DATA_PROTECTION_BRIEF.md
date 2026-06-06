# Customer Data Protection — Security, Privacy & Compliance Brief

**Prepared for dealership partners and their IT / legal advisors**
*This document has two halves: a plain-language section answering the questions dealers actually ask, and a technical section their IT and legal teams can scrutinize. Where something is a forward-looking commitment rather than a control in place today, it is labeled as such.*

---

## How to read this

The platform is operated **by the dealership**. The dealership is the legal **owner and controller** of its customer data. AutoCurb is the dealership's **technology service provider and processor** — it runs the software, but it does not own the data, does not sell it, and does not use it for its own purposes. Every protection below exists to serve two goals at once: **the customer's information cannot be lost, stolen, or misused, and the dealership stays in control of and protected around that information.**

---

# Part 1 — The concerns, answered

### "Could our customers' information be lost or stolen?"
No reasonable effort has been spared to prevent it. All data is encrypted both in transit (TLS 1.2+) and at rest (AES‑256). Access is locked down at the database itself, not just in the app, so even a bug in the interface can't expose another customer's or another store's records. Sensitive data is also automatically deleted as it ages (see Part 3), which shrinks the amount of information that could ever be exposed in the first place.
**Enforced by:** TLS, AES‑256 at rest, PostgreSQL Row‑Level Security, time‑based data redaction jobs.

### "Could AutoCurb take or misuse our data?"
The data belongs to the dealership, full stop, and that's written into the Data Processing Agreement. AutoCurb is contractually prohibited from selling it, using it to train AI models, or using it to compete with or solicit your customers. Technically, only a tiny number of platform super‑administrators can ever cross between dealerships, and that ability is governed by an explicit, individually‑granted flag — no ordinary account, and no dealership's staff, can reach another dealership's data.
**Enforced by:** Data Processing Agreement (ownership, no‑sale, no‑AI‑training, no‑compete clauses); per‑user platform‑admin flag; database‑level isolation.

### "Do we actually own the data?"
Yes — exclusively. The dealership retains all right, title, and interest in its customer data. If the dealership ever leaves, it receives a full export within 7 days and everything is deleted or anonymized within 30 days.
**Enforced by:** DPA §3 (ownership) and §11 (return/delete on termination).

### "Are we compliant in Connecticut?"
The customer‑facing pages implement the Connecticut Data Privacy Act in full — the right to access, correct, delete, get a portable copy, and opt out of sale/targeted ads/profiling, with the 45‑day response window, the appeal process, and a link to the Connecticut Attorney General. It also covers the new obligations under Public Act 25‑113 (effective July 1, 2026), including an automated‑processing disclosure, and the GLBA Safeguards Rule that applies to dealers who arrange financing.
**Enforced by:** Privacy Policy + the self‑service rights page; see Part 4 for the full mapping.

### "Could this expose us to liability?"
The customer‑facing legal pages are written to protect the dealership. Every value shown is clearly an **estimate** unless the dealership has deliberately opted to present a **firm offer** — and even then, the firm offer is honored only if an in‑person inspection confirms the vehicle matches what the customer described (clean title, no undisclosed accident or material issues). Undisclosed problems release the dealership. The Terms name the **dealership** (not AutoCurb) as the party the customer transacts with, carry a conspicuous warranty disclaimer and liability cap, and are fully branded to the individual store.
**Enforced by:** the firm/estimate engine, the offer‑page disclosures, Terms of Service, and the Offer Disclosure — all tenant‑specific.

### "How do we prove the customer opted in?"
Every lead the platform produces is accompanied by a versioned consent record — the exact disclosure text the customer agreed to, the date and time, their IP address and device, and a link to that specific submission. The customer can opt out at any time by replying STOP, and that opt‑out is honored across SMS, voice, and email through a single suppression list checked before any message goes out.
**Enforced by:** the consent log (IP/UA/version/token), the opt‑out table, and the central `can_touch` gate.

### "Can a customer delete their own information?"
Yes — themselves, from the dealership's website, in minutes. They verify their identity with a one‑time text code, then choose to download or permanently delete everything held about them. No staff involvement and no waiting. The verification is single‑use and purpose‑bound, and the request only ever touches that dealership's records.
**Enforced by:** the self‑service data‑rights page + an OTP‑gated, tenant‑scoped deletion engine.

---

# Part 2 — Technical controls reference

**Encryption.** HTTPS‑only across the app, customer portals, and APIs (TLS 1.2+). Databases and object storage (driver's‑license images, title documents, vehicle photos) are encrypted at rest with AES‑256, managed by the infrastructure provider (Supabase / AWS). Customer and dealer browsers receive only a restricted, publishable key; credentials capable of bypassing isolation exist solely in server‑side functions.

**Per‑dealership isolation.** Tenant isolation is enforced in the database via PostgreSQL Row‑Level Security. Every query against a customer/tenant table (submissions, appointments, conversations, voice‑call logs and transcripts, notifications, consent records, opt‑outs, offer settings, access logs, privacy requests) is automatically constrained to `dealership_id = the caller's dealership`. The only cross‑tenant predicate anywhere is an explicit per‑user `is_platform_admin` boolean. Cross‑tenant reporting views run with `security_invoker`, so even aggregate dashboards enforce the viewer's own row‑level security. This was verified table‑by‑table: no tenant‑blind policy remains.

**Access control & insider monitoring.** Role‑based, least‑privilege access with per‑state F&I licensing checks on sensitive writes; multi‑factor authentication is available and enforceable. Authorized access is also recorded: opening a customer file, reading a transcript, or playing a recording writes a who/what/when/where row to a tenant‑scoped, append‑only access log. A bulk‑access anomaly view surfaces any account that views an unusually large number of distinct customer records in a short window — the detective control for a stolen credential or rogue employee. High‑risk admin actions (role changes, rooftop merges, data overrides) are logged the same way.

**Consent & opt‑out architecture.** On every lead‑producing flow, the platform writes a consent record containing the versioned disclosure text (v1 = TCPA calls/texts/email; v2 adds loan‑payoff authorization when a lienholder is reported), the customer's name/phone/email, the date/time, the IP address and user agent (stamped server‑side), and the submission token. Phone numbers are normalized to E.164 so consent, contact, and opt‑out records reconcile. Replying STOP writes an "all‑channel" opt‑out; a single `can_touch` function enforces that opt‑out — plus quiet hours and frequency caps — before any SMS, voice, or email is sent.

**Self‑service rights & deletion engine.** The `/my-data-rights` page lets a customer exercise access, correction, deletion, or opt‑out. For instant access and deletion, the customer verifies a one‑time SMS code; that code is **purpose‑bound and single‑use**, so a code issued for one flow can never be replayed to delete or export data. The request is **tenant‑scoped** — it can only touch the dealership whose site the customer is on. Deletion cascades across submissions, voice logs/transcripts/turns/grades, appointments, consent records, and notifications, then enqueues a storage sweep that removes files and third‑party voice recordings.

---

# Part 3 — Data lifecycle: how information is purged over time

Protection isn't only about keeping data safe — it's about not keeping it longer than necessary. Retention runs on two tracks.

**Automatic, time‑based expiry (configurable; defaults shown):**
- **Call recordings, transcripts, per‑turn text, AI grading notes** — redacted and recording links purged after **90 days**.
- **AI "memory" notes about a customer** — pruned after **180 days**.
- **Customer offer‑view links** — expire after **90 days**.
- **Vehicle submission records** — retained up to **~3 years** after the customer's last interaction to meet the dealership's business, accounting, and legal‑recordkeeping needs.

These windows are enforced by scheduled background jobs that run continuously, so expiry happens automatically — no one has to remember to do it.

**On‑demand deletion (customer‑initiated or dealership‑initiated):** strips and nulls every direct identifier across the customer's submissions, voice records, appointments, consent, and notifications (names, phones, emails, VINs replaced with sentinels), then enqueues a worker that deletes the actual stored files and removes any recordings held by the third‑party voice provider. What remains is, at most, a minimal **de‑identified** record retained only where the law allows — it can no longer identify the person.

**End of relationship:** if a dealership leaves the platform, it receives a complete export within **7 days**, and all of its data is deleted or anonymized within **30 days**, except where law requires a minimal retained record.

---

# Part 4 — Compliance mapping

| Framework | What it requires | How it's met |
|---|---|---|
| **CTDPA** (Conn. Gen. Stat. §42‑515 et seq.) | Access, correction, deletion, portability, opt‑out of sale/targeted‑ads/profiling; 45‑day response (+45 extension); 60‑day appeal; AG escalation | Full rights in the Privacy Policy + verified self‑service access/delete on `/my-data-rights`; appeal + CT AG link surfaced |
| **CT Public Act 25‑113** (eff. July 1, 2026) | Broadened definitions, profiling/automated‑decision disclosure, expanded sensitive data | Automated‑processing disclosure (AI valuation + AI voice make no final/binding decision; opt‑out of profiling); no‑LLM‑training statement |
| **GLBA Safeguards Rule** (16 CFR Part 314) | Information‑security program for dealers who arrange financing | Designated security responsibility, access controls + tenant isolation, encryption, MFA, secure disposal, monitoring/logging, service‑provider oversight, incident‑response plan |
| **TCPA + CT mini‑TCPA** | Prior express consent for autodialed calls/texts; working opt‑out | Versioned, IP/UA‑stamped consent tied to each submission; cross‑channel STOP via the `can_touch` gate |
| **CARS Rule** (16 CFR Part 463) | — | Vacated (2025) / withdrawn (2026); **not relied upon**. Transparency principles followed voluntarily under state UDAP / FTC §5 |

---

# Part 5 — Verification & assurance

The protections above were not self‑asserted. They were reviewed by **five independent audit passes** — covering (1) data security & infrastructure, (2) tenant isolation, (3) Connecticut privacy law, (4) TCPA / consent, and (5) dealer liability — across multiple rounds, with findings tracked to closure. The final pass came back clean, and each supporting database change was **confirmed live in the production database** (tenant‑scoped data‑rights functions, purpose‑bound single‑use verification codes, the firm/estimate flag, the cross‑channel opt‑out gate, and per‑caller row‑level security on reporting views).

**Stated as commitments / roadmap (not yet independently verified):** continuous backups with point‑in‑time recovery and target RTO/RPO objectives; published restore‑drill cadence; third‑party penetration‑test summaries. These are service‑level commitments and are described as such.

*Binding terms live in the Master Services Agreement, the Data Processing Agreement, and the SLA. This brief is a summary, not a contract.*
