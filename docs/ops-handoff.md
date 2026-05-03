# Ops Handoff — Multi-Tenant + Stripe Billing Deploy Checklist

Snapshot date: May 3 2026.

This is the **single checklist** ops needs to complete to deploy
everything built across PRs #147–#149 to production. The code is
merged to main; what's missing is the operational work that can't
be done from inside the repo.

> If something here gets done out of order, the system will mostly
> still work — the migrations are idempotent, the React fallbacks
> are gentle. Pick up wherever you are.

---

## 1 — Apply pending migrations (Supabase SQL Editor)

Lovable's deploy pipeline ships the frontend code on every merge to
`main` but **does not run database migrations**. Apply these by hand
in **Supabase Dashboard → SQL Editor → + New query**, in timestamp
order:

| # | File | What it does |
|---|---|---|
| 1 | `20260501050000_changelog_full_backfill_apr06_to_may01.sql` | Backfills the Platform Updates page through May 1 |
| 2 | `20260502090000_demo_mode_blackbook_fallback.sql` | Adds `demo_mode` + `demo_offer_amount` to `site_config` |
| 3 | `20260502100000_demo_mode_heal_columns.sql` | Heal pass for #2 + reload PostgREST |
| 4 | `20260502120000_demo_mode_heal_v2_with_rpc.sql` | Self-heal RPC for the schema-cache miss path |
| 5 | `20260503140000_changelog_may02_03_ships.sql` | Backfills changelog for May 2-3 |
| 6 | `20260503180000_tier1_rls_heal.sql` | **Tier 1.2** — closes 3 RLS holes (notification_log, dealer_subscriptions, platform_pricing_model) |
| 7 | `20260503190000_tier1_platform_admin_boolean.sql` | **Tier 1.1** — adds `user_roles.is_platform_admin` boolean, replacing the magic `'default'` string |
| 8 | `20260503200000_tier2_dealer_groups_foundation.sql` | **Tier 2.6** — `dealer_groups` table + helpers |
| 9 | `20260503210000_tier2_location_id_backfill.sql` | **Tier 2.7** — `store_location_id` on 6 lead-adjacent tables |
| 10 | `20260503220000_billing_stripe_columns.sql` | Stripe wiring columns on `dealer_subscriptions` + `tenants` + new `stripe_events` table |
| 11 | `20260503230000_tier2_rooftop_activations.sql` | **Tier 2.10** — `rooftop_activations` + 30-day pilot logic |
| 12 | `20260503240000_tier3_provenance_fields.sql` | **Tier 3.12** — provenance columns + `data_egress_log` |
| 13 | `20260503250000_tier3_rooftop_detach.sql` | **Tier 3.13** — `rooftop_detach_log` + `detach_rooftop()` RPC |
| 14 | `20260503260000_tier3_state_fi_scoping.sql` | **Tier 3.15** — `licensed_states` column + helpers |
| 15 | `20260503270000_tier2_expire_pilots_cron.sql` | Hourly `pg_cron` for `expire_pilots()` |
| 16 | `20260503280000_tier3_state_fi_submissions_rls.sql` | First per-table application of `can_act_in_state()` |

All 16 are idempotent (`IF NOT EXISTS` / `NOT EXISTS` guards). Safe
to re-run.

**Verify after #7 lands:**
```sql
SELECT user_id, role, dealership_id, is_platform_admin
  FROM public.user_roles
 WHERE is_platform_admin = true;
```
Should list every super admin. If the count differs from your
expectation, check the legacy backfill — the migration auto-promotes
anyone who had `role='admin' AND dealership_id='default'`.

---

## 2 — Stripe Dashboard configuration

Detailed walkthrough: `docs/billing-stripe-setup.md`. Summary:

1. **Create one Product:** "Autocurb Platform"
2. **Create six Prices** (3 architecture tiers × monthly + annual). Each Price gets metadata:
   - `bundle_id`: `all_apps_unlimited` (single & multi) or `enterprise_group` (group)
   - `cycle`: `monthly` or `annual`
   - `product_ids`: `autocurb,autolabels,autoframe,autofilm`
3. **Create one Webhook Endpoint** pointing at `https://<your-supabase-ref>.supabase.co/functions/v1/billing-stripe-webhook` subscribed to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy the signing secret** (`whsec_…`) for the env-var step below.

**Test mode first.** Live mode = create a second webhook + Prices in the live Dashboard once everything passes the smoke test.

---

## 3 — Supabase environment variables

Set in **Supabase Dashboard → Project Settings → Edge Functions → Manage secrets**:

