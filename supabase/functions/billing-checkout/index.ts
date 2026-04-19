// Create a Stripe Checkout session for the signed-in dealer. Used for
// both brand-new subscriptions (no existing sub) AND for upsell flows
// that send the dealer back to /billing from a sister app.
//
// The line_items are supplied by the caller as Stripe price_id values.
// Never map slugs→price_ids in code — always let the caller pick the
// price shown in the UI. (The UI itself queries the Stripe Dashboard's
// active prices via metadata — there's no price-id constants module.)

import {
  authenticate,
  corsHeaders,
  ensureStripeCustomer,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = {
  // Array of { price: string, quantity?: number }. Usually length 1 (one
  // per-app item or one bundle item), but supports mixed multi-item
  // signup in a single checkout.
  line_items: { price: string; quantity?: number }[];
  // Origin for success/cancel URLs. The browser sends window.location.origin.
  origin: string;
  // Optional param from sister-app handoff, e.g. "autolabels".
  source_app?: string;
  // Disable the 14-day trial (e.g. for upgrades from an expired state).
  skip_trial?: boolean;
};

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

  if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
    return errorResponse("line_items required");
  }
  if (!body.origin || typeof body.origin !== "string") {
    return errorResponse("origin required");
  }

  const stripe = getStripe();

  try {
    const customerId = await ensureStripeCustomer(authed, stripe);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: body.line_items.map((i) => ({
        price: i.price,
        quantity: i.quantity ?? 1,
      })),
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      metadata: {
        tenant_id: authed.tenant.id,
        user_id: authed.user.id,
        source_app: body.source_app ?? "autocurb",
      },
      subscription_data: {
        trial_period_days: body.skip_trial ? undefined : 14,
        metadata: {
          tenant_id: authed.tenant.id,
          source_app: body.source_app ?? "autocurb",
        },
      },
      success_url: `${body.origin}/billing?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${body.origin}/billing?canceled=1`,
    });

    return jsonResponse({ url: session.url, id: session.id });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
