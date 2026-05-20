// Privacy Policy — overhauled to match the Moto landing aesthetic.
//
// Same chrome language as CustomerLookup: soft-gray bg flowing into
// BrandFooter, no separate hero slab, single icon tile + H1, white
// rounded-3xl article card holding the body. Per product direction
// the legacy SiteHeader/navy banner is gone — a slim inline row at
// the top of the article carries the back arrow + "Get my offer"
// link so the customer can bail in either direction without a page
// refresh (same route SPA navigation).
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Shield } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import BrandFooter from "@/components/BrandFooter";
import SiteHeader from "@/components/SiteHeader";
import SEO from "@/components/SEO";

const PrivacyPolicy = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim() || "Our Dealership";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(220 14% 98%)" }}
    >
      <SEO
        title={`Privacy Policy | ${dealerName}`}
        description={`Learn how ${dealerName} collects, uses, and protects your personal information.`}
        path="/privacy"
      />

      <SiteHeader />

      <main className="flex-1 px-5 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Slim nav row — back arrow on the left, "Get my offer"
              link on the right. Replaces the legacy SiteHeader so the
              page reads as one continuous soft-gray surface. */}
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

          {/* Page heading — same icon-tile + H1 + intro pattern as
              CustomerLookup. Calm, single navy accent, no banner. */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
              style={{ background: "hsl(220 100% 96%)" }}
            >
              <Shield className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-foreground/55">Last updated: May 9, 2026</p>
          </div>

          {/* Article card — same shell language as CustomerLookup's
              lookup card. White, hairline border, soft shadow. */}
          <article className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-8 text-[15px] text-foreground/75 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">1. Who We Are</h2>
              <p>
                {dealerName} ("we," "us," or "our") operates this website and related
                services. This privacy policy applies to all information collected
                through our platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">2. Information We Collect</h2>
              <p className="mb-2">
                We may collect the following categories of personal information when you
                use our website or services:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Contact information:</strong> full name, email address, phone number, mailing address, and ZIP code.</li>
                <li><strong className="text-foreground">Vehicle information:</strong> VIN, license plate number, vehicle year, make, model, mileage, condition details, and photographs.</li>
                <li><strong className="text-foreground">Financial information:</strong> loan/lease status, lender name, outstanding balance, and monthly payment amounts (provided voluntarily).</li>
                <li><strong className="text-foreground">Usage data:</strong> browser type, IP address, pages visited, and interaction timestamps collected automatically through standard web technologies.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">3. How We Use Your Information</h2>
              <p className="mb-2">We use the information we collect for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>To provide vehicle appraisals and purchase offers.</li>
                <li>To schedule and manage appointment requests.</li>
                <li>To communicate with you about your submission, offer, or appointment via phone, email, or text message.</li>
                <li>To improve our website and services.</li>
                <li>To comply with legal obligations.</li>
              </ul>
            </section>

            <section id="sms-consent">
              <h2 className="text-lg font-bold text-foreground mb-2">4. Text Message (SMS/MMS) Consent &amp; Communication</h2>
              <p className="mb-3">
                By providing your phone number on any form on this website — including but
                not limited to the vehicle appraisal form, appointment scheduling form, and
                service customer form — you expressly consent to receive autodialed and/or
                pre-recorded text messages (SMS and MMS) and phone calls from {dealerName}{" "}
                at the phone number you provided. These communications may include:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mb-4">
                <li>Vehicle appraisal updates and offer notifications.</li>
                <li>Appointment confirmations, reminders, and follow-ups.</li>
                <li>Service-related communications and trade-in opportunities.</li>
                <li>Requests for additional information or documentation.</li>
              </ul>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">Important details</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li><strong className="text-foreground">Consent is not a condition of purchase.</strong> You are not required to consent to receive text messages as a condition of purchasing any goods or services.</li>
                  <li><strong className="text-foreground">Message frequency varies.</strong> You may receive up to 10 messages per month depending on your interaction with our services.</li>
                  <li><strong className="text-foreground">Message and data rates may apply.</strong> Standard messaging rates from your wireless carrier apply.</li>
                  <li><strong className="text-foreground">Opt out at any time.</strong> Reply <strong className="text-foreground">STOP</strong> to any text message to unsubscribe. You will receive a one-time confirmation message. You may also contact us at (866) 851-7390 to opt out.</li>
                  <li><strong className="text-foreground">Help.</strong> Reply <strong className="text-foreground">HELP</strong> for assistance or contact us at (866) 851-7390.</li>
                  <li><strong className="text-foreground">Supported carriers:</strong> AT&amp;T, Verizon, T-Mobile, Sprint, and most major U.S. carriers. Carriers are not liable for delayed or undelivered messages.</li>
                </ul>
              </div>

              <p>
                Your consent to receive text messages is documented at the time of form
                submission and retained in our records. We do not sell, rent, or share your
                phone number with third parties for their marketing purposes. Your phone
                number will only be used by {dealerName} and its authorized service
                providers for the purposes described above.
              </p>
            </section>

            <section id="vehicle-value-tracker">
              <h2 className="text-lg font-bold text-foreground mb-2">5. Vehicle Value Tracker (optional service)</h2>
              <p className="mb-3">
                When you complete the appraisal flow on this site, you will see a toggle
                labelled <strong className="text-foreground">"Track my vehicle value monthly via email"</strong>.
                This toggle is <strong className="text-foreground">enabled by default</strong>. If you leave
                it enabled when you verify your phone number, you are opting in to our free
                Vehicle Value Tracker service.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">What the tracker does</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li><strong className="text-foreground">Weekly recompute.</strong> We re-run your vehicle's value against the same data sources we use to price your trade-in (Kelley Blue Book and Black Book), adjusted for drifted mileage.</li>
                  <li><strong className="text-foreground">Monthly email.</strong> You will receive a dealer-branded email from {dealerName} with your current estimated value and the change since you signed up.</li>
                  <li><strong className="text-foreground">Threshold alerts.</strong> If your vehicle's value moves more than $200 between checks, we may send an additional notification so you can decide whether to sell or trade.</li>
                  <li><strong className="text-foreground">One-click refresh.</strong> Each email includes a link back to a fresh appraisal page so you can update your information and request a new firm offer at any time.</li>
                </ul>
              </div>

              <p className="font-semibold text-foreground mb-2">Information stored for the tracker</p>
              <ul className="list-disc pl-5 space-y-1.5 mb-4">
                <li>Your name, email address, and phone number.</li>
                <li>Vehicle details: VIN (or year, make, model, trim), mileage at signup, and the condition you reported.</li>
                <li>The baseline valuation we computed for you and each subsequent weekly snapshot.</li>
              </ul>

              <p className="font-semibold text-foreground mb-2">How to opt out</p>
              <ul className="list-disc pl-5 space-y-1.5 mb-4">
                <li><strong className="text-foreground">Before you verify your phone:</strong> toggle off "Track my vehicle value monthly via email" on the contact step. No tracker record will be created.</li>
                <li><strong className="text-foreground">After you've signed up:</strong> click the <strong className="text-foreground">Unsubscribe</strong> link at the bottom of any value-tracking email, or open your tracker page (<code className="text-[13px] bg-[hsl(220_14%_96%)] px-1.5 py-0.5 rounded">/watch-my-car/&lt;your-link&gt;</code>) and disable notifications.</li>
                <li><strong className="text-foreground">Anytime:</strong> contact {dealerName} directly and we will delete your tracker record on request.</li>
              </ul>

              <p>
                The tracker uses your contact information solely to send the value-update
                emails described above. We do not sell, rent, or share your tracker data
                with third parties for their own marketing purposes. The data is stored in
                the same database that holds your appraisal record and is subject to all
                other rights described in this policy.
              </p>
            </section>

            <section id="payoff-authorization">
              <h2 className="text-lg font-bold text-foreground mb-2">6. Loan Payoff Verification Authorization (conditional)</h2>
              <p className="mb-3">
                <strong className="text-foreground">This section only applies if you have indicated on our form that there is an outstanding loan, lease, or lien on your vehicle.</strong>{" "}
                If you own your vehicle outright and have no active financing, no payoff
                request will ever be made and this authorization does not apply to you.
              </p>
              <p className="mb-3">
                When you submit a vehicle for appraisal or acquisition through this website{" "}
                <em>and indicate that the vehicle has an outstanding loan</em>, you authorize
                {" "}{dealerName} and our authorized service providers (including but not
                limited to DealerTrack and RouteOne, both of which are regulated
                financial-services integration platforms) to request a 10-day payoff quote
                from your current lienholder.
              </p>
              <p className="mb-4">
                This authorization is granted for the sole purpose of completing the vehicle
                acquisition you have requested, and it is necessary in order for us to
                calculate the net amount you will receive after your loan is paid off.
                Without this authorization, we cannot issue a check for the equity portion
                of your vehicle.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">What we request from your lender</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li><strong className="text-foreground">10-day payoff amount</strong> — the exact dollar amount required to satisfy your loan in full within the next 10 calendar days.</li>
                  <li><strong className="text-foreground">Per-diem interest rate</strong> — the daily amount of interest that accrues between the quote date and the date the check clears.</li>
                  <li><strong className="text-foreground">Account status</strong> — whether the loan is current, past due, or in a workout program, so we can communicate accurate net-proceeds numbers.</li>
                  <li><strong className="text-foreground">Lender confirmation number</strong> — the reference number the lender assigns to the quote so we can include it in the check-request documentation.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-sm font-semibold text-foreground mb-2">Important details</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li><strong className="text-foreground">Purpose.</strong> Payoff information is used solely to complete the vehicle acquisition you initiated. It is never used for marketing, credit analysis, or any purpose outside the transaction you have requested.</li>
                  <li><strong className="text-foreground">Duration.</strong> This authorization remains valid for 90 days from the date of submission or until you withdraw it in writing, whichever comes first.</li>
                  <li><strong className="text-foreground">Withdrawal.</strong> You may withdraw this authorization at any time by replying to any message from us or by contacting us directly. Withdrawal will stop future payoff requests but does not affect payoff quotes already retrieved.</li>
                  <li><strong className="text-foreground">Disclosure of requests.</strong> A copy of every payoff request we make on your behalf is available upon request.</li>
                  <li><strong className="text-foreground">Regulatory compliance.</strong> All payoff requests are made in compliance with the Gramm-Leach-Bliley Act (GLBA), the Fair Credit Reporting Act (FCRA), and applicable state financial privacy laws.</li>
                  <li><strong className="text-foreground">No credit inquiry.</strong> A payoff request is not a credit check and does not affect your credit score. We do not pull your credit report as part of this process unless you have separately authorized it on a credit application.</li>
                </ul>
              </div>

              <p>
                Your payoff authorization is documented at the time of form submission
                alongside your other consents, and the version of the authorization text in
                effect at that time is preserved in our records. If we materially update the
                authorization language in the future, previously submitted consents remain
                pinned to the version you agreed to.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">7. How We Share Your Information</h2>
              <p className="mb-3">We do not sell your personal information. We may share your information with:</p>
              <p className="mb-2"><strong className="text-foreground">Service providers (sub-processors)</strong> — the named third parties below, each contractually limited to delivering the service on our behalf:</p>
              <div className="overflow-x-auto rounded-2xl border border-border/60 mb-4">
                <table className="text-sm w-full">
                  <thead className="bg-[hsl(220_14%_96%)]">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Sub-processor</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Purpose</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-foreground">Categories of data shared</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr>
                      <td className="px-3 py-2.5">Supabase, Inc. (AWS us-east-1)</td>
                      <td className="px-3 py-2.5">Database, authentication, file storage</td>
                      <td className="px-3 py-2.5">All categories</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">Twilio, Inc.</td>
                      <td className="px-3 py-2.5">SMS / MMS delivery</td>
                      <td className="px-3 py-2.5">Phone number, message content</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">Bland AI, Inc.</td>
                      <td className="px-3 py-2.5">Outbound voice AI calls</td>
                      <td className="px-3 py-2.5">Phone number, name, vehicle details, call recording, transcript</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">Anthropic PBC</td>
                      <td className="px-3 py-2.5">AI grading + sentiment of voice calls</td>
                      <td className="px-3 py-2.5">Call transcripts (text only)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">OpenAI, L.L.C.</td>
                      <td className="px-3 py-2.5">Whisper speech-to-text on call recordings</td>
                      <td className="px-3 py-2.5">Call audio (recordings)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">Stripe, Inc.</td>
                      <td className="px-3 py-2.5">Payment processing (dealership subscriptions)</td>
                      <td className="px-3 py-2.5">No customer-of-dealership data; dealership account billing only</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">Resend, Inc. / SendGrid (Twilio)</td>
                      <td className="px-3 py-2.5">Transactional email delivery</td>
                      <td className="px-3 py-2.5">Email address, message content</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5">DealerTrack / RouteOne</td>
                      <td className="px-3 py-2.5">Loan payoff verification (only if you authorized in §6)</td>
                      <td className="px-3 py-2.5">Lender, account number, vehicle</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mb-2">We may also share your information when:</p>
              <ul className="list-disc pl-5 space-y-1.5 mb-3">
                <li><strong className="text-foreground">Legal requirements:</strong> when required by law, regulation, or legal process (subpoena, court order).</li>
                <li><strong className="text-foreground">Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, with notice to you.</li>
              </ul>
              <p className="text-sm text-foreground/60">
                We do not share your personal information with advertisers or marketing
                networks. We do not sell your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">8. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your personal
                information, including encrypted data transmission (SSL/TLS), access
                controls, and secure cloud storage. However, no method of electronic
                transmission or storage is 100% secure, and we cannot guarantee absolute
                security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">9. Data Retention</h2>
              <p>
                We retain your personal information for as long as reasonably necessary to
                fulfill the purposes for which it was collected, including to satisfy legal,
                accounting, or reporting requirements. Vehicle submission data and
                associated communications are retained for up to 3 years after your last
                interaction with us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">10. Your Rights</h2>
              <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5 mb-3">
                <li>Access, correct, or delete your personal information.</li>
                <li>Opt out of marketing communications at any time.</li>
                <li>Request a copy of the data we hold about you.</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{" "}
                <strong className="text-foreground">(866) 851-7390</strong> or email us at
                the address listed below.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">10a. California residents (CCPA / CPRA)</h2>
              <p className="mb-2">
                If you are a California resident, the California Consumer Privacy Act (as
                amended by the California Privacy Rights Act) gives you the following
                rights, which we honor regardless of where you live:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mb-3">
                <li><strong className="text-foreground">Right to know.</strong> You can request a copy of every category of personal information we have collected about you, the sources we collected it from, the business or commercial purpose for collecting it, and the third parties we shared it with.</li>
                <li><strong className="text-foreground">Right to delete.</strong> You can request that we delete personal information we have about you, subject to limited exceptions (legal hold, fraud prevention, completing a transaction you initiated).</li>
                <li><strong className="text-foreground">Right to correct.</strong> You can request correction of inaccurate personal information.</li>
                <li><strong className="text-foreground">Right to limit use of sensitive personal information.</strong> We do not use sensitive PI (driver's license images, financial account numbers) for any purpose beyond delivering the service you requested.</li>
                <li><strong className="text-foreground">Right to opt out of sale or sharing.</strong> We do not sell or share your personal information for cross-context behavioral advertising. There is nothing to opt out of.</li>
                <li><strong className="text-foreground">Right to non-discrimination.</strong> We will not deny service, charge a different price, or provide a lower quality of service because you exercised any of these rights.</li>
              </ul>
              <p className="mb-2">To exercise these rights, you (or an authorized agent) can:</p>
              <ul className="list-disc pl-5 space-y-1.5 mb-3">
                <li>
                  Submit a self-service request at{" "}
                  <a href="/my-data-rights" className="text-primary underline-offset-4 hover:underline">/my-data-rights</a>.
                  We will verify your identity by sending a one-time code to the phone or
                  email on file and respond within 45 days (extendable to 90 days with
                  notice).
                </li>
                <li>
                  Call <strong className="text-foreground">(866) 851-7390</strong> or email{" "}
                  <a href="mailto:privacy@hartecash.com" className="text-primary underline-offset-4 hover:underline">privacy@hartecash.com</a>.
                </li>
              </ul>
              <p className="text-sm text-foreground/60">
                The categories of personal information we have collected in the preceding
                12 months are listed in §2 above. We retain personal information for the
                periods stated in §9.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">10b. Other state privacy rights</h2>
              <p>
                Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah
                (UCPA), and other states with comprehensive privacy laws have substantially
                similar rights, including the right to know, delete, correct, opt out of
                sale or targeted advertising, and appeal a denied request. The same
                self-service request flow above applies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">11. Children's Privacy</h2>
              <p>
                Our services are not directed to individuals under 18 years of age. We do
                not knowingly collect personal information from children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted
                on this page with a revised "Last updated" date. Your continued use of our
                website after any changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-2">13. Contact Us</h2>
              <p className="mb-3">
                If you have questions about this Privacy Policy or our data practices,
                contact us:
              </p>
              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5">
                <p className="font-semibold text-foreground">{dealerName}</p>
                <p>150 Weston Street, Hartford, CT 06120</p>
                <p>Phone: (866) 851-7390</p>
              </div>
            </section>
          </article>

          {/* Bottom recovery — return to landing or back. Same calm
              text-link voice as the rest of the new system. */}
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

      <BrandFooter />
    </div>
  );
};

export default PrivacyPolicy;
