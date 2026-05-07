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

/**
 * Domain customer email replies are routed through. Configurable via
 * the INBOUND_EMAIL_DOMAIN secret so each environment can swap MX
 * providers without a redeploy. The inbound-email-webhook function
 * parses the +tag from the local part to find the originating
 * submission. Set Reply-To to "replies+<submission_token>@<this>" so
 * customer mail clients route the reply back to us.
 *
 * Falls back to FROM_DOMAIN if not set — replies still land in the
 * provider's inbound queue and the In-Reply-To fallback in the
 * webhook still routes them by message_id.
 */
const INBOUND_EMAIL_DOMAIN = Deno.env.get("INBOUND_EMAIL_DOMAIN") || `inbound.${FROM_DOMAIN}`;

/** Build the per-submission Reply-To address for inbound routing. */
function buildReplyTo(submissionToken: string | null | undefined, dealerName: string): string | undefined {
  if (!submissionToken) return undefined;
  return `${dealerName} <replies+${submissionToken}@${INBOUND_EMAIL_DOMAIN}>`;
}

/** Default templates for staff emails and fallback */
const DEFAULT_TEMPLATES: Record<string, { email_subject: string; email_body: string; sms_body: string }> = {
  customer_offer_ready: {
    email_subject: "Your Offer Is Ready — {{dealership_name}}",
    email_body: "Hi {{customer_name}},\n\nGreat news! We've reviewed your {{vehicle}} and your personalized offer is ready.\n\nClick below to view your offer:\n{{portal_link}}\n\nThis offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, your offer for your {{vehicle}} is ready! View it here: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_followup_d1: {
    email_subject: "Quick question about your {{vehicle}} offer",
    email_body: "Hi {{customer_name}},\n\nWe sent your offer for the {{vehicle}} and just wanted to check in. If you didn't accept it, would you let us know why? It helps us follow up the right way (and not pester you about something that doesn't fit).\n\n• Price too low: {{decline_link_price}}\n• Still shopping around: {{decline_link_shopping}}\n• Not ready to sell yet: {{decline_link_notready}}\n• Sold elsewhere: {{decline_link_sold}}\n\nView your offer: {{portal_link}}\n\n— {{dealership_name}}",
    sms_body: "Hi {{customer_name}}, just checking in on your {{vehicle}} offer. Reply with the reason if you didn't accept (price/shopping/not ready/sold) and we'll follow up the right way. View: {{portal_link}}",
  },
  // ─── Cadence step templates ────────────────────────────────────
  // D3 — market-data nudge (declined cadence)
  customer_offer_followup_d3: {
    email_subject: "Used {{vehicle}} values are moving — here's what we're seeing",
    email_body: "Hi {{customer_name}},\n\nFollowing up on the offer for your {{vehicle}}.\n\nUsed values on your model have been softening — every week of waiting can mean a few hundred dollars off the high. Our offer ({{offer_amount}}) is still good through {{lock_expires}}.\n\nQuick to lock it in: {{portal_link}}\n\nReply if you'd like us to walk you through the comps we used. — {{dealership_name}}",
    sms_body: "{{customer_name}}, used {{vehicle}} values are softening. Your offer of {{offer_amount}} still stands through {{lock_expires}}: {{portal_link}}",
  },
  // D3 — manager-bump reveal (price_too_low branch only)
  customer_offer_bump_reveal: {
    email_subject: "Good news — we found some room",
    email_body: "Hi {{customer_name}},\n\nMy used-car manager pulled comps this morning and we're able to come up on your {{vehicle}}.\n\nView your refreshed offer: {{portal_link}}\n\nIf this works, just hit Accept and we'll get you scheduled. Otherwise reply with where you need us to be — we'll see what we can do.\n\n— {{rep_name_short}}, {{dealership_name}}",
    sms_body: "{{customer_name}} — refreshed your {{vehicle}} offer. Take a look: {{portal_link}} — {{rep_name_short}}, {{dealership_name}}",
  },
  // D6 — expires tomorrow (declined cadence)
  customer_offer_expires_tomorrow: {
    email_subject: "Reminder: your offer expires tomorrow",
    email_body: "Hi {{customer_name}},\n\nQuick heads-up — your offer of {{offer_amount}} for the {{vehicle}} expires tomorrow ({{lock_expires}}).\n\nIf you'd like to lock it in, just one click: {{portal_link}}\n\nIf you've already moved on, reply STOP and we'll close it out.\n\n— {{dealership_name}}",
    sms_body: "Heads up — your {{vehicle}} offer ({{offer_amount}}) expires tomorrow {{lock_expires}}: {{portal_link}} — {{dealership_name}}",
  },
  // D7 — last chance / counter ask (declined cadence)
  customer_offer_last_chance: {
    email_subject: "Last day — we'd love to make this work",
    email_body: "Hi {{customer_name}},\n\nToday's the last day on your offer of {{offer_amount}} for the {{vehicle}}.\n\nIf the number isn't quite there, send us your best competing quote and we'll see if we can match or beat it. Just reply to this email.\n\nView your offer: {{portal_link}}\n\n— {{rep_name_short}}, {{dealership_name}}",
    sms_body: "Last day on your {{vehicle}} offer. If you got a better quote elsewhere, reply with the number and we'll try to match. {{portal_link}}",
  },
  // ─── Stall cadence (accepted, not scheduled) ───────────────────
  customer_offer_accepted_sms_followup: {
    email_subject: "Schedule your inspection — held until {{lock_expires}}",
    email_body: "Hi {{customer_name}}, just confirming — {{rep_name_short}} is holding your {{offer_amount}} offer through {{lock_expires}}. Schedule your visit: {{portal_link}}\n\n— {{dealership_name}}",
    sms_body: "{{customer_name}} — {{rep_name_short}} from {{dealership_name}} is holding your {{offer_amount}} offer until {{lock_expires}}. Schedule here (30 min): {{portal_link}}",
  },
  customer_schedule_slot_proposal: {
    email_subject: "A few times that work for your inspection",
    email_body: "Hi {{customer_name}},\n\nLet's get your {{vehicle}} inspection on the books. Pick the time that works:\n\n{{portal_link}}\n\nIf none of those slots work, reply with what does and {{rep_name_short}} will make it happen. — {{dealership_name}}",
    sms_body: "{{customer_name}}, reply 1, 2, or 3 to lock a time for your inspection — or pick from {{portal_link}}. Locked through {{lock_expires}}.",
  },
  customer_doc_upload_unlock: {
    email_subject: "One quick step — upload your title to lock the slot",
    email_body: "Hi {{customer_name}},\n\nUpload a quick photo of your title and we can lock your inspection slot in seconds (and verify there's no surprise lien on the day-of):\n\n{{portal_link}}\n\nNo title in hand? Reply and we'll send a state-specific replacement link. — {{dealership_name}}",
    sms_body: "{{customer_name}}, snap a pic of your title to lock the slot: {{portal_link}}. Reply if it's in the lender's hands and we'll handle it. — {{dealership_name}}",
  },
  customer_lock_expires_48h: {
    email_subject: "Heads up — your offer locks expire in 48 hours",
    email_body: "Hi {{customer_name}},\n\nYour offer of {{offer_amount}} expires in 48 hours ({{lock_expires}}). Need a different time? Reply and we'll work it out — {{rep_name_short}}, {{dealership_name}}\n\nSchedule: {{portal_link}}",
    sms_body: "{{customer_name}}, your {{offer_amount}} offer locks in 48h ({{lock_expires}}). Schedule: {{portal_link}}",
  },
  customer_manager_signed_extension: {
    email_subject: "Personal note from {{rep_name_short}} — happy to extend",
    email_body: "Hi {{customer_name}},\n\nI'm reaching out personally — your offer of {{offer_amount}} on the {{vehicle}} expires today, but I'd be happy to extend it another 7 days if you need more time.\n\nJust reply and let me know what's going on. If there's a snag (title, payoff, time-off-work), we have options — at-home pickup, after-hours appointments, lender coordination.\n\nSchedule: {{portal_link}}\n\n— {{rep_name_short}}, {{dealership_name}}",
    sms_body: "{{customer_name}}, this is {{rep_name_short}} from {{dealership_name}}. Happy to extend your {{offer_amount}} offer if you need more time — just reply. Schedule: {{portal_link}}",
  },
  // ─── Reengage cadence (post-expiry KBB-style) ──────────────────
  customer_reengage_market_update: {
    email_subject: "Market update on your {{vehicle}} — {{dealership_name}}",
    email_body: "Hi {{customer_name}},\n\nQuick update on the market for your {{vehicle}}.\n\nWe'd still buy it. Want a fresh, no-obligation number? One click: {{portal_link}}\n\n— {{dealership_name}}",
    sms_body: "Hi {{customer_name}}, market update on your {{vehicle}}: we'd still buy it. Fresh quote: {{portal_link}} — {{dealership_name}}",
  },
  customer_reengage_offer_refresh: {
    email_subject: "Refreshed offer for your {{vehicle}}",
    email_body: "Hi {{customer_name}},\n\nWe pulled fresh comps and refreshed your offer on the {{vehicle}}: {{portal_link}}\n\nReply STOP if you'd like us to stop following up. — {{dealership_name}}",
    sms_body: "{{customer_name}}, refreshed your {{vehicle}} offer: {{portal_link}}. Reply STOP to opt out.",
  },
  customer_offer_increased: {
    email_subject: "Great News — Your Offer Has Been Increased!",
    email_body: "Hi {{customer_name}},\n\nWe've increased the offer on your {{vehicle}}!\n\nView your updated offer:\n{{portal_link}}\n\nDon't wait — this offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body: "Hi {{customer_name}}, great news! We've increased our offer on your {{vehicle}}. View it: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_accepted: {
    email_subject: "Offer Accepted — let's get your {{vehicle}} scheduled",
    // Friction-removal up-front: doc checklist, lien-payoff pre-auth
    // link, named-rep accountability, 30-min timebox promise. Research
    // (KBB ICO data, BDC playbooks) shows surfacing requirements at
    // acceptance vs. at the door is the #1 lever on schedule-conversion.
    email_body: "Hi {{customer_name}},\n\nGreat — we've locked your offer of {{offer_amount}} for your {{vehicle}}.\n\n{{rep_intro}}holding it for you through {{lock_expires}}.\n\n📅 SCHEDULE YOUR VISIT (about 30 minutes):\n{{portal_link}}\n\n📋 BRING WITH YOU:\n  • Vehicle title (or signed lien-payoff authorization — see below)\n  • Government-issued photo ID\n  • Current vehicle registration\n  • All keys and key fobs\n  • Owner's manual / second-key fob if you have it{{loan_payoff_block}}\n\nWe'll inspect, verify, and cut your check the same visit. If you have a co-titleholder, please bring them — they'll need to sign too.\n\nQuestions? Just reply to this email — it goes straight to {{rep_name_short}}.\n\n— {{dealership_name}}",
    sms_body: "Hi {{customer_name}}, your offer of {{offer_amount}} is locked through {{lock_expires}}. Schedule your 30-min visit here: {{portal_link}} — {{dealership_name}}",
  },
  customer_appointment_reminder: {
    email_subject: "You're on the books for tomorrow at {{appointment_time}}",
    email_body: "Hi {{customer_name}},\n\n{{rep_name_short}} here — confirming your inspection tomorrow at {{appointment_time}}, {{location}}, for the {{vehicle}}.\n\nWhat to bring: driver's license, title (or registration if your lender holds it), all keys + remotes, loan payoff letter if you still owe.\n\nReply to this and it goes straight to {{rep_name_short}}.\n\n— {{dealership_name}}",
    sms_body: "{{customer_name}} — {{rep_name_short}} here, you're confirmed for tomorrow at {{appointment_time}} at {{location}}. Bring ID, title, all keys. — {{dealership_name}}",
  },
  // 24h-out reminder. Fired by send-appointment-reminders cron when
  // the appointment is 22.5–25.5h away. Calmer copy + a peek at the
  // self-checkin links so the customer knows the workflow when they
  // get the day-of ping.
  customer_appointment_reminder_24h: {
    email_subject: "Tomorrow at {{appointment_time}} — your inspection",
    email_body: "Hi {{customer_name}},\n\nQuick reminder — we'll see you tomorrow at {{appointment_time}} at {{location}} for your {{vehicle}}.\n\nWhat to bring:\n• Driver's license\n• Vehicle title (or registration if title is held by your lender)\n• All keys + remotes\n• Loan payoff letter if you still owe on it\n\nWhen the time comes you can let us know you're heading in by tapping {{arrive_url}}?status=on_the_way — totally optional, but it helps us have your file ready before you walk in.\n\nReply to this email if anything changes.\n\n— {{dealership_name}}",
    sms_body: "{{customer_name}} — heads-up that we'll see you tomorrow at {{appointment_time}} at {{location}}. Bring ID, title, all keys. — {{dealership_name}}",
  },
  // 2h-out reminder. This is the SMS that carries the self-checkin
  // links — close enough to departure that the customer is about to
  // get in the car. Both URLs included so the customer can pick
  // whichever fits their moment (heading out vs arriving).
  customer_appointment_reminder_2h: {
    email_subject: "Inspection in about 2 hours",
    email_body: "Hi {{customer_name}},\n\nWe're ready for you at {{appointment_time}} for the {{vehicle}}.\n\nWhen you head out: {{arrive_url}}?status=on_the_way\nWhen you pull in: {{arrive_url}}?status=arrived\n\nEither tap is fine — pick whichever fits.\n\n— {{dealership_name}}",
    sms_body: "Hi {{customer_name}} — ready for you at {{appointment_time}}. Tap when you head out: {{arrive_url}}?status=on_the_way — or when you arrive: {{arrive_url}}?status=arrived. — {{dealership_name}}",
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
  staff_customer_replied: {
    email_subject: "💬 {{customer_name}} replied — {{vehicle}}",
    email_body: "{{custom_body}}\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nOpen the conversation in the dashboard to respond.",
    sms_body: "💬 {{custom_body}}",
  },
  ai_warm_transfer_alert: {
    email_subject: "🚨 AI Voice — warm transfer for {{customer_name}}",
    email_body: "The AI voice agent is transferring a call to you.\n\n{{custom_body}}\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nLast offer: {{offer_amount}}\n\nOpen the customer file in the dashboard for the full transfer summary.",
    sms_body: "{{custom_body}}",
  },
  staff_bdc_call_needed: {
    email_subject: "📞 BDC call needed — {{customer_name}} ({{vehicle}})",
    email_body: "The cadence engine queued a follow-up call (this dealer doesn't use AI voice).\n\n{{custom_body}}\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nVehicle: {{vehicle}}\nLast offer: {{offer_amount}}\n\nOpen the BDC Calls page in the dashboard for the full talking points + authorized bump amount.",
    sms_body: "{{custom_body}}",
  },
  staff_deal_completed: {
    email_subject: "✅ Deal Completed — {{customer_name}}",
    email_body: "A deal has been completed.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThe purchase has been finalized.",
    sms_body: "✅ Deal completed: {{customer_name}} — {{vehicle}}.",
  },
  customer_deal_completed: {
    email_subject: "🎉 Your Deal Is Complete — {{dealership_name}}",
    email_body: "Hi {{customer_name}},\n\nCongratulations! Your deal for your {{vehicle}} is officially complete.\n\nOffer Amount: {{offer_amount}}\n\nThank you for choosing {{dealership_name}}. We appreciate your business!\n\nIf you had a great experience, we'd love a review:\n{{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body: "🎉 Congrats {{customer_name}}! Your deal for your {{vehicle}} is complete. Thank you for choosing {{dealership_name}}!",
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

// Mirror of the SQL tcpa_timezone_for_state() function. Used as a
// fallback when submissions.customer_timezone hasn't been backfilled
// yet (e.g. legacy rows imported before the trigger landed). Cross-tz
// states default to the easternmost zone so we never call too late.
function hardcodedStateTz(state: string | null | undefined): string {
  const s = (state || "").toUpperCase();
  if (["CT", "DE", "DC", "GA", "ME", "MD", "MA", "NH", "NJ", "NY", "NC", "OH", "PA", "RI", "SC", "VT", "VA", "WV", "FL", "IN", "KY", "MI", "TN"].includes(s)) return "America/New_York";
  if (["AL", "AR", "IL", "IA", "LA", "MN", "MS", "MO", "OK", "WI", "KS", "NE", "TX", "ND", "SD"].includes(s)) return "America/Chicago";
  if (["CO", "MT", "NM", "UT", "WY", "ID"].includes(s)) return "America/Denver";
  if (s === "AZ") return "America/Phoenix";
  if (["CA", "NV", "OR", "WA"].includes(s)) return "America/Los_Angeles";
  if (s === "AK") return "America/Anchorage";
  if (s === "HI") return "Pacific/Honolulu";
  return "America/New_York"; // most-restrictive default
}

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

    // ── Channel gate (defense in depth) ───────────────────────────
    // Staff-initiated trigger keys (customer_staff_reply_sms /
    // _email) must respect the dealership's tenant_channels +
    // location_channels toggles. Automated outbound (drips,
    // scheduled SMS, follow-up sequences, system staff alerts)
    // intentionally bypass — those live behind notification_settings
    // and shouldn't be gated by the customer-comms channel toggle.
    const STAFF_REPLY_TO_CHANNEL: Record<string, "two_way_sms" | "two_way_email"> = {
      customer_staff_reply_sms: "two_way_sms",
      customer_staff_reply_email: "two_way_email",
    };
    const channelKey = STAFF_REPLY_TO_CHANNEL[trigger_key];
    if (channelKey) {
      const { data: enabledRow } = await supabase.rpc("channel_enabled", {
        _dealership_id: dealershipId,
        _location_id: null,
        _channel: channelKey,
      });
      if (enabledRow === false) {
        return new Response(
          JSON.stringify({
            error: "channel_disabled",
            message: `${channelKey === "two_way_sms" ? "Two-way SMS" : "Two-way Email"} is turned off for this dealership.`,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

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

    // Decline-reason capture links — go through the
    // track-decline-reason edge function which writes to
    // submissions.decline_reason then redirects to the offer page.
    // Used by the customer_offer_followup_d1 template (and any future
    // template that wants to capture branching signals).
    const supabaseUrlForLinks = Deno.env.get("SUPABASE_URL") || "";
    const declineLink = (reason: string) =>
      sub
        ? `${supabaseUrlForLinks}/functions/v1/track-decline-reason?token=${encodeURIComponent(sub.token)}&reason=${reason}&redirect=${encodeURIComponent(portalLink)}`
        : "";

    // Acceptance-flow personalization. Only populated when we have the
    // signal (assigned_rep_email, lien data) — otherwise the variables
    // render as empty strings so the template degrades gracefully.
    let repIntro = "We're";
    let repNameShort = "our team";
    if (sub && (sub as any).assigned_rep_email) {
      const { data: repRow } = await supabase
        .from("user_roles")
        .select("display_name, email")
        .eq("email", (sub as any).assigned_rep_email)
        .maybeSingle();
      const rawName = (repRow as any)?.display_name || (sub as any).assigned_rep_email.split("@")[0];
      const firstName = String(rawName).split(/[\s.]/)[0];
      repIntro = `${firstName} from ${dealerName} is `;
      repNameShort = firstName;
    }

    // 7-day price-lock window matches the CarMax / KBB / Carvana norm.
    // Computed here rather than stored so a tenant can change the
    // window via site_config.price_guarantee_days without a backfill.
    let lockExpires = "";
    if (sub) {
      const acceptDate = new Date();
      const lockDays = Number(guaranteeDays) || 7;
      const exp = new Date(acceptDate.getTime() + lockDays * 24 * 60 * 60 * 1000);
      lockExpires = exp.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }

    // Lien-payoff pre-auth: only show when the customer told us they
    // have a loan. Surfacing the auth link at acceptance saves the
    // 10-day lender turnaround stall that kills most accepted-but-
    // not-scheduled deals.
    let loanPayoffBlock = "";
    if (sub && (sub as any).loan_status && String((sub as any).loan_status).toLowerCase() !== "none" && String((sub as any).loan_status).toLowerCase() !== "no") {
      loanPayoffBlock = `\n\n💳 IF YOU STILL HAVE A LOAN ON THIS VEHICLE:\n  Your lender (${(sub as any).loan_company || "your bank"}) needs to issue a 10-day payoff letter — that takes a few days, so let's get it started now.\n  Sign the payoff authorization here: ${portalLink}/payoff-auth\n  We'll fax/email it to your lender directly so you don't have to.`;
    }

    // Trade-up incentive block — pulled from trade_up_incentives if
    // the dealer has one configured for the relevant trigger moment.
    // Empty string when nothing's configured (templates render
    // without it).
    let tradeUpBlock = "";
    let tradeUpShort = "";
    if (sub?.dealership_id) {
      const incentiveMoment =
        trigger_key === "customer_offer_accepted" || trigger_key === "customer_offer_accepted_v2"
          ? "post_acceptance"
          : "pre_acceptance";
      try {
        const { data: incentives } = await supabase
          .from("trade_up_incentives")
          .select("headline, description, bonus_amount, inventory_url")
          .eq("dealership_id", sub.dealership_id)
          .eq("trigger_moment", incentiveMoment)
          .eq("is_active", true)
          .order("sort_order")
          .limit(1);
        const inc = (incentives as Array<{ headline: string; description: string | null; bonus_amount: number; inventory_url: string | null }> | null)?.[0];
        if (inc) {
          const amount = Number(inc.bonus_amount) > 0 ? `$${Number(inc.bonus_amount).toLocaleString()}` : "";
          tradeUpBlock = `BONUS — ${inc.headline}` +
            (inc.description ? `\n${inc.description}` : "") +
            (amount ? `\nAdditional value: ${amount}` : "") +
            (inc.inventory_url ? `\nBrowse eligible vehicles: ${inc.inventory_url}` : "");
          tradeUpShort = amount ? `Trade-up bonus: ${amount}.` : inc.headline;
        }
      } catch {
        // trade_up_incentives table missing → no-op block.
      }
    }

    const templateVars: Record<string, string> = {
      customer_name: sub?.name?.split(" ")[0] || "there",
      customer_email: sub?.email || "",
      customer_phone: sub?.phone || "",
      vehicle,
      mileage: sub?.mileage || "",
      offer_amount: offerAmount,
      portal_link: portalLink,
      // Self-check-in URL — the customer-facing /arrive/:token page
      // accepts ?status=on_the_way and ?status=arrived. Templates
      // append the query param themselves so we keep one variable
      // and let the message pick the action it wants to surface.
      arrive_url: sub ? `${siteUrl}/arrive/${sub.token}` : siteUrl,
      decline_link_price: declineLink("price_too_low"),
      decline_link_shopping: declineLink("shopping_around"),
      decline_link_notready: declineLink("not_ready"),
      decline_link_sold: declineLink("sold_elsewhere"),
      rep_intro: repIntro,
      rep_name_short: repNameShort,
      lock_expires: lockExpires,
      loan_payoff_block: loanPayoffBlock,
      trade_up_block: tradeUpBlock,
      trade_up_short: tradeUpShort,
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
    const defaults = DEFAULT_TEMPLATES[trigger_key] || {
      email_subject: "Message from {{dealership_name}}",
      email_body: "{{custom_body}}",
      sms_body: "{{custom_body}}",
    };

    // custom_body + custom_subject override the trigger template. Used
    // by the staff reply composer on the customer file — the rep types
    // the message, we route it through the existing send pipeline
    // (channel selection, opt-out, Twilio/email queue) without needing
    // a per-message trigger row in the templates table.
    const emailSubject = replacePlaceholders(
      body.custom_subject || customEmail?.subject || defaults.email_subject,
      templateVars
    );
    const emailBodyText = replacePlaceholders(
      body.custom_body || customEmail?.body || defaults.email_body,
      { ...templateVars, custom_body: body.custom_body || "" }
    );
    const smsBodyText = replacePlaceholders(
      body.custom_body || customSms?.body || defaults.sms_body,
      { ...templateVars, custom_body: body.custom_body || "" }
    );

    // Determine recipients
    let emailRecipients: string[] = [];
    let smsRecipients: string[] = [];

    if (isCustomerTrigger) {
      if (body.recipient_email) emailRecipients = [body.recipient_email];
      else if (sub?.email) emailRecipients = [sub.email];
      if (body.recipient_phone) smsRecipients = [body.recipient_phone];
      else if (sub?.phone) smsRecipients = [sub.phone];
    } else if (isStaffTrigger) {
      // Explicit recipient overrides win — used when we want to ping a
      // SPECIFIC staff member (e.g. reception hitting "Notify Sales Rep"
      // needs to text that specific rep, not the whole admin list).
      if (body.recipient_email || body.recipient_phone) {
        if (body.recipient_email) emailRecipients = [body.recipient_email];
        if (body.recipient_phone) smsRecipients = [body.recipient_phone];
        // Respect per-staff opt-in — look up the user_roles row by the
        // recipient email (primary key we can match reliably). Skip any
        // channel the staff member has opted out of.
        if (body.recipient_email) {
          const { data: staffRow } = await supabase
            .from("user_roles")
            .select("sms_notifications_opted_in, email_notifications_opted_in")
            .eq("email", body.recipient_email)
            .maybeSingle();
          if (staffRow) {
            if ((staffRow as any).sms_notifications_opted_in === false) smsRecipients = [];
            if ((staffRow as any).email_notifications_opted_in === false) emailRecipients = [];
          }
        }
      } else {
        const triggerRecipients = (notifSettings as any)?.staff_trigger_recipients?.[trigger_key];
        if (triggerRecipients) {
          emailRecipients = triggerRecipients.emails || [];
          smsRecipients = triggerRecipients.phones || [];
        } else {
          emailRecipients = (notifSettings as any)?.email_recipients || [];
          smsRecipients = (notifSettings as any)?.sms_recipients || [];
        }
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

    // Check quiet hours for SMS — honor the dealership's configured timezone
    // instead of the edge function's UTC clock so "9 PM – 8 AM" means 9 PM
    // local to the dealer, not 9 PM UTC.
    if (notifSettings && (notifSettings as any).quiet_hours_enabled) {
      const tz = (notifSettings as any).quiet_hours_timezone || "America/New_York";
      let currentTime: string;
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
        const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
        currentTime = `${hh}:${mm}`;
      } catch {
        // Fall back to UTC if the tz string is invalid rather than crashing
        const now = new Date();
        currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
      }
      const start = (notifSettings as any).quiet_hours_start || "21:00";
      const end = (notifSettings as any).quiet_hours_end || "08:00";
      const inQuietHours = start > end
        ? currentTime >= start || currentTime < end
        : currentTime >= start && currentTime < end;
      if (inQuietHours) smsRecipients = [];
    }

    // ── TCPA hard floor: 8am–9pm RECIPIENT local time ──
    // The dealer-configured quiet-hours above honor the *dealer's* tz,
    // which is wrong under TCPA — case law and 2024 class actions
    // consistently land on recipient-local. For customer-bound SMS we
    // also enforce 8pm–9am recipient-local as an absolute floor that
    // cannot be widened by dealer settings. Use the cached
    // submissions.customer_timezone (populated by the
    // submissions_set_customer_timezone trigger).
    if (isCustomerTrigger && sub && smsRecipients.length > 0) {
      const customerTz = (sub as any).customer_timezone
        || hardcodedStateTz((sub as any).state)
        || "America/New_York";
      try {
        const hh = parseInt(
          new Intl.DateTimeFormat("en-US", {
            timeZone: customerTz,
            hour: "2-digit",
            hourCycle: "h23",
          }).formatToParts(new Date()).find((p) => p.type === "hour")?.value ?? "0",
          10,
        );
        if (hh < 8 || hh >= 21) {
          // Defer logNotification — it's declared lower; just console-log
          // here. The block itself is what matters.
          console.log(`[send-notification] TCPA quiet-hour block: tz=${customerTz} hour=${hh} sub=${(sub as any).id}`);
          smsRecipients = [];
        }
      } catch (e) {
        // If tz parsing fails, fail-closed — block the send rather than
        // risk a TCPA violation. Logged so ops can fix the bad tz value.
        console.error("[send-notification] TCPA tz parse failed, blocking:", e);
        smsRecipients = [];
      }
    }

    const results: { email?: string; sms?: string } = {};

    const logNotification = async (channel: string, recipient: string, status: string, errorMsg?: string) => {
      // Deterministic idempotency key — same trigger + submission +
      // channel + recipient inside the same 5-minute bucket dedupes at
      // the DB layer (UNIQUE index from migration 20260507090000).
      // Catches dual-tab dispatches, cron-overlap re-fires, and
      // Twilio/Bland webhook retries that race the worker.
      const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
      const idempotencyKey = `${trigger_key}:${submission_id || "no-sub"}:${channel}:${recipient}:${bucket}`;
      try {
        const { error: insertErr } = await supabase.from("notification_log").insert({
          trigger_key, channel, recipient, status,
          error_message: errorMsg || null,
          submission_id: submission_id || null,
          dealership_id: dealershipId,
          idempotency_key: idempotencyKey,
        });
        if (insertErr) {
          // 23505 = unique violation = duplicate within 5-min bucket.
          // Log and swallow; do NOT re-attempt the actual send (caller
          // shouldn't reach here twice for the same key, but if it
          // does we treat it as a no-op).
          if (!String(insertErr.message || "").includes("duplicate key")) {
            console.error("notification_log insert error:", insertErr);
          }
        }
      } catch (e) {
        console.error("Failed to log notification:", e);
      }
    };

    // ── can_touch gate ──
    // Single source of truth from migration 20260507090000. Enforces
    // opt-out (all channels), recipient-local quiet hours, per-channel
    // gap, and 3/24h + 7/7d frequency caps. Staff triggers and manual
    // sends bypass the gate (the rep clicks Send; cap protections still
    // apply per-channel via the same function called with bypass=false).
    const canTouchOnChannel = async (chan: "sms" | "email" | "voice"): Promise<{ ok: true } | { ok: false; reason: string }> => {
      if (!sub?.id) return { ok: true };
      // Staff-facing triggers shouldn't honor customer opt-out — they're
      // notifying the dealership team, not the customer.
      if (!isCustomerTrigger) return { ok: true };
      try {
        const { data } = await supabase.rpc("can_touch", { _submission_id: sub.id, _channel: chan } as never);
        const row = (data as Array<{ decision: string; reason: string }> | null)?.[0];
        if (!row || row.decision === "ok") return { ok: true };
        return { ok: false, reason: `${row.decision}:${row.reason}` };
      } catch {
        // can_touch RPC missing (migration not applied) → fail open.
        // The legacy opt-out checks below still run.
        return { ok: true };
      }
    };

    if (channels.includes("email") && emailRecipients.length > 0) {
      const ct = await canTouchOnChannel("email");
      if (!ct.ok) {
        emailRecipients = [];
        results.email = { skipped: ct.reason };
      }
    }
    if (channels.includes("sms") && smsRecipients.length > 0) {
      const ct = await canTouchOnChannel("sms");
      if (!ct.ok) {
        smsRecipients = [];
        results.sms = { skipped: ct.reason };
      }
    }

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
              submission_id: submission_id || null,
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
                submission_id: submission_id || null,
                reply_to: buildReplyTo(sub?.token, dealerName),
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
                submission_id: submission_id || null,
                reply_to: buildReplyTo(sub?.token, dealerName),
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

    // ── SEND PUSH (staff triggers only, hybrid-first) ──
    // Try PWA web-push first for staff triggers. If at least one push
    // actually delivered we skip SMS for that recipient set — saves
    // Twilio cost and avoids double-notifying. Email always still goes.
    let pushDelivered = 0;
    if (isStaffTrigger && smsRecipients.length > 0) {
      try {
        // Resolve the target user_ids by looking up user_roles via
        // recipient email. SMS recipients-only (no email) won't get
        // push — there's no clean way to reverse-lookup a phone to a
        // user without a separate index.
        const lookupEmails = emailRecipients.length > 0 ? emailRecipients : [];
        if (lookupEmails.length > 0) {
          const { data: userRows } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("email", lookupEmails);
          const userIds = [...new Set(((userRows as any[]) || []).map((r) => r.user_id).filter(Boolean))];
          if (userIds.length > 0) {
            const { data: pushResult } = await supabase.functions.invoke("send-push", {
              body: {
                user_ids: userIds,
                title: emailSubject || "Autocurb",
                body: smsBodyText,
                url: body.url || "/admin",
                tag: trigger_key,
                submission_id: submission_id || null,
                trigger_key,
                require_interaction: trigger_key === "staff_escalation_opened" || trigger_key === "staff_escalation_overdue",
              },
            });
            pushDelivered = Number((pushResult as any)?.sent || 0);
            // If at least one device got the push, suppress SMS for
            // this send. Email still fires independently — it's a
            // cheap audit trail and doesn't cost Twilio $.
            if (pushDelivered > 0) {
              await logNotification("push", userIds.join(","), "sent");
              smsRecipients = [];
            }
          }
        }
      } catch (e) {
        console.warn("send-push fallback to SMS:", e);
      }
    }

    // ── SEND SMS ──
    if (channels.includes("sms") && smsRecipients.length > 0) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      // Per-dealer Twilio number routing — pulled from
      // dealer_accounts.twilio_from_number first, env-var as the last-
      // resort fallback. Single global number across tenants is the
      // multi-tenant safety bug the architect audit flagged: brand
      // contamination, spam-flag risk, and cross-tenant inbound-reply
      // matching all flow from it.
      let twilioPhone: string | null = null;
      if (sub?.dealership_id) {
        const { data: dealerRow } = await supabase
          .from("dealer_accounts")
          .select("twilio_from_number")
          .eq("dealership_id", sub.dealership_id)
          .maybeSingle();
        twilioPhone = (dealerRow as { twilio_from_number?: string } | null)?.twilio_from_number || null;
      }
      if (!twilioPhone) twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER") || null;

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
