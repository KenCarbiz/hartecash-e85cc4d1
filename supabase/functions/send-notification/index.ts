import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map notification trigger_keys to transactional email template names
const TRIGGER_TO_TEMPLATE: Record<string, string> = {
  customer_offer_ready: 'offer-ready',
  customer_offer_accepted: 'offer-accepted',
  customer_offer_increased: 'offer-increased',
  customer_appointment_booked: 'appointment-confirmation',
  customer_appointment_reminder: 'appointment-reminder',
  customer_appointment_rescheduled: 'appointment-rescheduled',
};

const SENDER_DOMAIN = "notify.autocurb.io";
const FROM_DOMAIN = "notify.autocurb.io";

/** Default templates for staff emails and fallback */
const DEFAULT_TEMPLATES: Record<string, { email_subject: string; email_body: string; sms_body: string }> = {
  customer_offer_ready: {
    email_subject: "Your Offer Is Ready — {{dealership_name}}",
    email_body: "Hi {{customer_name}},\n\nGreat news! We've reviewed your {{vehicle}} and your personalized offer is ready.\n\nClick below to view your offer:\n{{portal_link}}\n\nThis offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, your offer for your {{vehicle}} is ready! View it here: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_increased: {
    email_subject: "Great News — Your Offer Has Been Increased!",
    email_body: "Hi {{customer_name}},\n\nWe've increased the offer on your {{vehicle}}!\n\nView your updated offer:\n{{portal_link}}\n\nDon't wait — this offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, great news! We've increased our offer on your {{vehicle}}. View it: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_accepted: {
    email_subject: "Offer Accepted — Next Steps for Your {{vehicle}}",
    email_body: "Hi {{customer_name}},\n\nThank you for accepting our offer on your {{vehicle}}!\n\nOffer Amount: {{offer_amount}}\n\nSchedule now: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, your offer of {{offer_amount}} for your {{vehicle}} is confirmed! Schedule your visit: {{portal_link}} — {{dealership_name}}",
  },
  customer_appointment_reminder: {
    email_subject: "Reminder: Your Appointment Is Tomorrow",
    email_body: "Hi {{customer_name}},\n\nJust a friendly reminder — your inspection is tomorrow!\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}\nVehicle: {{vehicle}}\n\nSee you soon!\n{{dealership_name}}",
    sms_body: "Reminder: Your visit is tomorrow at {{appointment_time}} at {{location}}. Bring title, ID & keys. See you there! — {{dealership_name}}",
  },
  customer_appointment_rescheduled: {
    email_subject: "Your Appointment Has Been Rescheduled",
    email_body: "Hi {{customer_name}},\n\nYour inspection appointment has been rescheduled.\n\nNew Date: {{appointment_date}}\nNew Time: {{appointment_time}}\nLocation: {{location}}\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, your appointment has been rescheduled to {{appointment_date}} at {{appointment_time}} at {{location}}. — {{dealership_name}}",
  },
  customer_appointment_booked: {
    email_subject: "Appointment Confirmed — {{appointment_date}}",
    email_body: "Hi {{customer_name}},\n\nYour inspection appointment has been confirmed.\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}\n\nRemember to bring title, ID, registration, and all keys.\n\nSee you soon!\n{{dealership_name}}",
    sms_body: "Appointment confirmed for {{appointment_date}} at {{appointment_time}} at {{location}}. Bring title, ID & keys. — {{dealership_name}}",
  },
  staff_customer_accepted: {
    email_subject: "🎉 Customer Accepted Offer — {{customer_name}}",
    email_body: "Great news! {{customer_name}} has accepted the offer on their {{vehicle}}.\n\nOffer Amount: {{offer_amount}}\n\nFollow up to schedule their inspection visit.",
    sms_body: "🎉 {{customer_name}} accepted the offer on their {{vehicle}} ({{offer_amount}}). Follow up to schedule!",
  },
  staff_deal_completed: {
    email_subject: "✅ Deal Completed — {{customer_name}}",
    email_body: "A deal has been completed.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThe purchase has been finalized.",
    sms_body: "✅ Deal completed: {{customer_name}} — {{vehicle}}.",
  },
  new_submission: {
    email_subject: "🚗 New Submission — {{customer_name}}",
    email_body: "A new vehicle submission has come in.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nMileage: {{mileage}}\n\nView details in the admin dashboard.",
    sms_body: "🚗 New submission from {{customer_name}} — {{vehicle}}. Check the dashboard!",
  },
  hot_lead: {
    email_subject: "🔥 Hot Lead — {{customer_name}}",
    email_body: "A hot lead has been flagged!\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nMileage: {{mileage}}\n\nThis lead matches high-value criteria. Follow up quickly!",
    sms_body: "🔥 Hot lead: {{customer_name}} — {{vehicle}}. Follow up ASAP!",
  },
  appointment_booked: {
    email_subject: "📅 New Appointment — {{customer_name}}",
    email_body: "A new appointment has been booked.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}",
    sms_body: "📅 New appt: {{customer_name}} — {{vehicle}} on {{appointment_date}} at {{appointment_time}}.",
  },
  photos_uploaded: {
    email_subject: "📸 Photos Uploaded — {{customer_name}}",
    email_body: "{{customer_name}} has uploaded photos for their {{vehicle}}.\n\nView them in the admin dashboard.",
    sms_body: "📸 {{customer_name}} uploaded photos for their {{vehicle}}.",
  },
  docs_uploaded: {
    email_subject: "📄 Documents Uploaded — {{customer_name}}",
    email_body: "{{customer_name}} has uploaded documents for their {{vehicle}}.\n\nView them in the admin dashboard.",
    sms_body: "📄 {{customer_name}} uploaded documents for their {{vehicle}}.",
  },
  status_change: {
    email_subject: "Status Update — {{customer_name}}",
    email_body: "A submission status has changed.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nNew Status: {{status}}",
    sms_body: "Status update: {{customer_name}} — {{vehicle}} is now {{status}}.",
  },
  abandoned_lead: {
    email_subject: "⚠️ Abandoned Lead — {{customer_name}}",
    email_body: "A customer started the sell form but didn't finish.\n\nName: {{customer_name}}\nEmail: {{customer_email}}\nPhone: {{customer_phone}}\nVehicle: {{vehicle}}\nMileage: {{mileage}}\n\nThis lead needs immediate follow-up.",
    sms_body: "⚠️ Abandoned lead: {{customer_name}} ({{vehicle}}) started the form but didn't finish. Follow up ASAP!",
  },
};