| Variable | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` then later `sk_live_…` | From Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 2.3 above | Specific to the webhook endpoint |
| `SUPABASE_URL` | already set | Used by webhook for DB writes |
| `SUPABASE_SERVICE_ROLE_KEY` | already set | Service-role for RLS bypass during webhook upserts |
| `SUPABASE_ANON_KEY` | already set | Used by `_shared/billing.ts` for JWT verification |

---

## 4 — Provision the data-egress storage bucket

In **Supabase Dashboard → Storage → New bucket**:

| Field | Value |
|---|---|
| Name | `data-egress` |
| Public | **No** (private — signed URLs only) |
| File size limit | 50 MB (default fine; bump if a 100-rooftop group ever exports) |
| Allowed MIME types | leave open |

The `data-egress-export` edge function falls back to inline-blob
download if this bucket is missing — but the dealer experience is
much better with the real bucket: faster, supports larger exports,
and lets the dealer re-download within 24h without re-running queries.

---

## 5 — Edge function deploys

Lovable should auto-deploy on merge, but if you're running the CLI
manually, here's the exhaustive list of new / changed functions in
this batch:

```bash
# New this batch (PRs #147 + #148 + #149):
supabase functions deploy billing-subscribe
supabase functions deploy billing-stripe-webhook --no-verify-jwt   # ← important
supabase functions deploy billing-activate-rooftop
supabase functions deploy billing-deactivate-rooftop
supabase functions deploy data-egress-export

# Changed this batch (refactored to use this repo's schema):
supabase functions deploy _shared
# (the _shared "function" is actually a directory imported by the others;
#  re-deploying any of the above pulls the latest version)
```

The `--no-verify-jwt` flag on `billing-stripe-webhook` is **critical**
— Stripe doesn't send a Supabase JWT, it sends a `stripe-signature`
header that the function verifies itself. If you forget the flag, the
function will 401 on every Stripe event.

---

## 6 — Smoke test (test mode, end-to-end)

Run through this once everything above is in place. Use Stripe's
test card `4242 4242 4242 4242` with any future expiry and any CVC.

| Step | Expected |
|---|---|
| **a.** Sign in as a regular dealer admin → visit `/plan` | Picker loads, no errors |
| **b.** Pick a plan → click Save plan | Browser redirects to Stripe Checkout |
| **c.** Complete payment with test card | Browser comes back to `/plan?subscribed=1`. Subscription status banner now shows "Trial active, ends in 14 days" |
| **d.** Within 5 seconds, refresh `/plan` | Banner shows the plan name + "grandfathered" badge if the Price has `metadata.bundle_id` set |
| **e.** Click "Manage billing" | Stripe Customer Portal opens in a new tab with the test subscription visible |
| **f.** As super-admin, visit `/admin?section=groups` | Page loads. Click "New group" → create one |
| **g.** Attach a dealership to the group → click "Activate rooftop" | Rooftop appears with "Pilot" badge + "30d 0h left" countdown |
| **h.** As any dealer, visit `/admin?section=data-egress` | Page loads. Pick "Leads (submissions)" → click Export → CSV downloads |
| **i.** As an F&I-licensed user with `licensed_states='{TX}'`, attempt to update a CA submission | RLS blocks the write |

---

## 7 — Switch to live mode

When the test-mode smoke test passes:

1. Re-create the Product, Prices, and Webhook in **live mode** in Stripe Dashboard.
2. Replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live-mode values.
3. Re-deploy the edge functions so they pick up the new env.
4. Run smoke test step b–e once with a real card to confirm live mode works.
5. You're live.

---

## 8 — What to tell the first multi-rooftop customer

Once everything above is green, here's the talk track:

- **"Your data, your data."** Free CSV export from the admin under Account → Export My Data, anytime, no rate limit. (Shows the contractual differentiator from CDK / Reynolds.)
- **"30-day pilot per rooftop."** Activate any rooftop under the master MSA, no commitment for 30 days. Deactivate during pilot = no charge. (Shows you're not the multi-decade-contract incumbents.)
- **"Grandfathered pricing."** Whatever rate they sign up at is locked in via Stripe Price IDs. Future price changes affect new signups only. Document this clause in the MSA.
- **"One MSA, many rooftops."** The group signs once. Adding rooftop #31 doesn't require new contract papering — the group admin clicks Activate rooftop in the UI.

---

## 9 — Open product / contract decisions (your call)

Engineering can't move on these without you:

- **Per-product entitlement enforcement** — are Voice AI / Equity Mining / Executive HUD separate sellable SKUs inside AutoCurb, or bundled features? Today they're bundled (= no gating). Decision changes whether `<RequireProduct>` gets wired to those surfaces.
- **List pricing for the published single-rooftop tier** — the recommended-template document at `docs/billing-stripe-setup.md` has placeholder numbers. Replace before going live.
- **MSA template clauses** — 1-year max term, free data egress, grandfathered pricing. Get these into your contracts so the dealer-facing wedge is contractually real, not just operational.

---

## Index of all docs

| Doc | What it covers |
|---|---|
| `docs/ops-handoff.md` | This file. The single deploy checklist. |
| `docs/billing-stripe-setup.md` | Full Stripe Dashboard walkthrough, grandfathering pattern explained |
| `docs/sell-flow-competitive-audit.html` (+`.pdf`) | Competitive audit of every major sell-your-car flow (for sales / marketing) |
| `docs/changelog-paste-into-supabase.sql` | One-shot SQL to backfill Platform Updates rows directly in SQL Editor |
| `CLAUDE.md` | Repo-wide notes for AI assistants — including the "migrations don't auto-apply" warning that triggered the need for this checklist |
