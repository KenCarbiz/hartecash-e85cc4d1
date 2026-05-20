// Offer Disclosure — overhauled to match the Moto landing aesthetic.
//
// The three-agent panel (UX/conversion + visual/brand + legal/IA)
// converged on: water down the CHROME, not the legal content. So:
//
//   * Soft-gray bg flowing into BrandFooter, no navy gradient hero,
//     no red warning ribbon, no marketing stats strip.
//   * Accordion flattened to a single open article — the legal
//     defense ("we warned you") gets weaker if the ineligibility
//     list is hidden behind a click, and an open article actually
//     scans faster than an 8-section accordion.
//   * 18 credit/deduct factor cards keep their content but lose the
//     red/green tinted backgrounds — neutral white cards with a
//     single small icon tile (ArrowUp = credit, ArrowDown = deduct).
//   * "Our Promise" green-glow becomes calm navy emphasis.
//   * Black ACKNOWLEDGMENT block becomes a quiet white card in
//     sentence case (the six numbered clauses are preserved verbatim
//     — they're the page's legal teeth).
//   * Multi-tenant correctness: every literal "Our program" /
//     "our dealership" in the section bodies is now {dealerName}
//     via useSiteConfig, like Terms/Privacy.
//
// Governing law is still hard-coded as Connecticut. This is fine
// for the current tenant set (Hartecash-only) but is wrong for any
// non-CT dealer added in the future. The legal-IA agent flagged
// this; the right fix is a config.governing_law_state field
// (separate migration + admin UI), tracked outside this PR.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import BrandFooter from "@/components/BrandFooter";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Factor {
  title: string;
  body: string;
  credit: boolean;
}

const factors: Factor[] = [
  { title: "Tires — OEM/all-season, ≥60% remaining", body: "OEM or name-brand all-season tires in good condition are valued more favorably than off-brand or performance-only tires. Tread depth is measured with a calibrated gauge. ≥60% = Full Fair Value Credit. 50–59% = Partial Credit. See Section 03 for full thresholds.", credit: true },
  { title: "Brake pads — ≥60% remaining", body: "Pad life is measured directly where accessible. ≥60% = Full Fair Value Credit. 50–59% = Partial Credit. Metal-on-metal contact = significant deduct. See Section 03.", credit: true },
  { title: "Battery — recently replaced or tested good", body: "A recently replaced or passing load-test battery may receive a credit. A weak, failing, or dead battery — including hybrid 12V auxiliary — results in a deduct.", credit: true },
  { title: "Recent major service — verified with receipts", body: "Qualifying services within 24 months, supported by original receipts or dealer records: timing belt/chain replacement, new or rebuilt transmission, engine replacement or rebuild, full brake job (rotors + pads, all four corners). Verbal claims without documentation cannot be credited.", credit: true },
  { title: "Clean 1-owner history — no accidents", body: "A verified history report showing zero accidents, no commercial use, and single titled ownership is a meaningful positive valuation factor.", credit: true },
  { title: "Low mileage for model year", body: "Mileage meaningfully below the national average for the vehicle's model year is an explicit credit trigger reflected in the Final Offer.", credit: true },
  { title: "Exterior — original paint, excellent condition", body: "Original factory paint with no significant chips, deep scratches, or paint correction issues supports a higher offer. Quality, color-matched prior repairs are evaluated case by case.", credit: true },
  { title: "Interior — clean, odor-free, undamaged", body: "A clean interior with no smoke/pet odor, no torn or stained upholstery, and no broken trim or hard surfaces supports maximum value.", credit: true },
  { title: "All keys, fobs, remotes & original equipment", body: "All key sets, fobs, spare tire, jack, floor mats, and owner's manual present at inspection support maximum value. Each missing item carries its own deduct.", credit: true },
  { title: "Warning lights — any illuminated", body: "Any warning light at inspection — check engine, ABS, airbag/SRS, TPMS, transmission, or emissions — results in a deduct. Multiple active lights may trigger a program decline.", credit: false },
  { title: "Active fluid leaks", body: "Oil, coolant, transmission, power steering, or differential leaks discovered at inspection reduce the offer based on severity and estimated repair cost.", credit: false },
  { title: "Inoperable systems — A/C, heat, windows", body: "Non-functioning air conditioning, heating, or power windows are assessed as mechanical deducts at inspection.", credit: false },
  { title: "Missing catalytic converter", body: "A missing or stolen catalytic converter is a significant deduct due to high replacement cost and must be disclosed prior to inspection.", credit: false },
  { title: "Deployed airbags — not professionally replaced", body: "Airbags that have deployed and have not been replaced by a licensed professional are a significant deduct and may disqualify the vehicle from the program.", credit: false },
  { title: "Structural or frame damage", body: "Evidence of frame damage, structural repairs, or prior unibody work may significantly reduce the offer or result in a program decline, regardless of cosmetic appearance.", credit: false },
  { title: "Body damage — dents, rust, glass, panels", body: "Dents, rust/corrosion, cracked glass, hail damage, or non-OEM/mismatched replacement panels reduce the offer based on repair cost estimate.", credit: false },
  { title: "Prior accidents — on history report", body: "Any reported accident reduces the offer. Severity, number of incidents, repair quality, and structural involvement are all considered.", credit: false },
  { title: "Aftermarket modifications", body: "Lift kits, lowering springs, body kits, non-OEM exhaust, aftermarket wheels, and non-factory audio generally do not add value and may reduce the offer.", credit: false },
];

