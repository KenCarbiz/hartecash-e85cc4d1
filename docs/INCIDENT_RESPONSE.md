# Incident Response & Breach Notification Runbook

**Owner:** Hartecash compliance / engineering on-call.
**Last reviewed:** 2026-05-09.
**Related code:** `security_incident` table, `register_security_incident` RPC,
`v_bulk_access_anomalies` view, `customer_data_access_log`, `error_log`.

This runbook is the playbook to execute the moment something
suggesting customer-data exposure happens. **Do not improvise.**
Most state breach-notification statutes start the clock the moment
a "compromise is reasonably believed to have occurred" — every
hour matters once that clock is running.

---

## 1. Discovery — how an incident reaches us

| Source | Where to look | Severity hint |
|---|---|---|
| Bulk-access anomaly | Admin → Compliance → Privacy Posture → "Anomalies" section, or `SELECT * FROM v_bulk_access_anomalies` | **medium** initially; investigate before escalating |
| Staff report | Direct message / email from a team member who saw something | depends on report |
| Vendor breach disclosure | Twilio, Bland, Anthropic, OpenAI, Supabase, Stripe security bulletins | **high** until proven low |
| Customer complaint | "I think someone has my data" — usually via support inbox | **high** — treat as real until disproven |
| Scheduled audit finding | Quarterly compliance review | varies |
| External disclosure | Researcher, journalist, law-enforcement contact | **critical** |

Each source maps 1:1 to a `security_incident.detected_via` enum
value. The `error_log` table now also auto-fires a `severity =
'fatal'` row whenever `register_security_incident` is called, so
the incident shows in the daily ops review.

---

## 2. Triage — first 60 minutes

The goal in the first hour is **"is this real, and what's the
blast radius?"** Do **not** notify customers or regulators in this
window. Do **not** take destructive remediation steps that could
destroy forensic evidence (e.g., don't delete log rows or rotate
credentials yet — capture them first).

1. **Open the incident record** — call `register_security_incident`
   from the admin SQL editor, or use the upcoming Compliance →
   Incidents UI. Capture summary + detected_via + affected count
   estimate. The clock now starts; `notification_due_at` defaults
   to T+30 days (NY SHIELD floor).

2. **Capture forensics — DO THIS FIRST**:
   - `\copy customer_data_access_log TO '/tmp/access-log-{incident_id}.csv'`
     for the relevant window
   - `\copy error_log TO '/tmp/errors-{incident_id}.csv'` for the
     same window
   - Snapshot any related `voice_call_log` / `submissions` rows
     before any redaction touches them

3. **Triage severity** — three questions:
   - **What categories of PII were potentially exposed?** Names
     alone = lower; SSN / driver's license / financial data =
     critical regardless of count
   - **How many records?** Most state laws kick in at the FIRST
     record exposed; some (NY SHIELD) require notice to AG only
     above 500 affected. Don't over-rely on the threshold.
   - **Is the exposure ongoing?** If yes, contain first
     (revoke credentials, suspend the account) — but PRESERVE
     audit trails.

4. **Update incident severity** — `UPDATE security_incident
   SET severity = …, notification_due_at = …`. Adjust the
   notification deadline based on the strictest jurisdiction
   represented in the affected records (see §4).

---

## 3. Containment — concurrent with triage

Immediate-effect actions, in priority order:

1. **Revoke credentials** if the cause is credential compromise:
   - Suspend the staff account: `UPDATE user_roles SET role = 'suspended' …`
     (or use the admin UI)
   - Force MFA reset: delete the user's verified factors via the
     Supabase Auth dashboard
   - Invalidate all session tokens for the account

2. **Vendor notice** if the cause is a sub-processor:
   - Twilio: security@twilio.com
   - Bland.ai: support@bland.ai
   - Anthropic: trust@anthropic.com
   - OpenAI: security@openai.com
   - Supabase: security@supabase.com
   - Stripe: security@stripe.com

