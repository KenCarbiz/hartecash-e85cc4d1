import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

const TermsOfService = () => {
  const { config } = useSiteConfig();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`Terms of Service | ${config.dealership_name}`}
        description={`Review the terms and conditions for using ${config.dealership_name}'s vehicle appraisal and purchasing services.`}
        path="/terms"
      />
      <div className="bg-primary text-primary-foreground px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {config.logo_white_url ? (
            <img src={config.logo_white_url} alt={config.dealership_name} className="h-20 w-auto" />
          ) : (
            <span className="text-lg font-bold">{config.dealership_name}</span>
          )}
          <h1 className="font-bold text-lg">Terms of Service</h1>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto px-5 py-10 md:py-14">
        <h1 className="text-3xl font-extrabold mb-2 text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 26, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using this website and related services operated by
              Our Dealership ("we," "us," or "our"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Services</h2>
            <p>
              Our Dealership provides an online platform for vehicle appraisals, trade-in offers,
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
              receive communications from Our Dealership, including but not limited to phone calls,
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
              Our website and services are provided "as is" without warranties of any kind. Our dealership
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
              Questions about these Terms should be directed to Our Dealership at (866) 851-7390
              or at 150 Weston Street, Hartford, CT 06120.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Our Dealership. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default TermsOfService;
