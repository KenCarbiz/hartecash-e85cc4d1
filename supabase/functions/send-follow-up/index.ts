import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FollowUpRequest {
  submission_id: string;
  touch_number: 1 | 2 | 3;
  triggered_by: "auto" | "manual";
}

interface SubmissionData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  offered_price: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  created_at: string;
}

const sanitize = (str: string | undefined | null) =>
  (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

function getUnsubscribeUrl(siteUrl: string, token: string) {
  return `${siteUrl}/unsubscribe?token=${token}`;
}

function getUnsubscribeFooter(siteUrl: string, token: string) {
  const url = getUnsubscribeUrl(siteUrl, token);
  return `<p style="color: #999; font-size: 11px; margin-top: 16px;">Don't want these emails? <a href="${url}" style="color: #2563eb; text-decoration: underline;">Unsubscribe</a></p>`;
}

function getEmailTemplate(touch: number, sub: SubmissionData, siteUrl: string, dealerName = "Our Dealership") {
  const firstName = sub.name?.split(" ")[0] || "there";
  const vehicle = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ");
  const offerStr = sub.offered_price
    ? `$${sub.offered_price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : sub.estimated_offer_low && sub.estimated_offer_high
    ? `$${sub.estimated_offer_low.toLocaleString("en-US", { maximumFractionDigits: 0 })} – $${sub.estimated_offer_high.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : null;

  const portalUrl = `${siteUrl}/my-submission/${sub.token}`;
  const offerUrl = `${siteUrl}/offer/${sub.token}`;
  const uploadUrl = `${siteUrl}/upload/${sub.token}`;
  const scheduleUrl = `${siteUrl}/schedule?token=${sub.token}&vehicle=${encodeURIComponent(vehicle)}&name=${encodeURIComponent(sub.name || "")}&email=${encodeURIComponent(sub.email || "")}&phone=${encodeURIComponent(sub.phone || "")}`;
  const unsubFooter = getUnsubscribeFooter(siteUrl, sub.token);

  const templates: Record<number, { subject: string; html: string }> = {
    1: {
      subject: `Your offer for your ${vehicle} is waiting, ${firstName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #0a2647, #144272); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Your Offer is Ready 💰</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px;">
            <p>Hey ${sanitize(firstName)},</p>
            <p>We've got ${offerStr ? `a <strong>${offerStr}</strong> cash offer` : "an offer"} ready for your <strong>${sanitize(vehicle)}</strong>. It's just waiting for you to take the next step!</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${offerUrl}" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">View My Offer →</a>
            </div>
            <p style="color: #666; font-size: 14px;">Your offer is guaranteed for a limited time. Don't let it expire!</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">${dealerName} • <a href="${portalUrl}" style="color: #2563eb;">View your portal</a></p>
            ${unsubFooter}
          </div>
        </div>
      `,
    },
    2: {
      subject: `Fast-track your ${vehicle} deal — upload photos & docs`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #0a2647, #144272); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Speed Up Your Deal ⚡</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px;">
            <p>Hey ${sanitize(firstName)},</p>
            <p>Your ${offerStr ? `<strong>${offerStr}</strong> offer` : "offer"} for your <strong>${sanitize(vehicle)}</strong> is still available.</p>
            <p><strong>Want to get paid faster?</strong> Uploading your vehicle photos and documents ahead of your visit means:</p>
            <ul style="color: #555;">
              <li>✅ Faster processing at the dealership</li>
              <li>✅ Less time spent during your visit</li>
              <li>✅ Get your check sooner</li>
            </ul>
            ${!sub.photos_uploaded ? `<div style="text-align: center; margin: 16px 0;"><a href="${uploadUrl}" style="background: #dc2626; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Upload Photos →</a></div>` : ""}
            <div style="text-align: center; margin: 16px 0;">
              <a href="${scheduleUrl}" style="background: #0a2647; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Schedule Your Visit →</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">${dealerName} • <a href="${portalUrl}" style="color: #2563eb;">View your portal</a></p>
            ${unsubFooter}
          </div>
        </div>
      `,
    },
    3: {
      subject: `⏰ Last chance — your ${vehicle} offer expires soon`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #7f1d1d, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Don't Miss Out ⏰</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px;">
            <p>Hey ${sanitize(firstName)},</p>
            <p>Your ${offerStr ? `<strong>${offerStr}</strong> ` : ""}cash offer for your <strong>${sanitize(vehicle)}</strong> is about to expire. Once it does, we'll need to re-evaluate and the price may change.</p>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-weight: bold; color: #92400e;">⚠️ Your price guarantee is ending soon</p>
              <p style="margin: 8px 0 0; color: #92400e; font-size: 14px;">Schedule your visit now to lock in your offer before it expires.</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${scheduleUrl}" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Schedule My Visit Now →</a>
            </div>
            <p style="color: #666; font-size: 14px;">Questions? Reply to this email or call us — we're happy to help.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">${dealerName} • <a href="${portalUrl}" style="color: #2563eb;">View your portal</a></p>
            ${unsubFooter}
          </div>
        </div>
      `,
    },
  };

  return templates[touch] || templates[1];
}

function getSmsTemplate(touch: number, sub: SubmissionData, siteUrl: string) {
  const firstName = sub.name?.split(" ")[0] || "";
  const vehicle = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ");
  const offerStr = sub.offered_price
    ? `$${sub.offered_price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : sub.estimated_offer_low && sub.estimated_offer_high
    ? `$${sub.estimated_offer_low.toLocaleString("en-US", { maximumFractionDigits: 0 })}-$${sub.estimated_offer_high.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "";

  const offerUrl = `${siteUrl}/offer/${sub.token}`;

  const templates: Record<number, string> = {
    1: `Harte Auto Group: Hey ${firstName}, your ${offerStr ? offerStr + " " : ""}cash offer for your ${vehicle} is ready! View it here: ${offerUrl} Reply STOP to opt out.`,
    2: `Harte Auto Group: ${firstName}, upload your ${vehicle} photos to fast-track your deal & get paid sooner: ${siteUrl}/upload/${sub.token} Reply STOP to opt out.`,
    3: `Harte Auto Group: ⏰ ${firstName}, your ${vehicle} offer expires soon! Schedule your visit now to lock in your price: ${siteUrl}/schedule?token=${sub.token} Reply STOP to opt out.`,
  };

  return templates[touch] || templates[1];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submission_id, touch_number, triggered_by = "manual" } = (await req.json()) as FollowUpRequest;

    if (!submission_id || !touch_number || touch_number < 1 || touch_number > 3) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch submission
    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .select("id, name, email, phone, token, vehicle_year, vehicle_make, vehicle_model, offered_price, estimated_offer_low, estimated_offer_high, photos_uploaded, docs_uploaded, created_at, progress_status")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already completed
    if (["price_agreed", "purchase_complete"].includes(sub.progress_status)) {
      return new Response(JSON.stringify({ skipped: true, reason: "Deal already completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this touch already sent
    const { data: existing } = await supabase
      .from("follow_ups")
      .select("id")
      .eq("submission_id", submission_id)
      .eq("touch_number", touch_number)
      .eq("status", "sent");

    if (existing && existing.length > 0 && triggered_by === "auto") {
      return new Response(JSON.stringify({ skipped: true, reason: "Already sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check opt-out status
    const emailOptedOut = sub.email
      ? !!(await supabase.from("opt_outs").select("id").eq("email", sub.email).eq("channel", "email").maybeSingle()).data
      : false;

    const smsOptedOut = sub.phone
      ? !!(await supabase.from("opt_outs").select("id").eq("phone", sub.phone).eq("channel", "sms").maybeSingle()).data
      : false;

    const siteUrl = Deno.env.get("SITE_URL") || "https://hartecash.lovable.app";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: { email?: string; sms?: string } = {};

    // Send email (unless opted out)
    if (emailOptedOut) {
      results.email = "opted_out";
    } else if (resendKey && sub.email) {
      try {
        const template = getEmailTemplate(touch_number, sub as SubmissionData, siteUrl);
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Harte Auto Group <onboarding@resend.dev>",
            to: [sub.email],
            subject: template.subject,
            html: template.html,
          }),
        });
        const emailData = await emailRes.json();
        console.log("Email response:", JSON.stringify(emailData));
        results.email = emailRes.ok ? "sent" : `failed: ${JSON.stringify(emailData)}`;

        await supabase.from("follow_ups").insert({
          submission_id,
          touch_number,
          channel: "email",
          status: emailRes.ok ? "sent" : "failed",
          error_message: emailRes.ok ? null : JSON.stringify(emailData),
          triggered_by,
        });
      } catch (e) {
        console.error("Email error:", e);
        results.email = "error";
        await supabase.from("follow_ups").insert({
          submission_id,
          touch_number,
          channel: "email",
          status: "failed",
          error_message: String(e),
          triggered_by,
        });
      }
    } else {
      results.email = "skipped";
    }

    // Send SMS (unless opted out)
    if (smsOptedOut) {
      results.sms = "opted_out";
    } else if (twilioSid && twilioToken && twilioPhone && sub.phone) {
      try {
        const smsBody = getSmsTemplate(touch_number, sub as SubmissionData, siteUrl);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const smsRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: sub.phone,
            From: twilioPhone,
            Body: smsBody,
          }),
        });
        const smsData = await smsRes.json();
        console.log("SMS response:", JSON.stringify(smsData));
        results.sms = smsRes.ok ? "sent" : `failed: ${JSON.stringify(smsData)}`;

        await supabase.from("follow_ups").insert({
          submission_id,
          touch_number,
          channel: "sms",
          status: smsRes.ok ? "sent" : "failed",
          error_message: smsRes.ok ? null : JSON.stringify(smsData),
          triggered_by,
        });
      } catch (e) {
        console.error("SMS error:", e);
        results.sms = "error";
        await supabase.from("follow_ups").insert({
          submission_id,
          touch_number,
          channel: "sms",
          status: "failed",
          error_message: String(e),
          triggered_by,
        });
      }
    } else {
      results.sms = "skipped";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-follow-up error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
