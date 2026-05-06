// Boost-evaluate the customer's photo set and apply the bump.
//
// Called from BoostOfferClarity after the six required shots have
// uploaded. Right now the bump amount is computed deterministically
// on the client (photo count + a base + a condition modifier) and
// passed in — this function's job is to:
//   1. validate the bump is plausible (caps at $2,000, never negative)
//   2. write the new offered_price to submissions
//   3. record an audit row in offer_bumps so the dealer can see why
//      the price moved (and so we can replace deterministic with
//      analyze-vehicle-damage aggregation later without rewiring
//      the frontend)
//
// Token-authenticated. No JWT — the same opaque submission token
// the customer already has via the magic-link URL is the auth.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BUMP = 2000;          // never bump more than $2k in one shot
const BUMP_FLOOR_GUARD = 0;     // bumps can never reduce the offer

interface BumpLineItem {
  label: string;     // "Tires above 50% tread"
  amount: number;    // 150
  source?: string;   // "ai" | "shot:tires_wheels" | "condition"
}

interface ApplyBody {
  token: string;
  bump_amount: number;
  line_items?: BumpLineItem[];
  source?: string;       // "boost_offer"
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ApplyBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.token || typeof body.bump_amount !== "number") {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Clamp the bump — never negative, never above MAX_BUMP. Client
  // shouldn't be sending values outside this range but we defend
  // against bad input.
  const bump = Math.max(BUMP_FLOOR_GUARD, Math.min(MAX_BUMP, Math.round(body.bump_amount)));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Fetch the current offered_price + every fallback the offer
  // page reads from. offered_price is frequently NULL in practice
  // (lookups that didn't run a firm appraisal yet, demo-mode rows,
  // older submissions) — in that case the customer is looking at
  // a number computed from estimated_offer_high / bb_tradein_avg /
  // bb_wholesale_avg. Without this fallback, the bump would
  // overwrite NULL → just-the-bump-amount and the customer would
  // see "$750" instead of "$24,749" on the receipt.
  const { data: row, error: readErr } = await supabase
    .from("submissions")
    .select(
      "id, offered_price, estimated_offer_high, bb_tradein_avg, bb_wholesale_avg, dealership_id",
    )
    .eq("token", body.token)
    .maybeSingle();

  if (readErr || !row) {
    console.error("[boost-apply-offer] submission not found", readErr?.message);
    return new Response(JSON.stringify({ error: "submission_not_found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mirror the OfferPageClarity / OfferPage fallback order. First
  // truthy value wins. This is the same number the customer was
  // staring at on the offer page when they clicked Save, so the
  // bump arithmetic on the receipt matches their mental model.
  const currentOffer =
    Number(row.offered_price) ||
    Number(row.estimated_offer_high) ||
    Number(row.bb_tradein_avg) ||
    Number(row.bb_wholesale_avg) ||
    0;
  // Floor-locked promise from the boost page: the offer can only
  // go up. If the current price is somehow null/0 we still apply
  // the bump as the new floor.
  const newOffer = currentOffer + bump;

  const { error: updateErr } = await supabase
    .from("submissions")
    .update({
      offered_price: newOffer,
      updated_at: new Date().toISOString(),
    })
    .eq("token", body.token);

  if (updateErr) {
    console.error("[boost-apply-offer] update failed", updateErr.message);
    return new Response(JSON.stringify({ error: "update_failed", detail: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Audit row — best-effort, don't fail the whole request if the
  // table doesn't exist yet on this environment. The dealer-side
  // file detail view picks this up to show the bump reasons.
  try {
    await supabase.from("offer_bumps").insert({
      submission_id: row.id,
      dealership_id: row.dealership_id,
      previous_offer: currentOffer,
      new_offer: newOffer,
      bump_amount: bump,
      line_items: body.line_items ?? [],
      source: body.source || "boost_offer",
    });
  } catch (e) {
    console.warn("[boost-apply-offer] audit insert skipped:", (e as Error).message);
  }

  return new Response(
    JSON.stringify({
      previous_offer: currentOffer,
      new_offer: newOffer,
      bump_amount: bump,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
