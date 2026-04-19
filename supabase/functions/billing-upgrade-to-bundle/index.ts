// Swap every current SubscriptionItem for a single bundle item. Used
// when a dealer with 2+ à la carte apps clicks "Upgrade to Suite".
//
// Proration is turned on (dealers get credit for the unused portion of
// their current items). billing_cycle_anchor is preserved so their
// renewal date doesn't shift. The webhook handles the entitlements
// rewrite — this endpoint only mutates Stripe.

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getActiveSubscriptionId,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = { bundle_price: string };

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
  if (!body.bundle_price) return errorResponse("bundle_price required");

  try {
    const subId = await getActiveSubscriptionId(authed);
    if (!subId) {
      return errorResponse("no active subscription; use billing-checkout", 409);
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);

    const itemsToRemove = sub.items.data.map((i: any) => ({
      id: i.id,
      deleted: true as const,
    }));

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [...itemsToRemove, { price: body.bundle_price }],
      proration_behavior: "create_prorations",
      billing_cycle_anchor: "unchanged",
      metadata: { ...sub.metadata, last_action: "upgrade_to_bundle" },
    });

    return jsonResponse({ subscription_id: updated.id });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
