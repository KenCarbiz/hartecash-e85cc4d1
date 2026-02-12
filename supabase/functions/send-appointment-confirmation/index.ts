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
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check if user is staff
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const appointment = body?.appointment;

    if (!appointment || typeof appointment !== "object") {
      return new Response(JSON.stringify({ error: "Missing appointment data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer_name = typeof appointment.customer_name === "string" ? appointment.customer_name.trim().slice(0, 200) : "";
    const customer_email = typeof appointment.customer_email === "string" ? appointment.customer_email.trim().slice(0, 255) : "";
    const customer_phone = typeof appointment.customer_phone === "string" ? appointment.customer_phone.trim().slice(0, 30) : "";
    const preferred_date = typeof appointment.preferred_date === "string" ? appointment.preferred_date.trim().slice(0, 20) : "";
    const preferred_time = typeof appointment.preferred_time === "string" ? appointment.preferred_time.trim().slice(0, 50) : "";
    const vehicle_info = typeof appointment.vehicle_info === "string" ? appointment.vehicle_info.trim().slice(0, 500) : "";
    const notes = typeof appointment.notes === "string" ? appointment.notes.trim().slice(0, 1000) : "";

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Missing email configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return new Response(JSON.stringify({ error: "Invalid or missing customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize inputs for email content
    const sanitize = (str: string | undefined | null) =>
      (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

    // Format date for display
    const dateObj = new Date(preferred_date + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const firstName = sanitize(customer_name?.split(" ")[0]) || "friend";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Harte Auto <onboarding@resend.dev>",
        to: [customer_email],
        subject: `🚗 You've Got a Date With Us — ${formattedDate} at ${sanitize(preferred_time)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #003366 0%, #004488 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 26px;">It's a Date! 🎉</h1>
              <p style="color: #b0c4de; margin: 8px 0 0; font-size: 14px;">Your appointment at Harte Auto is locked in</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px;">Hey ${firstName}! 👋</p>
              
              <p>Great news — we've penciled you in (well, digitally inked you in, because it's ${new Date().getFullYear()} and pencils are so last century). Here's the lowdown:</p>
              
              <div style="background: white; padding: 20px; border-left: 4px solid #003366; margin: 20px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 10px 0;"><strong>📅 When:</strong> ${formattedDate}</p>
                <p style="margin: 10px 0;"><strong>⏰ Time:</strong> ${sanitize(preferred_time)} (yes, we'll actually be ready for you)</p>
                ${vehicle_info ? `<p style="margin: 10px 0;"><strong>🚗 Your Ride:</strong> ${sanitize(vehicle_info)}</p>` : ""}
                <p style="margin: 10px 0;"><strong>📞 Your Phone:</strong> ${sanitize(customer_phone)}</p>
              </div>

              ${notes ? `<p style="margin: 15px 0;"><strong>📝 Notes:</strong></p><p style="background: #f0f0f0; padding: 12px; border-radius: 6px; font-style: italic;">${sanitize(notes)}</p>` : ""}
              
              <div style="margin: 20px 0; padding: 16px; background: #fff3cd; border-radius: 6px; color: #856404;">
                <strong>⏰ Pro tip:</strong> Show up about 10 minutes early. It gives you time to grab a coffee from our lobby, take a deep breath, and mentally prepare to say goodbye to your car (or hello to a great offer 💰).
              </div>
              
              <p>If something comes up and you need to reschedule, no worries — just give us a shout. We don't hold grudges. Probably.</p>
              
              <p style="margin-top: 25px;">See you soon! 🙌</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                <strong>Harte Auto Group</strong><br/>
                Where selling your car is almost as fun as buying one. <em>Almost.</em>
              </div>
            </div>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();
    const result = emailRes.ok
      ? { success: true, message: "Confirmation email sent" }
      : { success: false, error: "Failed to send email" };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
