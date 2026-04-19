// Central Stripe webhook for the Autocurb Suite (autocurb, autolabels,
// autofilm, autoframe). The shared Supabase project owns app_entitlements;
// this function is the only writer.
//
// Responsibilities:
//  - Verify Stripe signature.
//  - Translate subscription.items[].price.metadata into app_entitlements
//    rows via the shared RPC autocurb_sync_entitlements.
//  - Flip rows to past_due / active on invoice events.
//  - Cancel all rows on subscription.deleted via autocurb_cancel_subscription.
//  - Insert an audit_log row for each high-level billing action (hash chain
//    is maintained by a DB trigger — we just INSERT).
//
// Price metadata contract (set in the Stripe Dashboard, NEVER in code):
//   price.metadata.app_slug       string           e.g. "autolabels" or "autocurb-suite"
//   price.metadata.plan_tier      string           e.g. "pro", "bundle-pro"
//   price.metadata.includes_apps  csv, optional    e.g. "autocurb,autolabels,autofilm,autoframe"
//
// If includes_apps is missing, we fall back to [app_slug].

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const admin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

type EntitlementItem = {
  app_slug: string;
  plan_tier: string;
  status: string;
  stripe_subscription_id: string;
  stripe_subscription_item_id: string;
  expires_at: string;
  includes_apps: string[];
};

function serializeItem(
  i: Stripe.SubscriptionItem,
  sub: Stripe.Subscription,
): EntitlementItem {
  const meta = i.price.metadata || {};
  const appSlug = meta.app_slug ?? "";
  const planTier = meta.plan_tier ?? "";
  const rawIncludes = meta.includes_apps ?? appSlug;
  const includes_apps = rawIncludes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    app_slug: appSlug,
    plan_tier: planTier,
    includes_apps,
    stripe_subscription_item_id: i.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    expires_at: new Date(sub.current_period_end * 1000).toISOString(),
  };
}

async function syncFromSubscription(
  sub: Stripe.Subscription,
  tenantId: string,
) {
  const items = sub.items.data.map((i) => serializeItem(i, sub));
  const { error } = await admin.rpc("autocurb_sync_entitlements", {
    p_tenant_id: tenantId,
    p_items: items,
  });
  if (error) throw new Error(`autocurb_sync_entitlements: ${error.message}`);
  return items;
}

async function audit(
  action: string,
  entityId: string,
  tenantId: string | null,
  details: Record<string, unknown>,
) {
  await admin.from("audit_log").insert({
    action,
    entity_type: "stripe_subscription",
    entity_id: entityId,
    store_id: tenantId,
    details,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing stripe-signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (e) {
    return new Response(`bad signature: ${(e as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;
        const userId = session.metadata?.user_id ?? null;
        if (!tenantId || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price.product"] },
        );
        const items = await syncFromSubscription(sub, tenantId);
        await audit("subscription_activated", sub.id, tenantId, {
          user_id: userId,
          checkout_session_id: session.id,
          items: items.map((i) => ({
            app_slug: i.app_slug,
            plan_tier: i.plan_tier,
          })),
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) {
          // Subscriptions created outside our checkout won't have this.
          // Skip rather than guess.
          break;
        }
        const items = await syncFromSubscription(sub, tenantId);
        await audit(
          event.type === "customer.subscription.created"
            ? "subscription_created"
            : "subscription_updated",
          sub.id,
          tenantId,
          {
            status: sub.status,
            last_action: sub.metadata?.last_action ?? null,
            items: items.map((i) => ({
              app_slug: i.app_slug,
              plan_tier: i.plan_tier,
            })),
          },
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error } = await admin.rpc("autocurb_cancel_subscription", {
          p_stripe_subscription_id: sub.id,
        });
        if (error) {
          throw new Error(`autocurb_cancel_subscription: ${error.message}`);
        }
        await audit(
          "subscription_canceled",
          sub.id,
          sub.metadata?.tenant_id ?? null,
          { canceled_at: new Date().toISOString() },
        );
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription) break;
        const subId = inv.subscription as string;
        await admin
          .from("app_entitlements")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subId);
        await audit("payment_failed", subId, null, {
          invoice_id: inv.id,
          amount_due: inv.amount_due,
          attempt_count: inv.attempt_count,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription) break;
        const subId = inv.subscription as string;
        // Only recover rows that were parked as past_due. Don't touch rows
        // that are trial / canceled / paused.
        await admin
          .from("app_entitlements")
          .update({ status: "active" })
          .eq("stripe_subscription_id", subId)
          .eq("status", "past_due");
        await audit("payment_succeeded", subId, null, {
          invoice_id: inv.id,
          amount_paid: inv.amount_paid,
        });
        break;
      }

      default:
        // Unhandled but valid Stripe event — ack so it doesn't retry.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries. Never swallow a sync failure silently.
    return new Response(
      JSON.stringify({ error: (err as Error).message, event: event.type }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response("ok", { status: 200 });
});
