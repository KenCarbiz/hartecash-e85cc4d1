import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Globe,
  Store,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Users,
  Star,
  Play,
  Building2,
  TrendingUp,
  Lock,
  Sparkles,
  Gauge,
  Brain,
  ScanLine,
  Link2,
  FileCheck,
  Bot,
  X,
} from "lucide-react";

/**
 * B2B Platform Pitch Page — targets dealer principals considering
 * the AutoCurb.ai platform. Follows the proven SaaS narrative arc:
 * Promise → Problem → Product → Proof → Push.
 *
 * Route: /platform
 */

const CHANNELS = [
  {
    id: "landing",
    name: "Landing Page Embed",
    tagline: "Catch trade intent before the shopper leaves your site",
    description:
      "Drop AutoCurb directly into the dealer's existing website — VDPs, SRPs, homepage, or a dedicated /sell-my-car page. Every shopper who thinks about a trade gets a real offer on your site instead of defecting to Carvana or CarMax.",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    features: [
      "Sticky ghost link that follows shoppers across VDP and SRP pages",
      "Floating trade widget with configurable position, colors, and CTA",
      "Full-page iframe with auto-resize for a dedicated /sell-my-car page",
      "Push / Pull / Tow guarantee certificate with location-specific terms",
      "VIN pre-fill with live Black Book + retail comp offer in seconds",
      "Lead lands in the dealer CRM already scored and routed",
    ],
    metric: "5 min",
    metricLabel: "dealer-side install",
  },
  {
    id: "trade",
    name: "Dedicated Trade Page",
    tagline: "A fully branded acquisition site for every rooftop",
    description:
      "Every rooftop gets its own white-label subdomain with corporate defaults and per-location overrides — logo, colors, phone, hours, PPT guarantee amount, hero copy, and social links. Drive it with paid search, direct mail, email blasts, or service-drive QR codes.",
    icon: Link2,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
    features: [
      "True multi-tenant white-label — not a re-theme, per-rooftop overrides",
      "Location-specific share links with built-in QR for every rep",
      "Customer-facing offer page with e-signature and PPT guarantee",
      "Phone-based document upload: driver's license, title, registration, payoff",
      "Driver's license OCR verifies name, DOB, address against the submission",
      "TCPA / CAN-SPAM / 10DLC consent logged at submission with version tag",
    ],
    metric: "1 platform",
    metricLabel: "unlimited rooftops",
  },
  {
    id: "showroom",
    name: "In-Showroom Trade",
    tagline: "The used-car manager's command center",
    description:
      "A single slide-out customer file that shows the progress tracker, ACV appraisal tool, inspection sheet, retail market panel, profit-spread gauge, activity log, and check-request generator — all without a tab switch. The UCM goes from walk-in to cash offer in fifteen minutes.",
    icon: Store,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    features: [
      "Digital inspection with photo capture on any phone or tablet",
      "Live Black Book wholesale/retail/trade pulls with regional adjustments",
      "Retail comps panel — competing listings, days-on-market, spread analysis",
      "Profit-spread gauge shows the room between offer, ACV, and retail",
      "Historical deal learning surfaces every similar unit the dealer has bought",
      "Role-based approvals: UCM → GSM → Admin with full audit trail",
    ],
    metric: "15 min",
    metricLabel: "walk-in to cash offer",
  },
];

const PAIN_POINTS = [
  {
    icon: TrendingUp,
    title: "Auctions Cost $1,500–$2,500 More Per Car",
    description:
      "Manheim and ADESA prices are at or above retail. Add buyer fees, transport, and lane risk, and the gross is gone before the car hits your lot.",
  },
  {
    icon: AlertTriangle,
    title: "Carvana and CarMax Are Stealing Every Trade",
    description:
      "Your shoppers get a live offer from a competitor in sixty seconds. If your website can't match that, the trade walks — and the replacement sale walks with it.",
  },
  {
    icon: X,
    title: "KBB ICO and AutoHub Stop at the Offer",
    description:
      "You pay $1,500–$3,500 a month for a lead form. No BDC workflow, no inspection, no ACV, no check request, no vAuto push. You still do all the work.",
  },
];

const ROI_METRICS = [
  { value: "$2,000", label: "gross per acquired car", comparison: "saved vs buying the same unit at auction" },
  { value: "20 units", label: "typical monthly acquisition lift", comparison: "a mid-sized rooftop sourced direct" },
  { value: "$40K", label: "extra monthly used-car gross", comparison: "20 units × $2,000 kept off the auction lane" },
  { value: "$480K", label: "annual gross recaptured", comparison: "from a single rooftop running AutoCurb" },
];

