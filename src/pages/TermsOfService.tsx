import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

/**
 * Substitute the dealership name into the contract body. We
 * deliberately fail safe here: if site_config.dealership_name is
 * missing or matches the placeholder list, we refuse to render the
 * legal-entity name and surface "(legal entity not configured)".
 *
 * Why: rendering a contract that says "{dealerName}" as the
 * counterparty is a contract-validity problem — the customer
 * doesn't know who they're agreeing with. The compliance audit
 * (May 2026) flagged this. The DB-side CHECK in 20260509050000
 * blocks new placeholder values; this function is the runtime
 * fallback for tenants whose config predates the constraint.
 */
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
  // Template-aware chrome — same pattern as PrivacyPolicy. Clarity
  // dealers get the quiet white header; every other template
  // keeps the dark primary banner. Body content unchanged.
  const isClarity = config.landing_template === "clarity";
  return (
    <div className={`min-h-screen flex flex-col ${isClarity ? "bg-white text-zinc-900" : "bg-background"}`}>
      <SEO
        title={`Terms of Service | ${dealerName}`}
        description={`Review the terms and conditions for using ${dealerName}'s vehicle appraisal and purchasing services.`}
        path="/terms"
      />
      {isClarity ? (
        <header className="border-b border-zinc-200 bg-white">
          <div className="max-w-3xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              {config.logo_url ? (
                <img src={config.logo_url} alt={dealerName} className="h-16 md:h-20 w-auto object-contain" />
              ) : (
                <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">{dealerName}</span>
              )}
            </Link>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Terms of Service
            </span>
          </div>
        </header>
      ) : (
        <div className="bg-primary text-primary-foreground px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {config.logo_white_url ? (
              <img src={config.logo_white_url} alt={dealerName} className="h-20 w-auto" />
            ) : (
              <span className="text-lg font-bold">{dealerName}</span>
            )}
            <h1 className="font-bold text-lg">Terms of Service</h1>
          </div>
        </div>
      )}

      <main className={`flex-1 max-w-3xl mx-auto px-5 py-10 md:py-14 ${isClarity ? "text-zinc-700" : ""}`}>
        <h1 className={`text-3xl font-extrabold mb-2 ${isClarity ? "font-sans tracking-[-0.025em] text-zinc-900" : "text-foreground"}`}>Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: May 9, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using this website and related services operated by
              {dealerName} ("we," "us," or "our"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Services</h2>
            <p>
              {dealerName} provides an online platform for vehicle appraisals, trade-in offers,
              appointment scheduling, and related automotive services. All offers and valuations
              provided through our website are estimates and subject to in-person vehicle inspection
              and verification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. User Submissions</h2>
            <p>
              When you submit information through our forms (including vehicle details, contact
              information, and photographs), you represent that the information provided is accurate
              and that you are authorized to submit it. You retain ownership of any photos you upload
              but grant us a non-exclusive license to use them for appraisal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">4. Communications Consent</h2>
            <p>
              By submitting your contact information through any form on our website, you consent to
              receive communications from {dealerName}, including but not limited to phone calls,
              text messages (SMS/MMS), and emails regarding your vehicle submission, offer, or
              appointment. See our{" "}
              <Link to="/privacy#sms-consent" className="text-primary underline hover:no-underline">
                Privacy Policy — SMS Consent section
              </Link>{" "}
              for full details on text messaging terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">5. Price Guarantee</h2>
            <p>
              Offers made through our platform are valid for 8 calendar days from the date of issuance,
              subject to vehicle inspection confirming the accuracy of the information provided.
              Material discrepancies between the submitted information and the actual vehicle condition
              may result in an adjusted offer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">6. Limitation of Liability</h2>
            <p>
              Our website and services are provided "as is" without warranties of any kind. {dealerName}
              Group shall not be liable for any indirect, incidental, or consequential damages arising
              from your use of our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">7. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Connecticut, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">8. Contact</h2>
            <p>
              Questions about these Terms should be directed to {dealerName} at (866) 851-7390
              or at 150 Weston Street, Hartford, CT 06120.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {dealerName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default TermsOfService;
