import { supabase } from "@/integrations/supabase/client";

// Current consent text version. Bump this (and add a corresponding row to
// consent_text_versions) any time the legal copy changes so the audit
// trail cleanly pins each customer agreement to a specific text.
export const CURRENT_CONSENT_VERSION = "v1";

const buildConsentText = (dealerName: string) =>
  `By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from ${dealerName} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out.`;

export async function logConsent({
  customerName,
  customerPhone,
  customerEmail,
  formSource,
  submissionToken,
  dealershipName,
}: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  formSource: string;
  submissionToken?: string;
  dealershipName?: string;
}) {
  try {
    await supabase.from("consent_log" as any).insert({
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      consent_type: "sms_calls_email",
      consent_text: buildConsentText(dealershipName || "our dealership"),
      consent_version: CURRENT_CONSENT_VERSION,
      form_source: formSource,
      submission_token: submissionToken || null,
      user_agent: navigator.userAgent || null,
    });
  } catch {
    // Fire-and-forget — don't block form submission
  }
}
