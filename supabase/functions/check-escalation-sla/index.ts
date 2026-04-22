import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * check-escalation-sla — runs every 10 minutes. Finds escalations
 * that have been open > 30 minutes AND haven't yet had their SLA
 * breach alert fired, then fires the staff_escalation_overdue
 * notification so someone in management grabs the lead.
 *
 * Keeps escalations from dying in the queue when every manager is
 * heads-down.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SLA_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const breachCutoff = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, dealership_id, escalation_reason, escalation_notes, escalation_created_at, escalation_created_by, escalation_sla_breach_notified_at"
      )
      .eq("escalated_to_manager", true)
      .is("escalation_resolved_at", null)
      .is("escalation_sla_breach_notified_at", null)
      .lte("escalation_created_at", breachCutoff);

    if (error) throw error;
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ breached: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fired = 0;
    for (const row of data as any[]) {
      const { error: notifyErr } = await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "staff_escalation_overdue",
          submission_id: row.id,
          escalation_reason: row.escalation_reason,
          escalation_notes: row.escalation_notes,
          escalation_created_at: row.escalation_created_at,
          escalation_created_by: row.escalation_created_by,
          minutes_open: Math.round(
            (Date.now() - new Date(row.escalation_created_at).getTime()) / 60000
          ),
        },
      });
      if (!notifyErr) {
        await supabase
          .from("submissions")
          .update({ escalation_sla_breach_notified_at: new Date().toISOString() } as any)
          .eq("id", row.id);
        fired++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, breached: fired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-escalation-sla error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
