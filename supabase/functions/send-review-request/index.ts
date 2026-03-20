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

    // Verify staff
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
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
    const submissionId = body?.submission_id;
    const submissionToken = body?.submission_token;

    if (!submissionId || !submissionToken) {
      return new Response(JSON.stringify({ error: "Missing submission data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submission details using service role for full access
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: submission, error: subError } = await serviceClient
      .from("submissions")
      .select("name, email, vehicle_year, vehicle_make, vehicle_model, review_requested")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!submission.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
      return new Response(JSON.stringify({ error: "Customer has no valid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get site config for the email message
    const { data: siteConfig } = await serviceClient
      .from("site_config")
      .select("dealership_name, review_request_subject, review_request_message, primary_color, accent_color")
      .eq("dealership_id", "default")
      .maybeSingle();

    const dealershipName = siteConfig?.dealership_name || "Harte Auto Group";
    const emailSubject = siteConfig?.review_request_subject || "We'd Love Your Feedback!";
    const emailMessage = siteConfig?.review_request_message || "Thank you for choosing us! We hope you had a great experience.";
    const primaryColor = siteConfig?.primary_color || "210 100% 25%";

    // Build the review URL
    const siteUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "") || "";
    // Use the app's origin from the request
    const origin = req.headers.get("origin") || `https://${siteUrl}.lovable.app`;
    const reviewUrl = `${origin}/review/${submissionToken}`;

    const sanitize = (str: string | undefined | null) =>
      (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

    const firstName = sanitize(submission.name?.split(" ")[0]) || "Valued Customer";
    const vehicleInfo = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");

    // Convert HSL string to CSS
    const primaryHsl = `hsl(${primaryColor})`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Missing email configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${dealershipName} <onboarding@resend.dev>`,
        to: [submission.email],
        subject: `⭐ ${emailSubject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${primaryHsl}; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⭐ ${sanitize(emailSubject)}</h1>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px;">Hey ${firstName}! 👋</p>
              
              <p style="font-size: 15px; line-height: 1.6; color: #333;">${sanitize(emailMessage)}</p>
              
              ${vehicleInfo ? `
              <div style="background: white; padding: 16px; border-left: 4px solid ${primaryHsl}; margin: 20px 0; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; font-size: 14px;"><strong>🚗 Your Vehicle:</strong> ${sanitize(vehicleInfo)}</p>
              </div>
              ` : ""}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${reviewUrl}" style="display: inline-block; background: ${primaryHsl}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Share My Experience
                </a>
              </div>
              
              <p style="font-size: 13px; color: #888; text-align: center;">It only takes a minute and helps others make the right choice.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; text-align: center;">
                <strong>${sanitize(dealershipName)}</strong><br/>
                Thank you for your business! 🙌
              </div>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json();
      return new Response(JSON.stringify({ error: "Failed to send email", details: errData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as review requested
    await serviceClient
      .from("submissions")
      .update({ review_requested: true, review_requested_at: new Date().toISOString() })
      .eq("id", submissionId);

    return new Response(JSON.stringify({ success: true, message: "Review request sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
