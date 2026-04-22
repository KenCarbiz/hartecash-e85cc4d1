// Create a Stripe Customer Portal session. Called from the /billing
// page on Autocurb AND from every sister app's "Manage billing" link.
//
// The Customer Portal itself is configured in the Stripe Dashboard with
// "Switch plans" DISABLED — plan changes go through our own /billing UI
// so metadata and entitlements stay in sync.

import {
  authenticate,
  corsHeaders,
  ensureStripeCustomer,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type Body = { return_url?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — default return_url to the canonical billing page.
  }

  try {
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(authed, stripe);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: body.return_url || "https://autocurb.io/billing",
    });
    return jsonResponse({ url: session.url });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