const ineligibleTitles = [
  { label: "Salvage Title", desc: "Vehicle was declared a total loss by an insurance company and issued a salvage brand by a state titling authority." },
  { label: "Total Loss Designation", desc: "Any vehicle with a prior total loss declaration on record, regardless of whether it was subsequently repaired or re-titled." },
  { label: "Rebuilt / Reconstructed Title", desc: "Vehicles that were previously salvaged and rebuilt, even if currently road-worthy and re-titled as rebuilt or reconstructed." },
  { label: "TMU — True Mileage Unknown", desc: "Any vehicle where the odometer reading cannot be verified or has been tampered with, broken, rolled back, or replaced without proper documentation." },
  { label: "Lemon Law Buyback", desc: "Vehicles repurchased by a manufacturer or dealer under state or federal lemon law provisions. Customers must affirmatively disclose this status prior to submission — see Section 02." },
  { label: "Flood / Water Damage Title", desc: "Vehicles carrying a flood, water damage, or hurricane brand on the title, regardless of current cosmetic condition or repair." },
  { label: "Junk Title", desc: "Any vehicle designated as junk or non-repairable by a state titling authority." },
  { label: "Gray Market / Non-US Specification", desc: "Vehicles not originally manufactured or federally certified for sale in the United States domestic market." },
  { label: "Affidavit of Heirship / Bonded Title", desc: "Vehicles where clear, standard legal ownership cannot be established through a fully transferable title instrument." },
];

const verificationItems = [
  "Odometer reading confirmed against submitted mileage",
  "Tire tread depth and tire life percentage — measured with calibrated gauge",
  "Brake pad and rotor condition — remaining pad life percentage",
  "Battery health test result",
  "All warning lights and active diagnostic codes",
  "Exterior and structural integrity — paint, panels, glass, frame",
  "Interior condition — upholstery, hard surfaces, electronics, and odors",
  "Mechanical operation — engine, transmission, drivetrain, and fluid condition",
  "Catalytic converter presence and condition",
  "Airbag system status — deployed or professionally replaced airbags noted",
  "All keys, fobs, remotes, spare tire, and original equipment",
  "Title instrument, lien payoff documentation, and VIN match",
];

const docRequirements = [
  "Valid vehicle title or lien payoff letter; all titled owners must be present",
  "Government-issued photo ID for each titled owner",
  "Current vehicle registration",
  "All sets of keys, fobs, and remotes",
  "Proof of current loan payoff amount for financed vehicles",
  "Service records and receipts for recent major repairs (required for credit — see Section 04)",
];

const transactionSteps = [
  { step: "01", title: "Schedule your appointment", body: "Select a convenient time at your nearest location, subject to availability. You will receive a confirmation with everything you need to bring." },
  { step: "02", title: "Vehicle inspection", body: "A representative will conduct a thorough physical inspection of your vehicle. Inspection time varies based on vehicle condition and documentation. All factors from Section 04 are evaluated at this time." },
  { step: "03", title: "Final Offer presentation", body: "Following the inspection, we will present your Final Purchase Offer in writing. This may be higher or lower than your online estimate based on inspection findings. You are under no obligation to accept." },
  { step: "04", title: "Paperwork & title transfer", body: "If you accept the Final Offer, we handle all required documentation including the bill of sale, odometer disclosure statement, and title transfer paperwork. All titled owners must be present with valid ID." },
  { step: "05", title: "Payment", body: "Payment is typically issued the same business day you accept the Final Offer, via check or electronic transfer, subject to successful title verification, clearance of all required documentation, and confirmation of any outstanding lien payoff. We reserve the right to delay payment if title or lien status cannot be immediately verified." },
];

