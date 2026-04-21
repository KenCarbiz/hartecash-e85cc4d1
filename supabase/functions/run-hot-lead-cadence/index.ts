import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * run-hot-lead-cadence — sub-day follow-up for fresh leads that saw
 * an offer but haven't engaged.
 *
 * Scheduled every 30 min by pg_cron (migration 20260420210000).
 *
 *  2h window (1.5h-3h old): SMS nudge — "still have questions about
 *     your offer? tap to book an inspection"
 *  4h window (3.5h-5h old): AI voice call via launch-voice-call if the
 *     2h nudge got no response (no portal re-view, no appointment, no
 *     accept).
 *
 * Gates:
 *   - Must have estimated_offer_high > 0 (offer was computed)
 *   - appointment_set = false
 *   - progress_status not already accepted / declined / lost
 *   - Customer has phone
 *   - Customer not opted out of marketing
 *   - The corresponding sent_at column is null
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Lead {
  id: string;
  token: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
  appointment_set: boolean | null;
  progress_status: string | null;
  estimated_offer_high: number | null;
  hot_followup_2h_sent_at: string | null;
  hot_followup_4h_sent_at: string | null;
  portal_view_count: number | null;
  dealership_id: string | null;
}

const EXCLUDED_STATUSES = [
  "offer_accepted",
  "deal_finalized",
  "check_request_submitted",
  "purchase_complete",
  "lost",
  "unreachable",
  "offer_declined",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pull leads from the last 6 hours with an offer but no appointment.
    const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, token, name, phone, created_at, appointment_set, progress_status, estimated_offer_high, hot_followup_2h_sent_at, hot_followup_4h_sent_at, portal_view_count, dealership_id"
      )
      .gte("created_at", windowStart)
      .not("estimated_offer_high", "is", null)
      .eq("appointment_set", false)
      .not("phone", "is", null);

    if (error) throw error;
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ sms_2h: 0, voice_4h: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leads = data as Lead[];
    const now = Date.now();
    let sms2h = 0;
    let voice4h = 0;

    for (const lead of leads) {
      if (lead.progress_status && EXCLUDED_STATUSES.includes(lead.progress_status)) continue;

      // Opt-out check — respect the dealer's opt-out list before any
      // outreach. Same pattern as run-acquisition-cadence.
      const { data: optOut } = await supabase
        .from("sms_opt_outs")
        .select("phone")
        .eq("phone", lead.phone)
        .maybeSingle();
      if (optOut) continue;

      const ageMs = now - new Date(lead.created_at).getTime();
      const ageH = ageMs / (1000 * 60 * 60);

      // ── 2h SMS nudge window ──
      const in2hWindow = ageH >= 1.5 && ageH <= 3;
      if (in2hWindow && !lead.hot_followup_2h_sent_at) {
        const { error: notifyErr } = await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "hot_lead_2h_followup",
            submission_id: lead.id,
          },
        });
        if (!notifyErr) {
          await supabase
            .from("submissions")
            .update({ hot_followup_2h_sent_at: new Date().toISOString() } as any)
            .eq("id", lead.id);
          sms2h++;
        }
        continue;
      }

      // ── 4h voice call window (only if 2h SMS fired + got no engagement) ──
      const in4hWindow = ageH >= 3.5 && ageH <= 5;
      if (
        in4hWindow &&
        lead.hot_followup_2h_sent_at &&
        !lead.hot_followup_4h_sent_at
      ) {
        // Engagement signal — if the customer re-opened the portal
        // after the 2h SMS, we don't need to call them. The SMS worked.
        const viewCount = lead.portal_view_count ?? 0;
        if (viewCount >= 2) continue;

        const { error: voiceErr } = await supabase.functions.invoke("launch-voice-call", {
          body: {
            submission_id: lead.id,
            campaign_type: "hot_lead_4h_followup",
          },
        });
        if (!voiceErr) {
          await supabase
            .from("submissions")
            .update({ hot_followup_4h_sent_at: new Date().toISOString() } as any)
            .eq("id", lead.id);
          voice4h++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sms_2h: sms2h, voice_4h: voice4h }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("run-hot-lead-cadence error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
