// ─────────────────────────────────────────────────────────────────────────
//  billing-subscribe — high-level Checkout entry point for the picker.
//
//  Takes a PlanSelection (bundle or tiers, cycle, rooftopCount) and
//  produces a Stripe Checkout Session URL. The picker doesn't need
//  to know any Stripe Price IDs — this function looks them up by
//  metadata convention.
//
//  Stripe Dashboard convention (set at Price creation time):
//
//    Bundle Prices:
//      metadata.bundle_id     = "all_apps_unlimited"
//      metadata.cycle         = "monthly" | "annual"
//
//    Tier Prices:
//      metadata.tier_id       = "autocurb_pro"
//      metadata.cycle         = "monthly" | "annual"
//
//  See docs/billing-stripe-setup.md for the full setup runbook.
// ─────────────────────────────────────────────────────────────────────────

import {
  authenticate,
  corsHeaders,
  ensureStripeCustomer,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

type Selection =
  | { kind: "bundle"; bundleId: string; cycle: "monthly" | "annual"; rooftopCount: number }
  | { kind: "tiers"; tierIds: string[]; cycle: "monthly" | "annual"; rooftopCount: number };

type Body = {
  selection: Selection;
  origin: string;        // window.location.origin from the browser
  return_path?: string;  // where to land after Checkout — default "/plan"
  skip_trial?: boolean;
};

// Find an active Stripe Price whose metadata matches the given filters.
async function findPrice(
  stripe: Stripe,
  filters: { bundle_id?: string; tier_id?: string; cycle: "monthly" | "annual" },
): Promise<Stripe.Price | null> {
  // Stripe's prices.search supports metadata filters, but the syntax is
  // limited. We search by interval first (built-in) then filter by
  // metadata in code — small page sizes so this stays fast.
  const interval = filters.cycle === "annual" ? "year" : "month";
  const list = await stripe.prices.list({
    active: true,
    type: "recurring",
    limit: 100,
    expand: ["data.product"],
  });
  const candidates = list.data.filter((p) => p.recurring?.interval === interval);
  for (const p of candidates) {
    const meta = p.metadata ?? {};
    if (filters.bundle_id && meta.bundle_id === filters.bundle_id) return p;
    if (filters.tier_id && meta.tier_id === filters.tier_id) return p;
  }
  return null;
}

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
  if (!body.selection) return errorResponse("selection required");
  if (!body.origin) return errorResponse("origin required");

  const stripe = getStripe();

  // Resolve the selection → Stripe Price line items.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const rooftopQty = Math.max(1, body.selection.rooftopCount || 1);

  if (body.selection.kind === "bundle") {
    const price = await findPrice(stripe, {
      bundle_id: body.selection.bundleId,
      cycle: body.selection.cycle,
    });
    if (!price) {
      return errorResponse(
        `No active Stripe Price for bundle "${body.selection.bundleId}" cycle "${body.selection.cycle}". Configure it in the Stripe Dashboard with metadata.bundle_id and metadata.cycle set.`,
        404,
      );
    }
    lineItems.push({ price: price.id, quantity: rooftopQty });
  } else {
    // tiers: one line item per tier
    for (const tierId of body.selection.tierIds) {
      const price = await findPrice(stripe, {
        tier_id: tierId,
        cycle: body.selection.cycle,
      });
      if (!price) {
        return errorResponse(
          `No active Stripe Price for tier "${tierId}" cycle "${body.selection.cycle}".`,
          404,
        );
      }
      lineItems.push({ price: price.id, quantity: rooftopQty });
    }
  }
  if (lineItems.length === 0) return errorResponse("no resolvable line items");

  // Ensure the Customer exists with metadata.dealership_id set so the
  // webhook can attribute events back to the right tenant.
  const customerId = await ensureStripeCustomer(authed, stripe);

  const returnPath = body.return_path && body.return_path.startsWith("/")
    ? body.return_path
    : "/plan";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    subscription_data: {
      // 14-day trial unless explicitly skipped (e.g. for a re-subscribe
      // after cancellation).
      trial_period_days: body.skip_trial ? undefined : 14,
      metadata: {
        dealership_id: authed.tenant.dealership_id,
        tenant_id: authed.tenant.id,
        selection_kind: body.selection.kind,
      },
    },
    // The dealer is in /plan when they click subscribe. Send them back
    // there with a flag so the page can show "you're subscribed" instead
    // of the picker.
    success_url: `${body.origin}${returnPath}?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${body.origin}${returnPath}?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  return jsonResponse({ url: session.url, session_id: session.id });
});
