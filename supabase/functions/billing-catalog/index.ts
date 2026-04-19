// Return the active Stripe Price catalog grouped by app_slug/plan_tier.
// The /billing UI calls this on mount so it can render cards without
// any price_id constants in client code. "Price metadata is the API."
//
// We filter to prices whose metadata.app_slug is set — any legacy
// Stripe prices in the account without that metadata are ignored.

import {
  corsHeaders,
  errorResponse,
  getStripe,
  jsonResponse,
} from "../_shared/billing.ts";

type CatalogEntry = {
  price_id: string;
  product_id: string;
  product_name: string;
  nickname: string | null;
  app_slug: string;
  plan_tier: string;
  includes_apps: string[];
  interval: "month" | "year" | "week" | "day" | null;
  unit_amount: number | null;
  currency: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("method not allowed", 405);
  }

  try {
    const stripe = getStripe();
    const entries: CatalogEntry[] = [];
    let startingAfter: string | undefined;

    // Stripe paginates at 100 per page — for 5 products × ~4 prices
    // each (~20 prices total) one page is plenty, but we loop for safety.
    while (true) {
      const page = await stripe.prices.list({
        active: true,
        limit: 100,
        expand: ["data.product"],
        starting_after: startingAfter,
      });
      for (const price of page.data) {
        const meta = price.metadata || {};
        if (!meta.app_slug || !meta.plan_tier) continue;
        const product = price.product as unknown as {
          id: string;
          name: string;
          active: boolean;
        };
        if (!product?.active) continue;
        const raw = (meta.includes_apps || meta.app_slug || "").trim();
        let includes: string[] = [];
        if (raw.startsWith("[")) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              includes = parsed.map((s) => String(s).trim()).filter(Boolean);
            }
          } catch {
            // fall through
          }
        }
        if (includes.length === 0) {
          includes = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
        entries.push({
          price_id: price.id,
          product_id: product.id,
          product_name: product.name,
          nickname: price.nickname,
          app_slug: meta.app_slug,
          plan_tier: meta.plan_tier,
          includes_apps: includes,
          interval: price.recurring?.interval ?? null,
          unit_amount: price.unit_amount,
          currency: price.currency,
        });
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
      if (!startingAfter) break;
    }

    return jsonResponse({ prices: entries });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
