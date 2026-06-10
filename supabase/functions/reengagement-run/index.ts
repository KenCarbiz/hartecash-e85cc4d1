// @jwt-required — admin/cron only; default verify_jwt=true is correct.
//
// Re-engagement journey runner. Pulls due targets from
// get_reengagement_targets() (already opt-out + cadence filtered) and,
// WHEN EXPLICITLY ENABLED, sends each via send-notification (which
// re-checks consent at send time and logs to notification_log, closing
// the 8-day cadence loop).
//
// SAFETY — sends nothing unless BOTH are true:
//   1. the request sets `dryRun: false`, AND
//   2. the env var REENGAGEMENT_LIVE === "true".
// Default (no body / any other input) = DRY RUN: returns who it *would*
// message and sends nothing. This makes the function inert on deploy and
// safe to invoke for preview. A per-run cap bounds blast size. Outbound
// is still TCPA/CAN-SPAM gated downstream by send-notification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Target {
  submission_id: string;
  name: string | null;
  vehicle: string | null;
  days_left: number;
  bucket: string;
  suggested_trigger: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json().catch(() => ({}))) as {
      dryRun?: boolean;
      dealership_id?: string;
      maxSends?: number;
    };

    // Sending requires an explicit non-dry-run request AND the env gate.
    const wantsSend = body.dryRun === false;
    const liveEnabled = Deno.env.get("REENGAGEMENT_LIVE") === "true";
    const live = wantsSend && liveEnabled;
    const maxSends = Math.min(Number(body.maxSends) || 200, 500);

    // Which dealerships to process.
    let dealerships: string[];
    if (body.dealership_id) {
      dealerships = [body.dealership_id];
    } else {
      const { data: tenants } = await supabase.from("tenants").select("dealership_id");
      dealerships = (tenants || []).map((t: { dealership_id: string }) => t.dealership_id);
    }

    // Gather due targets (already consent + cadence filtered by the RPC).
    const targets: (Target & { dealership_id: string })[] = [];
    for (const d of dealerships) {
      const { data, error } = await supabase.rpc("get_reengagement_targets", { p_dealership_id: d });
      if (error) continue; // RPC not deployed / no access — skip this tenant
      for (const t of (data || []) as Target[]) targets.push({ ...t, dealership_id: d });
    }

    // DRY RUN (default) — return the plan, send nothing.
    if (!live) {
      return json({
        mode: wantsSend && !liveEnabled ? "blocked_env_off" : "dry_run",
        would_send: targets.length,
        note:
          wantsSend && !liveEnabled
            ? "Refusing to send: set REENGAGEMENT_LIVE=true to enable real sends."
            : "Dry run — nothing was sent. Pass { dryRun: false } and set REENGAGEMENT_LIVE=true to send.",
        sample: targets.slice(0, 50).map((t) => ({
          dealership_id: t.dealership_id,
          submission_id: t.submission_id,
          name: t.name,
          vehicle: t.vehicle,
          days_left: t.days_left,
          bucket: t.bucket,
          trigger: t.suggested_trigger,
        })),
      });
    }

    // LIVE SEND — each routes through send-notification (re-checks consent,
    // logs to notification_log). Bounded by maxSends.
    const results: { submission_id: string; trigger: string; ok: boolean; detail?: string }[] = [];
    let sent = 0;
    for (const t of targets) {
      if (sent >= maxSends) break;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ trigger_key: t.suggested_trigger, submission_id: t.submission_id }),
        });
        const text = await resp.text();
        results.push({ submission_id: t.submission_id, trigger: t.suggested_trigger, ok: resp.ok, detail: resp.ok ? undefined : text });
        if (resp.ok) sent += 1;
      } catch (err) {
        results.push({ submission_id: t.submission_id, trigger: t.suggested_trigger, ok: false, detail: (err as Error).message });
      }
    }

    return json({ mode: "live", eligible: targets.length, attempted: results.length, sent, capped: targets.length > maxSends, results });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
