import SEO from "@/components/SEO";
import { ShieldCheck, Activity, Clock, FileSearch, Lock, ServerCrash } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Public Service Level Agreement page at /sla.
 *
 * The May-2026 industry research called out a published SLA + status
 * page as a cheap competitive wedge against the post-CDK-ransomware
 * trust deficit. The status page (/status) shows live health; this
 * page documents the contractual commitments behind it.
 *
 * Linked from StatusPage's footer. Not behind any auth — prospects,
 * customers, and OEM compliance officers can all read it.
 */
const SlaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Service Level Agreement — Autocurb"
        description="Autocurb's published uptime, support response, data portability, and recovery commitments to dealer customers."
        path="/sla"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            Service Level Agreement
          </div>
          <h1 className="text-3xl font-bold text-card-foreground tracking-tight">
            What we commit to.
          </h1>
          <p className="text-base text-muted-foreground">
            Plain-English commitments to every dealer running on Autocurb. Last
            updated May 2026.
          </p>
        </header>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Uptime: 99.9% monthly
            </h2>
          </div>
          <p className="text-sm text-card-foreground">
            We commit to <strong>99.9% monthly uptime</strong> on the
            customer-facing sell flow, the dealer admin, and the Stripe
            billing pipeline. Live system health is published at{" "}
            <Link to="/status" className="text-primary hover:underline">
              /status
            </Link>{" "}
            and refreshes every 60 seconds.
          </p>
          <p className="text-sm text-muted-foreground">
            Excluded: scheduled maintenance windows announced ≥48 hours in
            advance, force-majeure events affecting upstream cloud providers,
            and customer-side network or DNS failures.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-700" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Recovery: RTO 1 hour, RPO 5 minutes
            </h2>
          </div>
          <p className="text-sm text-card-foreground">
            Recovery Time Objective: <strong>1 hour</strong> for customer-
            facing surfaces in the worst-case full-region failure. Recovery
            Point Objective: <strong>5 minutes</strong> — we do not lose more
            than 5 minutes of customer or lead data under any single failure.
          </p>
          <p className="text-sm text-muted-foreground">
            Backups run continuously to a separate region. Restore drills
            execute quarterly and the report is available to enterprise
            customers on request.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-700" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Support response
            </h2>
          </div>
          <ul className="text-sm text-card-foreground space-y-2 list-disc list-inside">
            <li>
              <strong>Severity 1</strong> (production down for the entire
              dealership) — first response within <strong>30 minutes</strong>,
              24×7.
            </li>
            <li>
              <strong>Severity 2</strong> (single-feature outage) — first
              response within <strong>2 hours</strong> during business hours.
            </li>
            <li>
              <strong>Severity 3</strong> (questions, configuration, training)
              — first response within <strong>1 business day</strong>.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Support is reachable at{" "}
            <a className="text-primary hover:underline" href="mailto:support@autocurb.io">
              support@autocurb.io
            </a>
            . Enterprise customers receive a direct phone line and named
            account manager.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Free data portability
            </h2>
          </div>
          <p className="text-sm text-card-foreground">
            Your data is yours. You can export every customer, lead, inspection,
            and communication record as CSV from the admin (Account →{" "}
            <em>Export My Data</em>) at any time. <strong>No charge, no rate
            limit, no data-egress fees.</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            On contract termination we provide a final, complete export within
            7 calendar days at no additional cost. We retain your data for 30
            days after termination unless you request earlier deletion.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-card-foreground" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Security &amp; compliance
            </h2>
          </div>
          <ul className="text-sm text-card-foreground space-y-2 list-disc list-inside">
            <li>All data is encrypted in transit (TLS 1.2+) and at rest (AES-256).</li>
            <li>Row-Level Security ensures one dealership's data is never visible to another.</li>
            <li>Super-admin access to a dealer's data is logged with a mandatory ≥10-character reason and surfaced to the dealer in their compliance log.</li>
            <li>Annual third-party penetration test; report available to enterprise customers under NDA.</li>
            <li>SOC 2 Type II certification in progress (target: Q4 2026).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ServerCrash className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Incident communication
            </h2>
          </div>
          <p className="text-sm text-card-foreground">
            Every Severity-1 or -2 incident triggers an entry on{" "}
            <Link to="/status" className="text-primary hover:underline">
              /status
            </Link>{" "}
            within 10 minutes of detection. We post updates at least every 30
            minutes until resolution. A post-mortem is published within 5
            business days for any incident lasting more than 60 minutes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-card-foreground">
            Service credits
          </h2>
          <p className="text-sm text-card-foreground">
            If we miss the 99.9% monthly uptime commitment, you're entitled to
            a service credit:
          </p>
          <ul className="text-sm text-card-foreground space-y-1 list-disc list-inside">
            <li>99.0% – 99.9% uptime → <strong>10% credit</strong> on that month's invoice</li>
            <li>95.0% – 99.0% uptime → <strong>25% credit</strong></li>
            <li>Below 95.0% uptime → <strong>50% credit</strong></li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Credits apply to the next invoice and require a request to
            support@autocurb.io within 30 days of the affected month.
          </p>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            What this isn't
          </h2>
          <p className="text-sm text-muted-foreground">
            This page is a public commitment. The legally-binding terms live
            in your signed Master Service Agreement, which takes precedence
            where it differs. Email{" "}
            <a className="text-primary hover:underline" href="mailto:legal@autocurb.io">
              legal@autocurb.io
            </a>{" "}
            for a copy of the current MSA template.
          </p>
        </section>

        <footer className="text-center text-xs text-muted-foreground pt-8 border-t border-border space-y-1">
          <p>
            Live status: <Link to="/status" className="text-primary hover:underline">/status</Link>
            {" · "}
            Need help: <a className="text-primary hover:underline" href="mailto:support@autocurb.io">support@autocurb.io</a>
          </p>
          <p>Last updated May 2026 · Autocurb.io</p>
        </footer>
      </div>
    </div>
  );
};

export default SlaPage;
