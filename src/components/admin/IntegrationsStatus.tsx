// IntegrationsStatus
// ----------------------------------------------------------------------------
// Master integrations dashboard for Super Admin. Shows every external
// integration the platform supports along with its current wiring status
// (live, beta, in-development, needs-config) so operators can see at a
// glance what is ready for production and what still requires credentials
// or deployment work before going live.
// ----------------------------------------------------------------------------

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Zap,
  CheckCircle2,
  HardHat,
  Beaker,
  Settings2,
  ArrowRight,
  Database,
  MessageSquare,
  Cpu,
  Building2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────── */

type IntegrationStatus = "live" | "beta" | "in-development" | "needs-config";
type IntegrationCategory = "Data" | "Communication" | "Hardware" | "Enterprise";

interface Integration {
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  description: string;
  requirements?: string[];
  action?: { label: string; href: string };
}

/* ── Integration catalog ────────────────────────────────────── */

const INTEGRATIONS: Integration[] = [
  // ── Live ──
  {
    name: "Analytics (Plausible / GA4)",
    category: "Data",
    status: "live",
    description:
      "Privacy-friendly visitor analytics and conversion tracking across the customer-facing funnel.",
    requirements: ["Plausible or GA4 measurement ID in site config"],
    action: { label: "Configure", href: "/admin?section=site-config" },
  },
  {
    name: "Lead Scoring Engine",
    category: "Data",
    status: "live",
    description:
      "Archetype-based lead scoring that blends vehicle condition, market fit, and urgency signals.",
  },
  {
    name: "Email & SMS Notifications",
    category: "Communication",
    status: "live",
    description:
      "Transactional emails, follow-up sequences, and SMS alerts to customers and staff.",
    action: { label: "Manage", href: "/admin?section=notifications" },
  },
  {
    name: "Calendar Invites (ICS)",
    category: "Communication",
    status: "live",
    description:
      "Generates and delivers .ics calendar invites when appointments are booked.",
  },

  // ── Beta ──
  {
    name: "OBD-II Scanner",
    category: "Hardware",
    status: "beta",
    description:
      "Capture live diagnostic trouble codes over Web Bluetooth using an OBDLink CX or compatible BLE adapter.",
    requirements: [
      "OBDLink CX (or compatible BLE OBD-II dongle)",
      "Chrome / Edge on Android for Web Bluetooth",
    ],
  },
  {
    name: "Customer Portal",
    category: "Communication",
    status: "beta",
    description:
      "Self-service portal where customers track offer status, upload documents, and e-sign.",
  },
  {
    name: "AI Damage Analysis",
    category: "Data",
    status: "beta",
    description:
      "Computer-vision damage assessment from uploaded vehicle photos with severity scoring.",
  },

  // ── In Development ──
  {
    name: "vAuto (Cox Automotive) Push",
    category: "Enterprise",
    status: "in-development",
    description:
      "Push finalized appraisals into the dealer's Cox Automotive vAuto inventory system.",
    requirements: [
      "Cox Automotive / vAuto API credentials",
      "vAuto dealer ID",
      "Production environment flipped on per dealer",
    ],
    action: { label: "Open Settings", href: "/admin?section=vauto-integration" },
  },
  {
    name: "API Access (REST + Webhooks)",
    category: "Enterprise",
    status: "in-development",
    description:
      "Public REST API and webhook delivery for DMS/CRM integration partners.",
    requirements: [
      "Backend edge functions deployed",
      "Rate limiting infrastructure",
      "API key scopes wired to RLS",
    ],
    action: { label: "Open Settings", href: "/admin?section=api-access" },
  },
  {
    name: "White Label Custom Domains",
    category: "Enterprise",
    status: "in-development",
    description:
      "Per-dealer custom domains with verified DNS and automated SSL provisioning.",
    requirements: [
      "DNS verification flow",
      "SSL certificate provisioning pipeline",
      "CNAME / A record instructions surfaced to dealers",
    ],
    action: { label: "Open Settings", href: "/admin?section=white-label" },
  },
  {
    name: "Wholesale Marketplace",
    category: "Enterprise",
    status: "in-development",
    description:
      "Cross-dealer marketplace for listing dead leads to a network of participating dealers.",
    requirements: [
      "Multiple dealer tenants connected",
      "Inter-dealer offer / bid workflow",
      "Escrow / settlement rails",
    ],
    action: {
      label: "Open Settings",
      href: "/admin?section=wholesale-marketplace",
    },
  },
  {
    name: "DMS Integration (CDK / Reynolds)",
    category: "Enterprise",
    status: "in-development",
    description:
      "Two-way sync with major DMS platforms for service lead ingestion and appraisal write-back.",
    requirements: [
      "CDK or Reynolds & Reynolds partner credentials",
      "Service RO feed parser",
      "Appraisal push adapter",
    ],
  },
  {
    name: "SSO / SAML",
    category: "Enterprise",
    status: "in-development",
    description:
      "Enterprise single sign-on via SAML 2.0 / OIDC for dealer group identity providers.",
    requirements: [
      "Identity provider metadata (Okta, Azure AD, Google Workspace)",
      "SAML assertion → Supabase auth mapping",
    ],
  },

  // ── Needs Config ──
  {
    name: "Sentry Error Monitoring",
    category: "Data",
    status: "needs-config",
    description:
      "Production error tracking, release health, and performance monitoring.",
    requirements: ["Sentry DSN in environment config"],
  },
  {
    name: "PostHog Product Analytics",
    category: "Data",
    status: "needs-config",
    description:
      "Event-level product analytics, funnels, and session replay.",
    requirements: ["PostHog API key in environment config"],
  },
  {
    name: "Stripe Billing",
    category: "Enterprise",
    status: "needs-config",
    description:
      "Subscription billing and seat-based plans for dealer tenants.",
    requirements: [
      "Stripe secret key",
      "Webhook signing secret",
      "Product / price IDs mapped to dealer tiers",
    ],
  },
];

