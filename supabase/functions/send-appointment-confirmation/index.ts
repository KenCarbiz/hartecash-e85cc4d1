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

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customer_email) {
      return new Response(JSON.stringify({ error: "Missing customer_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format date for display
    const dateObj = new Date(preferred_date + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const firstName = customer_name?.split(" ")[0] || "friend";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Harte Auto <onboarding@resend.dev>",
        to: [customer_email],
        subject: `🚗 You've Got a Date With Us — ${formattedDate} at ${preferred_time}`,
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
                <p style="margin: 10px 0;"><strong>⏰ Time:</strong> ${preferred_time} (yes, we'll actually be ready for you)</p>
                ${vehicle_info ? `<p style="margin: 10px 0;"><strong>🚗 Your Ride:</strong> ${vehicle_info}</p>` : ""}
                <p style="margin: 10px 0;"><strong>📞 Your Phone:</strong> ${customer_phone}</p>
              </div>

              ${notes ? `<p style="margin: 15px 0;"><strong>📝 Notes:</strong></p><p style="background: #f0f0f0; padding: 12px; border-radius: 6px; font-style: italic;">${notes}</p>` : ""}
              
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
