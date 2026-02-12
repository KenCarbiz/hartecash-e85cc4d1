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

    if (!customer_name || !customer_phone || !preferred_date || !preferred_time) {
      return new Response(JSON.stringify({ error: "Missing required appointment fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffEmail = Deno.env.get("STAFF_NOTIFICATION_EMAIL");
    const staffPhone = Deno.env.get("STAFF_NOTIFICATION_PHONE");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: { email?: string; sms?: string } = {};

    // Sanitize inputs for email content
    const sanitize = (str: string | undefined | null) =>
      (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

    // Send email via Resend
    if (resendKey && staffEmail) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Harte Auto <onboarding@resend.dev>",
            to: [staffEmail],
            subject: `New Appointment Request — ${sanitize(customer_name)}`,
            html: `
              <h2>New Appointment Request</h2>
              <p><strong>Customer:</strong> ${sanitize(customer_name)}</p>
              <p><strong>Email:</strong> ${sanitize(customer_email)}</p>
              <p><strong>Phone:</strong> ${sanitize(customer_phone)}</p>
              <p><strong>Preferred Date:</strong> ${sanitize(preferred_date)}</p>
              <p><strong>Preferred Time:</strong> ${sanitize(preferred_time)}</p>
              ${vehicle_info ? `<p><strong>Vehicle:</strong> ${sanitize(vehicle_info)}</p>` : ""}
              ${notes ? `<p><strong>Notes:</strong> ${sanitize(notes)}</p>` : ""}
              <hr/>
              <p>Please log in to the admin dashboard to manage this appointment.</p>
            `,
          }),
        });
        const emailData = await emailRes.json();
        results.email = emailRes.ok ? "sent" : "failed";
      } catch (e) {
        results.email = "error";
      }
    } else {
      results.email = "skipped: missing configuration";
    }

    // Send SMS via Twilio
    if (twilioSid && twilioToken && twilioPhone && staffPhone) {
      try {
        const smsBody = `New appointment request from ${customer_name}. Date: ${preferred_date}, Time: ${preferred_time}. Phone: ${customer_phone}${vehicle_info ? `. Vehicle: ${vehicle_info}` : ""}`;
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const smsRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: staffPhone,
            From: twilioPhone,
            Body: smsBody,
          }),
        });
        const smsData = await smsRes.json();
        results.sms = smsRes.ok ? "sent" : "failed";
      } catch (e) {
        results.sms = "error";
      }
    } else {
      results.sms = "skipped: missing configuration";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