const OfferDisclosure = () => {
  const { config } = useSiteConfig();
  const dealerName = (config.dealership_name || "").trim() || "Our Dealership";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(220 14% 98%)" }}
    >
      <SEO
        title={`How We Calculate Your Offer | ${dealerName}`}
        description={`Full transparency on how ${dealerName} determines your vehicle's cash offer — inspection factors, valuation methodology, and price guarantee details.`}
        path="/disclosure"
      />

      <main className="flex-1 px-5 py-12 lg:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Slim nav row — back + Get my offer, same pattern as
              PrivacyPolicy / TermsOfService. */}
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

          {/* Heading — calm icon tile + H1 + intro. No navy hero,
              no red ribbon, no stats strip. */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55 mb-3">
              {dealerName} &nbsp;·&nbsp; Official Program Disclosure
            </p>
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
              style={{ background: "hsl(220 100% 96%)" }}
            >
              <FileText className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
              How your offer works
            </h1>
            <p className="text-base text-foreground/65 leading-relaxed max-w-xl mx-auto">
              Everything you need to know about how your offer is calculated, what
              conditions apply, and how your offer can increase when your vehicle
              exceeds expectations.
            </p>
          </div>

          {/* Intro card — soft note that frames the rest of the doc.
              Same shell language as the rest of the new system. */}
          <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 mb-7 text-[15px] text-foreground/75 leading-relaxed">
            <p>
              The {dealerName} vehicle purchase and trade-in tool provides customers
              with an <strong className="text-foreground">Estimated Purchase Offer</strong>{" "}
              based on information submitted through our website. This disclosure
              explains how your Offer is calculated, your obligations as a seller,
              our <strong className="text-foreground">Fair Value Credit</strong>{" "}
              policy, the full transaction process, and which vehicles are
              ineligible. Please read this carefully before submitting.
            </p>
          </div>

          {/* Article body — open sections, not an accordion. Same
              card shell as the intro, then sections separated by
              top hairlines so the document reads as one continuous
              piece of legal copy that's actually scannable. */}
          <article className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 text-[15px] text-foreground/75 leading-relaxed">

            {/* ── 01. Vehicles We Cannot Purchase ── */}
            <section id="section-01" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 01</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                Vehicles we cannot purchase
              </h2>
              <p className="mb-4">
                Our program cannot purchase vehicles with any of the following title
                brands or designations — regardless of condition, mileage, or offer
                amount. These restrictions are firm and non-negotiable. Verify your
                vehicle's title status before scheduling an appointment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {ineligibleTitles.map((t) => (
                  <div
                    key={t.label}
                    className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-4"
                  >
                    <p className="text-sm font-semibold text-foreground mb-1">{t.label}</p>
                    <p className="text-[13px] text-foreground/65 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
              <p>
                If an ineligible title brand or designation is discovered at
                inspection that was not disclosed at the time of submission,
                {" "}{dealerName} reserves the right to immediately withdraw the
                Offer at no cost to either party. See Section 02 for your full
                disclosure obligations prior to submission.
              </p>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 02. Offer Validity, Accuracy & Disclosure ── */}
            <section id="section-02" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 02</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                Offer validity, accuracy &amp; your disclosure obligations
              </h2>
              <p className="mb-3">
                Your {dealerName} Offer is a genuine estimated offer generated from
                the vehicle details you provide. It is valid for{" "}
                <strong className="text-foreground">eight (8) calendar days</strong>{" "}
                from the date and time of issuance. This Offer is not a guaranteed
                purchase price and is contingent upon our in-person verification of
                your vehicle's actual condition, mileage, use, and history.
              </p>
              <p className="mb-4">
                If the vehicle's actual condition, equipment, mileage, or history
                differs from the information you provided, {dealerName} reserves the
                right to revise the Offer upward or downward, or to decline to
                purchase the vehicle.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Federal odometer disclosure — your certification
                </p>
                <p className="text-[14px] leading-relaxed">
                  By submitting a vehicle for valuation, you certify that the
                  mileage you have provided is accurate to the best of your
                  knowledge and reflects the vehicle's true and actual odometer
                  reading. Federal law (the Truth in Mileage Act, 49 U.S.C.
                  § 32705) prohibits odometer fraud and requires accurate mileage
                  disclosure in connection with the transfer of a motor vehicle.
                  Intentional misrepresentation of mileage is a federal offense
                  subject to civil and criminal penalties.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Your obligation to disclose — title status &amp; history
                </p>
                <p className="text-[14px] leading-relaxed">
                  You are required to disclose, prior to or at the time of
                  submission, any known title brand, designation, or vehicle history
                  that may affect eligibility, including but not limited to: lemon
                  law buyback status, prior total loss, salvage or rebuilt title,
                  flood or water damage, True Mileage Unknown (TMU) designation, or
                  any other branded title. Applicable state law and federal UDAP
                  regulations require accurate and truthful disclosure. Knowingly
                  withholding or misrepresenting this information may constitute
                  fraud and expose you to civil or criminal liability.
                </p>
              </div>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 03. Our Commitment to Fair Value ── */}
            <section id="section-03" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 03</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                Our commitment to Fair Value
              </h2>

              <div
                className="rounded-2xl border border-primary/15 p-5 mb-5"
                style={{ background: "hsl(220 100% 96%)" }}
              >
                <p className="text-sm font-semibold text-foreground mb-2">
                  We believe you deserve the most your vehicle is worth — and we
                  built our process to prove it.
                </p>
                <p className="text-[14px] text-foreground/75 leading-relaxed">
                  Most programs use condition only as a reason to reduce your offer
                  after you arrive. {dealerName} takes a different approach. When
                  your vehicle arrives in better condition than estimated —
                  particularly tires and brake pads — our inspector measures those
                  components directly and your Final Offer is recalculated to
                  include a <strong className="text-foreground">Fair Value Credit</strong>{" "}
                  for what's actually there.
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-3">
                Tire &amp; brake Fair Value Credit — specific thresholds
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {["Tire condition", "Brake pad life"].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/60 overflow-hidden"
                  >
                    <div className="bg-primary px-4 py-2.5">
                      <span className="text-xs font-semibold text-primary-foreground uppercase tracking-[0.12em]">
                        {label}
                      </span>
                    </div>
                    <div className="p-3 flex flex-col gap-2 bg-white">
                      {[
                        { range: "60% or more remaining", tag: "Full Credit" },
                        { range: "50–59% remaining", tag: "Partial Credit" },
                        { range: "Below 50% remaining", tag: "No Credit" },
                      ].map((row) => (
                        <div
                          key={row.range}
                          className="flex justify-between items-center px-3 py-2 rounded-lg bg-[hsl(220_14%_98%)] border border-border/60"
                        >
                          <span className="text-[13px] font-semibold text-foreground">{row.range}</span>
                          <span className="text-[11px] font-semibold text-foreground/65 bg-white border border-border/60 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                            {row.tag}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mb-4">
                Tread depth is measured with a calibrated gauge. Brake pad life is
                assessed by direct measurement where accessible. Both are documented
                in your inspection record. The Fair Value Credit reflects remaining
                useful life relative to industry-standard replacement thresholds, as
                determined solely by our qualified inspection staff.{" "}
                <strong className="text-foreground">
                  All inspection measurements, condition assessments, and Fair Value
                  Credit determinations are made at the sole and final discretion of
                  the {dealerName} inspector. These determinations are not subject
                  to customer dispute or negotiation as a condition of the
                  transaction.
                </strong>{" "}
                The customer retains the right to decline the Final Offer in its
                entirety.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5">
                <p className="text-[14px] leading-relaxed">
                  <strong className="text-foreground">Our commitment to you:</strong>{" "}
                  It is our goal to ensure that if your vehicle's actual condition
                  at inspection meaningfully exceeds what was reported at the time
                  of online submission, that difference will be reflected in your
                  Final Offer — subject to current market conditions, our inspection
                  findings, and the terms of this disclosure. Every factor we
                  measure is applied transparently and in good faith. You always
                  retain the right to accept or decline the Final Offer.
                </p>
              </div>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 04. How We Determine Value ── */}
            <section id="section-04" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 04</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                How we determine your vehicle's value
              </h2>

              <p className="mb-3">
                {dealerName} determines your vehicle's value exclusively through our{" "}
                <strong className="text-foreground">proprietary valuation methodology</strong>{" "}
                — an independent system developed and maintained by our team. Our
                valuations are not derived from, affiliated with, or endorsed by any
                third-party pricing service including Kelley Blue Book, Edmunds,
                Black Book, NADA Guides, or any other external platform.
              </p>
              <p className="mb-3">
                Our system analyzes thousands of data points from wholesale market
                transactions, regional and national retail sales, current inventory
                demand, internal acquisition data, and continuously evolving market
                conditions — all interpreted through our own proprietary pricing
                intelligence.
              </p>
              <p className="mb-4">
                The factors below are assessed at in-person inspection and may
                result in an upward or downward adjustment to your Final Offer.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Important — pre-factored conditions
                </p>
                <p className="text-[14px] leading-relaxed">
                  Several credit factors below are based on the condition and
                  equipment information you report at the time of online
                  submission. Where that information has already been taken into
                  account in generating your Estimated Offer, those credits will{" "}
                  <strong className="text-foreground">not</strong> be applied again
                  at inspection — they are already reflected in the value you
                  received. Credits are only additive at inspection when a
                  condition meaningfully exceeds what was originally reported. If
                  actual condition is worse than reported, the Final Offer will be
                  adjusted downward accordingly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {factors.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-2xl border border-border/60 bg-white p-4 flex gap-3"
                  >
                    <div
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "hsl(220 14% 96%)" }}
                    >
                      {f.credit ? (
                        <ArrowUp className="w-4 h-4 text-foreground/70" strokeWidth={2} />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-foreground/70" strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug mb-1">
                        {f.title}
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/55">
                          {f.credit ? "Credit" : "Deduct"}
                        </span>
                      </p>
                      <p className="text-[13px] text-foreground/65 leading-relaxed">{f.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[14px]">
                See <strong className="text-foreground">Section 03</strong> for our
                full Fair Value Credit policy and specific tire and brake
                thresholds.
              </p>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 05. In-Person Verification ── */}
            <section id="section-05" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 05</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                In-person verification
              </h2>
              <p className="mb-3">
                Once you accept your {dealerName} Offer, a representative will
                conduct a physical inspection of your vehicle. The following are
                verified at every inspection:
              </p>
              <ul className="list-none space-y-2 mb-4">
                {verificationItems.map((item) => (
                  <li key={item} className="flex gap-3 items-start text-[14px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p>
                Additional condition factors detailed in Section 04 are also
                evaluated. Following the inspection, we will present you with a{" "}
                <strong className="text-foreground">Final Purchase Offer</strong>{" "}
                — which may be higher or lower than the online Offer. You are under
                no obligation to accept it.
              </p>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 06. Eligibility & Documentation ── */}
            <section id="section-06" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 06</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                Eligibility &amp; required documentation
              </h2>
              <p className="mb-3">
                To complete your vehicle sale with {dealerName}, please bring the
                following at the time of your appointment:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {docRequirements.map((d) => (
                  <div
                    key={d}
                    className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-4"
                  >
                    <p className="text-[13px] text-foreground leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5 mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Ineligible vehicles
                </p>
                <p className="text-[14px] leading-relaxed">
                  {dealerName}{" "}
                  <strong className="text-foreground">cannot purchase</strong>{" "}
                  vehicles with salvage, total loss, rebuilt/reconstructed, TMU,
                  lemon law buyback, flood damage, or junk title designations. See
                  Section 01 for the complete list. Do not schedule an appointment
                  without first verifying your title status.
                </p>
              </div>

              <p className="mb-4">
                Customers with outstanding loan or lease balances are responsible
                for any negative equity at closing, payable by cash, cashier's
                check, or certified funds. In certain circumstances, negative
                equity may be applied toward a new vehicle purchase, subject to
                credit approval.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Trade-in tax credit — eligibility notice
                </p>
                <p className="text-[14px] leading-relaxed">
                  If you are applying your vehicle's value as a trade-in toward a
                  qualified new or pre-owned vehicle purchase, a trade-in tax
                  credit may be available under applicable state law.{" "}
                  <strong className="text-foreground">
                    {dealerName} does not determine, grant, or guarantee trade-in
                    tax credit eligibility.
                  </strong>{" "}
                  The availability and amount of any trade-in tax credit is
                  subject to: (1) verification that the customer is completing a
                  qualified vehicle purchase — new or pre-owned — as defined by the
                  state in which the vehicle will be registered; and (2)
                  verification of the applicable tax credit provisions under the
                  registration state's law at the time of the transaction. State
                  laws governing trade-in tax credits vary from state to state and
                  are subject to change. Customers are encouraged to confirm their
                  eligibility with their tax advisor or the relevant state taxing
                  authority prior to completing their transaction.
                </p>
              </div>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 07. What Happens After You Accept ── */}
            <section id="section-07" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 07</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                What happens after you accept
              </h2>
              <div className="flex flex-col gap-3 mb-4">
                {transactionSteps.map((s) => (
                  <div
                    key={s.step}
                    className="flex gap-4 items-start rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-4"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "hsl(220 100% 96%)" }}
                    >
                      <span className="text-xs font-semibold text-primary">{s.step}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                      <p className="text-[14px] text-foreground/65 leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p>
                You are under no obligation to sell your vehicle at any point in
                this process until you have signed the purchase agreement. There is
                no cost, no pressure, and no penalty for declining the Final Offer.
              </p>
            </section>

            <div className="border-t border-border/60 my-10" />

            {/* ── 08. Market Conditions & Limitation of Liability ── */}
            <section id="section-08" className="scroll-mt-24">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">Section 08</p>
              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-4">
                Market conditions, re-appraisals &amp; limitation of liability
              </h2>
              <p className="mb-4">
                The automotive market changes daily. Regional supply and demand,
                seasonal buying patterns, fuel prices, interest rate environments,
                and national inventory levels all influence what any given vehicle
                is worth at any moment. {dealerName}'s proprietary valuation model
                continuously monitors these conditions. If your Offer expires after
                the 8-day validity window or you request a new appraisal, a fresh
                Offer will be generated reflecting current market conditions —
                which may be higher or lower than your original Offer. {dealerName}{" "}
                is not responsible for market fluctuations that occur between the
                date of your Estimated Offer and the date of your inspection
                appointment.
              </p>

              <div className="rounded-2xl border border-border/60 bg-[hsl(220_14%_98%)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/65 mb-2">
                  Limitation of liability &amp; governing law
                </p>
                <p className="text-[14px] leading-relaxed mb-3">
                  <strong className="text-foreground">Limitation of liability:</strong>{" "}
                  To the fullest extent permitted by applicable law, {dealerName}{" "}
                  shall not be liable for any indirect, incidental, consequential,
                  special, or punitive damages arising out of or related to the
                  Estimated Offer, the valuation process, any inspection, or any
                  related transaction — including but not limited to claims that a
                  customer declined or forfeited another offer in reliance on the
                  Estimated Offer. {dealerName}'s maximum liability to any seller
                  shall not exceed the Final Purchase Offer amount stated in the
                  executed purchase agreement, if any.
                </p>
                <p className="text-[14px] leading-relaxed">
                  <strong className="text-foreground">Governing law &amp; venue:</strong>{" "}
                  This disclosure and any dispute, claim, or controversy arising
                  out of or relating to the {dealerName} vehicle valuation program,
                  any Estimated Offer, or any related transaction shall be governed
                  by and construed in accordance with the laws of the State of
                  Connecticut, without regard to its conflict of law provisions.
                  Any legal action or proceeding shall be brought exclusively in
                  the state or federal courts of competent jurisdiction located in
                  the State of Connecticut, and each party irrevocably consents to
                  the personal jurisdiction of such courts.
                </p>
              </div>
            </section>
          </article>

          {/* Acknowledgment — preserves the six numbered consents
              verbatim (legal teeth) but renders them quietly. Sentence
              case, white card, foreground/75 — no all-caps, no
              inverted background. */}
          <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 mt-7">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-3">
              Acknowledgment — please read carefully
            </p>
            <p className="text-[14px] text-foreground/75 leading-relaxed">
              By submitting a vehicle for valuation through this platform, you
              confirm that: (1) you have read and understood this disclosure in its
              entirety; (2) all information you have provided about the vehicle is
              accurate and truthful to the best of your knowledge; (3) you have
              disclosed all known title brands, history designations, and material
              defects prior to submission; (4) you understand your obligations
              under applicable federal and state law regarding odometer disclosure
              and title representation; (5) you understand that this disclosure
              does not constitute a purchase agreement and that no binding
              obligation exists on either party until a written purchase agreement
              is executed and signed by both parties; and (6) you agree that any
              dispute arising from this disclosure or any related transaction
              shall be governed by the laws of the applicable state.
            </p>
          </div>

          {/* Bottom recovery — same calm voice as the rest of the
              new system. */}
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

export default OfferDisclosure;