const COMPETITORS = [
  {
    name: "KBB ICO",
    parent: "(Cox)",
    cost: "$1,500 – $2,500/mo",
    gives: "A consumer-facing lead form",
    misses: "No BDC, no inspection, no ACV, no title work, no acquisition workflow. Same lead is sold to multiple dealers.",
  },
  {
    name: "AutoHub / AccuTrade",
    parent: "(Cox)",
    cost: "$1,800 – $3,500/mo",
    gives: "Appraisal tool inside vAuto",
    misses: "Not consumer-facing. Requires a rep at a desk. No website embed, no service-drive tool, no compliance stack.",
  },
  {
    name: "TrueCar / Edmunds",
    parent: "",
    cost: "$800 – $1,500/mo",
    gives: "A web widget value estimator",
    misses: "No backend. The dealer is on their own the moment the form submits.",
  },
  {
    name: "Carvana / CarMax",
    parent: "",
    cost: "N/A",
    gives: "Direct-to-consumer buying",
    misses: "Not available to dealers. They are the enemy — stealing every trade you don't catch first.",
  },
  {
    name: "vAuto / ProfitTime",
    parent: "(Cox)",
    cost: "$2,500 – $5,000/mo",
    gives: "Inventory management",
    misses: "Starts after the car is acquired. Doesn't help you buy the car in the first place.",
  },
];

const INTELLIGENCE = [
  {
    icon: DollarSign,
    title: "Live Black Book Pricing",
    description:
      "Real-time wholesale, retail, and trade-in pulls with regional adjustments and market-day-supply multipliers on every submission.",
  },
  {
    icon: TrendingUp,
    title: "Retail Comps Panel",
    description:
      "Live competitive listings inside a configurable radius — asking price, days on market, and spread analysis next to the offer.",
  },
  {
    icon: Gauge,
    title: "Profit-Spread Gauge",
    description:
      "The UCM sees exactly how much room sits between the offer, the ACV, and the retail target before they commit a dollar.",
  },
  {
    icon: Brain,
    title: "Historical Deal Learning",
    description:
      "Every offer the dealer has ever made on every similar car surfaces inside the appraisal screen. The platform gets smarter per store.",
  },
  {
    icon: ScanLine,
    title: "Driver's License OCR",
    description:
      "Auto-verifies name, DOB, and address against the submission, then marks the VIN as verified in the audit trail.",
  },
  {
    icon: Sparkles,
    title: "AI Vehicle Rendering",
    description:
      "Every lead auto-renders the correct year/make/model/color three-quarter view so the customer file looks like a product, not a database row.",
  },
];

const AUTOMATIONS = [
  "3-touch email + SMS follow-up sequences",
  "Abandoned-lead recovery",
  "Appointment confirmations and reminders",
  "Reschedule notifications",
  "Post-deal review requests",
  "Hot-lead staff alerts",
  "AI damage analysis on uploaded photos",
  "VIN decoding and title parsing",
  "TCPA consent logging and opt-out suppression",
  "Voice AI follow-up calls",
  "Quiet-hours enforcement per customer timezone",
  "Referral attribution and payout tracking",
];

const ROADMAP = [
  {
    phase: "Phase 1",
    status: "Live in Production",
    title: "Direct-to-Consumer Acquisition",
    description:
      "Click → offer → BDC → inspection → ACV → check request → paid. Every feature above is shipping today across all three channels.",
  },
  {
    phase: "Phase 2",
    status: "Next Build",
    title: "Backgrounding & Recon Board",
    description:
      "The moment the check is cut, the unit auto-enrolls: photo capture in the service lane, reconditioning checklist, mechanical inspection sync, title tracking, and frontline-ready scoring on one board.",
  },
  {
    phase: "Phase 3",
    status: "On the Roadmap",
    title: "Direct vAuto Push",
    description:
      "When the unit clears recon, AutoCurb pushes the full record — VIN, condition, damage, photos, ACV, recon costs, frontline date — straight into vAuto. You never hand-type a used car into inventory again.",
  },
];

