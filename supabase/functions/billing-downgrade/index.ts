// Schedule a plan change to take effect at the end of the current period.
// Used for downgrades (bundle → single app, elite → pro, annual → monthly).
// Creates a Stripe SubscriptionSchedule so the current subscription
// continues exactly as-is until the period ends, then switches to the
// target items. No proration — dealers finish what they paid for.

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getActiveSubscriptionId,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = {
  // Target state after the current period ends. Each entry is a Stripe
  // price id; quantity defaults to 1.
  target_items: { price: string; quantity?: number }[];
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
  if (!Array.isArray(body.target_items) || body.target_items.length === 0) {
    return errorResponse("target_items required");
  }

  try {
    const subId = await getActiveSubscriptionId(authed);
    if (!subId) return errorResponse("no active subscription", 409);

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);

    const currentItems = sub.items.data.map((i) => ({
      price: i.price.id,
      quantity: i.quantity ?? 1,
    }));

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: sub.id,
    });

    const updated = await stripe.subscriptionSchedules.update(schedule.id, {
      phases: [
        {
          items: currentItems,
          start_date: sub.current_period_start,
          end_date: sub.current_period_end,
          proration_behavior: "none",
        },
        {
          items: body.target_items.map((i) => ({
            price: i.price,
            quantity: i.quantity ?? 1,
          })),
          proration_behavior: "none",
        },
      ],
      metadata: { tenant_id: authed.tenant.id, last_action: "downgrade" },
    });

    return jsonResponse({
      schedule_id: updated.id,
      effective_at: new Date(sub.current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
