// /security — public Security & Trust page (dealer- and compliance-
// facing). Describes the controls that are actually in place; anything
// aspirational is marked as a commitment/roadmap so the page is truthful.
// Voice = AutoCurb ("we"), matching SlaPage/StatusPage.

import { Link } from "react-router-dom";
import { ArrowLeft, Lock, Shield, KeyRound, Eye, Database, History, Bell, Server } from "lucide-react";
import SEO from "@/components/SEO";

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <section className="border-t border-border/60 pt-6">
    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-3">
      <Icon className="w-5 h-5 text-primary" /> {title}
    </h2>
    <div className="space-y-2 text-[15px] text-foreground/75 leading-relaxed">{children}</div>
  </section>
);

const SecurityTrust = () => (
  <div className="min-h-screen flex flex-col" style={{ background: "hsl(220 14% 98%)" }}>
    <SEO title="Security & Trust | AutoCurb" description="How AutoCurb protects dealership and customer data — encryption, per-dealership isolation, access controls, monitoring, backups, and breach response." path="/security" />
    <main className="flex-1 px-5 py-12 lg:py-16">
      <div className="max-w-3xl mx-auto">
        <Link to="/" onClick={() => window.scrollTo(0, 0)} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-tight tracking-tight mb-3">Security &amp; Trust</h1>
        <p className="text-[15px] text-foreground/70 leading-relaxed mb-8">
          AutoCurb stores dealership and customer data for automotive retailers. Protecting that data —
          from loss and from unauthorized access — is foundational to our product. This page describes the
          controls that are actually in place. The dealership owns its customer data; AutoCurb is only its
          service provider and never sells it.
        </p>

        <article className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-10 space-y-7">
          <Section icon={Lock} title="Encryption">
            <p><strong className="text-foreground">In transit:</strong> all traffic is encrypted with TLS 1.2+. The app, customer portals, and APIs are HTTPS‑only.</p>
            <p><strong className="text-foreground">At rest:</strong> all databases and file storage are encrypted with AES‑256, managed by our infrastructure provider (Supabase / AWS).</p>
          </Section>

          <Section icon={Database} title="Per‑dealership isolation">
            <p>
              Every dealership ("rooftop") is logically isolated. Access is enforced in the database itself
              via PostgreSQL Row‑Level Security: each query is automatically constrained to the caller's own
              dealership. Staff at one dealership <strong className="text-foreground">cannot read or modify</strong> another
              dealership's customers, leads, appointments, conversations, call recordings, or audit logs.
              The only role that can cross dealership boundaries is a small number of AutoCurb platform
              super‑administrators, governed by an explicit, individually‑granted flag — no role inherits
              cross‑tenant access by default.
            </p>
          </Section>

          <Section icon={KeyRound} title="Access controls">
            <p><strong className="text-foreground">Multi‑factor authentication (MFA)</strong> is available and enforceable for staff accounts.</p>
            <p><strong className="text-foreground">Least privilege:</strong> role‑based access with per‑state F&amp;I licensing checks on write operations. Customer apps use a restricted, publishable key only — no privileged credential is ever delivered to a browser or mobile client. Service credentials capable of bypassing isolation exist only in server‑side functions.</p>
          </Section>

          <Section icon={Eye} title="Monitoring & audit logs">
            <p><strong className="text-foreground">Staff‑action log:</strong> high‑risk actions (role changes, rooftop merges, data overrides) are recorded in a tenant‑scoped, append‑only audit trail.</p>
            <p><strong className="text-foreground">Customer‑data access log:</strong> when a staff member opens a customer's file, reads a call transcript, or plays a recording, we record who, what, when, and from where in a tenant‑scoped log — a precise "who saw what" answer for any privacy request or investigation.</p>
            <p><strong className="text-foreground">Anomaly detection:</strong> from that log, bulk‑access patterns (for example one account viewing an unusually large number of distinct customer records in a short window) surface in a compliance dashboard for review — the detective control for a stolen credential or a rogue employee. <span className="text-foreground/55">(Coverage spans the primary sensitive‑record views today and continues to expand to additional surfaces.)</span></p>
          </Section>

          <Section icon={History} title="Data retention & secure deletion">
            <p>Voice‑call transcripts, per‑turn text, and grading rationale are automatically redacted after a configurable window (default 90 days); recording links are purged on the same schedule. Customer "memory" notes are pruned after a configurable window (default 180 days). Customer access links expire automatically (default 90 days).</p>
            <p>Consumers may submit access, correction, deletion, and opt‑out requests through our privacy‑rights intake; requests route only to the owning dealership's staff.</p>
          </Section>

          <Section icon={Server} title="Backups & disaster recovery (service commitments)">
            <p>Continuous backups with point‑in‑time recovery. Target Recovery Time Objective: 1 hour; target Recovery Point Objective: 5 minutes for customer and lead data. <span className="text-foreground/55">(These are our service‑level commitments — see the <Link to="/sla" className="text-primary underline-offset-4 hover:underline">SLA</Link>. Published restore‑drill cadence and third‑party penetration‑test summaries are on our roadmap.)</span></p>
          </Section>

          <Section icon={Bell} title="Breach response & notification">
            <p>We maintain a written incident‑response runbook covering detection, forensics‑first containment, severity triage by PII category, and notification timelines aligned to the strictest applicable state law (and GLBA where dealer‑originated financing is involved). Affected customers receive plain‑language notice of what happened, what data was involved, and recommended protective steps.</p>
          </Section>

          <Section icon={Shield} title="GLBA Safeguards Rule">
            <p>Auto dealers are "financial institutions" under the GLBA when they arrange or refer financing. AutoCurb maintains an information‑security program designed to meet the FTC Safeguards Rule (16 CFR Part 314): a designated qualified individual, access controls and tenant isolation, encryption, MFA, secure disposal, change management, monitoring and logging, service‑provider oversight, and a written incident‑response plan. Supporting documentation is available to customers under NDA.</p>
          </Section>

          <Section icon={Server} title="Sub‑processors">
            <p>We rely on a limited set of vetted sub‑processors, each bound to no‑sale / no‑secondary‑use terms: Supabase / AWS (hosting, database, storage, US), Twilio (SMS/voice), Bland AI (AI voice), Anthropic and OpenAI (AI language models — no training on your data), Resend / SendGrid (email), and Stripe (dealer billing only — no consumer data). The current list is published at <Link to="/sub-processors" className="text-primary underline-offset-4 hover:underline">/sub-processors</Link>.</p>
          </Section>
        </article>

        <p className="mt-6 text-xs text-foreground/45">
          This page describes controls as implemented; items noted as commitments or roadmap are planned and
          not yet independently verified. For the binding terms, see your Master Services Agreement, the{" "}
          <Link to="/dpa" className="text-primary underline-offset-4 hover:underline">Data Processing Agreement</Link>, and the{" "}
          <Link to="/sla" className="text-primary underline-offset-4 hover:underline">SLA</Link>.
        </p>
      </div>
    </main>
  </div>
);

export default SecurityTrust;
