import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Cron-triggered function (every 15 min) that detects abandoned leads
 * (progress_status = 'partial') and sends a BDC alert via the send-notification function.
 *
 * Only notifies once per abandoned submission (checks notification_log).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find partial submissions from the last 30 minutes across all tenants
    // Each submission's dealership_id will be used by send-notification to scope config
    // (wider window to catch any missed, deduplication via notification_log)
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: partials, error: partialErr } = await supabase
      .from("submissions")
      .select("id, name, email, phone, vehicle_year, vehicle_make, vehicle_model, mileage, created_at")
      .eq("progress_status", "partial")
      .gte("created_at", cutoff);

    if (partialErr) throw partialErr;
    if (!partials || partials.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which ones have already been notified
    const subIds = partials.map((p: any) => p.id);
    const { data: alreadyNotified } = await supabase
      .from("notification_log")
      .select("submission_id")
      .eq("trigger_key", "abandoned_lead")
      .in("submission_id", subIds);

    const notifiedSet = new Set((alreadyNotified || []).map((n: any) => n.submission_id));
    const newAbandoned = partials.filter((p: any) => !notifiedSet.has(p.id));

    if (newAbandoned.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, already_notified: subIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification for each new abandoned lead
    const results: Array<{ id: string; result: string }> = [];

    for (const sub of newAbandoned) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_key: "abandoned_lead",
            submission_id: sub.id,
          }),
        });

        const text = await response.text();
        results.push({ id: sub.id, result: response.ok ? "sent" : text });
      } catch (err) {
        results.push({ id: sub.id, result: `error: ${(err as Error).message}` });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
