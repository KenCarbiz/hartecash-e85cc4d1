import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Shield,
  Camera,
  Film,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Zap,
  Star,
  ChevronRight,
  Play,
  Building2,
  TrendingUp,
  Lock,
  Sparkles,
} from "lucide-react";

/**
 * B2B Platform Pitch Page — targets dealer principals considering
 * the AutoCurb.ai platform. Follows the proven SaaS narrative arc:
 * Promise → Problem → Product → Proof → Push.
 *
 * Route: /platform
 */

const PRODUCTS = [
  {
    id: "autocurb",
    name: "AutoCurb.io",
    tagline: "Off-Street Vehicle Acquisition",
    description:
      "Turn every walk-in into a cash offer in 15 minutes. Instant appraisals, inspection workflows, and customer-facing offer pages — no more spreadsheets or phone tag.",
    icon: Car,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    features: [
      "Instant cash offers from real-time market data",
      "Digital inspection with photo capture",
      "Customer-facing offer page with e-signature",
      "Automated follow-up via SMS, email, and Voice AI",
      "Appraiser queue with manager approval workflow",
    ],
    metric: "15 min",
    metricLabel: "walk-in to cash offer",
  },
  {
    id: "autolabels",
    name: "AutoLabels.io",
    tagline: "FTC Compliance & Window Stickers",
    description:
      "Stay ahead of the FTC CARS Rule with automated buyer's guides, addendums, accessory disclosures, and customer e-signatures. Compliant in all 50 states.",
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
    features: [
      "FTC CARS Rule compliant disclosures",
      "Unlimited window stickers & addendums",
      "Per-vehicle accessory tracking",
      "Customer disclosure with e-signature",
      "Retained audit trail for every deal",
    ],
    metric: "99%",
    metricLabel: "audit pass rate",
  },
  {
    id: "autoframe",
    name: "AutoFrame.io",
    tagline: "AI-Powered Vehicle Photography",
    description:
      "Consistent, studio-quality photos for every unit on your lot. AI background removal and lighting correction — photo-ready in hours, not days.",
    icon: Camera,
    color: "text-purple-600",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
    features: [
      "AI background removal & studio lighting",
      "Consistent brand look across every vehicle",
      "Inventory-tiered plans (75 / 125 / unlimited)",
      "Same-day turnaround SLA",
      "Bulk upload & batch processing",
    ],
    metric: "Same day",
    metricLabel: "photo-ready",
  },
  {
    id: "autofilm",
    name: "AutoFilm.io",
    tagline: "Sales & Service Video",
    description:
      "Walkaround videos for sales and MPI videos for service — one subscription covers both departments. Customer-facing delivery via SMS with 65%+ open rates.",
    icon: Film,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    features: [
      "Sales walkaround video creation",
      "Service MPI video with customer delivery",
      "SMS + email distribution",
      "AI transcription & highlights",
      "Performance analytics per video",
    ],
    metric: "65%+",
    metricLabel: "video open rate",
  },
];

const PAIN_POINTS = [
  {
    icon: Users,
    title: "8–12 Vendors. 8–12 Logins.",
    description:
      "Your team juggles disconnected tools for acquisition, compliance, photos, and video. Every handoff is a leak.",
  },
  {
    icon: AlertTriangle,
    title: "$50,000+ FTC Penalties",
    description:
      "The CARS Rule is live. One missed disclosure, one unsigned buyer's guide — and you're writing a check to the FTC.",
  },
  {
    icon: Clock,
    title: "3–7 Days to Frontline",
    description:
      "Every day a car sits unprocessed costs $32 in floorplan interest. Your acquisition-to-online pipeline is bleeding margin.",
  },
];

const ROI_METRICS = [
  { value: "$150", label: "per vehicle acquisition cost", comparison: "vs $300–500 industry avg" },
  { value: "Same day", label: "photo-ready turnaround", comparison: "vs 3–7 days industry avg" },
  { value: "99%", label: "FTC compliance audit rate", comparison: "vs ~60% industry avg" },
  { value: "<$100", label: "total platform cost per unit", comparison: "vs $300–500 across vendors" },
];

