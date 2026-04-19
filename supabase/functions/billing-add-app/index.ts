// Append a new SubscriptionItem to the tenant's existing subscription.
// Used when a dealer already owns (say) AutoLabels and adds AutoFilm
// à la carte. Stripe prorates and the webhook replays state through
// autocurb_sync_entitlements — this endpoint just mutates Stripe.
//
// If the tenant has NO active subscription, return a 409 so the client
// can fall back to /billing-checkout (a fresh Checkout session). We
// don't try to bootstrap subscriptions here — Checkout is the only
// route that collects payment method + trial + tax.

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getActiveSubscriptionId,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = { price: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid json");
  }
  if (!body.price) return errorResponse("price required");

  try {
    const subId = await getActiveSubscriptionId(authed);
    if (!subId) {
      return errorResponse("no active subscription; use billing-checkout", 409);
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ price: body.price }],
      proration_behavior: "create_prorations",
      metadata: { ...sub.metadata, last_action: "add_app" },
    });

    return jsonResponse({ subscription_id: updated.id });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
