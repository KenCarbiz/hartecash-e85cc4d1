# Deployment Checklist — April 2026 Platform Updates

This document covers everything that needs to be verified after the
large April 2026 set of migrations lands. The features themselves are
code-complete but rely on environment variables, cron schedules, and
third-party webhooks that have to be wired manually per environment.

Run through this list on every fresh environment (staging, prod, new
multi-tenant rooftop) before declaring things live.

## 1. Environment variables

### Supabase function secrets (Edge Functions → Secrets)

| Variable | Used by | Required for |
|---|---|---|
| `SUPABASE_URL` | all functions | Every edge function |
| `SUPABASE_SERVICE_ROLE_KEY` | all functions | Every edge function |
| `SUPABASE_ANON_KEY` | auth-aware functions | Tenant isolation checks |
| `LOVABLE_API_KEY` | `analyze-vehicle-damage`, `ai-photo-reappraisal`, `estimate-inspector-note`, `ai-text-agent` | AI photo scoring + text agent |
| `TWILIO_ACCOUNT_SID` | `send-notification`, `sms-webhook` | Outbound + inbound SMS |
| `TWILIO_AUTH_TOKEN` | `send-notification`, `sms-webhook` | Inbound webhook signature validation |
| `TWILIO_PHONE_NUMBER` | `send-notification` | Outbound SMS From field |
| `RESEND_API_KEY` | `send-transactional-email`, `process-email-queue` | Outbound email |
| `BLAND_API_KEY` | `launch-voice-call`, `run-voice-campaign`, `run-hot-lead-cadence` | AI voice calls |
| `PUSH_VAPID_PUBLIC_KEY` | `send-push` | PWA push notifications |
| `PUSH_VAPID_PRIVATE_KEY` | `send-push` | PWA push notifications |
| `PUSH_VAPID_SUBJECT` | `send-push` | PWA push (e.g. `mailto:ops@autocurb.io`) |
| `PUBLIC_APP_URL` | `send-appointment-reminders` | Reschedule links in SMS |
| `STRIPE_SECRET_KEY` | billing functions | Subscription management |

Generate VAPID keys once:
```bash
npx web-push generate-vapid-keys
```

### Client (Vite) env

Set in `.env` / deployment env:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Client API base |
| `VITE_SUPABASE_ANON_KEY` | Client auth |
| `VITE_PUSH_VAPID_PUBLIC_KEY` | Same public key as `PUSH_VAPID_PUBLIC_KEY` |

### Postgres runtime settings

Required for cron jobs that post to edge functions. Set once per
database (already set if prior cron jobs work):

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres SET app.supabase_service_role_key = '<service-role-key>';
```

## 2. Cron jobs to verify

Run in SQL editor:

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Expected entries (shipped across the April migrations):

| Job name | Schedule | Added by |
|---|---|---|
| `acquisition_cadence_daily` | `15 10 * * *` | 20260420200000 |
| `appointment_reminder_cadence` | `*/15 * * * *` | 20260420180000 |
| `appraiser_queue_auto_flag` | `*/15 * * * *` | 20260420090000 |
| `escalation_sla_check` | `*/10 * * * *` | 20260420250000 |
| `hot_lead_cadence_30min` | `*/30 * * * *` | 20260420210000 |

If any are missing, re-run the corresponding migration.

## 3. Twilio webhook config

In Twilio Console → Phone Numbers → (your number) → Messaging:

- **A MESSAGE COMES IN:**
  - Webhook: `https://<project-ref>.supabase.co/functions/v1/sms-webhook`
  - HTTP POST
- **Primary handler fails:** (leave default or point to a monitoring
  URL)

Test by texting the Twilio number from an enrolled customer phone
and verifying:
1. An `sms_inbound_log` row appears
2. A `conversation_events` row with `direction='inbound'` appears for
   that submission
3. The assigned rep receives the `staff_customer_replied` notification
4. Replying `STOP` auto-adds to `sms_opt_outs` + returns the
   compliance acknowledgement

## 4. Per-dealership config that admins need to set

These are per-tenant values dealers must configure in the admin UI
before the associated features light up:

| Setting | Location | Feature |
|---|---|---|
| Floor plan rate annual % | System Settings | Holding cost chip on appraisal + GM HUD aged inventory burn |
| Target holding days | System Settings | Aged inventory threshold |
| Offer model (wholesale %, recon buffers, promo bonuses) | Offer Logic | Offer calculation |
| Tire + brake input mode (depth vs pass/fail) | Inspection Sheet Builder | Inspector recording |
| Notification Settings (per-trigger recipients + channel toggles) | Configuration → Notifications | Staff broadcast routing |

## 5. Staff onboarding for PWA push

Once VAPID keys are in env, staff individually need to:

1. Sign into `/admin` on the device they want notifications on
2. Click the bell icon next to the dark-mode toggle in the header
3. Approve the browser permission prompt
4. Verify they show "Turn off push notifications" (= subscribed)

iOS-specific: Safari requires the site to be installed to Home
Screen first (iOS 16.4+). Older iPhones fall back to SMS.

## 6. Backfill jobs to run manually

Most migrations backfill automatically. One manual job that may be
worth running against production once after deploy:

```sql
-- Verify conversation_events backfilled from all sources:
SELECT source_table, count(*) FROM public.conversation_events GROUP BY 1;
-- Expect rows from: activity_log, notification_log, voice_call_log,
-- plus manual / manual_sms / manual_email from the reply composer
-- going forward.
```

## 7. Deprecated surfaces cleaned up

- Old `<AI Call History>` + `<Activity Log>` sections on the customer
  file were removed in the F2 follow-up cleanup. If a user reports
  "missing call history", confirm the Conversation section inside
  Research & Automation shows the calls (it should — backfilled by
  migration 20260420280000).

## 8. RLS / access verification

Quick smoke test to run as different roles:

| Role | Should be able to |
|---|---|
| `receptionist` | Access `/inspection-checkin` + `/admin?section=accepted-appts`; nothing else |
| `sales` / `sales_bdc` | See Book Values read-only; cannot see profit spread, activity log, retail market |
| `internet_manager` | See BDC action strip; can escalate; can send to appraiser directly |
| `gm` | See GM HUD + holding costs; approve deal finalized |
| `platform_admin` | See Dealer Tenants list; see Pricing Model (subscription tiers) |
| `admin` (dealer) | See My Plan; cannot see Dealer Tenants |
