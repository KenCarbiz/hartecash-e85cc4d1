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
    const body = await req.json();
    const appointment = body?.appointment;

    if (!appointment || typeof appointment !== "object") {
      return new Response(JSON.stringify({ error: "Missing appointment data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const STORE_LOCATIONS: Record<string, string> = {
      hartford_nissan: "Harte Nissan — Hartford, CT",
      hartford_infiniti: "Harte Infiniti — Hartford, CT",
      west_haven: "George Harte Nissan — West Haven, CT",
      wallingford: "George Harte Infiniti — Wallingford, CT",
      old_saybrook: "Harte Hyundai — Old Saybrook, CT",
    };

    const customer_name = typeof appointment.customer_name === "string" ? appointment.customer_name.trim().slice(0, 200) : "";
    const customer_email = typeof appointment.customer_email === "string" ? appointment.customer_email.trim().slice(0, 255) : "";
    const customer_phone = typeof appointment.customer_phone === "string" ? appointment.customer_phone.trim().slice(0, 30) : "";
    const new_date = typeof appointment.new_date === "string" ? appointment.new_date.trim().slice(0, 20) : "";
    const new_time = typeof appointment.new_time === "string" ? appointment.new_time.trim().slice(0, 50) : "";
    const old_date = typeof appointment.old_date === "string" ? appointment.old_date.trim().slice(0, 20) : "";
    const old_time = typeof appointment.old_time === "string" ? appointment.old_time.trim().slice(0, 50) : "";
    const vehicle_info = typeof appointment.vehicle_info === "string" ? appointment.vehicle_info.trim().slice(0, 500) : "";
    const store_location_key = typeof appointment.store_location === "string" ? appointment.store_location.trim() : "";
    const store_location_label = STORE_LOCATIONS[store_location_key] || store_location_key || "";

    if (!customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return new Response(JSON.stringify({ error: "Invalid or missing customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Missing email configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitize = (str: string | undefined | null) =>
      (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

    const formatDate = (d: string) => {
      const dateObj = new Date(d + "T12:00:00");
      return dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    };

    const formattedNewDate = formatDate(new_date);
    const formattedOldDate = old_date ? formatDate(old_date) : "";
    const firstName = sanitize(customer_name?.split(" ")[0]) || "friend";

    // Fetch dealership name
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const appointmentDealershipId = appointment.dealership_id || "default";
    const { data: siteConfig } = await adminClient
      .from("site_config")
      .select("dealership_name")
      .eq("dealership_id", appointmentDealershipId)
      .maybeSingle();
    const dealerName = siteConfig?.dealership_name || "Our Dealership";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${dealerName} <onboarding@resend.dev>`,
        to: [customer_email],
        subject: `📅 Your Appointment Has Been Rescheduled — ${formattedNewDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #003366 0%, #004488 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 26px;">Schedule Update 📅</h1>
              <p style="color: #b0c4de; margin: 8px 0 0; font-size: 14px;">Your appointment has been rescheduled</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px;">Hey ${firstName}! 👋</p>
              
              <p>Quick heads-up — your appointment has been rescheduled. Here are the updated details:</p>
              
              ${formattedOldDate ? `
              <div style="background: #fff0f0; padding: 14px 20px; border-left: 4px solid #cc3333; margin: 16px 0; border-radius: 0 4px 4px 0; text-decoration: line-through; color: #999;">
                <p style="margin: 6px 0;"><strong>📅 Was:</strong> ${formattedOldDate} at ${sanitize(old_time)}</p>
              </div>
              ` : ""}

              <div style="background: white; padding: 20px; border-left: 4px solid #28a745; margin: 16px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 10px 0; font-size: 15px;"><strong>📅 New Date:</strong> ${formattedNewDate}</p>
                <p style="margin: 10px 0; font-size: 15px;"><strong>⏰ New Time:</strong> ${sanitize(new_time)}</p>
                ${vehicle_info ? `<p style="margin: 10px 0;"><strong>🚗 Vehicle:</strong> ${sanitize(vehicle_info)}</p>` : ""}
                ${store_location_label ? `<p style="margin: 10px 0;"><strong>📍 Location:</strong> ${sanitize(store_location_label)}</p>` : ""}
              </div>

              <div style="margin: 20px 0; padding: 16px; background: #e8f4fd; border-radius: 6px; color: #0c5460;">
                <strong>💡 Reminder:</strong> Arrive about 10 minutes early so we can get started right on time. Don't forget to bring your vehicle title, registration, and a valid photo ID.
              </div>
              
              <p>If this new time doesn't work for you, just give us a call and we'll find something better. We're flexible like that. 🤸</p>
              
              <p style="margin-top: 25px;">See you then! 🙌</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                <strong>${dealerName}</strong><br/>
                Where selling your car is almost as fun as buying one. <em>Almost.</em>
              </div>
            </div>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();
    const result = emailRes.ok
      ? { success: true, message: "Reschedule notification sent" }
      : { success: false, error: "Failed to send email" };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reschedule-notification error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
