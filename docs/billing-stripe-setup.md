# Stripe Billing Setup — Autocurb Platform

**Status:** code wired, Stripe Dashboard configuration pending.

This document is the operational runbook for turning the Stripe-led
billing on. Once the steps below are complete, the dealer-facing
plan picker on `/plan` will hand off to Stripe Checkout, payments
will land in your Stripe account, and the local `dealer_subscriptions`
table will be kept in sync via webhook.

---

## Architecture in one diagram

```
                    Stripe (system of record for $$$)
                           ▲      │
                           │      │  webhook
                           │      ▼
              billing-stripe-webhook edge function
                           │
                           │  upsert
                           ▼
                  dealer_subscriptions (local cache)
                           │
                           │  read
                           ▼
            usePlatform / RequireProduct (in-app gates)


                  PricingPlanPicker.onConfirm
                           │
                           │  invoke
                           ▼
                billing-subscribe edge function
                           │
                           │  resolves Stripe Price IDs by metadata
                           │  ensures Customer
                           │  creates Checkout Session
                           ▼
                       Stripe Checkout
                           │
                           │  customer pays / signs up
                           ▼
                   webhook → top of diagram
```

Three principles:

1. **Stripe owns money.** All payment, invoicing, dunning, retries, card
   updates, and cancellations happen in Stripe.
2. **Local DB owns entitlements.** `dealer_subscriptions` is a cache of
   Stripe state, written by the webhook. The app reads it for in-app
   gates. **The picker no longer writes to it directly** — the only
   exception is the "enterprise" (custom-quote) path.
3. **Grandfathering is automatic.** Each Stripe Subscription locks in
   the `Price` it was created with. When you raise prices later you
   create a new `Price`; existing subscribers stay on their old one
   until you explicitly migrate them. This means "legacy dealers keep
   it" requires zero custom code.

---

## One-time setup

### 1. Stripe Dashboard — create the Product

You only need **one Product** for the platform. The 4 brands (AutoCurb,
AutoLabels, AutoFrame, AutoFilm) are *features included*, not separate
SKUs.

Stripe Dashboard → **Product catalog → Add product**:

| Field | Value |
|---|---|
| Name | Autocurb Platform |
| Description | Customer acquisition, F&I, photography & video tools for dealers. |
| Image | (your logo) |
| Tax behavior | Inclusive or exclusive — pick once and stay consistent |

### 2. Create the Prices (one per tier × billing cycle)

For the **simple** model recommended in the audit, create three Prices —
one per architecture tier — each in monthly + annual. That gives six
Prices total. All Prices belong to the single "Autocurb Platform"
Product. Per-rooftop billing is achieved by setting the **quantity**
on the Subscription Item to the rooftop count (`billing-subscribe`
already does this).

Recommended starting prices (adjust to your model):

| Architecture | Cycle | Unit amount per rooftop | metadata |
|---|---|---|---|
| Single-rooftop | monthly | $349/month | `bundle_id=all_apps_unlimited`, `cycle=monthly` |
| Single-rooftop | annual | $3,490/year (-17%) | `bundle_id=all_apps_unlimited`, `cycle=annual` |
| Multi-location | monthly | $329/rooftop/month | `bundle_id=all_apps_unlimited`, `cycle=monthly` |
| Multi-location | annual | $3,290/rooftop/year | `bundle_id=all_apps_unlimited`, `cycle=annual` |
| Dealer group | monthly | $299/rooftop/month | `bundle_id=enterprise_group`, `cycle=monthly` |
| Dealer group | annual | $2,990/rooftop/year | `bundle_id=enterprise_group`, `cycle=annual` |

For each Price:

- **Pricing model:** Standard pricing
- **Recurring:** Monthly or Yearly
- **Metadata** (this is the critical part — `billing-subscribe`
  matches Prices to picker selections by these keys):

  | Key | Value |
  |---|---|
  | `bundle_id` | `all_apps_unlimited` (single & multi) or `enterprise_group` (group) |
  | `cycle` | `monthly` or `annual` |
  | `tier_id` | *(only set if you ever want à-la-carte; leave empty for the bundle path)* |
  | `product_ids` | `autocurb,autolabels,autoframe,autofilm` (comma-separated, no spaces) |

Click **Save price** for each row. Note the `price_xxx` IDs but you
don't need to put them anywhere in code — the lookup is by metadata.

### 3. Stripe Dashboard — create the Webhook Endpoint

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

| Field | Value |
|---|---|
| Endpoint URL | `https://<your-supabase-ref>.supabase.co/functions/v1/billing-stripe-webhook` |
| Description | dealer_subscriptions sync |
| Listen to | **Events on your account** |
| Events to send | (see list below) |

Events to subscribe:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

After creating the endpoint, click **Reveal** under "Signing secret"
and copy the value (starts with `whsec_`).

### 4. Set Supabase environment variables

In the Supabase Dashboard → **Project settings → Edge Functions →
Manage secrets**:

| Variable | Source | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key | Use the **live** key only when ready for production. Use **test** key during setup. |
| `STRIPE_WEBHOOK_SECRET` | The `whsec_…` from step 3 | Specific to the webhook endpoint above. |
| `SUPABASE_URL` | Already set | Used by the webhook for DB writes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set | Service-role key for the webhook to bypass RLS when caching subscriptions. |
| `SUPABASE_ANON_KEY` | Already set | Used by `_shared/billing.ts` for JWT verification. |