3. **Stop the bleeding** without destroying evidence:
   - Mark the incident `contained` once new exposure is
     prevented: `UPDATE security_incident SET status = 'contained',
     contained_at = now() WHERE id = …`

---

## 4. Notification — statutory deadlines

These are the floors. Always check current state law; many states
have updated their windows in the last 24 months.

| Jurisdiction | Notice trigger | Window from discovery |
|---|---|---|
| **California** (CCPA) | Any reasonable belief PI was exposed | "Without unreasonable delay" — interpreted as ≤ 60 days |
| **New York** (SHIELD) | Any compromise of NY-resident PII | 30 days; AG + ITS notice if > 500 affected |
| **Connecticut** | Any compromise of CT-resident PII | 60 days |
| **Texas** | "As quickly as possible" | 60 days, no later than |
| **Massachusetts** | Notice to AG + OCABR + customer | "As soon as practicable", typically ≤ 30 days |
| **Florida** | Notice within 30 days | 30 days |
| **Illinois** | "Most expedient time possible" | Practical: ≤ 45 days |
| **GLBA** (financial) | If dealer originated financing | "As soon as possible after determining" |

Use the strictest applicable state for each affected customer.
The incident's `notification_due_at` should match the strictest
deadline in the affected population, **not** the average.

### Notification content (every state requires roughly the same)
- What happened, in plain language
- What categories of PII were involved
- What steps the customer should take (credit freeze, password
  change, etc.)
- What we are doing in response
- A direct contact (phone + email) for questions
- For SSN/driver's license exposures: offer of identity-theft
  monitoring (state-specific; CA + others require ≥ 12 months)

A drafted notification template lives at
`docs/templates/breach-notification-letter.md` (TODO).

---

## 5. Resolution

1. Update the incident record:
   ```sql
   UPDATE security_incident
   SET status = 'notified',
       customers_notified_at = now()
   WHERE id = '...';
   ```

2. After remediation actions are complete:
   ```sql
   UPDATE security_incident
   SET status = 'closed', closed_at = now()
   WHERE id = '...';
   ```

3. Conduct a postmortem within 14 days. Document:
   - Root cause
   - Detection latency (incident discovered_at vs first compromise
     time)
   - What controls failed; what controls caught it
   - Action items with owners + due dates

4. File the postmortem at `docs/postmortems/INC-{id}.md`.

---

## 6. Drill cadence

- **Tabletop drill: every 6 months.** Pick a hypothetical scenario
  (stolen laptop, vendor breach, rogue employee) and walk through
  every step above. The first drill always finds gaps.
- **Live data-export request drill: quarterly.** Pretend a CCPA
  request just landed; time the response. Target: ≤ 7 days from
  request to fulfilled, well within the 45-day statutory window.
- **Backup-restore drill: annually.** Pick a random submission;
  restore from the most recent point-in-time backup; verify the
  customer's data is intact and post-restore.

---

## 7. Useful queries

```sql
-- Open incidents past their notification deadline
SELECT id, severity, summary, discovered_at, notification_due_at
FROM security_incident
WHERE status NOT IN ('closed','dismissed')
  AND notification_due_at < now() + interval '7 days'
ORDER BY notification_due_at ASC;

-- Recent bulk-access anomalies tied to a specific staff user
SELECT * FROM v_bulk_access_anomalies
WHERE staff_user_id = '...'
ORDER BY window_start DESC;

-- All access events for one customer in the last 30 days
SELECT staff_label, resource_kind, request_path, ip_addr, created_at
FROM customer_data_access_log
WHERE submission_id = '...'
  AND created_at > now() - interval '30 days'
ORDER BY created_at DESC;
```

---

## 8. External contacts (fill in)

- **Cyber-incident counsel:** `[firm name + 24h line]`
- **Forensics retainer:** `[provider]`
- **Insurance broker (cyber liability):** `[broker + policy #]`
- **State AG breach contacts:** linked at
  https://oag.ca.gov/privacy/databreach (CA);
  https://ag.ny.gov/internet/data-breach (NY); etc.
