import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import {
  BookOpen, ShieldCheck, Activity, ArrowRight, Database, FileText, ScrollText, Wrench,
} from "lucide-react";

interface DocCard {
  href: string;
  external?: boolean;
  icon: React.ElementType;
  title: string;
  blurb: string;
  audience: string;
}

const DOCS: DocCard[] = [
  {
    href: "/sla",
    icon: ShieldCheck,
    title: "Service Level Agreement",
    blurb: "Uptime, recovery, support response, free data egress, security commitments.",
    audience: "Customers · OEM compliance · prospects",
  },
  {
    href: "/status",
    icon: Activity,
    title: "Live system status",
    blurb: "Real-time health checks against the customer site, database, vehicle lookup, notifications, and billing pipeline.",
    audience: "Anyone · refreshes every 60 seconds",
  },
  {
    href: "/updates",
    icon: ScrollText,
    title: "Platform updates",
    blurb: "Public changelog of every dealer-visible feature, fix, and policy update.",
    audience: "Customers · prospects",
  },
  {
    href: "/admin?section=data-egress",
    icon: Database,
    title: "Export My Data",
    blurb: "Self-service CSV export of every customer, lead, inspection, and communication record. Free, unlimited.",
    audience: "Dealer admins · sign-in required",
  },
  {
    href: "https://github.com/KenCarbiz/hartecash-e85cc4d1/blob/main/docs/billing-stripe-setup.md",
    external: true,
    icon: FileText,
    title: "Stripe billing setup runbook",
    blurb: "Step-by-step Stripe Dashboard configuration: Products, Prices, webhook endpoint, env vars, grandfathering pattern.",
    audience: "Operators · platform admins",
  },
  {
    href: "https://github.com/KenCarbiz/hartecash-e85cc4d1/blob/main/docs/ops-handoff.md",
    external: true,
    icon: Wrench,
    title: "Ops deploy checklist",
    blurb: "Single consolidated list: every migration to apply, env var to set, edge function to deploy, smoke test to run.",
    audience: "Operators",
  },
  {
    href: "https://github.com/KenCarbiz/hartecash-e85cc4d1/blob/main/docs/sell-flow-competitive-audit.html",
    external: true,
    icon: BookOpen,
    title: "Sell-flow competitive audit",
    blurb: "Side-by-side audit of every major sell-your-car flow (Carvana / CarMax / Cars.com / KBB / TradePending / AccuTrade etc.) with design wins, losses, and recommended landing-page recipe.",
    audience: "Sales · marketing · used-car managers",
  },
];

/**
 * Public /docs landing — single index page that surfaces every
 * customer- or operator-facing document in the repo.
 *
 * Internal-only content (engineering ADRs, CLAUDE.md, etc.) stays
 * out — this is the front door for prospects, customers, and the
 * dealer's own IT / compliance team.
 */
const DocsLanding = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Docs — Autocurb"
        description="Status, SLA, runbooks, and changelogs for Autocurb's dealer-facing platform."
        path="/docs"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            Docs
          </div>
          <h1 className="text-3xl font-bold text-card-foreground tracking-tight">
            Everything you need to know about Autocurb.
          </h1>
          <p className="text-base text-muted-foreground">
            Public-facing commitments, live system health, customer-facing
            release notes, and operator runbooks. Sign-in is only required
            for the in-product surfaces.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOCS.map((d) => {
            const Icon = d.icon;
            const Wrap = ({ children }: { children: React.ReactNode }) =>
              d.external ? (
                <a href={d.href} target="_blank" rel="noreferrer" className="block group">
                  {children}
                </a>
              ) : (
                <Link to={d.href} className="block group">
                  {children}
                </Link>
              );
            return (
              <Wrap key={d.href}>
                <div className="border border-border rounded-xl bg-card p-5 h-full hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-card-foreground flex items-center gap-1">
                        {d.title}
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {d.audience}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.blurb}</p>
                </div>
              </Wrap>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-6 border-t border-border">
          <p>
            Need something not listed?{" "}
            <a className="text-primary hover:underline" href="mailto:support@autocurb.io">
              support@autocurb.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocsLanding;