const PlatformPitch = () => {
  const [activeChannel, setActiveChannel] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#4a4a4a] dark:text-slate-200">Auto</span>
              <span className="text-[#4CAF50]">Curb</span>
              <span className="text-[#4a4a4a] dark:text-slate-400 text-base">.io</span>
            </span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-semibold border-l border-border/60 pl-2.5 ml-0.5">
              Bring the Curb to the Cloud
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <a href="#pricing">Pricing</a>
            </Button>
            <Button size="sm" className="gap-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white" asChild>
              <a href="mailto:sales@autocurb.io?subject=Platform%20Demo%20Request">
                Get a Demo
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Section 1: Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4CAF50]/[0.06] via-transparent to-[#4CAF50]/[0.03]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 border-[#4CAF50]/30 text-[#4CAF50]">
              The Dealer Acquisition Operating System
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#333] dark:text-slate-100 leading-[1.1]">
              Divorce the Auction.{" "}
              <span className="text-[#4CAF50]">Source Cars Direct.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AutoCurb is the only end-to-end platform that turns your website, your trade page, and your showroom into a single acquisition engine — so every used car you buy comes from a consumer, not a lane fee.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button size="lg" className="gap-2 text-base px-8 bg-[#4CAF50] hover:bg-[#43A047] text-white" asChild>
                <a href="mailto:sales@autocurb.io?subject=Platform%20Demo%20Request">
                  Get a Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="lg" className="gap-2 text-base border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/5" asChild>
                <a href="#channels">
                  <Play className="w-4 h-4" />
                  See the Three Channels
                </a>
              </Button>
            </div>
            {/* Social proof bar */}
            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 font-semibold text-card-foreground">4.9</span>
              </div>
              <span className="hidden sm:block">·</span>
              <span>Built with dealer principals. Shipping in production today.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Problem-Agitation ── */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4 border-destructive/30 text-destructive">
              The Auction Squeeze
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Used-Car Gross Is Dying in the Auction Lane
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Every dealer in America is trying to escape the auction. The tools they've been sold to do it — KBB ICO, AutoHub, TrueCar — stop at the offer. AutoCurb finishes the job.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <Card key={point.title} className="border-border/60 bg-card">
                  <CardContent className="p-6 space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-destructive" />
                    </div>
                    <h3 className="text-lg font-bold text-card-foreground">
                      {point.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {point.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 3: Three Acquisition Channels (Tabbed) ── */}
      <section id="channels" className="scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              3 Channels. 1 Platform.
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Three Ways to Source a Car Direct
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Your website, your dedicated trade page, and your showroom — all running on the same platform, the same data, and the same playbook.
            </p>
          </div>

          {/* Channel tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {CHANNELS.map((channel, idx) => {
              const Icon = channel.icon;
              const isActive = activeChannel === idx;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(idx)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    isActive
                      ? `${channel.bg} ${channel.color} ring-2 ${channel.ring}`
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {channel.name}
                </button>
              );
            })}
          </div>

          {/* Active channel detail */}
          {(() => {
            const channel = CHANNELS[activeChannel];
            const Icon = channel.icon;
            const borderClass =
              activeChannel === 0
                ? "border-emerald-500/30"
                : activeChannel === 1
                ? "border-blue-500/30"
                : "border-amber-500/30";
            return (
              <Card className={`border-2 ${borderClass} overflow-hidden`}>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Content */}
                    <div className="p-8 sm:p-10 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${channel.bg} flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${channel.color}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-card-foreground">
                            {channel.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {channel.tagline}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {channel.description}
                      </p>
                      <ul className="space-y-2.5">
                        {channel.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5">
                            <CheckCircle2 className={`w-4 h-4 ${channel.color} shrink-0 mt-0.5`} />
                            <span className="text-sm text-card-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Right: Big metric */}
                    <div className={`${channel.bg} flex items-center justify-center p-8 sm:p-10`}>
                      <div className="text-center space-y-2">
                        <p className={`text-5xl sm:text-6xl font-bold ${channel.color}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                          {channel.metric}
                        </p>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {channel.metricLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </section>

      {/* ── Section 4: ROI Metrics ── */}
      <section className="bg-slate-900 text-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4 border-[#66BB6A]/40 text-[#66BB6A]">
              The Dealer Math
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Every Car Off the Auction Lane Is Pure Gross
            </h2>
            <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
              The auction is costing you $1,500–$2,500 per unit in premium, fees, transport, and lane risk. Source the same car direct from a consumer and every dollar of that premium becomes your gross.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ROI_METRICS.map((metric) => (
              <div key={metric.label} className="text-center space-y-2 p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-3xl sm:text-4xl font-bold text-[#66BB6A]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {metric.value}
                </p>
                <p className="text-sm font-semibold text-slate-200">
                  {metric.label}
                </p>
                <p className="text-xs text-slate-500">
                  {metric.comparison}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Competitive Landscape ── */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              The Competitive Landscape
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              What Everyone Else Sells You. What They Leave Out.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              The industry has a consumer tool (KBB) and a dealer tool (vAuto) — and nothing that connects them. AutoCurb is the missing middle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMPETITORS.map((c) => (
              <Card key={c.name} className="border-border/60">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-card-foreground">
                        {c.name} <span className="text-xs font-normal text-muted-foreground">{c.parent}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.cost}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                      {c.gives}
                    </Badge>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t border-border/50">
                    <X className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {c.misses}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-2 border-[#4CAF50]/40 bg-[#4CAF50]/[0.04] md:col-span-2">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#4CAF50]">
                      AutoCurb.io
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">$1,495 – $1,995 / mo per rooftop</p>
                  </div>
                  <Badge className="bg-[#4CAF50] hover:bg-[#4CAF50] text-white text-[10px] uppercase tracking-wider shrink-0">
                    The Full Stack
                  </Badge>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-[#4CAF50]/20">
                  <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0 mt-0.5" />
                  <p className="text-sm text-card-foreground leading-relaxed">
                    Website embed, dedicated trade page, in-showroom workflow, BDC automations, inspection, live Black Book, retail comps, ACV appraisal, compliance logging, check request, and the vAuto push — all one system, one price.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Section 5b: Intelligence Layer ── */}
      <section className="border-b border-border/50 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4 border-[#4CAF50]/30 text-[#4CAF50]">
              The Intelligence Layer
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Technology No Competitor Ships
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A used-car manager sees live market data, historical performance, and profit spread on one screen — before they ever commit a dollar.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTELLIGENCE.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border/60 bg-card">
                  <CardContent className="p-6 space-y-3">
                    <div className="w-10 h-10 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#4CAF50]" />
                    </div>
                    <h3 className="text-base font-bold text-card-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 5c: Automations ── */}
      <section className="border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              Automations
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Twenty Background Workers. Zero BDC Headcount.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              A full-time BDC rep runs $40,000–$60,000 a year. AutoCurb's production edge functions do the same job for the price of a subscription, and they don't take lunch.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {AUTOMATIONS.map((item) => (
              <div key={item} className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
                <Bot className="w-4 h-4 text-[#4CAF50] shrink-0 mt-0.5" />
                <span className="text-sm text-card-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: End-to-End Workflow ── */}
      <section className="bg-muted/30 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              End-to-End
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              From Customer Click to Check Cut — On One Platform
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Nobody else ties the website form to the BDC to the inspection to the ACV to the title work to inventory. That gap is where dealers lose 60–80% of the cars they "offered." We close it.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Customer Submits", description: "VIN pre-fills on your site or trade page. Live Black Book + retail comp offer generated in seconds.", icon: Globe },
              { step: "2", title: "BDC Engages", description: "Lead lands pre-scored in the CRM. Automated 3-touch sequences plus hot-lead alerts to the rep on duty.", icon: Users },
              { step: "3", title: "UCM Appraises", description: "Digital inspection, ACV tool, profit-spread gauge, historical deal learning — all in one slide-out.", icon: Gauge },
              { step: "4", title: "Check to vAuto", description: "Role-based approval, check request, TCPA-logged e-signature. Phase 3: the unit auto-pushes to vAuto.", icon: FileCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative">
                  <Card className="border-border/60 bg-card h-full">
                    <CardContent className="p-6 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#4CAF50] text-white text-sm font-bold flex items-center justify-center shrink-0">
                          {item.step}
                        </div>
                        <Icon className="w-5 h-5 text-[#4CAF50]" />
                      </div>
                      <h3 className="text-base font-bold text-card-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 6b: Roadmap ── */}
      <section className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4 border-[#4CAF50]/30 text-[#4CAF50]">
              The Roadmap
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Acquisition Today. The Whole Used-Car Supply Chain Next.
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Once AutoCurb owns the click-to-check workflow, the natural expansion is the recon board and the vAuto push — which makes us the system of record vAuto depends on.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ROADMAP.map((item, idx) => (
              <Card key={item.phase} className={`${idx === 0 ? "border-2 border-[#4CAF50]/40 bg-[#4CAF50]/[0.03]" : "border-border/60"}`}>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={idx === 0 ? "default" : "outline"} className={`text-[10px] uppercase tracking-wider ${idx === 0 ? "bg-[#4CAF50] hover:bg-[#4CAF50] text-white" : ""}`}>
                      {item.phase}
                    </Badge>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-card-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Vendor-Stack Pricing Comparison ── */}
      <section id="pricing" className="scroll-mt-16 bg-muted/30 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              The "Why Buy Here" Math
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Replace $10,000+ in Vendor Fees With One Platform
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Dealers today stack five vendors to do what AutoCurb does in one system — and the vendors don't even talk to each other.
            </p>
          </div>

          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {[
                  { vendor: "KBB ICO", cost: "$1,500 – $2,500 / mo", gets: "Lead feed only" },
                  { vendor: "AutoHub / AccuTrade", cost: "$1,800 – $3,500 / mo", gets: "Appraisal tool inside vAuto" },
                  { vendor: "vAuto Provision + ProfitTime", cost: "$2,500 – $5,000 / mo", gets: "Inventory management only" },
                  { vendor: "TrueCar Trade-In", cost: "$800 – $1,500 / mo", gets: "Web widget" },
                  { vendor: "BDC staffing (1 FTE)", cost: "$3,500 – $5,500 / mo loaded", gets: "Human follow-up" },
                  { vendor: "Compliance / SMS platform", cost: "$300 – $800 / mo", gets: "Consent & messaging" },
                ].map((row) => (
                  <div key={row.vendor} className="grid grid-cols-12 gap-4 p-4 text-sm items-center">
                    <div className="col-span-5 font-semibold text-card-foreground">{row.vendor}</div>
                    <div className="col-span-4 text-muted-foreground">{row.gets}</div>
                    <div className="col-span-3 text-right font-mono text-card-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{row.cost}</div>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-4 p-4 text-sm items-center bg-destructive/5">
                  <div className="col-span-5 font-bold text-destructive">Total just to try to compete</div>
                  <div className="col-span-4 text-muted-foreground">Five vendors, zero integration</div>
                  <div className="col-span-3 text-right font-bold text-destructive" style={{ fontVariantNumeric: "tabular-nums" }}>$10,400 – $18,800</div>
                </div>
                <div className="grid grid-cols-12 gap-4 p-5 text-sm items-center bg-[#4CAF50]/[0.06]">
                  <div className="col-span-5 font-bold text-[#4CAF50] text-base">AutoCurb.io</div>
                  <div className="col-span-4 text-card-foreground">All of the above, one system</div>
                  <div className="col-span-3 text-right font-bold text-[#4CAF50] text-base" style={{ fontVariantNumeric: "tabular-nums" }}>$1,495 – $1,995</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground text-center mt-6 max-w-2xl mx-auto">
            One extra car acquired direct — instead of at auction — pays for the platform ten times over. Two extra cars and it pays for itself twenty times over in gross profit alone.
          </p>
        </div>
      </section>

      {/* ── Section 8: Trust Strip ── */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-muted-foreground">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="w-4 h-4" />
              TCPA / CAN-SPAM / 10DLC Logged
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="w-4 h-4" />
              Live Black Book Data
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="w-4 h-4" />
              True Multi-Rooftop White-Label
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="w-4 h-4" />
              Role-Based CRM with Audit Trail
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="w-4 h-4" />
              SOC 2 Ready
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 9: Final CTA ── */}
      <section className="bg-gradient-to-br from-[#4CAF50]/[0.06] via-transparent to-[#4CAF50]/[0.03]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-card-foreground">
            Stop Feeding the Auction. Start Feeding Your Lot.
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Every car you source direct is $1,500–$2,500 in recaptured gross. See the platform run on your own inventory in a 20-minute demo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="gap-2 text-base px-8 bg-[#4CAF50] hover:bg-[#43A047] text-white" asChild>
              <a href="mailto:sales@autocurb.io?subject=Platform%20Demo%20Request">
                Get a Demo
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="gap-2 border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/5" asChild>
              <a href="tel:+18668517390">
                Call (866) 851-7390
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold">
              <span className="text-[#4a4a4a] dark:text-slate-300">Auto</span>
              <span className="text-[#4CAF50]">Curb</span>
              <span className="text-[#4a4a4a] dark:text-slate-400">.io</span>
            </span>
            <span>· Bring the Curb to the Cloud</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PlatformPitch;