### 5. Deploy the edge functions

The new `billing-subscribe` and `billing-stripe-webhook` functions need
to be deployed to Supabase. Lovable's pipeline handles this on push to
main, **but if migrations and edge-function deploys aren't auto-syncing**
(same issue as the changelog migrations), deploy manually:

```bash
supabase functions deploy billing-stripe-webhook
supabase functions deploy billing-subscribe
supabase functions deploy billing-portal-session
```

Note: `billing-stripe-webhook` MUST be deployed **with `--no-verify-jwt`**
because Stripe's webhook does not send a Supabase JWT (it sends a
signature in the `stripe-signature` header instead, which the function
verifies itself):

```bash
supabase functions deploy billing-stripe-webhook --no-verify-jwt
```

If you can't run the CLI, set the function's "Verify JWT" toggle
**off** in the Supabase Dashboard.

### 6. Apply the migrations

Three migrations need to land in production:

- `20260503180000_tier1_rls_heal.sql` (Tier 1 RLS fixes)
- `20260503190000_tier1_platform_admin_boolean.sql` (super-admin column)
- `20260503200000_tier2_dealer_groups_foundation.sql` (dealer_groups)
- `20260503210000_tier2_location_id_backfill.sql` (per-store FKs)
- `20260503220000_billing_stripe_columns.sql` (Stripe columns + idempotency)

Same caveat as before: if Lovable's pipeline is code-only, paste these
into Supabase Dashboard → SQL Editor in timestamp order.

---

## Verification

After all steps complete:

1. **Smoke test the webhook signing.** Stripe Dashboard → your endpoint
   → "Send test event" → `customer.subscription.created`. The function
   should log "Subscription <id> has no dealership_id mapping" — that's
   expected because the test customer has no metadata. Check the
   Supabase function logs to confirm the function fires.

2. **End-to-end test in test mode.**
   - Sign in as a dealer.
   - Visit `/plan`.
   - Pick a plan → click Save plan → land on Stripe Checkout.
   - Use card `4242 4242 4242 4242`, any future expiry, any CVC.
   - Pay → redirect back to `/plan?subscribed=1`.
   - Confirm `dealer_subscriptions` has a new row with
     `stripe_subscription_id` populated within ~5 seconds (webhook latency).
   - Click **Manage billing** → Stripe Customer Portal opens.

3. **Switch to live mode.** Replace `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` with the live-mode equivalents. Redeploy
   the functions or restart so they pick up the new env vars.
   Re-create the live-mode Prices in the live Dashboard with the
   same metadata.

---

## Pricing changes & grandfathering (Ken's stated direction)

> "If we ever change our mind, legacy dealers can keep it and then we
> charge going forward."

This is automatic in Stripe. To raise prices:

1. Stripe Dashboard → Product catalog → Autocurb Platform → **Add another price**.
2. Set the new amount + the same metadata as the existing Price (`bundle_id`, `cycle`, etc.).
3. **Archive the old Price.** Existing subscribers continue paying the
   old amount because each Subscription Item references the
   `price_xxx` id directly. Archived Prices stop appearing in the
   picker (because `billing-subscribe` calls `prices.list({active: true})`)
   so all *new* signups use the new price.
4. Existing dealers stay on legacy pricing **forever** unless you
   explicitly migrate them via Subscription update. No customer-facing
   communication required.

To migrate a specific legacy dealer to current pricing later:

```ts
// In a one-off admin script
await stripe.subscriptionItems.update(itemId, {
  price: NEW_PRICE_ID,
  proration_behavior: "none", // or "create_prorations"
});
```

This is the antithesis of how CDK/Reynolds price-hike — and that
contrast is a marketing wedge in itself.

---

## What was removed

- **`/billing` route** and `BillingPage.tsx` — orphaned (not in sidebar)
  and read from the parallel `app_entitlements` schema that doesn't
  exist in this repo. The Manage Billing button on `/plan` covers the
  same need with one click instead of two.
- **`useEntitlements` hook** — same parallel-schema concern. Use
  `usePlatform().hasProduct(productId)` from `PlatformContext` instead;
  it reads the local `dealer_subscriptions` cache that the webhook
  keeps in sync.

---

## Open questions for the product team

1. **Trial length.** Currently 14 days hardcoded in `billing-subscribe`.
   Should it be 7? 30? Configurable per dealer? Adjust the
   `trial_period_days` value in `billing-subscribe/index.ts`.
2. **Promo codes.** `allow_promotion_codes: true` is on. Create
   promo codes in Stripe Dashboard → Coupons.
3. **Tax.** Stripe Tax is the easiest path (auto-handles 50 states).
   Enable it in Stripe Dashboard → Tax. Adds ~0.5% to the per-transaction
   cost but solves a real compliance problem.
4. **ACH / bank debit.** Adds a second payment method to Checkout. Cuts
   processing fees from ~2.9% to ~$0.80. Worth turning on once card
   volume is steady.
5. **Per-rooftop subscriptions for groups.** The current per-rooftop
   billing uses `quantity` on the Subscription Item. The next-generation
   model (one Subscription Item per rooftop, metadata-tagged with
   `location_id`) is described in the audit's Tier 2.8 — defer until
   you sign your first 3-rooftop+ group.
