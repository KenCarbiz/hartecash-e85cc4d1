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
    const { appointment } = await req.json();

    if (!appointment) {
      return new Response(JSON.stringify({ error: "Missing appointment data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      customer_name,
      customer_email,
      customer_phone,
      preferred_date,
      preferred_time,
      vehicle_info,
      notes,
    } = appointment;

    const staffEmail = Deno.env.get("STAFF_NOTIFICATION_EMAIL");
    const staffPhone = Deno.env.get("STAFF_NOTIFICATION_PHONE");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: { email?: string; sms?: string } = {};

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
            subject: `New Appointment Request — ${customer_name}`,
            html: `
              <h2>New Appointment Request</h2>
              <p><strong>Customer:</strong> ${customer_name}</p>
              <p><strong>Email:</strong> ${customer_email}</p>
              <p><strong>Phone:</strong> ${customer_phone}</p>
              <p><strong>Preferred Date:</strong> ${preferred_date}</p>
              <p><strong>Preferred Time:</strong> ${preferred_time}</p>
              ${vehicle_info ? `<p><strong>Vehicle:</strong> ${vehicle_info}</p>` : ""}
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
              <hr/>
              <p>Please log in to the admin dashboard to manage this appointment.</p>
            `,
          }),
        });
        const emailData = await emailRes.json();
        results.email = emailRes.ok ? "sent" : `failed: ${JSON.stringify(emailData)}`;
      } catch (e) {
        results.email = `error: ${e.message}`;
      }
    } else {
      results.email = "skipped: missing RESEND_API_KEY or STAFF_NOTIFICATION_EMAIL";
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
        results.sms = smsRes.ok ? "sent" : `failed: ${JSON.stringify(smsData)}`;
      } catch (e) {
        results.sms = `error: ${e.message}`;
      }
    } else {
      results.sms = "skipped: missing Twilio credentials or STAFF_NOTIFICATION_PHONE";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
