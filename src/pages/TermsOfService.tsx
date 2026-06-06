// Terms of Service — overhauled to match the Moto landing aesthetic.
//
// Same chrome language as PrivacyPolicy and CustomerLookup: soft-gray
// bg flowing into BrandFooter, no separate hero slab, icon tile + H1,
// white rounded-3xl article card holding the body. The slim inline
// row at the top carries the back arrow + "Get my offer" link so the
// customer can bail in either direction (SPA navigation, no refresh).
//
// Substitution safety preserved: if the dealership name is missing or
// matches a placeholder, the contract refuses to render the
// counterparty name and surfaces "(legal entity not configured)" —
// rendering a contract with "{dealerName}" or "Our Dealership" as the
// counterparty would be a contract-validity problem.
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

const PLACEHOLDER_NAMES = new Set([
  "our dealership", "dealership", "default", "tbd", "your dealership",
]);

function legalEntityName(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "(legal entity not configured)";
  if (PLACEHOLDER_NAMES.has(v.toLowerCase())) return "(legal entity not configured)";
  return v;
}

const TermsOfService = () => {
  const { config } = useSiteConfig();
  const dealerName = legalEntityName(config.dealership_name);
  // Tenant-driven contact details — never hard-code one dealership's phone or
  // address into a contract that names a different dealership as counterparty.
  const contactPhone = (config.phone || "").trim();
  const contactAddress = ((config as { dealership_address?: string }).dealership_address || "").trim();

  return (
    <>
      <SEO
        title={`Terms of Service | ${dealerName}`}
        description={`Review the terms and conditions for using ${dealerName}'s vehicle appraisal and purchasing services.`}
        path="/terms"
      />

      <main
        className="flex-1 px-5 py-12 lg:py-16"
        style={{ background: "hsl(220 14% 98%)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Back
            </Link>
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Get my offer
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          </div>

          <div className="text-center mb-10">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
              style={{ background: "hsl(220 100% 96%)" }}
            >
              <FileText className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
              Terms of Service
            </h1>
            <p className="text-sm text-foreground/55">Last updated: May 9, 2026</p>
          </div>

          <article className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-8 text-[15px] text-foreground/75 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using this website and related services operated by{" "}
                {dealerName} ("we," "us," or "our"), you agree to be bound by these Terms of
                Service. If you do not agree to these terms, please do not use our services.
              </p>
              <p className="mt-3 text-sm text-foreground/60">
                These Terms are between you and {dealerName}. {dealerName} operates this
                website using AutoCurb, a third-party technology platform acting solely
                as {dealerName}'s service provider and facilitator. {dealerName} — not
                AutoCurb — is the party you are transacting with and is responsible for
                the offers and communications you receive.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">2. Services</h2>
              <p>
                {dealerName} provides an online platform for vehicle appraisals, trade-in
                offers, appointment scheduling, and related automotive services.{" "}
                <strong className="text-foreground">Unless a value is expressly labeled a
                "firm offer," any value, estimate, or "offer" you receive through this
                website is an estimate only — it is not a binding offer to purchase your
                vehicle, not a guarantee of price, and creates no obligation on you or
                {" "}{dealerName}.</strong> Where {dealerName} expressly presents a value as
                a firm offer, {dealerName} commits to honoring that amount for the stated
                validity period <strong className="text-foreground">provided an in-person
                inspection confirms the vehicle matches your description and has a clean,
                non-branded title with no prior accident and no undisclosed material
                issues</strong>; if inspection reveals something materially different,
                {dealerName} is not bound by that amount. Every value is conditioned on
                in-person inspection and verification of the vehicle's actual condition,
                mileage, equipment, title, and history, and may be revised upward or
                downward or withdrawn. No purchase obligation exists on either party
                unless and until a written purchase agreement is signed by both parties.
                See our <a href="/disclosure" className="text-primary underline-offset-4 hover:underline">Offer Disclosure</a> for how offers are calculated.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">3. User Submissions</h2>
              <p>
                When you submit information through our forms (including vehicle details,
                contact information, and photographs), you represent that the information
                provided is accurate and that you are authorized to submit it. You retain
                ownership of any photos you upload but grant us a non-exclusive license to
                use them for appraisal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">4. Communications Consent</h2>
              <p>
                By submitting your contact information through any form on our website, you
                consent to receive communications from {dealerName}, including but not
                limited to phone calls, text messages (SMS/MMS), and emails regarding your
                vehicle submission, offer, or appointment. See our{" "}
                <Link
                  to="/privacy#sms-consent"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Privacy Policy — SMS Consent section
                </Link>{" "}
                for full details on text messaging terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">5. Price Guarantee</h2>
              <p>
                Offers made through our platform are valid for 8 calendar days from the date
                of issuance, subject to vehicle inspection confirming the accuracy of the
                information provided. Material discrepancies between the submitted
                information and the actual vehicle condition may result in an adjusted
                offer.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">6. Disclaimer of Warranties; Limitation of Liability</h2>
              <p className="font-semibold text-foreground">
                THE WEBSITE AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE,"
                WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW,
                {" "}{dealerName} DISCLAIMS ALL EXPRESS AND IMPLIED WARRANTIES,
                INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                NON-INFRINGEMENT, AND ACCURACY.
              </p>
              <p className="mt-3">
                To the fullest extent permitted by law, {dealerName} shall not be liable
                for any indirect, incidental, consequential, special, or punitive
                damages arising from your use of the services or any estimate, including
                any claim that you declined or forfeited another offer in reliance on an
                estimate. {dealerName}'s total liability shall not exceed the final
                purchase offer amount stated in a signed purchase agreement, if any.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">7. Acceptable Use &amp; Intellectual Property</h2>
              <p>
                You agree not to submit false, fraudulent, or another person's
                information; misrepresent a vehicle's condition, mileage, title, or
                ownership; use the services unlawfully; or attempt to disrupt, scrape, or
                gain unauthorized access to the services. The website, its content, and
                the underlying software platform are owned by {dealerName} or its
                technology providers; you receive only a limited, revocable license to
                use the services for your personal vehicle transaction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">8. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws
                of the State of Connecticut, without regard to its conflict of law
                provisions.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">9. Contact</h2>
              <p>
                Questions about these Terms should be directed to {dealerName}
                {contactPhone ? <> at {contactPhone}</> : null}
                {contactAddress ? <> or at {contactAddress}</> : null}.
              </p>
            </section>
          </article>

          <div className="flex items-center justify-center gap-6 mt-10 text-sm">
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="inline-flex items-center gap-2 text-foreground/65 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Back
            </Link>
            <span className="text-foreground/30">·</span>
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
            >
              Get my offer
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default TermsOfService;
