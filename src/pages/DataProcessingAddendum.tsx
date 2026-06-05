// /dpa — public, dealer-facing Data Processing Agreement. Voice = AutoCurb
// ("we"/"Processor"); the Dealer is the owner/Controller. This is the
// document that operationalizes "you own your data; AutoCurb only
// processes it." Aligned to the published SLA's numbers (7-day export,
// 30-day deletion, logged super-admin access, RLS isolation).
//
// NOTE: have qualified counsel ratify the bracketed terms + the MSA
// liability carve-out before relying on this commercially.

import { Link } from "react-router-dom";
import { ArrowLeft, FileLock2 } from "lucide-react";
import SEO from "@/components/SEO";

const Clause = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-base font-bold text-foreground mb-2">{n}. {title}</h2>
    <div className="space-y-2 text-[14px] text-foreground/75 leading-relaxed">{children}</div>
  </section>
);

const DataProcessingAddendum = () => (
  <div className="min-h-screen flex flex-col" style={{ background: "hsl(220 14% 98%)" }}>
    <SEO title="Data Processing Agreement | AutoCurb" description="AutoCurb's Data Processing Agreement: the dealer owns and controls customer data; AutoCurb processes it only on the dealer's instructions and never sells it." path="/dpa" />
    <main className="flex-1 px-5 py-12 lg:py-16">
      <div className="max-w-3xl mx-auto">
        <Link to="/" onClick={() => window.scrollTo(0, 0)} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
          <FileLock2 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-tight tracking-tight mb-3">Data Processing Agreement</h1>
        <p className="text-[15px] text-foreground/70 leading-relaxed mb-8">
          This DPA is incorporated into the Master Service Agreement ("MSA") between AutoCurb, Inc.
          ("AutoCurb," "Processor," "Service Provider") and the dealership customer ("Dealer," "Controller").
          If the MSA and this DPA conflict on the processing of personal data, this DPA controls.
        </p>

        <article className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-6">
          <Clause n="1" title="Definitions">
            <p>"Dealer Personal Data" means personal information relating to the Dealer's customers, prospects, or leads that AutoCurb processes on the Dealer's behalf. "Applicable Privacy Law" includes the CCPA/CPRA, the Connecticut Data Privacy Act (CTDPA), and other U.S. state privacy laws. "Controller," "Processor," "Service Provider," "Sub‑processor," "Sale," "Share," and "Business Purpose" have the meanings given under Applicable Privacy Law.</p>
          </Clause>
          <Clause n="2" title="Roles of the parties">
            <p>As between the parties, the <strong className="text-foreground">Dealer is the Controller/Business</strong> and <strong className="text-foreground">AutoCurb is the Processor/Service Provider</strong>. The Dealer determines the purposes and means of processing; AutoCurb processes only as set out in this DPA and the MSA.</p>
          </Clause>
          <Clause n="3" title="Ownership of Dealer Personal Data">
            <p>As between the parties, the <strong className="text-foreground">Dealer exclusively owns and retains all right, title, and interest</strong> in and to Dealer Personal Data. AutoCurb acquires no ownership interest and obtains only a limited, revocable right to process it to deliver the service. Nothing transfers ownership of Dealer Personal Data to AutoCurb.</p>
          </Clause>
          <Clause n="4" title="Documented instructions">
            <p>AutoCurb processes Dealer Personal Data <strong className="text-foreground">only on the Dealer's documented instructions</strong> — the MSA, this DPA, the Dealer's configuration, and the Dealer's use of the platform — and as required to provide the service. AutoCurb will notify the Dealer if, in its opinion, an instruction infringes Applicable Privacy Law.</p>
          </Clause>
          <Clause n="5" title="Permitted purpose & prohibited uses">
            <p>AutoCurb processes Dealer Personal Data <strong className="text-foreground">only for the limited Business Purpose</strong> of providing, securing, supporting, and maintaining the service for the Dealer. AutoCurb is <strong className="text-foreground">expressly prohibited</strong> from:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Selling or sharing</strong> Dealer Personal Data (as defined under the CCPA/CPRA), including for cross‑context behavioral advertising;</li>
              <li><strong className="text-foreground">Retaining, using, or disclosing</strong> it for any purpose other than the Business Purpose, or for AutoCurb's own commercial purposes;</li>
              <li><strong className="text-foreground">Using it to train, fine‑tune, or improve any AI/ML model</strong> for AutoCurb's or any other customer's benefit. AI features run only on the Dealer's own data to serve the Dealer; AI sub‑processors are bound by no‑training / limited‑retention terms;</li>
              <li><strong className="text-foreground">Combining</strong> it with personal information from other sources except as permitted to perform a Business Purpose;</li>
              <li><strong className="text-foreground">Using it to compete with the Dealer</strong>, to solicit the Dealer's customers, to build benchmark/aggregate products from identifiable data, or to serve another dealership using the Dealer's data.</li>
            </ul>
            <p>AutoCurb <strong className="text-foreground">certifies</strong> that it understands and will comply with these restrictions.</p>
          </Clause>
          <Clause n="6" title="Confidentiality & security">
            <p>AutoCurb treats Dealer Personal Data as confidential and limits access to authorized personnel under confidentiality obligations on a least‑privilege basis. AutoCurb maintains technical and organizational measures no less protective than the FTC Safeguards Rule, including encryption in transit (TLS 1.2+) and at rest (AES‑256), per‑Dealer Row‑Level‑Security isolation, role‑based access, MFA for administrative access, and access logging. See the <Link to="/security" className="text-primary underline-offset-4 hover:underline">Security page</Link>.</p>
          </Clause>
          <Clause n="7" title="Sub‑processors">
            <p>The Dealer authorizes the sub‑processors listed at <Link to="/sub-processors" className="text-primary underline-offset-4 hover:underline">/sub-processors</Link>. AutoCurb imposes on each, by written contract, obligations <strong className="text-foreground">no less protective</strong> than this DPA (including the prohibitions in §5), remains fully liable for their performance, and gives the Dealer at least <strong className="text-foreground">30 days' notice</strong> of any new sub‑processor (with a right to object on reasonable data‑protection grounds).</p>
          </Clause>
          <Clause n="8" title="Assistance with consumer requests">
            <p>Taking into account the nature of processing, AutoCurb reasonably assists the Dealer in responding to verified consumer requests (access, correction, deletion, opt‑out of sale/sharing, and honoring Global Privacy Control signals) — the platform's <Link to="/my-data-rights" className="text-primary underline-offset-4 hover:underline">privacy‑rights tools</Link> are provided for this purpose — and routes any consumer request it receives directly to the relevant Dealer.</p>
          </Clause>
          <Clause n="9" title="Security‑incident notification">
            <p>AutoCurb notifies the Dealer of a confirmed security incident affecting Dealer Personal Data <strong className="text-foreground">without undue delay and within seventy‑two (72) hours</strong> of confirming it, describing the nature, categories and approximate number of records affected, likely consequences, and measures taken, with updates as available. AutoCurb does not notify affected consumers or regulators on the Dealer's behalf unless the Dealer instructs it in writing, so the Dealer retains control of consumer/AG notification. Notification is not an acknowledgment of fault.</p>
          </Clause>
          <Clause n="10" title="Audit & assurance">
            <p>AutoCurb makes available information reasonably necessary to demonstrate compliance, including third‑party audit reports (e.g., SOC 2 Type II once available) and penetration‑test summaries under NDA. No more than once per twelve months, on 30 days' notice, and subject to confidentiality, the Dealer (or a non‑competitor auditor) may audit AutoCurb's compliance in a manner that does not compromise other customers' data.</p>
          </Clause>
          <Clause n="11" title="Return & deletion on termination">
            <p>On termination, at the Dealer's option, AutoCurb provides a <strong className="text-foreground">complete final export within 7 days at no charge and with no egress fee</strong>, and <strong className="text-foreground">deletes or anonymizes all Dealer Personal Data within 30 days</strong> (backups on their normal rotation), except where retention is required by law. AutoCurb certifies deletion in writing on request, and instructs sub‑processors to do the same.</p>
          </Clause>
          <Clause n="12" title="Data location & liability">
            <p>Dealer Personal Data is hosted in the United States. Liability is governed by the MSA, except that the MSA's general liability cap does <strong className="text-foreground">not</strong> apply to AutoCurb's breach of the prohibited‑use restrictions (§5), its confidentiality/security obligations, or a security incident caused by AutoCurb — see the MSA limitation‑of‑liability carve‑out and indemnity.</p>
          </Clause>
        </article>

        <p className="mt-6 text-xs text-foreground/45">
          Schedule 1 (Sub‑processors) is published at <Link to="/sub-processors" className="text-primary underline-offset-4 hover:underline">/sub-processors</Link>; Schedule 2 (Security Measures) is described on the <Link to="/security" className="text-primary underline-offset-4 hover:underline">Security page</Link>. For the binding terms, see your Master Services Agreement.
        </p>
      </div>
    </main>
  </div>
);

export default DataProcessingAddendum;
