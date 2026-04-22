import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, AlertTriangle, ChevronDown } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SiteFooter from "@/components/SiteFooter";
import SEO from "@/components/SEO";

// ─── Factor cards ────────────────────────────────────────────────────────────
const factors = [
  { title: "Tires — OEM/all-season, ≥60% remaining", body: "OEM or name-brand all-season tires in good condition are valued more favorably than off-brand or performance-only tires. Tread depth measured with a calibrated gauge. ≥60% = Full Fair Value Credit. 50–59% = Partial Credit. See Section 03 for full thresholds.", credit: true },
  { title: "Brake pads — ≥60% remaining", body: "Pad life measured directly where accessible. ≥60% = Full Fair Value Credit. 50–59% = Partial Credit. Metal-on-metal contact = significant deduct. See Section 03.", credit: true },
  { title: "Battery — recently replaced or tested good", body: "A recently replaced or passing load-test battery may receive a credit. Weak, failing, or dead battery — including hybrid 12V auxiliary — results in a deduct.", credit: true },
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
  { label: "Lemon Law Buyback", desc: "Vehicles repurchased by a manufacturer or dealer under state or federal lemon law provisions. Customers must affirmatively disclose this status prior to submission — see Section 01." },
  { label: "Flood / Water Damage Title", desc: "Vehicles carrying a flood, water damage, or hurricane brand on the title, regardless of current cosmetic condition or repair." },
  { label: "Junk Title", desc: "Any vehicle designated as junk or non-repairable by a state titling authority." },
  { label: "Gray Market / Non-US Specification", desc: "Vehicles not originally manufactured or federally certified for sale in the United States domestic market." },
  { label: "Affidavit of Heirship / Bonded Title", desc: "Vehicles where clear, standard legal ownership cannot be established through a fully transferable title instrument." },
];

// ─── Section definitions ─────────────────────────────────────────────────────
interface Section {
  id: string;
  title: string;
  danger?: boolean;
  highlight?: boolean;
  render: () => React.ReactNode;
}

