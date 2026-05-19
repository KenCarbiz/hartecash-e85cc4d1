// @jwt-required — admin/cron only; default verify_jwt=true is correct.
// ─────────────────────────────────────────────────────────────────────────
//  billing-deactivate-rooftop — pilot-aware deactivation.
//
//  - During pilot (status='pilot' AND pilot_ends_at > now): cancel the
//    Stripe Subscription immediately, no proration. The "30 days no
//    penalty" promise.
//  - After pilot: cancel_at_period_end on the Stripe Subscription so
//    the dealer keeps access through the end of the paid month/year.
//
//  Authorization: caller must be a platform admin OR a group admin
//  for the activation's dealer_group_id.
// ─────────────────────────────────────────────────────────────────────────

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = {
  activation_id: string;
  reason?: string;
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
  if (!body.activation_id) return errorResponse("activation_id required");

  const { data: activation, error: actErr } = await authed.admin
    .from("rooftop_activations")
    .select("id, dealer_group_id, dealership_id, status, pilot_ends_at, stripe_subscription_id")
    .eq("id", body.activation_id)
    .maybeSingle();
  if (actErr) return errorResponse(actErr.message, 500);
  if (!activation) return errorResponse("activation not found", 404);

  // Authorization.
  const { data: isAdmin } = await authed.admin.rpc("is_platform_admin", {
    _user_id: authed.user.id,
  });
  if (!isAdmin) {
    const { data: isGroupAdmin } = await authed.admin.rpc("is_dealer_group_admin", {
      _user_id: authed.user.id,
      _group_id: (activation as any).dealer_group_id,
    });
    if (!isGroupAdmin) {
      return errorResponse("not authorized to deactivate this rooftop", 403);
    }
  }

  if (
    (activation as any).status !== "pilot" &&
    (activation as any).status !== "active"
  ) {
    return errorResponse(
      `activation already ${(activation as any).status}`,
      409,
    );
  }

  // Pilot vs post-pilot decision.
  const { data: inPilot } = await authed.admin.rpc("activation_in_pilot", {
    _activation_id: body.activation_id,
  });

  const stripe = getStripe();
  const subId = (activation as any).stripe_subscription_id as string | null;

  if (subId) {
    if (inPilot) {
      // Cancel immediately, no proration. The 30-day-no-penalty promise.
      await stripe.subscriptions.cancel(subId, {
        invoice_now: false,
        prorate: false,
      });
    } else {
      // Cancel at period end. Dealer keeps access through their paid window.
      await stripe.subscriptions.update(subId, {
        cancel_at_period_end: true,
        cancellation_details: {
          comment: body.reason ?? "Deactivated by group admin",
        },
      });
    }
  }

  // Update the activation row. The webhook will set the canonical
  // canceled_at on dealer_subscriptions when Stripe processes the
  // cancellation; here we just close the activation locally.
  const { error: updateErr } = await authed.admin
    .from("rooftop_activations")
    .update({
      status: inPilot ? "deactivated" : "active", // remains "active" until the period ends; webhook will set "deactivated"
      deactivated_at: inPilot ? new Date().toISOString() : null,
      deactivation_reason: body.reason ?? null,
    })
    .eq("id", body.activation_id);

  if (updateErr) {
    return errorResponse(`activation update failed: ${updateErr.message}`, 500);
  }

  return jsonResponse({
    kind: inPilot ? "immediate" : "scheduled",
    in_pilot: inPilot === true,
    activation_id: body.activation_id,
    message: inPilot
      ? "Rooftop deactivated immediately. No charge."
      : "Cancellation scheduled at end of current billing period.",
  });
});