const PlatformPitch = () => {
  const [activeProduct, setActiveProduct] = useState(0);

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
              The Dealer Platform
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#333] dark:text-slate-100 leading-[1.1]">
              From Curb to Customer.{" "}
              <span className="text-[#4CAF50]">One Platform.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Acquire vehicles, stay FTC compliant, shoot studio photos, and
              deliver walkaround videos — all from one dashboard.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button size="lg" className="gap-2 text-base px-8 bg-[#4CAF50] hover:bg-[#43A047] text-white" asChild>
                <a href="mailto:sales@autocurb.io?subject=Platform%20Demo%20Request">
                  Get a Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="lg" className="gap-2 text-base border-[#4CAF50]/30 text-[#4CAF50] hover:bg-[#4CAF50]/5" asChild>
                <a href="#products">
                  <Play className="w-4 h-4" />
                  See How It Works
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
              <span>Trusted by dealer groups across the country</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Problem-Agitation ── */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              The Hidden Cost of Vendor Sprawl
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Every disconnected tool is a leak in your operation.
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

      {/* ── Section 3: Product Showcase (Tabbed) ── */}
      <section id="products" className="scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="text-xs font-semibold tracking-wider uppercase px-3 py-1 mb-4">
              4 Products. 1 Platform.
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Everything Your Dealership Needs
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Each product stands alone. Together, they eliminate every gap in your workflow.
            </p>
          </div>

          {/* Product tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {PRODUCTS.map((product, idx) => {
              const Icon = product.icon;
              const isActive = activeProduct === idx;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setActiveProduct(idx)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    isActive
                      ? `${product.bg} ${product.color} ring-2 ${product.ring}`
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {product.name}
                </button>
              );
            })}
          </div>

          {/* Active product detail */}
          {(() => {
            const product = PRODUCTS[activeProduct];
            const Icon = product.icon;
            return (
              <Card className={`border-2 ${activeProduct === 0 ? "border-emerald-500/30" : activeProduct === 1 ? "border-blue-500/30" : activeProduct === 2 ? "border-purple-500/30" : "border-amber-500/30"} overflow-hidden`}>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Content */}
                    <div className="p-8 sm:p-10 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl ${product.bg} flex items-center justify-center`}>
                          <Icon className={`w-6 h-6 ${product.color}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-card-foreground">
                            {product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {product.tagline}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {product.description}
                      </p>
                      <ul className="space-y-2.5">
                        {product.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5">
                            <CheckCircle2 className={`w-4 h-4 ${product.color} shrink-0 mt-0.5`} />
                            <span className="text-sm text-card-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Right: Big metric */}
                    <div className={`${product.bg} flex items-center justify-center p-8 sm:p-10`}>
                      <div className="text-center space-y-2">
                        <p className={`text-5xl sm:text-6xl font-bold ${product.color}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                          {product.metric}
                        </p>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {product.metricLabel}
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              The Numbers Speak for Themselves
            </h2>
            <p className="text-slate-400 mt-2">
              Based on platform averages across active dealerships.
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

      {/* ── Section 5: Testimonial ── */}
      <section className="border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center space-y-6">
          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium text-card-foreground leading-relaxed italic">
            "We replaced four vendors with AutoCurb in one weekend. Our acquisition
            cost dropped 60%, photos go live same-day, and we haven't had a single
            FTC compliance issue since switching."
          </blockquote>
          <div>
            <p className="font-semibold text-card-foreground">Mike Reynolds</p>
            <p className="text-sm text-muted-foreground">General Manager, Reynolds Auto Group</p>
          </div>
        </div>
      </section>

      {/* ── Section 6: How It Works ── */}
      <section className="bg-muted/30 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Live in Days, Not Months
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Connect", description: "We integrate with your DMS and existing tools. No rip-and-replace." },
              { step: "2", title: "Onboard", description: "Your team is trained and live in one day. White-glove setup included." },
              { step: "3", title: "Launch", description: "Go live across all four products. See ROI from week one." },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#4CAF50] text-white text-lg font-bold flex items-center justify-center mx-auto">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-card-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Pricing Preview ── */}
      <section id="pricing" className="scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-card-foreground">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground">
              Per-rooftop pricing. Pick individual apps or get everything with the All-Apps bundle.
              Volume discounts for 3+ locations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <Card className="border-border/60">
                <CardContent className="p-6 text-center space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Per App</p>
                  <p className="text-3xl font-bold text-card-foreground">From $399<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                  <p className="text-xs text-muted-foreground">per rooftop · mix and match</p>
                </CardContent>
              </Card>
              <Card className="border-[#4CAF50]/30 bg-[#4CAF50]/[0.03]">
                <CardContent className="p-6 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <p className="text-sm font-semibold text-[#4CAF50] uppercase tracking-wider">All-Apps Bundle</p>
                    <Badge className="text-[9px]">Best Value</Badge>
                  </div>
                  <p className="text-3xl font-bold text-card-foreground">$3,999<span className="text-base font-normal text-muted-foreground">/mo</span></p>
                  <p className="text-xs text-muted-foreground">per rooftop · everything included</p>
                </CardContent>
              </Card>
            </div>
            <p className="text-xs text-muted-foreground">
              Annual prepaid saves 15%. Dealer groups (6+ rooftops) save up to 20%.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 8: Trust Strip ── */}
      <section className="bg-muted/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="w-4 h-4" />
              SOC 2 Compliant
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="w-4 h-4" />
              FTC CARS Rule Ready
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="w-4 h-4" />
              DMS Integrations
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />
              Real-Time Market Data
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="w-4 h-4" />
              99.9% Uptime SLA
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 9: Final CTA ── */}
      <section className="bg-gradient-to-br from-[#4CAF50]/[0.06] via-transparent to-[#4CAF50]/[0.03]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-card-foreground">
            Ready to Simplify Your Dealership?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Join dealer groups across the country who replaced their vendor stack with one platform.
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