const sections: Section[] = [
  {
    id: "01",
    title: "Vehicles We Cannot Purchase",
    danger: true,
    render: () => (
      <>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-destructive mb-1">Our program cannot purchase vehicles with any of the following title brands or designations — regardless of condition, mileage, or offer amount.</p>
          <p className="text-[13px] text-destructive/85 leading-relaxed">These restrictions are firm and non-negotiable. Verify your vehicle's title status before scheduling an appointment. If an ineligible brand is discovered at inspection that was not disclosed at submission, Our program reserves the right to immediately withdraw the Offer.</p>
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {ineligibleTitles.map((t) => (
            <div key={t.label} className="flex gap-3 items-start bg-card border border-destructive/30 border-l-4 border-l-destructive rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-foreground mb-0.5">{t.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-[13px] text-destructive leading-relaxed">
            If an ineligible title brand or designation is discovered at inspection that was not disclosed at the time of submission, Our program reserves the right to immediately withdraw the Offer at no cost to either party. See Section 02 for your full disclosure obligations prior to submission.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "02",
    title: "Offer Validity, Accuracy & Your Disclosure Obligations",
    render: () => (
      <>
        <p>Your Our program Offer is a genuine estimated offer generated from the vehicle details you provide. It is valid for <strong>eight (8) calendar days</strong> from the date and time of issuance. This Offer is not a guaranteed purchase price and is contingent upon our in-person verification of your vehicle's actual condition, mileage, use, and history.</p>
        <p>If the vehicle's actual condition, equipment, mileage, or history differs from the information you provided, Our program and our dealership reserve the right to revise the Offer upward or downward, or to decline to purchase the vehicle.</p>
        <div className="bg-muted border border-border border-l-4 border-l-primary rounded-lg p-4 my-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Federal Odometer Disclosure — Your Certification</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            By submitting a vehicle for valuation, you certify that the mileage you have provided is accurate to the best of your knowledge and reflects the vehicle's true and actual odometer reading. Federal law (the Truth in Mileage Act, 49 U.S.C. § 32705) prohibits odometer fraud and requires accurate mileage disclosure in connection with the transfer of a motor vehicle. Intentional misrepresentation of mileage is a federal offense subject to civil and criminal penalties.
          </p>
        </div>
        <div className="bg-destructive/10 border border-destructive/30 border-l-4 border-l-destructive rounded-lg p-4">
          <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">Your Obligation to Disclose — Title Status & History</p>
          <p className="text-[13px] text-destructive leading-relaxed">
            You are required to disclose, prior to or at the time of submission, any known title brand, designation, or vehicle history that may affect eligibility, including but not limited to: lemon law buyback status, prior total loss, salvage or rebuilt title, flood or water damage, True Mileage Unknown (TMU) designation, or any other branded title. Connecticut law and federal UDAP regulations require accurate and truthful disclosure. Knowingly withholding or misrepresenting this information may constitute fraud and expose you to civil or criminal liability.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "03",
    title: "Our Commitment to Fair Value",
    highlight: true,
    render: () => (
      <>
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-primary mb-2">We believe you deserve the most your vehicle is worth — and we built our process to prove it.</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">Most programs use condition only as a reason to reduce your offer after you arrive. Our program takes a different approach. When your vehicle arrives in better condition than estimated — particularly tires and brake pads — our inspector measures those components directly and your Final Offer is recalculated to include a <strong className="text-foreground">Fair Value Credit</strong> for what's actually there.</p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Tire & Brake Fair Value Credit — Specific Thresholds</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {["Tire Condition", "Brake Pad Life"].map((label) => (
            <div key={label} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="bg-primary p-3 flex items-center gap-2">
                <span className="text-[11px] font-bold text-primary-foreground uppercase tracking-wider">{label}</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {[
                  { range: "60% or more remaining", tag: "Full Credit", cls: "bg-success/10 border-success/30 text-success" },
                  { range: "50–59% remaining", tag: "Partial Credit", cls: "bg-yellow-50 border-yellow-300 text-yellow-700" },
                  { range: "Below 50% remaining", tag: "No Credit", cls: "bg-muted border-border text-muted-foreground" },
                ].map((row) => (
                  <div key={row.range} className={`flex justify-between items-center p-2 rounded-md border ${row.cls}`}>
                    <span className="text-xs font-semibold">{row.range}</span>
                    <span className={`text-[10px] font-bold bg-card border rounded-full px-2 py-0.5 whitespace-nowrap ${row.cls}`}>{row.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p>Tread depth is measured with a calibrated gauge. Brake pad life is assessed by direct measurement where accessible. Both are documented in your inspection record. The Fair Value Credit reflects remaining useful life relative to industry-standard replacement thresholds, as determined solely by our dealership's qualified inspection staff. <strong>All inspection measurements, condition assessments, and Fair Value Credit determinations are made at the sole and final discretion of the our dealership inspector. These determinations are not subject to customer dispute or negotiation as a condition of the transaction.</strong> The customer retains the right to decline the Final Offer in its entirety.</p>
        <div className="bg-muted border border-border border-l-4 border-l-success rounded-lg p-4 mt-4">
          <p className="text-[13px] text-foreground leading-relaxed">
            <strong>Our commitment to you:</strong> It is our goal to ensure that if your vehicle's actual condition at inspection meaningfully exceeds what was reported at the time of online submission, that difference will be reflected in your Final Offer — subject to current market conditions, our inspection findings, and the terms of this disclosure. Every factor we measure is applied transparently and in good faith. You always retain the right to accept or decline the Final Offer.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "04",
    title: "How We Determine Your Vehicle's Value",
    render: () => (
      <>
        <p>Our program determines your vehicle's value exclusively through our <strong>proprietary valuation methodology</strong> — an independent system developed and maintained by our dealership. Our valuations are not derived from, affiliated with, or endorsed by any third-party pricing service including Kelley Blue Book, Edmunds, Black Book, NADA Guides, or any other external platform.</p>
        <p>Our system analyzes thousands of data points from wholesale market transactions, regional and national retail sales, current inventory demand, internal acquisition data, and continuously evolving market conditions — all interpreted through our own proprietary pricing intelligence.</p>
        <p className="mb-4">
          The factors below are assessed at in-person inspection and may result in an upward or downward adjustment to your Final Offer.{" "}
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 border border-success/30 rounded-full px-2 py-px align-middle">↑ Credit</span>
          {" "}factors can increase your offer when conditions exceed baseline expectations.
        </p>
        <div className="bg-muted border border-border border-l-4 border-l-primary rounded-lg p-4 mb-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Important — Pre-Factored Conditions</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Several credit factors below are based on the condition and equipment information you report at the time of online submission. Where that information has already been taken into account in generating your Estimated Offer, those credits will <strong className="text-foreground">not</strong> be applied again at inspection — they are already reflected in the value you received. Credits are only additive at inspection when a condition meaningfully exceeds what was originally reported. If actual condition is worse than reported, the Final Offer will be adjusted downward accordingly.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {factors.map((f) => (
            <div key={f.title} className={`rounded-lg p-3 border ${f.credit ? "bg-success/10 border-success/30" : "bg-muted border-border"}`}>
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className={`text-xs font-bold leading-snug ${f.credit ? "text-success" : "text-foreground"}`}>{f.title}</p>
                {f.credit
                  ? <span className="text-[10px] font-bold text-success bg-card border border-success/30 rounded-full px-2 py-px whitespace-nowrap flex-shrink-0">↑ Credit</span>
                  : <span className="text-[10px] font-bold text-destructive bg-card border border-destructive/30 rounded-full px-2 py-px whitespace-nowrap flex-shrink-0">↓ Deduct</span>
                }
              </div>
              <p className={`text-[11.5px] leading-relaxed ${f.credit ? "text-success/80" : "text-muted-foreground"}`}>{f.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">See <strong className="text-foreground">Section 03</strong> for our full Fair Value Credit policy and specific tire and brake thresholds.</p>
      </>
    ),
  },
  {
    id: "05",
    title: "In-Person Verification",
    render: () => (
      <>
        <p>Once you accept your Our program Offer, a our dealership representative will conduct a physical inspection of your vehicle. The following are verified at every inspection:</p>
        <ul className="list-none space-y-2 mb-4">
          {[
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
          ].map((item) => (
            <li key={item} className="flex gap-3 items-start text-[13.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />
              {item}
            </li>
          ))}
        </ul>
        <p>Additional condition factors detailed in Section 04 are also evaluated. Following the inspection, we will present you with a <strong>Final Purchase Offer</strong> — which may be higher or lower than the online Offer. You are under no obligation to accept it.</p>
      </>
    ),
  },
  {
    id: "06",
    title: "Eligibility & Required Documentation",
    render: () => (
      <>
        <p>To complete your vehicle sale with Our program, please bring the following at the time of your appointment:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {[
            "Valid vehicle title or lien payoff letter; all titled owners must be present",
            "Government-issued photo ID for each titled owner",
            "Current vehicle registration",
            "All sets of keys, fobs, and remotes",
            "Proof of current loan payoff amount for financed vehicles",
            "Service records and receipts for recent major repairs (required for credit — see Section 04)",
          ].map((d) => (
            <div key={d} className="flex gap-2 items-start bg-muted border border-border rounded-lg p-3">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 mt-2" />
              <p className="text-xs text-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[11px] font-bold text-destructive uppercase tracking-wider">Ineligible Vehicles</span>
          </div>
          <p className="text-[13px] text-destructive leading-relaxed">Our program <strong>cannot purchase</strong> vehicles with salvage, total loss, rebuilt/reconstructed, TMU, lemon law buyback, flood damage, or junk title designations. See Section 01 for the complete list. Do not schedule an appointment without first verifying your title status.</p>
        </div>
        <p>Customers with outstanding loan or lease balances are responsible for any negative equity at closing, payable by cash, cashier's check, or certified funds. In certain circumstances, negative equity may be applied toward a new vehicle purchase, subject to credit approval.</p>
        <div className="bg-muted border border-border border-l-4 border-l-primary rounded-lg p-4 mt-1">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Trade-In Tax Credit — Eligibility Notice</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            If you are applying your vehicle's value as a trade-in toward a qualified new or pre-owned vehicle purchase, a trade-in tax credit may be available under applicable state law. <strong className="text-foreground">Our program and our dealership do not determine, grant, or guarantee trade-in tax credit eligibility.</strong> The availability and amount of any trade-in tax credit is subject to: (1) verification that the customer is completing a qualified vehicle purchase — new or pre-owned — as defined by the state in which the vehicle will be registered; and (2) verification of the applicable tax credit provisions under the registration state's law at the time of the transaction. State laws governing trade-in tax credits vary from state to state and are subject to change. Customers are encouraged to confirm their eligibility with their tax advisor or the relevant state taxing authority prior to completing their transaction.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "07",
    title: "What Happens After You Accept — The Transaction Process",
    render: () => (
      <>
        <div className="flex flex-col gap-3 mb-4">
          {[
            { step: "01", title: "Schedule Your Appointment", body: "Select a convenient time at your nearest our dealership location, subject to availability. You will receive a confirmation with everything you need to bring." },
            { step: "02", title: "Vehicle Inspection", body: "A our dealership representative will conduct a thorough physical inspection of your vehicle. Inspection time varies based on vehicle condition and documentation. All factors from Section 04 are evaluated at this time." },
            { step: "03", title: "Final Offer Presentation", body: "Following the inspection, we will present your Final Purchase Offer in writing. This may be higher or lower than your online estimate based on inspection findings. You are under no obligation to accept." },
            { step: "04", title: "Paperwork & Title Transfer", body: "If you accept the Final Offer, we handle all required documentation including the bill of sale, odometer disclosure statement, and title transfer paperwork. All titled owners must be present with valid ID." },
            { step: "05", title: "Payment", body: "Payment is typically issued the same business day you accept the Final Offer, via check or electronic transfer, subject to successful title verification, clearance of all required documentation, and confirmation of any outstanding lien payoff. Our program reserves the right to delay payment if title or lien status cannot be immediately verified." },
          ].map((s) => (
            <div key={s.step} className="flex gap-4 items-start bg-muted border border-border rounded-lg p-4">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-primary-foreground">{s.step}</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground mb-1">{s.title}</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p>You are under no obligation to sell your vehicle at any point in this process until you have signed the purchase agreement. There is no cost, no pressure, and no penalty for declining the Final Offer.</p>
      </>
    ),
  },
  {
    id: "08",
    title: "Market Conditions, Re-Appraisals & Limitation of Liability",
    render: () => (
      <>
        <p>The automotive market changes daily. Regional supply and demand, seasonal buying patterns, fuel prices, interest rate environments, and national inventory levels all influence what any given vehicle is worth at any moment. Our program's proprietary valuation model continuously monitors these conditions. If your Offer expires after the 8-day validity window or you request a new appraisal, a fresh Offer will be generated reflecting current market conditions — which may be higher or lower than your original Offer. Our program and our dealership are not responsible for market fluctuations that occur between the date of your Estimated Offer and the date of your inspection appointment.</p>
        <div className="bg-muted border border-border border-l-4 border-l-foreground rounded-lg p-4 mt-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">Limitation of Liability & Governing Law</p>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-2.5">
            <strong className="text-foreground">Limitation of liability:</strong> To the fullest extent permitted by applicable law, Our program and our dealership shall not be liable for any indirect, incidental, consequential, special, or punitive damages arising out of or related to the Estimated Offer, the valuation process, any inspection, or any related transaction — including but not limited to claims that a customer declined or forfeited another offer in reliance on the Our program Estimated Offer. Our program's maximum liability to any seller shall not exceed the Final Purchase Offer amount stated in the executed purchase agreement, if any.
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Governing law & venue:</strong> This disclosure and any dispute, claim, or controversy arising out of or relating to the Our program vehicle valuation program, any Estimated Offer, or any related transaction shall be governed by and construed in accordance with the laws of the State of Connecticut, without regard to its conflict of law provisions. Any legal action or proceeding shall be brought exclusively in the state or federal courts of competent jurisdiction located in the State of Connecticut, and each party irrevocably consents to the personal jurisdiction of such courts.
          </p>
        </div>
      </>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────
const OfferDisclosure = () => {
  const { config } = useSiteConfig();
  const [open, setOpen] = useState<number | null>(null);
  const toggle = (i: number) => setOpen(open === i ? null : i);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`How We Calculate Your Offer | ${config.dealership_name}`}
        description={`Full transparency on how ${config.dealership_name} determines your vehicle's cash offer — inspection factors, valuation methodology, and price guarantee details.`}
        path="/disclosure"
      />
      {/* Hero */}
      <div className="bg-gradient-to-br from-[hsl(210,100%,15%)] via-primary to-[hsl(220,80%,18%)] text-primary-foreground px-6 py-16 md:py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(220,40,40,0.18)_0%,transparent_65%)] pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-primary-foreground/45 mb-3">{config.dealership_name} &nbsp;·&nbsp; Official Program Disclosure</p>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight tracking-tight">Vehicle Purchase &amp;<br />Trade-In Offer Disclosure</h1>
          <p className="text-[15px] text-primary-foreground/60 max-w-lg mx-auto mb-8 leading-relaxed">Everything you need to know about how your offer is calculated, what conditions apply, and how your offer can increase when your vehicle exceeds expectations.</p>
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-success/15 border border-success/40 rounded-full px-5 py-2.5 text-[13px] font-medium text-success">
              <span className="w-2 h-2 rounded-full bg-success inline-block shadow-[0_0_0_3px_rgba(16,183,127,0.28)]" />
              All offers valid for 8 calendar days
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2.5 text-[13px] font-medium text-primary-foreground/90">
              <ShieldCheck className="w-3.5 h-3.5" />
              Fair Value Credit — tires &amp; brakes ≥50% get credited
            </div>
          </div>
        </div>
      </div>

      {/* Ineligible banner */}
      <div className="bg-[hsl(0,70%,20%)] border-b border-[hsl(0,55%,16%)] px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-200/90 flex-shrink-0" />
          <p className="text-xs text-red-200/90 leading-relaxed">
            <strong className="text-white">We do not purchase vehicles with salvage, total loss, rebuilt/reconstructed, TMU, lemon law buyback, flood damage, or junk title designations.</strong>
            <span className="opacity-75">&nbsp; See Section 01 for the complete list before submitting.</span>
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-card border-b border-border">
        {[["8 Days", "Offer validity"], ["100%", "Proprietary — no third-party pricing"], ["No Fee", "No obligation to sell"]].map(([v, l], i) => (
          <div key={i} className={`p-5 text-center ${i < 2 ? "sm:border-r border-b sm:border-b-0 border-border" : ""}`}>
            <div className="text-xl font-extrabold text-primary tracking-tight mb-1">{v}</div>
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{l}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <main className="flex-1 max-w-3xl mx-auto px-5 py-10 md:py-14 w-full">
        {/* Intro callout */}
        <div className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-5 mb-7 text-sm leading-relaxed text-muted-foreground">
          The Our program vehicle purchase and trade-in tool provides customers with an <strong className="text-foreground font-semibold">Estimated Purchase Offer</strong> based on information submitted through Our program.com. This disclosure explains how your Offer is calculated, your obligations as a seller, our <strong className="text-foreground font-semibold">Fair Value Credit</strong> policy, the full transaction process, and which vehicles are ineligible. Please read this carefully before submitting.
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {sections.map((sec, i) => {
            const isOpen = open === i;
            const isHighlight = !!sec.highlight;
            const isDanger = !!sec.danger;

            let borderCls = "border-border";
            if (isOpen && isHighlight) borderCls = "border-success/50";
            else if (isOpen && isDanger) borderCls = "border-destructive/40";
            else if (isOpen) borderCls = "border-primary/25";
            else if (isHighlight) borderCls = "border-success/30";
            else if (isDanger) borderCls = "border-destructive/30";

            let shadowCls = "";
            if (isOpen && isHighlight) shadowCls = "shadow-[0_4px_22px_rgba(16,183,127,0.11)]";
            else if (isOpen && isDanger) shadowCls = "shadow-[0_4px_22px_rgba(200,40,40,0.1)]";
            else if (isOpen) shadowCls = "shadow-[0_4px_20px_rgba(0,64,128,0.07)]";

            const bgClosed = !isOpen && isHighlight ? "bg-success/5" : !isOpen && isDanger ? "bg-destructive/5" : "";

            return (
              <div key={i} className={`bg-card border ${borderCls} rounded-xl overflow-hidden transition-all duration-200 ${shadowCls}`}>
                <button
                  onClick={() => toggle(i)}
                  className={`flex items-center gap-4 w-full text-left px-5 py-4 cursor-pointer select-none ${bgClosed}`}
                >
                  <span className={`text-[11px] font-bold tracking-wider min-w-[22px] transition-colors ${
                    isOpen ? (isHighlight ? "text-success" : isDanger ? "text-destructive" : "text-primary") :
                    (isHighlight ? "text-success/60" : isDanger ? "text-destructive" : "text-muted-foreground")
                  }`}>{sec.id}</span>
                  <span className={`flex-1 text-[15px] font-semibold ${
                    isHighlight ? (isOpen ? "text-success" : "text-success/80") :
                    isDanger ? "text-destructive" : "text-foreground"
                  }`}>
                    {sec.title}
                    {isHighlight && <span className="ml-2.5 text-[10px] font-bold bg-success text-white rounded-full px-2 py-0.5 uppercase align-middle">Our Promise</span>}
                    {isDanger && <span className="ml-2.5 text-[10px] font-bold bg-destructive text-white rounded-full px-2 py-0.5 uppercase align-middle">Important</span>}
                  </span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                    isOpen ? "rotate-180" : ""
                  } ${
                    isOpen ? (isHighlight ? "bg-success" : isDanger ? "bg-destructive" : "bg-primary") :
                    (isHighlight ? "bg-success/20" : isDanger ? "bg-destructive/20" : "bg-muted")
                  }`}>
                    <ChevronDown className={`w-3 h-3 ${isOpen ? "text-white" : (isHighlight ? "text-success" : isDanger ? "text-destructive" : "text-muted-foreground")}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-6 pl-14 animate-accordion-down prose-disclosure">
                    {sec.render()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Acknowledgment */}
        <div className="bg-foreground rounded-xl p-6 mt-6">
          <p className="text-[13px] font-bold text-background uppercase tracking-widest mb-3 border-b border-background/20 pb-2.5">ACKNOWLEDGMENT — PLEASE READ CAREFULLY</p>
          <p className="text-sm text-background/90 leading-relaxed">
            BY SUBMITTING A VEHICLE FOR VALUATION THROUGH THIS PLATFORM, YOU CONFIRM THAT: (1) you have read and understood this disclosure in its entirety; (2) all information you have provided about the vehicle is accurate and truthful to the best of your knowledge; (3) you have disclosed all known title brands, history designations, and material defects prior to submission; (4) you understand your obligations under applicable federal and state law regarding odometer disclosure and title representation; (5) you understand that this disclosure does not constitute a purchase agreement and that no binding obligation exists on either party until a written purchase agreement is executed and signed by both parties; and (6) you agree that any dispute arising from this disclosure or any related transaction shall be governed by the laws of the applicable state.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default OfferDisclosure;
