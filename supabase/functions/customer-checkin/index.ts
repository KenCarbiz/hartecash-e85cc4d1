// Customer self check-in edge function.
// See frontend-redesign/CLAUDE_CODE_BRIEF.md §7.
//
// Authenticates via the submission token (bearer credential carried in
// /check-in/:token), bypasses RLS via the service-role key, and exposes
// three actions:
//
//   - "fetch"      — read-only. Returns minimal shape for the page to
//                    render. No side effects.
//   - "on_the_way" — sets progress_status='on_the_way' and stamps
//                    on_the_way_at if not already set. Idempotent.
//   - "arrived"    — sets progress_status='arrived' and stamps
//                    arrived_at if not already set. Idempotent.
//
// Side effects of write actions:
//   - Insert one activity_log row with old_value/new_value
//   - Fire-and-forget `send-notification` invoke with trigger_key
//     "customer_on_the_way" or "customer_arrived" so the assigned
//     salesperson / BDC rep gets pinged.
//
// Terminal states (purchase_complete, dead_lead) are rejected — a
// customer who already closed shouldn't be marking themselves arrived
// for a stale link.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TERMINAL_STATUSES = new Set(["purchase_complete", "dead_lead"]);

interface RequestBody {
  token?: string;
  action?: "fetch" | "on_the_way" | "arrived";
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }

  const token = (body.token || "").trim();
  const action = body.action;
  if (!token || (action !== "fetch" && action !== "on_the_way" && action !== "arrived")) {
    return json(400, { error: "bad_request" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "server_misconfigured" });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Validate the token. We pull the minimum shape the page needs plus
  // the timestamps so we can short-circuit duplicate taps.
  const { data: sub, error: subErr } = await supabase
    .from("submissions")
    .select(
      "id, token, name, vehicle_year, vehicle_make, vehicle_model, progress_status, on_the_way_at, arrived_at, dealership_id",
    )
    .eq("token", token)
    .maybeSingle();

  if (subErr) {
    console.error("[customer-checkin] submission fetch failed:", subErr);
    return json(500, { error: "fetch_failed" });
  }
  if (!sub) {
    return json(404, { error: "not_found" });
  }

  const buildShape = (row: typeof sub) => ({
    token: row.token,
    name: row.name,
    vehicle: [row.vehicle_year, row.vehicle_make, row.vehicle_model]
      .filter(Boolean)
      .join(" ")
      .trim() || null,
    progress_status: row.progress_status,
    on_the_way_at: (row as any).on_the_way_at ?? null,
    arrived_at: (row as any).arrived_at ?? null,
  });

  if (action === "fetch") {
    return json(200, { ok: true, submission: buildShape(sub) });
  }

  // Reject taps against terminal-state leads. The link is stale.
  if (TERMINAL_STATUSES.has(sub.progress_status)) {
    return json(409, {
      error: "terminal_state",
      submission: buildShape(sub),
    });
  }

  // ── Idempotency ──
  // Tapping the same button twice is fine — the second call is a no-op
  // for the timestamp and skips the audit/notification side effects.
  // We still return the latest shape so the page can render the success
  // state.
  if (action === "on_the_way" && sub.progress_status === "on_the_way") {
    return json(200, { ok: true, deduped: true, submission: buildShape(sub) });
  }
  if (action === "arrived" && sub.progress_status === "arrived") {
    return json(200, { ok: true, deduped: true, submission: buildShape(sub) });
  }

  const oldStatus = sub.progress_status;
  const newStatus = action;
  const nowIso = new Date().toISOString();

  const updates: Record<string, unknown> = {
    progress_status: newStatus,
    status_updated_at: nowIso,
  };
  if (action === "on_the_way" && !(sub as any).on_the_way_at) {
    updates.on_the_way_at = nowIso;
  }
  if (action === "arrived" && !(sub as any).arrived_at) {
    updates.arrived_at = nowIso;
  }

  const { data: updated, error: updErr } = await supabase
    .from("submissions")
    .update(updates)
    .eq("id", sub.id)
    .select(
      "id, token, name, vehicle_year, vehicle_make, vehicle_model, progress_status, on_the_way_at, arrived_at",
    )
    .single();

  if (updErr || !updated) {
    console.error("[customer-checkin] update failed:", updErr);
    return json(500, { error: "update_failed" });
  }

  // Audit. submission_id is set, so this works regardless of whether
  // the activity_log.submission_id NULL migration has shipped.
  const { error: auditErr } = await supabase.from("activity_log").insert({
    submission_id: sub.id,
    action: "customer_self_checkin",
    old_value: oldStatus,
    new_value: newStatus,
    performed_by: "customer (self check-in)",
  });
  if (auditErr) {
    // Non-fatal — the customer already saw their tap take effect.
    console.error("[customer-checkin] audit insert failed:", auditErr);
  }

  // Notify staff. Fire-and-forget — we don't block the customer's
  // response on the email queue. send-notification handles routing to
  // the assigned salesperson / BDC rep based on trigger_key.
  const triggerKey =
    action === "arrived" ? "customer_arrived" : "customer_on_the_way";
  supabase.functions
    .invoke("send-notification", {
      body: { trigger_key: triggerKey, submission_id: sub.id },
    })
    .catch((e: unknown) => {
      console.error("[customer-checkin] send-notification dispatch failed:", e);
    });

  return json(200, {
    ok: true,
    submission: buildShape(updated as any),
  });
});