const sanitize = (str: string | null | undefined) =>
  (str || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] || c));

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val);
  }
  return result;
}

function textToHtml(text: string, dealerName: string): string {
  const lines = sanitize(text).split("\n");
  const bodyHtml = lines.map(l => {
    if (l.startsWith("• ")) return `<li>${l.slice(2)}</li>`;
    if (/^\d+\.\s/.test(l)) return `<li>${l.replace(/^\d+\.\s/, "")}</li>`;
    return `<p style="margin:0 0 8px;">${l || "&nbsp;"}</p>`;
  }).join("\n");

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#0a2647,#144272);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:22px;">${sanitize(dealerName)}</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border-radius:0 0 12px 12px;">
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
        <p style="color:#999;font-size:12px;">${sanitize(dealerName)}</p>
      </div>
    </div>`;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SendRequest {
  trigger_key: string;
  submission_id?: string;
  appointment_date?: string;
  appointment_time?: string;
  location?: string;
  channels?: string[];
  recipient_email?: string;
  recipient_phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendRequest;
    const { trigger_key, submission_id } = body;

    if (!trigger_key || !DEFAULT_TEMPLATES[trigger_key]) {
      return new Response(JSON.stringify({ error: "Invalid trigger_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch submission data if provided
    let sub: any = null;
    let dealershipId = "default";
    if (submission_id) {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("id", submission_id)
        .single();
      sub = data;
      if (sub?.dealership_id) dealershipId = sub.dealership_id;
    }

    // Fetch site config scoped to tenant
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("dealership_name, price_guarantee_days")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    const dealerName = siteConfig?.dealership_name || "Our Dealership";
    const guaranteeDays = String(siteConfig?.price_guarantee_days || 8);

    // Fetch notification settings
    const { data: notifSettings } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    const isStaffTrigger = trigger_key.startsWith("staff_") ||
      ["new_submission", "hot_lead", "appointment_booked", "photos_uploaded", "docs_uploaded", "status_change", "abandoned_lead"].includes(trigger_key);
    const isCustomerTrigger = trigger_key.startsWith("customer_");

    // Check if trigger enabled
    const enabledKey = `notify_${trigger_key}`;
    if (notifSettings && (notifSettings as any)[enabledKey] === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "Trigger disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get channels
    const fullChannelKey = `${trigger_key}_channels`;
    const channels: string[] = body.channels ||
      (notifSettings as any)?.[fullChannelKey] || ["email"];

    // Build template variables
    const vehicle = sub ? [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") : "";
    const offerAmount = sub?.offered_price
      ? `$${Number(sub.offered_price).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : "";
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.autocurb.io";
    const portalLink = sub ? `${siteUrl}/offer/${sub.token}` : siteUrl;

    const templateVars: Record<string, string> = {
      customer_name: sub?.name?.split(" ")[0] || "there",
      customer_email: sub?.email || "",
      customer_phone: sub?.phone || "",
      vehicle,
      mileage: sub?.mileage || "",
      offer_amount: offerAmount,
      portal_link: portalLink,
      appointment_date: body.appointment_date || "",
      appointment_time: body.appointment_time || "",
      location: body.location || "",
      dealership_name: dealerName,
      status: sub?.progress_status || "",
      guarantee_days: guaranteeDays,
    };

    // Fetch custom templates (if any)
    const { data: customTemplates } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("trigger_key", trigger_key)
      .eq("dealership_id", dealershipId);

    const customEmail = customTemplates?.find((t: any) => t.channel === "email");
    const customSms = customTemplates?.find((t: any) => t.channel === "sms");
    const defaults = DEFAULT_TEMPLATES[trigger_key];

    const emailSubject = replacePlaceholders(customEmail?.subject || defaults.email_subject, templateVars);
    const emailBodyText = replacePlaceholders(customEmail?.body || defaults.email_body, templateVars);
    const smsBodyText = replacePlaceholders(customSms?.body || defaults.sms_body, templateVars);

    // Determine recipients
    let emailRecipients: string[] = [];
    let smsRecipients: string[] = [];

    if (isCustomerTrigger) {
      if (body.recipient_email) emailRecipients = [body.recipient_email];
      else if (sub?.email) emailRecipients = [sub.email];
      if (body.recipient_phone) smsRecipients = [body.recipient_phone];
      else if (sub?.phone) smsRecipients = [sub.phone];
    } else if (isStaffTrigger) {
      const triggerRecipients = (notifSettings as any)?.staff_trigger_recipients?.[trigger_key];
      if (triggerRecipients) {
        emailRecipients = triggerRecipients.emails || [];
        smsRecipients = triggerRecipients.phones || [];
      } else {
        emailRecipients = (notifSettings as any)?.email_recipients || [];
        smsRecipients = (notifSettings as any)?.sms_recipients || [];
      }
    }

    // Check opt-outs for customer triggers
    if (isCustomerTrigger && sub) {
      if (sub.email) {
        const { data: emailOpt } = await supabase
          .from("opt_outs")
          .select("id")
          .eq("email", sub.email)
          .in("channel", ["email", "all"])
          .limit(1);
        if (emailOpt && emailOpt.length > 0) emailRecipients = [];

        const { data: smsOpt } = await supabase
          .from("opt_outs")
          .select("id")
          .eq("phone", sub.phone)
          .in("channel", ["sms", "all"])
          .limit(1);
        if (smsOpt && smsOpt.length > 0) smsRecipients = [];
      }
    }

    // Check quiet hours for SMS
    if (notifSettings && (notifSettings as any).quiet_hours_enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const start = (notifSettings as any).quiet_hours_start || "21:00";
      const end = (notifSettings as any).quiet_hours_end || "08:00";
      const inQuietHours = start > end
        ? currentTime >= start || currentTime < end
        : currentTime >= start && currentTime < end;
      if (inQuietHours) smsRecipients = [];
    }

    const results: { email?: string; sms?: string } = {};

    const logNotification = async (channel: string, recipient: string, status: string, errorMsg?: string) => {
      try {
        await supabase.from("notification_log").insert({
          trigger_key, channel, recipient, status,
          error_message: errorMsg || null,
          submission_id: submission_id || null,
          dealership_id: dealershipId,
        });
      } catch (e) {
        console.error("Failed to log notification:", e);
      }
    };

    // ── SEND EMAILS ──
    if (channels.includes("email") && emailRecipients.length > 0) {
      const templateKey = TRIGGER_TO_TEMPLATE[trigger_key];
      const reactTemplate = templateKey ? TEMPLATES[templateKey] : null;

      if (isCustomerTrigger && reactTemplate) {
        // Use branded React Email template + email queue for customer emails
        for (const addr of emailRecipients) {
          try {
            const templateData = {
              customerName: templateVars.customer_name,
              vehicle: templateVars.vehicle,
              offerAmount: templateVars.offer_amount,
              portalLink: templateVars.portal_link,
              guaranteeDays: templateVars.guarantee_days,
              dealershipName: templateVars.dealership_name,
              appointmentDate: templateVars.appointment_date,
              appointmentTime: templateVars.appointment_time,
              location: templateVars.location,
            };

            const html = await renderAsync(React.createElement(reactTemplate.component, templateData));
            const plainText = await renderAsync(React.createElement(reactTemplate.component, templateData), { plainText: true });
            const resolvedSubject = typeof reactTemplate.subject === 'function'
              ? reactTemplate.subject(templateData)
              : reactTemplate.subject;

            const messageId = crypto.randomUUID();
            const idempotencyKey = `${trigger_key}-${submission_id || 'no-sub'}-${messageId}`;

            // Log pending
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: templateKey,
              recipient_email: addr,
              status: "pending",
            });

            // Enqueue to transactional email queue
            const { error: enqueueError } = await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                message_id: messageId,
                to: addr,
                from: `${dealerName} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: resolvedSubject,
                html,
                text: plainText,
                purpose: "transactional",
                label: templateKey,
                idempotency_key: idempotencyKey,
                queued_at: new Date().toISOString(),
              },
            });

            if (enqueueError) {
              console.error("Failed to enqueue customer email:", enqueueError);
              results.email = `failed: ${enqueueError.message}`;
              await logNotification("email", addr, "failed", enqueueError.message);
            } else {
              console.log(`Customer email enqueued: ${templateKey} → ${addr}`);
              results.email = "queued";
              await logNotification("email", addr, "sent");
            }
          } catch (e) {
            console.error("Customer email error:", e);
            results.email = "error";
            await logNotification("email", addr, "error", String(e));
          }
        }
      } else {
        // Staff emails: use the email queue with inline HTML
        for (const addr of emailRecipients) {
          try {
            const emailHtml = textToHtml(emailBodyText, dealerName);
            const messageId = crypto.randomUUID();
            const idempotencyKey = `${trigger_key}-${submission_id || 'no-sub'}-${messageId}`;

            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: trigger_key,
              recipient_email: addr,
              status: "pending",
            });

            const { error: enqueueError } = await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                message_id: messageId,
                to: addr,
                from: `${dealerName} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: emailSubject,
                html: emailHtml,
                text: emailBodyText,
                purpose: "transactional",
                label: trigger_key,
                idempotency_key: idempotencyKey,
                queued_at: new Date().toISOString(),
              },
            });

            if (enqueueError) {
              console.error("Failed to enqueue staff email:", enqueueError);
              results.email = `failed: ${enqueueError.message}`;
              await logNotification("email", addr, "failed", enqueueError.message);
            } else {
              console.log(`Staff email enqueued: ${trigger_key} → ${addr}`);
              results.email = "queued";
              await logNotification("email", addr, "sent");
            }
          } catch (e) {
            console.error("Staff email error:", e);
            results.email = "error";
            await logNotification("email", addr, "error", String(e));
          }
        }
      }
    } else {
      results.email = channels.includes("email") ? "skipped: no recipients" : "channel_disabled";
    }

    // ── SEND SMS ──
    if (channels.includes("sms") && smsRecipients.length > 0) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioSid && twilioToken && twilioPhone) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const smsText = smsBodyText + " Reply STOP to opt out.";

        for (const phone of smsRecipients) {
          try {
            const smsRes = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: phone, From: twilioPhone, Body: smsText }),
            });
            const smsData = await smsRes.json();
            console.log("SMS response:", JSON.stringify(smsData));
            const smsStatus = smsRes.ok ? "sent" : "failed";
            results.sms = smsRes.ok ? "sent" : `failed: ${JSON.stringify(smsData)}`;
            await logNotification("sms", phone, smsStatus, smsRes.ok ? undefined : JSON.stringify(smsData));
          } catch (e) {
            console.error("SMS error:", e);
            results.sms = "error";
            await logNotification("sms", phone, "error", String(e));
          }
        }
      } else {
        results.sms = "skipped: no Twilio config";
      }
    } else {
      results.sms = channels.includes("sms") ? "skipped: no recipients" : "channel_disabled";
    }

    return new Response(JSON.stringify({ success: true, trigger_key, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-notification error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
