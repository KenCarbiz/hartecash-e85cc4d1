// ─────────────────────────────────────────────────────────────────────────
//  billing-stripe-webhook — receives subscription lifecycle events from
//  Stripe and writes them into the local dealer_subscriptions cache.
//
//  Stripe is the system of record for money. Our DB is the system of
//  record for in-app entitlements. This function is the bridge.
//
//  Setup checklist (runbook): docs/billing-stripe-setup.md
//    1. Create one Stripe Webhook Endpoint pointing at this function URL.
//    2. Subscribe it to:
//         - customer.subscription.created
//         - customer.subscription.updated
//         - customer.subscription.deleted
//         - invoice.payment_succeeded
//         - invoice.payment_failed
//    3. Copy the signing secret to STRIPE_WEBHOOK_SECRET env var.
//    4. STRIPE_SECRET_KEY must already be set for the other billing-* fns.
//
//  Idempotency: every event id is recorded in stripe_events on first
//  receipt. Duplicate deliveries (Stripe is at-least-once) short-circuit.
//
//  Tenant attribution: we rely on customer.metadata.dealership_id being
//  set at Customer creation time (see _shared/billing.ts ensureStripeCustomer).
//  If the metadata is absent (e.g. a Customer created manually in the
//  Stripe Dashboard), the event is logged but not applied — the
//  super-admin needs to fix metadata on the Customer.
// ─────────────────────────────────────────────────────────────────────────

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function stripeClient() {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

function statusFromStripe(stripeStatus: string): string {
  // Map Stripe's enum to our local enum. Anything we don't know about
  // gets passed through verbatim so the row still tells the truth.
  switch (stripeStatus) {
    case "trialing": return "trial";
    case "active":
    case "past_due":
    case "unpaid":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "suspended";
    default:
      return stripeStatus;
  }
}

async function recordEvent(event: Stripe.Event, summary: string): Promise<boolean> {
  // Returns true if this is the first time we've seen the event id,
  // false if it was already recorded (duplicate delivery).
  const sb = admin();
  const { error } = await sb.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    received_at: new Date().toISOString(),
    summary,
  });
  if (error) {
    // 23505 = unique violation = duplicate delivery
    if ((error as any).code === "23505") return false;
    console.error("recordEvent insert error:", error);
    return false;
  }
  return true;
}

async function markEventProcessed(eventId: string) {
  const sb = admin();
  await sb
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId);
}

async function resolveDealershipId(customerId: string): Promise<string | null> {
  // Two paths in priority order:
  //   1. tenants.stripe_customer_id (the canonical link we maintain)
  //   2. Customer metadata.dealership_id (fallback for Dashboard-created Customers)
  const sb = admin();
  const { data: tenant } = await sb
    .from("tenants")
    .select("dealership_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (tenant?.dealership_id) return (tenant as any).dealership_id;

  try {
    const stripe = stripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as any).deleted) return null;
    const meta = (customer as Stripe.Customer).metadata ?? {};
    return meta.dealership_id ?? null;
  } catch (e) {
    console.error("resolveDealershipId stripe lookup failed:", (e as Error).message);
    return null;
  }
}

// Sync a Stripe Subscription into dealer_subscriptions. Treats this row
// as cache: replace the canonical fields, preserve nothing the dealer
// could have edited locally.
async function upsertSubscription(sub: Stripe.Subscription) {
  const sb = admin();
  const dealershipId = await resolveDealershipId(sub.customer as string);
  if (!dealershipId) {
    console.warn(
      `Subscription ${sub.id} has no dealership_id mapping (customer=${sub.customer}). Event recorded but not applied. Fix the Customer metadata in Stripe Dashboard.`,
    );
    return;
  }

  // We only support one item per subscription in the current bundle-led
  // model (the picker creates one Subscription Item for the chosen
  // platform tier). Per-product à-la-carte will need to expand this.
  const item = sub.items?.data?.[0];
  const stripePriceId = item?.price?.id ?? null;
  const stripeProductId = (item?.price?.product as string | null) ?? null;

  // The product/price ids on the Stripe price's metadata tell us which
  // local product_ids and tier_ids the row should reflect. Convention
  // (set in the Stripe Dashboard at Price-creation time):
  //   metadata.product_ids = "autocurb,autolabels,autoframe,autofilm"
  //   metadata.tier_id     = "autocurb_pro"  (optional, single tier)
  //   metadata.bundle_id   = "all_apps_unlimited"
  let productIds: string[] = [];
  let tierIds: string[] = [];
  let bundleId: string | null = null;
  if (item?.price) {
    const meta = item.price.metadata ?? {};
    if (meta.product_ids) {
      productIds = meta.product_ids.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    if (meta.tier_id) tierIds = [meta.tier_id];
    if (meta.bundle_id) bundleId = meta.bundle_id;
  }

  const status = statusFromStripe(sub.status);

  const row: Record<string, unknown> = {
    dealership_id: dealershipId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    stripe_price_id: stripePriceId,
    stripe_product_id: stripeProductId,
    bundle_id: bundleId,
    product_ids: productIds,
    tier_ids: tierIds,
    status,
    billing_cycle: item?.price?.recurring?.interval === "year" ? "annual" : "monthly",
    monthly_amount:
      item?.price?.unit_amount != null
        ? Number(item.price.unit_amount) / 100
        : null,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Upsert keyed on stripe_subscription_id (the unique index added in
  // 20260503220000_billing_stripe_columns.sql).
  const { error } = await sb
    .from("dealer_subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });

  if (error) {
    console.error("upsertSubscription error:", error);
    throw new Error(`upsert dealer_subscriptions: ${error.message}`);
  }
}

async function markCanceled(sub: Stripe.Subscription) {
  const sb = admin();
  const { error } = await sb
    .from("dealer_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      cancel_at_period_end: false,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
  if (error) {
    console.error("markCanceled error:", error);
    throw new Error(`mark canceled: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing stripe-signature", { status: 400 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("server misconfigured", { status: 500 });
  }

  const body = await req.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (e) {
    console.error("webhook signature verification failed:", (e as Error).message);
    return new Response(`signature verification failed: ${(e as Error).message}`, {
      status: 400,
    });
  }

  // Idempotency. recordEvent returns false for duplicates.
  const summary = (() => {
    try {
      const obj: any = event.data?.object ?? {};
      return [event.type, obj.id, obj.customer ?? obj.customer_id ?? ""].filter(Boolean).join(" ");
    } catch {
      return event.type;
    }
  })();
  const fresh = await recordEvent(event, summary);
  if (!fresh) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markCanceled(sub);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        // We don't store invoices locally — the Stripe Dashboard / Customer
        // Portal is the canonical surface. We still record the event for
        // audit and bump last_synced_at on the matching subscription so
        // the dealer's /plan UI shows recency.
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sb = admin();
          await sb
            .from("dealer_subscriptions")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("stripe_subscription_id", inv.subscription as string);
        }
        break;
      }
      default:
        // No-op; stripe_events row is kept for audit.
        break;
    }
    await markEventProcessed(event.id);
  } catch (e) {
    console.error(`event ${event.id} (${event.type}) handler failed:`, (e as Error).message);
    // Don't 500 — Stripe will retry forever, which is rarely what we want
    // for a logic bug. Return 200 so the event is acknowledged; the
    // unprocessed_at NULL on stripe_events flags it for replay.
    return new Response(
      JSON.stringify({ received: true, error: (e as Error).message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
