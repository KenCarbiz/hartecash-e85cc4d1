// ─────────────────────────────────────────────────────────────────────────
//  billing-activate-rooftop — activate a single rooftop under a dealer
//  group's master MSA. Creates a Stripe Subscription with a 30-day
//  pilot trial; inserts a rooftop_activations row; returns either a
//  Checkout URL (when the group has no Customer-level payment method
//  yet) or a confirmation that the subscription was created directly
//  (when the group already has a default payment method on file).
//
//  Authorization: caller must be a platform admin OR a group admin
//  for the requested dealer_group_id.
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

type Body = {
  dealer_group_id: string;
  dealership_id: string;
  location_id?: string | null;
  // Stripe Price metadata to resolve to. Same convention as
  // billing-subscribe: bundle_id+cycle picks the right Price.
  bundle_id: string;
  cycle: "monthly" | "annual";
  // Optional. If the group has no payment method on Customer yet,
  // we'll redirect to Checkout; otherwise we'll create the subscription
  // directly with the existing default payment method.
  origin?: string;
  notes?: string;
};

async function findPrice(
  stripe: Stripe,
  bundle_id: string,
  cycle: "monthly" | "annual",
): Promise<Stripe.Price | null> {
  const interval = cycle === "annual" ? "year" : "month";
  const list = await stripe.prices.list({
    active: true,
    type: "recurring",
    limit: 100,
  });
  for (const p of list.data) {
    if (p.recurring?.interval !== interval) continue;
    if ((p.metadata ?? {}).bundle_id === bundle_id) return p;
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
  if (!body.dealer_group_id) return errorResponse("dealer_group_id required");
  if (!body.dealership_id) return errorResponse("dealership_id required");
  if (!body.bundle_id) return errorResponse("bundle_id required");
  if (!body.cycle) return errorResponse("cycle required");

  // Authorization: platform admin OR group admin for this group.
  const { data: isAdmin } = await authed.admin.rpc("is_platform_admin", {
    _user_id: authed.user.id,
  });
  if (!isAdmin) {
    const { data: isGroupAdmin } = await authed.admin.rpc("is_dealer_group_admin", {
      _user_id: authed.user.id,
      _group_id: body.dealer_group_id,
    });
    if (!isGroupAdmin) {
      return errorResponse("not authorized to activate rooftops in this group", 403);
    }
  }

  // Sanity-check: the dealership belongs to this group (or is being
  // attached). We don't auto-attach here — the platform admin must
  // assign the dealership to the group first.
  const { data: dealerAccount } = await authed.admin
    .from("dealer_accounts")
    .select("dealer_group_id")
    .eq("dealership_id", body.dealership_id)
    .maybeSingle();
  if (!dealerAccount) {
    return errorResponse(`dealership ${body.dealership_id} not found`, 404);
  }
  if ((dealerAccount as any).dealer_group_id !== body.dealer_group_id) {
    return errorResponse(
      `dealership ${body.dealership_id} is not attached to group ${body.dealer_group_id}. Assign it via the dealer_accounts admin first.`,
      400,
    );
  }

  // No double-activation: refuse if there's already a pilot or active
  // row for the same tuple.
  const { data: existing } = await authed.admin
    .from("rooftop_activations")
    .select("id, status")
    .eq("dealer_group_id", body.dealer_group_id)
    .eq("dealership_id", body.dealership_id)
    .in("status", ["pilot", "active"])
    .maybeSingle();
  if (existing) {
    return errorResponse(
      `rooftop already activated (${(existing as any).status}). Deactivate first.`,
      409,
    );
  }

  const stripe = getStripe();

  // Find the Price for this bundle+cycle.
  const price = await findPrice(stripe, body.bundle_id, body.cycle);
  if (!price) {
    return errorResponse(
      `No active Stripe Price for bundle "${body.bundle_id}" cycle "${body.cycle}"`,
      404,
    );
  }

  const customerId = await ensureStripeCustomer(authed, stripe);

  // Insert the activation row first so the webhook can find it via
  // the Stripe metadata link we'll set on the Subscription.
  const { data: activationRow, error: actErr } = await authed.admin
    .from("rooftop_activations")
    .insert({
      dealer_group_id: body.dealer_group_id,
      dealership_id: body.dealership_id,
      location_id: body.location_id ?? null,
      status: "pilot",
      activated_at: new Date().toISOString(),
      pilot_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      activated_by_user_id: authed.user.id,
      notes: body.notes ?? null,
    })
    .select("id, pilot_ends_at")
    .single();

  if (actErr || !activationRow) {
    return errorResponse(`activation insert failed: ${actErr?.message ?? "unknown"}`, 500);
  }

  // Stripe Subscription path:
  //   - 30-day trial (matches the pilot window)
  //   - metadata back-link to activation row + dealership for the webhook
  //
  // If the Customer already has a default payment method on file (set
  // up during the group's first activation via Checkout), we can
  // create the Subscription directly. Otherwise we redirect to
  // Checkout for the first card.
  const customer = await stripe.customers.retrieve(customerId);
  const hasDefaultMethod =
    !(customer as any).deleted &&
    !!((customer as Stripe.Customer).invoice_settings?.default_payment_method ||
       (customer as Stripe.Customer).default_source);

  if (hasDefaultMethod) {
    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id, quantity: 1 }],
      trial_period_days: 30,
      metadata: {
        rooftop_activation_id: (activationRow as any).id,
        dealer_group_id: body.dealer_group_id,
        dealership_id: body.dealership_id,
        location_id: body.location_id ?? "",
        activation_kind: "rooftop_under_msa",
      },
      // After trial, charge automatically using saved method.
      payment_settings: {
        payment_method_types: ["card", "us_bank_account"],
        save_default_payment_method: "on_subscription",
      },
    });

    // Stamp the subscription id immediately for fast UI feedback.
    // The webhook will arrive in seconds and overwrite the rest.
    await authed.admin
      .from("rooftop_activations")
      .update({ stripe_subscription_id: sub.id })
      .eq("id", (activationRow as any).id);

    return jsonResponse({
      kind: "direct",
      activation_id: (activationRow as any).id,
      subscription_id: sub.id,
      pilot_ends_at: (activationRow as any).pilot_ends_at,
    });
  }

  // No default method → Checkout flow.
  if (!body.origin) {
    return errorResponse(
      "origin required when group has no payment method on file (Checkout flow)",
      400,
    );
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: {
        rooftop_activation_id: (activationRow as any).id,
        dealer_group_id: body.dealer_group_id,
        dealership_id: body.dealership_id,
        location_id: body.location_id ?? "",
        activation_kind: "rooftop_under_msa",
      },
    },
    success_url: `${body.origin}/group?activated=${(activationRow as any).id}`,
    cancel_url: `${body.origin}/group?canceled=${(activationRow as any).id}`,
    allow_promotion_codes: true,
  });

  return jsonResponse({
    kind: "checkout",
    activation_id: (activationRow as any).id,
    url: session.url,
    pilot_ends_at: (activationRow as any).pilot_ends_at,
  });
});
