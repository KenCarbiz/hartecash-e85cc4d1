// ─────────────────────────────────────────────────────────────────────────
//  billing-list-invoices — list the caller's recent Stripe invoices
//  for inline display on the /plan page.
//
//  Stripe Customer Portal is the canonical place for full invoice
//  history; this endpoint exists so /plan can show a quick summary
//  inline (last 5 invoices, with status + downloadable PDF link)
//  without a portal round-trip.
// ─────────────────────────────────────────────────────────────────────────

import {
  authenticate,
  corsHeaders,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return errorResponse("method not allowed", 405);

  const authed = await authenticate(req);
  if (authed instanceof Response) return authed;

  if (!authed.tenant.stripe_customer_id) {
    return jsonResponse({ invoices: [] });
  }

  const stripe = getStripe();

  try {
    const list = await stripe.invoices.list({
      customer: authed.tenant.stripe_customer_id,
      limit: 5,
    });

    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: (inv.amount_due ?? 0) / 100,
      amount_paid: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));

    return jsonResponse({ invoices });
  } catch (e) {
    return errorResponse(`stripe list failed: ${(e as Error).message}`, 502);
  }
});
