import { Link } from "react-router-dom";
import { ArrowRight, Car, Gauge, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";

/**
 * AutocurbLanding — SaaS marketing page served ONLY on autocurb.io.
 * Tenant custom domains (hartecash.com, sell2harte.com, etc.) keep
 * routing through Index → LandingTemplateRouter and are unaffected.
 */
const AutocurbLanding = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="AutoCurb — Inventory Acquisition Platform for Dealers"
        description="The white-label platform powering modern dealer trade-in, sell-us, and acquisition workflows. Branded customer portals, AI appraisals, and live market data."
        path="/"
        siteName="AutoCurb"
      />

      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-md sticky top-0 z-40 bg-background/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Car className="w-6 h-6 text-primary" />
            <span>AutoCurb</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <Button asChild size="sm">
            <a href="#demo">Book a demo <ArrowRight className="w-4 h-4 ml-1" /></a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-card/40 text-xs text-muted-foreground mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            White-label inventory acquisition platform
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Acquire vehicles directly <br className="hidden md:block" />
            from your customers.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            AutoCurb gives dealer groups a branded sell-us, trade-in, and service-lane
            acquisition stack — appraisals, customer portals, and live market data, all under your domain.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="#demo">Book a demo</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#features">See the platform</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything to run an acquisition program</h2>
          <p className="text-muted-foreground">Replace cobbled-together tools with one purpose-built stack.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "2-minute customer offers", desc: "Friction-free sell-us flow that captures leads even without a VIN." },
            { icon: Gauge, title: "Live market intelligence", desc: "Black Book + retail listings power every offer. No more guessing." },
            { icon: Workflow, title: "Appraiser workbench", desc: "COMPASS strategy modes, AI damage detection, and approval workflows." },
            { icon: ShieldCheck, title: "Multi-tenant by design", desc: "Each rooftop gets its own domain, branding, pricing model, and reporting." },
            { icon: Car, title: "Service-lane trade-ups", desc: "Convert service customers into trade leads automatically." },
            { icon: Sparkles, title: "Branded customer portal", desc: "Status, scheduling, doc upload, and offer locking — all under your domain." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6 hover:border-primary/40 transition-colors">
              <Icon className="w-7 h-7 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Live in two weeks</h2>
            <p className="text-muted-foreground">We onboard your group, brand the portal, and connect your DMS.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Onboard", d: "Connect your domain, upload branding, and configure rooftops." },
              { n: "02", t: "Calibrate", d: "We tune your offer strategy against your historical book." },
              { n: "03", t: "Launch", d: "Go live across web, service drive, and SMS campaigns." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/60 bg-background p-6">
                <div className="text-xs font-mono text-primary mb-3">{s.n}</div>
                <h3 className="font-semibold mb-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">See AutoCurb in your colors.</h2>
        <p className="text-muted-foreground mb-8">
          15-minute walkthrough on your group's data. No deck, no fluff.
        </p>
        <Button asChild size="lg">
          <a href="mailto:ken@ken.cc?subject=AutoCurb%20demo">Request a demo</a>
        </Button>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} AutoCurb. All rights reserved.</span>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AutocurbLanding;
