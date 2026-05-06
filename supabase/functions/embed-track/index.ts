// Embed v3 analytics firehose. The dealer-side loader (public/embed.js)
// posts a small set of event types here whenever the inventory-aware
// widget renders, the customer interacts with it, or the iframe
// broadcasts a state change. We validate origin loosely (events are
// effectively public — the data is already on the customer's page),
// resolve the dealership to confirm it exists, and write to embed_events.
//
// The function is idempotent at the row level (each event gets a fresh
// UUID), but the loader includes a session_id so dealers can bucket
// activity into visitor sessions in their dashboard.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Whitelist of event types we accept. New types added here should
// be cheap to capture and useful in the dealer dashboard.
const ALLOWED_EVENT_TYPES = new Set([
  "widget_loaded",      // floating button or inline iframe rendered
  "vehicle_detected",   // a strategy successfully extracted vehicle context
  "pill_clicked",       // customer tapped the floating pill
  "overlay_opened",     // iframe overlay actually mounted
  "overlay_closed",     // overlay dismissed (Esc / backdrop / X)
  "escalation_fired",   // tier 2 toast or tier 3 auto-open triggered
  "state_received",     // iframe broadcast a hartecash-state-change
  "offer_made",         // shortcut for "iframe just produced an offer"
  "deal_accepted",      // shortcut for "iframe just accepted a deal"
]);

// Loose payload size cap so a misbehaving loader can't DOS the table.
const MAX_PAYLOAD_BYTES = 4096;

interface TrackBody {
  dealer_id: string;
  events: Array<{
    event_type: string;
    intent?: string;
    tier?: number;
    vehicle_label?: string;
    vehicle_msrp?: number;
    submission_token?: string;
    page_url?: string;
    session_id?: string;
    payload?: Record<string, unknown>;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: TrackBody;
  try {
    const text = await req.text();
    if (text.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body || !body.dealer_id || !Array.isArray(body.events) || body.events.length === 0) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Normalize + filter events. Anything we don't recognize is dropped
  // silently — clients running an old embed.js version on a new server
  // shouldn't 400 the whole batch.
  const userAgent = req.headers.get("user-agent") || null;
  const rows = body.events
    .filter((e) => e && typeof e.event_type === "string" && ALLOWED_EVENT_TYPES.has(e.event_type))
    .slice(0, 50) // cap batch size — loader currently sends 1-3 at a time
    .map((e) => ({
      dealership_id: body.dealer_id,
      event_type: e.event_type,
      intent: typeof e.intent === "string" ? e.intent.slice(0, 32) : null,
      tier: typeof e.tier === "number" ? Math.max(0, Math.min(3, Math.floor(e.tier))) : null,
      vehicle_label: typeof e.vehicle_label === "string" ? e.vehicle_label.slice(0, 200) : null,
      vehicle_msrp: typeof e.vehicle_msrp === "number" && e.vehicle_msrp >= 0 ? e.vehicle_msrp : null,
      submission_token: typeof e.submission_token === "string" ? e.submission_token.slice(0, 64) : null,
      page_url: typeof e.page_url === "string" ? e.page_url.slice(0, 500) : null,
      user_agent: userAgent,
      session_id: typeof e.session_id === "string" ? e.session_id.slice(0, 64) : null,
      payload: e.payload && typeof e.payload === "object" ? e.payload : {},
    }));

  if (rows.length === 0) {
    return new Response(JSON.stringify({ accepted: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Confirm the dealership exists before writing — keeps random
  // POST traffic from filling the table with bogus rows. Soft fail
  // to 200 so a misconfigured embed snippet doesn't cause client
  // errors that the dealer notices in their console.
  const { data: dealer } = await supabase
    .from("dealerships")
    .select("id")
    .eq("id", body.dealer_id)
    .maybeSingle();

  if (!dealer) {
    return new Response(JSON.stringify({ accepted: 0, warning: "unknown_dealer" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase.from("embed_events").insert(rows);
  if (error) {
    console.error("[embed-track] insert error", error.message);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ accepted: rows.length }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
