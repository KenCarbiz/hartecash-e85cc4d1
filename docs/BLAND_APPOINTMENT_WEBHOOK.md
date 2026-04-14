# Bland.AI Appointment Webhook

Credentials and payload contract to give Bland.AI so the voice agent
can write appointments into Hartecash directly.

## What this solves

Three customer journeys need to create an appointment:

1. **Agreed online, never came in** — customer accepted an offer on
   the website but didn't show up to finalize. Bland calls, books the
   visit, and hits this webhook.
2. **Cold call → accepted** — Bland calls a lead, the customer says
   yes on the phone, and now needs to come in to sign and get paid.
3. **Firm up offer** — offer is tentative. We need to physically see
   the car to set the final number. Bland schedules the inspection.

When the voice agent and the customer agree on a date, time, and
location, Bland POSTs to this webhook with the booking details. The
function creates the appointment, links it to the existing submission
and voice-call log, and advances the pipeline status.

## Endpoint

```
POST https://<your-supabase-project>.functions.supabase.co/bland-appointment-webhook
```

Replace `<your-supabase-project>` with the project-specific hostname.
For this project the URL is:

```
https://ptiwdwfdckfqivoocyvp.functions.supabase.co/bland-appointment-webhook
```

## Authentication

Shared-secret auth. Pass the secret **either** in the header **or** as
a query-string parameter:

- Header: `X-Webhook-Secret: <BLAND_WEBHOOK_SECRET>`
- Query:  `?secret=<BLAND_WEBHOOK_SECRET>`

The secret is the same one Bland already uses for the call-status
webhook (`voice-call-webhook`). Configure it as a Supabase edge-function
secret:

```bash
supabase secrets set BLAND_WEBHOOK_SECRET=<long-random-string>
```

If `BLAND_WEBHOOK_SECRET` is not set on the server, the webhook returns
**503** and rejects every request (fail-closed).

The function uses a constant-time comparison to eliminate timing-based
secret discovery.

## Request

**Content-Type:** `application/json`

### Minimum required fields

```json
{
  "customer_name": "Jane Doe",
  "customer_phone": "+15551234567",
  "scheduled_at": "2026-04-21T15:30:00-05:00"
}
```

### Full payload

```json
{
  "customer_name":   "Jane Doe",
  "customer_phone":  "+15551234567",
  "customer_email":  "jane@example.com",

  "scheduled_at":    "2026-04-21T15:30:00-05:00",
  "preferred_date":  "2026-04-21",
  "preferred_time":  "15:30",

  "location":        "Hartecash — 123 Main St, Dallas TX 75201",
  "notes":           "Customer prefers afternoon. Bringing spare key.",
  "vehicle_info":    "2019 Honda Civic LX — VIN 1HGBH41JXMN109186",

  "appointment_type": "inspection",
  "status":           "scheduled",

  "external_ref":    "bland_call_abc123",

  "metadata": {
    "submission_id":  "7f9b5c2a-....",
    "call_log_id":    "0e4a3f18-....",
    "dealership_id":  "hartecash-dallas"
  }
}
```

### Field reference

| Field | Required | Notes |
|-------|----------|-------|
| `customer_name` | **yes** | Plain string |
| `customer_phone` | **yes** | Any format (digits are normalized server-side; E.164 `+1...` preferred) |
| `scheduled_at` | one of | ISO 8601 timestamp. Preferred over `preferred_date`/`preferred_time`. |
| `preferred_date` | one of | `YYYY-MM-DD`. Use when only a date was agreed, no specific time. |
| `preferred_time` | no | `HH:MM` 24h, or free text ("afternoon"). Only used when `scheduled_at` is absent. |
| `customer_email` | no | Captured opportunistically |
| `location` | no | Dealer lot / address where the customer will show up |
| `notes` | no | Anything useful from the call — customer context, special requests |
| `vehicle_info` | no | Free-text vehicle description. Usually resolvable via `submission_id`. |
| `appointment_type` | no | `"inspection"` (default), `"finalization"`, or `"firm_up_offer"`. |
| `status` | no | `"scheduled"` (default), `"pending"`, `"confirmed"` |
| `external_ref` | recommended | Bland's `call_id`. Enables idempotent retries. |
| `metadata.submission_id` | recommended | Hartecash submission UUID. Pass through from Bland's `request_data`/`metadata` field. |
| `metadata.call_log_id` | recommended | Hartecash `voice_call_log` UUID |
| `metadata.dealership_id` | recommended | Hartecash `dealer_accounts.dealership_id` — multi-rooftop tenancy |

