/**
 * Default email & SMS templates for every notification trigger.
 * Placeholders: {{customer_name}}, {{vehicle}}, {{mileage}}, {{offer_amount}},
 * {{portal_link}}, {{appointment_date}}, {{appointment_time}}, {{location}},
 * {{dealership_name}}, {{status}}, {{guarantee_days}}
 */

export interface TemplateDefaults {
  email_subject: string;
  email_body: string;
  sms_body: string;
  channels?: string[];
}

export const DEFAULT_TEMPLATES: Record<string, TemplateDefaults> = {
  /* ───── Staff triggers ───── */
  new_submission: {
    email_subject: "New Vehicle Submission — {{vehicle}}",
    email_body:
      "A new submission has been received.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nMileage: {{mileage}}\n\nView it in the admin dashboard to review and make an offer.",
    sms_body:
      "New submission from {{customer_name}} for their {{vehicle}}. Review it in the admin dashboard.",
  },
  hot_lead: {
    email_subject: "🔥 Hot Lead — {{customer_name}}",
    email_body:
      "A submission has been flagged as a hot lead.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThis lead meets your configured offer rules for priority follow-up.",
    sms_body:
      "🔥 Hot Lead: {{customer_name}} — {{vehicle}}. Flagged for priority follow-up.",
  },
  appointment_booked: {
    email_subject: "New Appointment — {{customer_name}}",
    email_body:
      "A customer has scheduled an inspection.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}",
    sms_body:
      "New appt: {{customer_name}} — {{vehicle}} on {{appointment_date}} at {{appointment_time}}.",
  },
  photos_uploaded: {
    email_subject: "Photos Uploaded — {{vehicle}}",
    email_body:
      "{{customer_name}} has uploaded photos for their {{vehicle}}. Review them in the admin dashboard.",
    sms_body: "{{customer_name}} uploaded photos for their {{vehicle}}.",
  },
  docs_uploaded: {
    email_subject: "Documents Uploaded — {{vehicle}}",
    email_body:
      "{{customer_name}} has uploaded documents for their {{vehicle}}. Review them in the admin dashboard.",
    sms_body: "{{customer_name}} uploaded documents for their {{vehicle}}.",
  },
  status_change: {
    email_subject: "Status Update — {{vehicle}}",
    email_body:
      "A submission status has been updated.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\nNew Status: {{status}}",
    sms_body:
      "Status update: {{customer_name}} — {{vehicle}} is now \"{{status}}\".",
  },
  staff_customer_accepted: {
    email_subject: "🎉 Customer Accepted Offer — {{customer_name}}",
    email_body:
      "Great news! {{customer_name}} has accepted the offer on their {{vehicle}}.\n\nOffer Amount: {{offer_amount}}\n\nFollow up to schedule their inspection visit.",
    sms_body:
      "🎉 {{customer_name}} accepted the offer on their {{vehicle}} ({{offer_amount}}). Follow up to schedule!",
  },
  staff_deal_completed: {
    email_subject: "✅ Deal Completed — {{customer_name}}",
    email_body:
      "A deal has been completed.\n\nCustomer: {{customer_name}}\nVehicle: {{vehicle}}\n\nThe purchase has been finalized.",
    sms_body: "✅ Deal completed: {{customer_name}} — {{vehicle}}.",
  },

  /* ───── Customer triggers ───── */
  customer_offer_ready: {
    email_subject: "Your Offer Is Ready — {{dealership_name}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news! We've reviewed your {{vehicle}} and your personalized offer is ready.\n\nClick below to view your offer:\n{{portal_link}}\n\nThis offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your offer for your {{vehicle}} is ready! View it here: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_increased: {
    email_subject: "Great News — Your Offer Has Been Increased!",
    email_body:
      "Hi {{customer_name}},\n\nWe've increased the offer on your {{vehicle}}!\n\nView your updated offer:\n{{portal_link}}\n\nDon't wait — this offer is valid for {{guarantee_days}} days.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, great news! We've increased our offer on your {{vehicle}}. View it: {{portal_link}} — {{dealership_name}}",
  },
  customer_offer_accepted: {
    email_subject: "Offer Accepted — Next Steps for Your {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nThank you for accepting our offer on your {{vehicle}}!\n\nOffer Amount: {{offer_amount}}\n\nNext Steps:\n1. Schedule your inspection visit\n2. Bring your title, registration, and valid ID\n3. We'll handle the rest!\n\nSchedule now: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your offer of {{offer_amount}} for your {{vehicle}} is confirmed! Schedule your visit: {{portal_link}} — {{dealership_name}}",
  },
  customer_appointment_booked: {
    email_subject: "Appointment Confirmed — {{appointment_date}}",
    email_body:
      "Hi {{customer_name}},\n\nYour inspection is confirmed!\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}\nAddress: {{location_address}}\nVehicle: {{vehicle}}\n\nWhat to Bring:\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Info (if applicable)\n\nYour inspection takes about 15-20 minutes.\n\nSee you there!\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your visit is confirmed for {{appointment_date}} at {{appointment_time}} at {{location}}. Bring your ID, title/registration, and all keys. — {{dealership_name}}",
  },
  customer_appointment_reminder: {
    email_subject: "Reminder: Your Appointment Is Tomorrow",
    email_body:
      "Hi {{customer_name}},\n\nJust a friendly reminder — your inspection is tomorrow!\n\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nLocation: {{location}}\nAddress: {{location_address}}\nVehicle: {{vehicle}}\n\nRemember to bring:\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Info (if applicable)\n\nYour inspection takes about 15-20 minutes.\n\nSee you soon!\n{{dealership_name}}",
    sms_body:
      "Reminder: Your visit is tomorrow at {{appointment_time}} at {{location}}. Bring your ID, title/registration, and all keys. See you there! — {{dealership_name}}",
  },
  customer_appointment_reminder_dayof: {
    email_subject: "Your inspection is today at {{appointment_time}}",
    email_body:
      "Hi {{customer_name}},\n\nYour vehicle inspection is TODAY!\n\nTime: {{appointment_time}}\nLocation: {{location}}\nAddress: {{location_address}}\nVehicle: {{vehicle}}\n\nWhat to Bring:\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Info (if applicable)\n\nYour inspection takes about 15-20 minutes.\n\nWe look forward to seeing you!\n{{dealership_name}}",
    sms_body:
      "Reminder: Your vehicle inspection is today at {{appointment_time}} at {{location_name}}. Bring your ID, title/registration, and all keys. — {{dealership_name}}",
  },
  customer_what_to_bring: {
    email_subject: "What to bring to your vehicle inspection",
    email_body:
      "Hi {{customer_name}},\n\nHere's what to bring to your upcoming vehicle inspection:\n\n• Driver's License\n• Vehicle Title or Registration\n• All Keys & Remotes\n• Loan Payoff Statement (if applicable)\n\nExpect your visit to take about 15-20 minutes.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "For your upcoming inspection, please bring: Driver's License, Title/Registration, all keys & remotes, and loan payoff info if applicable. Visit takes ~15-20 min. — {{dealership_name}}",
  },
  customer_inspection_started: {
    email_subject: "Inspection in progress — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nOur team is starting the inspection of your {{vehicle}} now. You'll get a quick update when we're done — usually 15-20 minutes.\n\nHang tight, and thanks for choosing {{dealership_name}}.",
    sms_body:
      "Hi {{customer_name}} — our team is starting your {{vehicle}} inspection now. Usually takes 15-20 min. We'll text when we're done. — {{dealership_name}}",
  },
  customer_inspection_progress: {
    email_subject: "Inspection progress — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nQuick update: tires and brakes have been checked on your {{vehicle}}. We're wrapping up the rest of the inspection and will send your final number shortly.\n\n— {{dealership_name}}",
    sms_body:
      "Quick update: tires & brakes checked on your {{vehicle}}, wrapping up the rest. Final number coming shortly. — {{dealership_name}}",
  },
  customer_inspection_complete: {
    email_subject: "Inspection Complete — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news! The inspection on your {{vehicle}} has been completed.\n\nWe're finalizing the details and will be in touch shortly with next steps.\n\nView your status: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, the inspection on your {{vehicle}} is complete! We'll follow up with next steps shortly. — {{dealership_name}}",
  },
  customer_check_ready: {
    email_subject: "Your Check Is Being Processed — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nYour check request for your {{vehicle}} has been submitted and is being processed.\n\nWe'll let you know as soon as it's ready for pickup.\n\nView your status: {{portal_link}}\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your check for your {{vehicle}} is being processed. We'll notify you when it's ready! — {{dealership_name}}",
  },
  staff_escalation_overdue: {
    email_subject: "[OVERDUE] Escalation open {{minutes_open}}m — {{vehicle}}",
    email_body:
      "An escalation on {{customer_name}}'s {{vehicle}} has been open for {{minutes_open}} minutes without resolution.\n\nReason: {{escalation_reason}}\nNotes: {{escalation_notes}}\nEscalated by: {{escalation_created_by}}\n\nOpen the customer file: {{admin_link}}",
    sms_body:
      "Escalation open {{minutes_open}}m — {{customer_name}}'s {{vehicle}}. Reason: {{escalation_reason}}. Needs someone.",
  },
  staff_escalation_opened: {
    email_subject: "[ESCALATION] {{escalation_reason}} — {{customer_name}}",
    email_body:
      "{{escalation_created_by}} just escalated {{customer_name}}'s {{vehicle}}.\n\nReason: {{escalation_reason}}\nNotes: {{escalation_notes}}\n\nOpen the customer file: {{admin_link}}",
    sms_body:
      "Escalation: {{customer_name}} — {{vehicle}}. Reason: {{escalation_reason}}. Needs a manager.",
  },
  staff_customer_arrived: {
    email_subject: "Customer arrived — {{customer_name}}",
    email_body:
      "{{customer_name}} just checked in at reception for their {{vehicle}} inspection.\n\nHead to the front desk to greet them.\n\nCustomer file: {{admin_link}}",
    sms_body:
      "{{customer_name}} just arrived for their {{vehicle}} inspection. They're at the front desk.",
  },
  customer_check_ready_for_pickup: {
    email_subject: "Your check is ready — {{vehicle}}",
    email_body:
      "Hi {{customer_name}},\n\nGreat news — your check for the {{vehicle}} is ready for pickup. Come on by whenever works for you today.\n\nJust ask for your salesperson at the front desk.\n\nThank you,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}} — your check for the {{vehicle}} is ready! Come pick it up any time today. — {{dealership_name}}",
  },
  customer_purchase_complete: {
    email_subject: "Purchase Complete — Thank You!",
    email_body:
      "Hi {{customer_name}},\n\nCongratulations! The purchase of your {{vehicle}} is now complete.\n\nThank you for choosing {{dealership_name}}. If you have any questions, don't hesitate to reach out.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your {{vehicle}} purchase is complete! Thank you for choosing {{dealership_name}}.",
  },
  customer_appointment_rescheduled: {
    email_subject: "Your Appointment Has Been Rescheduled",
    email_body:
      "Hi {{customer_name}},\n\nYour inspection appointment has been rescheduled.\n\nNew Date: {{appointment_date}}\nNew Time: {{appointment_time}}\nLocation: {{location}}\nVehicle: {{vehicle}}\n\nIf you need to make changes, please contact us.\n\nBest regards,\n{{dealership_name}}",
    sms_body:
      "Hi {{customer_name}}, your appointment has been rescheduled to {{appointment_date}} at {{appointment_time}} at {{location}}. — {{dealership_name}}",
  },

  /* ───── Voice AI triggers ───── */
  voice_warmup_sms: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Hey {{customer_name}}, this is {{dealership_name}}. We have a cash offer ready for your {{vehicle_info}}. We'll give you a quick call shortly to discuss. Reply STOP to opt out.",
    channels: ["sms"],
  },
  customer_voicemail_followup: {
    email_subject: "We tried to reach you about your {{vehicle_info}}",
    email_body:
      "Hi {{customer_name}},\n\nWe just tried to give you a call about your {{vehicle_info}}. We have an offer of {{offer_amount}} ready for you.\n\nView your offer: {{offer_link}}\n\nReply to this email or call us anytime.",
    sms_body:
      "Hey {{customer_name}}, we just tried to reach you about your {{vehicle_info}}. Your ${{offer_amount}} offer is waiting: {{offer_link}}",
    channels: ["sms", "email"],
  },
  customer_missed_call_text: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Hey {{customer_name}}, this is {{dealership_name}}. We have a ${{offer_amount}} cash offer for your {{vehicle_info}}. Tap here to view: {{offer_link}}",
    channels: ["sms"],
  },
  customer_callback_confirmation: {
    email_subject: "",
    email_body: "",
    sms_body:
      "Thanks for chatting, {{customer_name}}! We'll call you back as requested. In the meantime, your ${{offer_amount}} offer is here: {{offer_link}}",
    channels: ["sms"],
  },
};

/** Available placeholder variables with descriptions */
export const PLACEHOLDER_VARS: { key: string; desc: string }[] = [
  { key: "{{customer_name}}", desc: "Customer's full name" },
  { key: "{{vehicle}}", desc: "Year Make Model" },
  { key: "{{mileage}}", desc: "Vehicle mileage" },
  { key: "{{offer_amount}}", desc: "Dollar offer amount" },
  { key: "{{portal_link}}", desc: "Customer portal URL" },
  { key: "{{appointment_date}}", desc: "Appointment date" },
  { key: "{{appointment_time}}", desc: "Appointment time" },
  { key: "{{location}}", desc: "Dealership location" },
  { key: "{{location_address}}", desc: "Dealership street address" },
  { key: "{{location_name}}", desc: "Dealership location name" },
  { key: "{{dealership_name}}", desc: "Dealership name" },
  { key: "{{status}}", desc: "Submission status" },
  { key: "{{guarantee_days}}", desc: "Offer guarantee days" },
];
