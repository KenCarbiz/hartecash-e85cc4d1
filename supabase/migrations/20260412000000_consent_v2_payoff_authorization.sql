-- Consent Text v2 — adds Loan Payoff Verification Authorization
--
-- Builds on the consent_text_versions system shipped in Wave 3
-- (migration 20260411000100). This migration publishes v2 of the
-- consent text which adds an explicit Loan Payoff Verification
-- Authorization paragraph required before the platform can request
-- payoff quotes from DealerTrack / RouteOne / direct lender APIs.
--
-- **Critical scoping note:** v2 is ONLY applied to submissions
-- where the customer has indicated they have an outstanding loan.
-- Customers who own outright get v1 (TCPA only). The consent.ts
-- helper picks the right version based on self-reported loan_status
-- — v1 stays in active use and remains the default for no-loan
-- customers, so this is additive, not a global replacement.

INSERT INTO public.consent_text_versions (dealership_id, version, consent_type, text, is_active, published_by)
VALUES (
  'default',
  'v2',
  'sms_calls_email_and_payoff_auth',
  'By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from {{dealership_name}} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out.

Payoff Verification Authorization: Because you indicated you have an outstanding loan on this vehicle, by submitting this form you authorize {{dealership_name}} and its authorized service providers (including DealerTrack and/or RouteOne) to request a 10-day payoff quote from your current lienholder for the sole purpose of completing the vehicle acquisition you''ve requested. You authorize your lender to release your payoff amount, per-diem interest rate, and account status to us in response to this request. This authorization remains valid for 90 days from the date of submission or until you withdraw it in writing. A copy of every payoff request we make on your behalf is available upon request.',
  true,
  'system_seed'
)
ON CONFLICT (dealership_id, version, consent_type) DO NOTHING;