### Matching when metadata is missing

If `metadata.submission_id` is not provided, the function tries to
match by normalized phone against recent submissions. This covers the
**cold-call** case where Bland surfaced a lead the website hadn't
seen yet. If no submission matches, the appointment is still saved —
it will appear in the admin queue unlinked and staff can stitch it to
a customer manually.

Similarly for `metadata.call_log_id`: if missing, we try to find the
voice-call log row by `provider_call_id == external_ref`.

### Appointment types

- `inspection` — default. Dealer needs to see the car before
  finalizing. Firms up the number, then paperwork.
- `finalization` — price is locked; customer is coming in to sign
  paperwork and receive payment.
- `firm_up_offer` — the offer on the site was tentative (e.g. missing
  photos, high-mileage); the visit will let us set the final number.

## Response

Always returns JSON. Response codes:

| Code | When |
|------|------|
| `200` | Request authenticated. Body indicates success or internal error. Bland should **not** retry. |
| `401` | Missing or invalid `BLAND_WEBHOOK_SECRET`. |
| `405` | Wrong HTTP method. |
| `503` | Server-side secret not configured. |

### Success

```json
{
  "ok": true,
  "appointment_id": "2d1c8f...-uuid",
  "submission_id": "7f9b5c2a-...-uuid",
  "dealership_id": "hartecash-dallas"
}
```

### Input error (still 200 to block retry storms)

```json
{
  "ok": false,
  "error": "customer_name and customer_phone required"
}
```

## Idempotency

When you pass `external_ref` (recommended: Bland's `call_id`), the
function upserts on `(dealership_id, external_ref)`. This means Bland
can safely retry on network timeouts — you'll never create duplicate
appointments.

## Side effects

On success the function also:

1. Sets the matched submission's `progress_status` to
   `'appointment_scheduled'` (so admin dashboards move it to the
   right queue).
2. Sets the matched voice-call log's `outcome` to
   `'appointment_scheduled'` (so call reporting reflects the booking).

## Example — full curl

```bash
curl -X POST \
  'https://ptiwdwfdckfqivoocyvp.functions.supabase.co/bland-appointment-webhook' \
  -H 'X-Webhook-Secret: <BLAND_WEBHOOK_SECRET>' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "Jane Doe",
    "customer_phone": "+15551234567",
    "scheduled_at":   "2026-04-21T15:30:00-05:00",
    "location":       "Hartecash Dallas — 123 Main St",
    "appointment_type": "inspection",
    "external_ref":    "bland_call_abc123",
    "metadata": {
      "submission_id":  "7f9b5c2a-...",
      "call_log_id":    "0e4a3f18-...",
      "dealership_id":  "hartecash-dallas"
    }
  }'
```

## Bland.AI tool configuration

In your Bland agent's tool definition (Webhooks → Custom Tools), add a
tool along these lines:

```
Name:        book_appointment
Description: Call this ONCE the customer has agreed on a specific
             date, time, and location for their in-person visit.
             Never call before they've confirmed.
URL:         https://ptiwdwfdckfqivoocyvp.functions.supabase.co/bland-appointment-webhook?secret={{BLAND_WEBHOOK_SECRET}}
Method:      POST
Headers:
  Content-Type: application/json

Body (JSON):
{
  "customer_name":   "{{customer_name}}",
  "customer_phone":  "{{customer_phone}}",
  "scheduled_at":    "{{iso_timestamp}}",
  "location":        "{{dealer_location}}",
  "appointment_type": "{{appointment_type}}",
  "notes":           "{{notes}}",
  "external_ref":    "{{call.call_id}}",
  "metadata": {
    "submission_id":  "{{request_data.submission_id}}",
    "call_log_id":    "{{request_data.call_log_id}}",
    "dealership_id":  "{{request_data.dealership_id}}"
  }
}
```

Pass `submission_id`, `call_log_id`, and `dealership_id` through
Bland's `request_data` field when you initiate the call — they will
flow back to this webhook unchanged, letting the function link the
appointment to the right tenant and the right customer record.
