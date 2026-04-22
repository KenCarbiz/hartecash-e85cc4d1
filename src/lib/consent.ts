import { supabase } from "@/integrations/supabase/client";

// Consent text versions — the payoff authorization paragraph is
// ONLY added when the customer indicates they have an outstanding
// loan on the vehicle. Customers who own outright get the v1 TCPA
// text; customers with a loan get v2 which layers the payoff
// verification authorization on top.
//
// Version history:
//   v1 — TCPA SMS/Calls/Email consent only (Wave 3,
//        migration 20260411000100). Used for customers who
//        indicate NO outstanding loan.
//   v2 — v1 + Loan Payoff Verification Authorization required for
//        the DealerTrack Payoff Quotes integration (migration
//        20260412000000). Used ONLY when the customer indicates
//        they DO have an outstanding loan.
//
// The edge function ai-photo-reappraisal / dealertrack-payoff-fetch
// enforces this at the boundary — it refuses payoff requests on any
// submission whose consent_version is not in
// PAYOFF_AUTHORIZED_VERSIONS below. A v1 submission with no loan
// will never have a payoff pulled anyway (nothing to pull), but
// defense in depth matters.
export const CURRENT_CONSENT_VERSION_NO_LOAN = "v1";
export const CURRENT_CONSENT_VERSION_WITH_LOAN = "v2";

// Versions that include explicit payoff verification authorization.
// When adding a new version that supersedes v2, keep v2 in this list
// so previously-consented customers remain authorized.
export const PAYOFF_AUTHORIZED_VERSIONS = ["v2"] as const;

/**
 * Returns true when the customer's self-reported loan status
 * indicates there's a lienholder we'd need to pay off. Customers
 * who say "own outright" or "no loan" or leave the field blank
 * don't need the payoff authorization.
 */
export function hasLoanFromStatus(loanStatus: string | null | undefined): boolean {
  if (!loanStatus) return false;
  const s = loanStatus.toLowerCase().replace(/\s+/g, "_");
  // Anything that mentions "loan", "finance", "lease", "lien" — yes
  if (s.includes("loan") || s.includes("finance") || s.includes("lease") || s.includes("lien")) {
    // but NOT "no_loan" / "paid_off" / "own_outright"
    if (s.includes("no_") || s.includes("paid") || s.includes("outright") || s.includes("free_and_clear")) {
      return false;
    }
    return true;
  }
  return false;
}

const TCPA_BASE = (dealerName: string) =>
  `By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from ${dealerName} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out.`;

const PAYOFF_AUTHORIZATION = (dealerName: string) =>
  `\n\nPayoff Verification Authorization: Because you indicated you have an outstanding loan on this vehicle, by submitting this form you authorize ${dealerName} and its authorized service providers (including DealerTrack and/or RouteOne) to request a 10-day payoff quote from your current lienholder for the sole purpose of completing the vehicle acquisition you've requested. You authorize your lender to release your payoff amount, per-diem interest rate, and account status to us in response to this request. This authorization remains valid for 90 days from the date of submission or until you withdraw it in writing. A copy of every payoff request we make on your behalf is available upon request.`;

const buildConsentText = (dealerName: string, hasLoan: boolean): string => {
  const base = TCPA_BASE(dealerName);
  return hasLoan ? base + PAYOFF_AUTHORIZATION(dealerName) : base;
};

export async function logConsent({
  customerName,
  customerPhone,
  customerEmail,
  formSource,
  submissionToken,
  dealershipName,
  loanStatus,
  hasLoan,
}: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  formSource: string;
  submissionToken?: string;
  dealershipName?: string;
  // Either pass the raw loanStatus string (platform will normalize
  // it) or pass an explicit hasLoan boolean. If neither is provided
  // the consent defaults to "no loan" (v1) which is safe because
  // the edge function refuses payoff pulls on v1 submissions.
  loanStatus?: string | null;
  hasLoan?: boolean;
}) {
  try {
    const includesPayoff =
      typeof hasLoan === "boolean" ? hasLoan : hasLoanFromStatus(loanStatus);
    const version = includesPayoff
      ? CURRENT_CONSENT_VERSION_WITH_LOAN
      : CURRENT_CONSENT_VERSION_NO_LOAN;
    const consentType = includesPayoff
      ? "sms_calls_email_and_payoff_auth"
      : "sms_calls_email";
    await supabase.from("consent_log" as any).insert({
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      consent_type: consentType,
      consent_text: buildConsentText(dealershipName || "our dealership", includesPayoff),
      consent_version: version,
      form_source: formSource,
      submission_token: submissionToken || null,
      user_agent: navigator.userAgent || null,
    });
  } catch {
    // Fire-and-forget — don't block form submission
  }
}
