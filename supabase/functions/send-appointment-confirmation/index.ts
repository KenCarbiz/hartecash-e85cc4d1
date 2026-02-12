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
    const { appointment, confirmationUrl } = await req.json();

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

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey || !customer_email) {
      return new Response(
        JSON.stringify({
          error: "Missing RESEND_API_KEY or customer_email",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Format date for display
    const dateObj = new Date(preferred_date + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Harte Auto <onboarding@resend.dev>",
        to: [customer_email],
        subject: `Appointment Confirmed — ${formattedDate} at ${preferred_time}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #003366 0%, #004488 100%); padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Confirmed!</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p>Hi ${customer_name},</p>
              
              <p>Your appointment at Harte Auto has been confirmed. Here are the details:</p>
              
              <div style="background: white; padding: 20px; border-left: 4px solid #003366; margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 10px 0;"><strong>⏰ Time:</strong> ${preferred_time}</p>
                ${vehicle_info ? `<p style="margin: 10px 0;"><strong>🚗 Vehicle:</strong> ${vehicle_info}</p>` : ""}
                <p style="margin: 10px 0;"><strong>📞 Phone:</strong> ${customer_phone}</p>
              </div>
              
              ${notes ? `<p style="margin: 20px 0;"><strong>Notes:</strong></p><p style="background: #f0f0f0; padding: 10px; border-radius: 4px;">${notes}</p>` : ""}
              
              <p style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 4px; color: #856404;">
                ⚠️ <strong>Please arrive 10 minutes early</strong> to allow time for check-in.
              </p>
              
              <p>If you need to reschedule or have any questions, please don't hesitate to contact us at your earliest convenience.</p>
              
              <p style="margin-top: 30px; color: #666; font-size: 12px;">
                Thank you for choosing Harte Auto!<br/>
                <strong>Harte Auto</strong>
              </p>
            </div>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();
    const result = emailRes.ok
      ? { success: true, message: "Confirmation email sent" }
      : { success: false, error: JSON.stringify(emailData) };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
