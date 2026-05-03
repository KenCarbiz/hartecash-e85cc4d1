// ─────────────────────────────────────────────────────────────────────────
//  billing-replay-event — platform-admin tool to replay a stripe_events
//  row through the webhook handler.
//
//  Use case: a webhook event was recorded (stripe_events row exists)
//  but the handler failed before setting processed_at. The
//  StripeWebhookReprocessor admin surface lists those rows; clicking
//  Replay calls this endpoint with the event id; we re-fetch the
//  underlying object from Stripe and re-run the same upsert logic
//  the live webhook would have run.
//
//  Authorization: platform admins only.
// ─────────────────────────────────────────────────────────────────────────

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Body = {
  event_id: string;
};

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function statusFromStripe(stripeStatus: string): string {
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

async function resolveDealershipId(customerId: string): Promise<string | null> {
  const sb = admin();
  const { data: tenant } = await sb
    .from("tenants")
    .select("dealership_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (tenant?.dealership_id) return (tenant as any).dealership_id;
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as any).deleted) return null;
    return ((customer as Stripe.Customer).metadata ?? {}).dealership_id ?? null;
  } catch {
    return null;
  }
}

async function applySubscriptionRow(sub: Stripe.Subscription) {
  const sb = admin();
  const dealershipId = await resolveDealershipId(sub.customer as string);
  if (!dealershipId) {
    return { ok: false, error: "no dealership_id mapping for customer" };
  }
  const item = sub.items?.data?.[0];
  const stripePriceId = item?.price?.id ?? null;
  const stripeProductId = (item?.price?.product as string | null) ?? null;
  let productIds: string[] = [];
  let tierIds: string[] = [];
  let bundleId: string | null = null;
  if (item?.price) {
    const meta = item.price.metadata ?? {};
    if (meta.product_ids) productIds = meta.product_ids.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (meta.tier_id) tierIds = [meta.tier_id];
    if (meta.bundle_id) bundleId = meta.bundle_id;
  }
  const row = {
    dealership_id: dealershipId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    stripe_price_id: stripePriceId,
    stripe_product_id: stripeProductId,
    bundle_id: bundleId,
    product_ids: productIds,
    tier_ids: tierIds,
    status: statusFromStripe(sub.status),
    billing_cycle: item?.price?.recurring?.interval === "year" ? "annual" : "monthly",
    monthly_amount: item?.price?.unit_amount != null ? Number(item.price.unit_amount) / 100 : null,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from("dealer_subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, dealership_id: dealershipId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;

  // Platform admin only.
  const { data: isAdmin } = await authed.admin.rpc("is_platform_admin", {
    _user_id: authed.user.id,
  });
  if (!isAdmin) return errorResponse("platform admin only", 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid json");
  }
  if (!body.event_id) return errorResponse("event_id required");

  // Look up the stripe_events row to confirm it exists.
  const { data: evtRow, error: evtErr } = await authed.admin
    .from("stripe_events")
    .select("id, type, processed_at")
    .eq("id", body.event_id)
    .maybeSingle();
  if (evtErr) return errorResponse(evtErr.message, 500);
  if (!evtRow) return errorResponse("event not found in stripe_events", 404);

  // Pull the live event from Stripe (the local row only stores
  // metadata for audit; the canonical payload lives upstream).
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.events.retrieve(body.event_id);
  } catch (e) {
    return errorResponse(`stripe retrieve failed: ${(e as Error).message}`, 502);
  }

  let result: { ok: boolean; error?: string; dealership_id?: string };
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      result = await applySubscriptionRow(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
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
      result = error ? { ok: false, error: error.message } : { ok: true };
      break;
    }
    default:
      result = { ok: true };
  }

  if (result.ok) {
    await authed.admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", body.event_id);
  }

  return jsonResponse({ replayed: result.ok, error: result.error, type: event.type });
});
