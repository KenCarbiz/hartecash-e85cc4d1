// @jwt-required — admin/cron only; default verify_jwt=true is correct.
// RETIRED — superseded by `boost-evaluate`, which performs the
// server-side AI verification of uploaded photos before applying any
// bump. The old endpoint accepted a client-supplied `bump_amount`
// authenticated only by the submission token, which let any customer
// inflate their offer up to $2,000 with no photo evidence.
//
// We keep the function deployed so any stale magic-link clients fail
// loudly with 410 Gone instead of silently 404ing or — worse — being
// re-enabled by accident. To reinstate, route to `boost-evaluate`.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "endpoint_retired",
      message:
        "boost-apply-offer has been retired. Use boost-evaluate, which verifies uploaded photos server-side before applying any bump.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