/* ── Status metadata ────────────────────────────────────────── */

const STATUS_META: Record<
  IntegrationStatus,
  {
    label: string;
    icon: React.ElementType;
    ring: string;
    badge: string;
    dot: string;
    gradient: string;
  }
> = {
  live: {
    label: "Live",
    icon: CheckCircle2,
    ring: "border-emerald-500/40",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
  },
  beta: {
    label: "Beta",
    icon: Beaker,
    ring: "border-blue-500/40",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    dot: "bg-blue-500",
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
  },
  "in-development": {
    label: "In Development",
    icon: HardHat,
    ring: "border-amber-500/40",
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
  },
  "needs-config": {
    label: "Needs Config",
    icon: Settings2,
    ring: "border-orange-500/40",
    badge:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
    dot: "bg-orange-500",
    gradient: "from-orange-500/10 via-orange-500/5 to-transparent",
  },
};

const CATEGORY_ICON: Record<IntegrationCategory, React.ElementType> = {
  Data: Database,
  Communication: MessageSquare,
  Hardware: Cpu,
  Enterprise: Building2,
};

/* ── KPI pill ───────────────────────────────────────────────── */

const StatusPill = ({
  status,
  count,
}: {
  status: IntegrationStatus;
  count: number;
}) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/80 backdrop-blur-sm p-4 flex items-center gap-3",
        meta.ring
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl",
          meta.badge
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {meta.label}
        </div>
        <div className="text-xl font-black tracking-tight text-card-foreground">
          {count}
        </div>
      </div>
    </div>
  );
};

/* ── Card ───────────────────────────────────────────────────── */

const IntegrationCard = ({ integration }: { integration: Integration }) => {
  const meta = STATUS_META[integration.status];
  const CategoryIcon = CATEGORY_ICON[integration.category];
  const StatusIcon = meta.icon;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)]",
        "transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        meta.ring
      )}
    >
      {/* Accent gradient wash */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br pointer-events-none opacity-70",
          meta.gradient
        )}
      />

      <div className="relative p-5 flex flex-col h-full">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted/60 border border-border/60">
              <CategoryIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {integration.category}
              </div>
              <h3 className="text-sm font-black tracking-tight text-card-foreground leading-tight">
                {integration.name}
              </h3>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
              meta.badge
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed text-muted-foreground mb-3">
          {integration.description}
        </p>

        {/* Requirements */}
        {integration.requirements && integration.requirements.length > 0 && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/70 mb-1.5">
              Requirements
            </div>
            <ul className="space-y-1">
              {integration.requirements.map((req, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] leading-snug text-card-foreground/80"
                >
                  <span
                    className={cn(
                      "mt-1.5 w-1 h-1 rounded-full shrink-0",
                      meta.dot
                    )}
                  />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action button */}
        {integration.action && (
          <div className="mt-auto pt-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 text-[11px] h-8"
            >
              <a href={integration.action.href}>
                {integration.action.label}
                <ArrowRight className="w-3 h-3" />
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main ───────────────────────────────────────────────────── */

const IntegrationsStatus: React.FC = () => {
  const counts = React.useMemo(() => {
    const c: Record<IntegrationStatus, number> = {
      live: 0,
      beta: 0,
      "in-development": 0,
      "needs-config": 0,
    };
    INTEGRATIONS.forEach((i) => {
      c[i.status] += 1;
    });
    return c;
  }, []);

  const grouped = React.useMemo(() => {
    const groups: Record<IntegrationCategory, Integration[]> = {
      Data: [],
      Communication: [],
      Hardware: [],
      Enterprise: [],
    };
    INTEGRATIONS.forEach((i) => {
      groups[i.category].push(i);
    });
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              Integrations Status
              <Zap className="w-4 h-4 text-primary" />
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              At-a-glance wiring status for every external system the platform
              connects to. Use this dashboard to plan the next integration to
              light up.
            </p>
          </div>
          <a
            href="https://docs.hartecash.com/integrations"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Integration docs
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Status summary pills ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusPill status="live" count={counts.live} />
        <StatusPill status="beta" count={counts.beta} />
        <StatusPill status="in-development" count={counts["in-development"]} />
        <StatusPill status="needs-config" count={counts["needs-config"]} />
      </div>

      {/* ── Grouped grids ── */}
      {(Object.keys(grouped) as IntegrationCategory[]).map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const CategoryIcon = CATEGORY_ICON[cat];
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted/60 border border-border/60">
                <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                {cat}
              </h3>
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[10px] font-bold text-muted-foreground/70">
                {items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((integration) => (
                <IntegrationCard
                  key={integration.name}
                  integration={integration}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default IntegrationsStatus;
