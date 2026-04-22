import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";

const PrivacyPolicy = () => {
  const { config } = useSiteConfig();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`Privacy Policy | ${config.dealership_name}`}
        description={`Learn how ${config.dealership_name} collects, uses, and protects your personal information.`}
        path="/privacy"
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
          <h1 className="font-bold text-lg">Privacy Policy</h1>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto px-5 py-10 md:py-14">
        <h1 className="text-3xl font-extrabold mb-2 text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: February 26, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Who We Are</h2>
            <p>
              Our Dealership ("we," "us," or "our") operates this website
              and related services. This privacy policy applies to all information collected
              through our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Information We Collect</h2>
            <p>We may collect the following categories of personal information when you use our website or services:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contact Information:</strong> Full name, email address, phone number, mailing address, and ZIP code.</li>
              <li><strong>Vehicle Information:</strong> VIN, license plate number, vehicle year, make, model, mileage, condition details, and photographs of your vehicle.</li>
              <li><strong>Financial Information:</strong> Loan/lease status, lender name, outstanding balance, and monthly payment amounts (provided voluntarily).</li>
              <li><strong>Usage Data:</strong> Browser type, IP address, pages visited, and interaction timestamps collected automatically through standard web technologies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide vehicle appraisals and purchase offers.</li>
              <li>To schedule and manage appointment requests.</li>
              <li>To communicate with you about your submission, offer, or appointment via phone, email, or text message.</li>
              <li>To improve our website and services.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section id="sms-consent">
            <h2 className="text-xl font-bold text-foreground">4. Text Message (SMS/MMS) Consent & Communication</h2>
            <p>
              By providing your phone number on any form on this website — including but not limited to
              the vehicle appraisal form, appointment scheduling form, and service customer form — you
              expressly consent to receive autodialed and/or pre-recorded text messages (SMS and MMS)
              and phone calls from Our Dealership at the phone number you provided. These communications
              may include:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Vehicle appraisal updates and offer notifications.</li>
              <li>Appointment confirmations, reminders, and follow-ups.</li>
              <li>Service-related communications and trade-in opportunities.</li>
              <li>Requests for additional information or documentation.</li>
            </ul>

            <div className="bg-muted/50 border border-border rounded-lg p-4 my-4">
              <h3 className="font-bold text-foreground mb-2">Important Details:</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Consent is not a condition of purchase.</strong> You are not required to consent to receive text messages as a condition of purchasing any goods or services.</li>
                <li><strong>Message frequency varies.</strong> You may receive up to 10 messages per month depending on your interaction with our services.</li>
                <li><strong>Message and data rates may apply.</strong> Standard messaging rates from your wireless carrier apply.</li>
                <li><strong>Opt-out at any time.</strong> Reply <strong>STOP</strong> to any text message to unsubscribe. You will receive a one-time confirmation message. You may also contact us at (866) 851-7390 to opt out.</li>
                <li><strong>Help.</strong> Reply <strong>HELP</strong> for assistance or contact us at (866) 851-7390.</li>
                <li><strong>Supported carriers:</strong> AT&T, Verizon, T-Mobile, Sprint, and most major U.S. carriers. Carriers are not liable for delayed or undelivered messages.</li>
              </ul>
            </div>

            <p>
              Your consent to receive text messages is documented at the time of form submission and
              retained in our records. We do not sell, rent, or share your phone number with third
              parties for their marketing purposes. Your phone number will only be used by our dealership
              Group and its authorized service providers for the purposes described above.
            </p>
          </section>

          <section id="payoff-authorization">
            <h2 className="text-xl font-bold text-foreground">5. Loan Payoff Verification Authorization (Conditional)</h2>
            <p>
              <strong>This section only applies if you have indicated on our form that there is an
              outstanding loan, lease, or lien on your vehicle.</strong> If you own your vehicle
              outright and have no active financing, no payoff request will ever be made and this
              authorization does not apply to you.
            </p>
            <p>
              When you submit a vehicle for appraisal or acquisition through this website <em>and
              indicate that the vehicle has an outstanding loan</em>, you authorize our dealership
              and our authorized service providers (including but not limited to DealerTrack and
              RouteOne, both of which are regulated financial-services integration platforms) to
              request a 10-day payoff quote from your current lienholder.
            </p>
            <p>
              This authorization is granted for the sole purpose of completing the vehicle
              acquisition you have requested, and it is necessary in order for us to calculate the
              net amount you will receive after your loan is paid off. Without this authorization,
              we cannot issue a check for the equity portion of your vehicle.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-4 my-4">
              <h3 className="font-bold text-foreground mb-2">What we request from your lender:</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>10-day payoff amount</strong> — the exact dollar amount required to satisfy your loan in full within the next 10 calendar days.</li>
                <li><strong>Per-diem interest rate</strong> — the daily amount of interest that accrues between the quote date and the date the check clears.</li>
                <li><strong>Account status</strong> — whether the loan is current, past due, or in a workout program, so we can communicate accurate net-proceeds numbers.</li>
                <li><strong>Lender confirmation number</strong> — the reference number the lender assigns to the quote so we can include it in the check-request documentation.</li>
              </ul>
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4 my-4">
              <h3 className="font-bold text-foreground mb-2">Important Details:</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Purpose.</strong> Payoff information is used solely to complete the vehicle acquisition you initiated. It is never used for marketing, credit analysis, or any purpose outside the transaction you have requested.</li>
                <li><strong>Duration.</strong> This authorization remains valid for 90 days from the date of submission or until you withdraw it in writing, whichever comes first.</li>
                <li><strong>Withdrawal.</strong> You may withdraw this authorization at any time by replying to any message from us or by contacting us directly. Withdrawal will stop future payoff requests but does not affect payoff quotes already retrieved.</li>
                <li><strong>Disclosure of requests.</strong> A copy of every payoff request we make on your behalf is available upon request. Contact us in writing for a copy of your payoff quote history.</li>
                <li><strong>Regulatory compliance.</strong> All payoff requests are made in compliance with the Gramm-Leach-Bliley Act (GLBA), the Fair Credit Reporting Act (FCRA), and applicable state financial privacy laws.</li>
                <li><strong>No credit inquiry.</strong> A payoff request is not a credit check and does not affect your credit score. We do not pull your credit report as part of this process unless you have separately authorized it on a credit application.</li>
              </ul>
            </div>

            <p>
              Your payoff authorization is documented at the time of form submission alongside your
              other consents, and the version of the authorization text in effect at that time is
              preserved in our records. If we materially update the authorization language in the
              future, previously submitted consents remain pinned to the version you agreed to.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">6. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Service Providers:</strong> Third-party vendors that help us deliver services (e.g., email delivery, SMS messaging, data hosting). These providers are contractually obligated to protect your data.</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">7. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information,
              including encrypted data transmission (SSL/TLS), access controls, and secure cloud
              storage. However, no method of electronic transmission or storage is 100% secure, and
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">8. Data Retention</h2>
            <p>
              We retain your personal information for as long as reasonably necessary to fulfill the
              purposes for which it was collected, including to satisfy legal, accounting, or reporting
              requirements. Vehicle submission data and associated communications are retained for up
              to 3 years after your last interaction with us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">9. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access, correct, or delete your personal information.</li>
              <li>Opt out of marketing communications at any time.</li>
              <li>Request a copy of the data we hold about you.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <strong>(866) 851-7390</strong> or email us at the address listed below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">10. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under 18 years of age. We do not
              knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this
              page with a revised "Last updated" date. Your continued use of our website after any
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">12. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, contact us:</p>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="font-bold">Our Dealership</p>
              <p>150 Weston Street, Hartford, CT 06120</p>
              <p>Phone: (866) 851-7390</p>
            </div>
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

export default PrivacyPolicy;
