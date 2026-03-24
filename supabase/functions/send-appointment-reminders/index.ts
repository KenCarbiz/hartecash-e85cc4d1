import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find appointments scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*, submission_token")
      .eq("preferred_date", tomorrowStr)
      .eq("status", "pending");

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch locations for display names
    const { data: locations } = await supabase
      .from("dealership_locations")
      .select("id, name, city, state");
    const locMap = new Map((locations || []).map((l: any) => [l.id, `${l.name} — ${l.city}, ${l.state}`]));

    let sent = 0;
    for (const appt of appointments) {
      if (!appt.submission_token) continue;

      // Find submission by token
      const { data: sub } = await supabase
        .from("submissions")
        .select("id")
        .eq("token", appt.submission_token)
        .maybeSingle();

      if (!sub) continue;

      const locationLabel = locMap.get(appt.store_location) || appt.store_location || "";

      await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "customer_appointment_reminder",
          submission_id: sub.id,
          appointment_date: appt.preferred_date,
          appointment_time: appt.preferred_time,
          location: locationLabel,
        },
      });
      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-appointment-reminders error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
