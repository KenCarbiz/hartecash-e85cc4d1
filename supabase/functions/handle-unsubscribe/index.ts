import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { token, channel = "all" } = await req.json();

    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validChannels = ["all", "email", "sms"];
    if (!validChannels.includes(channel)) {
      return new Response(JSON.stringify({ error: "Invalid channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up submission by token
    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .select("id, email, phone, name, vehicle_year, vehicle_make, vehicle_model, dealership_id")
      .eq("token", token)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-dealership scope: an unsubscribe suppresses only the dealer whose
    // submission produced the link.
    const optOuts: { email?: string; phone?: string; channel: string; token: string; submission_id: string; dealership_id: string | null }[] = [];

    if (channel === "all" || channel === "email") {
      if (sub.email) {
        optOuts.push({ email: sub.email, channel: "email", token, submission_id: sub.id, dealership_id: sub.dealership_id ?? null });
      }
    }
    if (channel === "all" || channel === "sms") {
      if (sub.phone) {
        optOuts.push({ phone: sub.phone, channel: "sms", token, submission_id: sub.id, dealership_id: sub.dealership_id ?? null });
      }
    }

    // Insert-with-catch (not upsert): tenant-scoped uniqueness means a true
    // duplicate is harmless and a swallowed dup avoids a hard dependency on a
    // specific ON CONFLICT target.
    for (const optOut of optOuts) {
      await supabase.from("opt_outs").insert(optOut)
        .catch((e: unknown) => console.warn("opt_outs insert failed (likely dup):", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "You have been unsubscribed successfully.",
        name: sub.name?.split(" ")[0] || "",
        vehicle: [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" "),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("handle-unsubscribe error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
