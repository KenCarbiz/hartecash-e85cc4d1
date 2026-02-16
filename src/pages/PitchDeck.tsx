import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import harteLogo from "@/assets/harte-logo.png";
import {
  Car, Users, Shield, Zap, BarChart3, ChevronRight, ChevronLeft,
  Maximize2, Minimize2, CheckCircle2, XCircle, Clock, DollarSign,
  Smartphone, FileText, Camera, CalendarDays, UserCheck, Lock,
  TrendingUp, Award, ArrowRight, Globe, Layers, Eye, Star,
  Target, Cpu, Database, ArrowUpRight, ChevronDown
} from "lucide-react";

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, prefix = "", suffix = "", className = "" }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);

  return <span ref={ref} className={className}>{prefix}{displayed.toLocaleString()}{suffix}</span>;
}

/* ─── Slide IDs ─── */
const SLIDES = [
  "hero", "market", "problem", "competition", "cookie-cutter", "solution-intro",
  "customer-exp", "employee-exp", "workflow", "mobile", "security",
  "comparison", "traction", "why-us", "cta",
] as const;
type SlideId = typeof SLIDES[number];

/* ─── Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const } }),
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.1, duration: 0.6 } }),
};

/* ─── Section Wrapper ─── */
function Section({ id, dark, children, isPresenting, currentSlide, className = "" }: {
  id: SlideId; dark?: boolean; children: React.ReactNode; isPresenting: boolean; currentSlide: SlideId; className?: string;
}) {
  if (isPresenting && id !== currentSlide) return null;
  const bg = dark ? "bg-[hsl(220,25%,6%)] text-white" : "bg-background text-foreground";
  return (
    <section
      id={id}
      className={`${isPresenting ? "w-full h-full flex items-center justify-center" : "min-h-screen flex items-center justify-center"} ${bg} ${className} relative overflow-hidden`}
    >
      {/* Subtle grid pattern for dark sections */}
      {dark && (
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(210 100% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 100% 60%) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
      )}
      <div className={`relative z-10 w-full max-w-7xl mx-auto ${isPresenting ? "px-12" : "px-6 py-20 md:py-28"}`}>
        {children}
      </div>
    </section>
  );
}

/* ─── Glow Badge ─── */
function GlowBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-blue-500/30 text-blue-400 bg-blue-500/10 backdrop-blur-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      {label}
    </div>
  );
}

function LightBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-primary/30 text-primary bg-primary/5">
      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
      {label}
    </div>
  );
}

/* ─── Metric Card ─── */
function MetricCard({ value, prefix, suffix, label, dark }: { value: number; prefix?: string; suffix?: string; label: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-8 text-center ${dark ? "bg-white/5 border border-white/10 backdrop-blur-sm" : "bg-card border border-border shadow-sm"}`}>
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} className={`text-5xl md:text-6xl font-black ${dark ? "text-blue-400" : "text-primary"}`} />
      <p className={`text-sm mt-3 ${dark ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

/* ─── Feature Pill ─── */
function FeaturePill({ icon: Icon, title, desc, dark }: { icon: any; title: string; desc: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-6 ${dark ? "bg-white/5 border border-white/10" : "bg-card border border-border"} hover:scale-[1.02] transition-transform duration-300`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${dark ? "bg-blue-500/20" : "bg-primary/10"}`}>
        <Icon className={`w-6 h-6 ${dark ? "text-blue-400" : "text-primary"}`} />
      </div>
      <h3 className={`font-bold text-lg mb-2 ${dark ? "text-white" : "text-foreground"}`}>{title}</h3>
      <p className={`text-sm leading-relaxed ${dark ? "text-white/60" : "text-muted-foreground"}`}>{desc}</p>
    </div>
  );
}

/* ─── Comparison Row ─── */
function CompRow({ feature, us, them }: { feature: string; us: boolean; them: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3.5 border-b border-white/5 items-center">
      <span className="text-sm text-white/80">{feature}</span>
      <div className="flex justify-center">{us ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-white/15" />}</div>
      <div className="flex justify-center">{them ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-white/15" />}</div>
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function PitchDeck() {
  const [isPresenting, setIsPresenting] = useState(false);
  const [idx, setIdx] = useState(0);
  const current = SLIDES[idx];

  const next = useCallback(() => setIdx(i => Math.min(i + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  const togglePresent = useCallback(() => {
    if (!isPresenting) {
      document.documentElement.requestFullscreen?.();
      setIsPresenting(true);
    } else {
      document.exitFullscreen?.();
      setIsPresenting(false);
    }
  }, [isPresenting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPresenting) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { setIsPresenting(false); document.exitFullscreen?.(); }
    };
    const onFs = () => { if (!document.fullscreenElement) setIsPresenting(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [isPresenting, next, prev]);

  return (
    <div className={isPresenting ? "fixed inset-0 z-[9999] bg-[hsl(220,25%,6%)] overflow-hidden flex flex-col" : "min-h-screen"}>
      {/* ── Toolbar ── */}
      <div className={`fixed ${isPresenting ? "bottom-6" : "top-6"} right-6 z-[10000] flex items-center gap-2 print:hidden`}>
        {isPresenting && (
          <>
            <span className="text-xs text-white/50 bg-white/5 backdrop-blur border border-white/10 px-4 py-2 rounded-full font-mono">
              {idx + 1} / {SLIDES.length}
            </span>
            <button onClick={prev} disabled={idx === 0} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={next} disabled={idx === SLIDES.length - 1} className="w-10 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-20 transition text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={togglePresent} className="h-10 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-blue-500 transition shadow-lg shadow-blue-600/25">
          {isPresenting ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isPresenting ? "Exit" : "Present"}
        </button>
      </div>

      {/* ── Scroll indicator (page mode only) ── */}
      {!isPresenting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1 print:hidden"
        >
          <span className="text-xs text-white/40 font-medium tracking-wider uppercase">Scroll</span>
          <ChevronDown className="w-4 h-4 text-white/40 animate-bounce" />
        </motion.div>
      )}

      <AnimatePresence mode="wait">

        {/* ═══ 1 — HERO ═══ */}
        <Section id="hero" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "hero"}>
          {/* Gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <img src={harteLogo} alt="Harte Auto Group" className="h-16 mx-auto brightness-0 invert opacity-90" />
            </motion.div>
            <motion.div variants={fadeUp} custom={0.5}>
              <GlowBadge label="Introducing" />
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-8">
              The Future of<br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                Vehicle Acquisition
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-14 leading-relaxed">
              A full-stack, dealer-branded platform that captures, manages, and converts direct consumer vehicle purchases — end to end.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
              {[
                { icon: Zap, label: "Cash in 24 Hours" },
                { icon: Shield, label: "Enterprise Security" },
                { icon: BarChart3, label: "Full Deal Pipeline" },
                { icon: Smartphone, label: "Mobile-First Design" },
              ].map(({ icon: I, label }) => (
                <span key={label} className="flex items-center gap-2">
                  <I className="w-4 h-4 text-blue-400" />{label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 2 — MARKET OPPORTUNITY ═══ */}
        <Section id="market" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "market"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Market Opportunity" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              A <span className="text-blue-400">$400 Billion</span> Market<br />Waiting to Be Disrupted
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-16">
              40 million used cars are sold annually in the U.S. Dealers who can acquire inventory directly from consumers — without auctions — hold the ultimate competitive advantage.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-4 gap-6">
              <MetricCard value={40} suffix="M" label="Used cars sold annually in the U.S." dark />
              <MetricCard value={400} prefix="$" suffix="B" label="Total U.S. used vehicle market" dark />
              <MetricCard value={73} suffix="%" label="of consumers prefer selling online first" dark />
              <MetricCard value={3200} prefix="$" label="Average profit per direct acquisition" dark />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 3 — THE PROBLEM ═══ */}
        <Section id="problem" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "problem"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="The Problem" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Dealers Are <span className="text-destructive">Hemorrhaging</span><br />Acquisition Opportunities
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mb-14">
              While dealers fight over auction inventory and pay inflated prices, millions of consumers are selling their vehicles to CarMax and Carvana — often vehicles that were serviced at YOUR dealership.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-8">
              {[
                { icon: "💸", title: "Auction Dependency", desc: "Dealers pay premium prices at auction for inventory they could acquire directly from consumers at wholesale." },
                { icon: "🚪", title: "Customer Walkaway", desc: "Your service customers — the ones you already have a relationship with — are selling to your competitors because you don't make it easy." },
                { icon: "📉", title: "Margin Compression", desc: "Rising auction prices, transportation costs, and reconditioning eat into profits. Direct acquisition solves all three." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 3} className="bg-card border border-border rounded-2xl p-8">
                  <span className="text-4xl mb-4 block">{item.icon}</span>
                  <h3 className="font-bold text-xl text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 4 — COMPETITION ═══ */}
        <Section id="competition" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "competition"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Competitive Landscape" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              They Built <span className="text-blue-400">Empires</span> on<br />Your Missed Opportunities
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-14">
              CarMax and Carvana proved the model works. But they have zero relationship with your customer. You have something they'll never have — trust.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-emerald-400" /></span>
                  What They Got Right
                </h3>
                <ul className="space-y-4">
                  {["Frictionless online experience", "Instant valuation & offer", "Speed to payment", "National brand awareness"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center"><Target className="w-4 h-4 text-red-400" /></span>
                  Their Fatal Weakness
                </h3>
                <ul className="space-y-4">
                  {["No existing customer relationship", "Aggressive low-ball pricing strategy", "No service history leverage", "Zero local market presence", "Impersonal, commodity experience"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70 text-sm"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 5 — COOKIE CUTTER ═══ */}
        <Section id="cookie-cutter" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cookie-cutter"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="The Status Quo" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Every Dealer Has the<br /><span className="text-destructive">Same Broken Widget</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mb-14">
              Plug-and-play vendor tools promise results but deliver a generic form that looks identical on 10,000 other dealer websites. No pipeline. No workflow. No differentiation.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-8">
              <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8">
                <h3 className="text-2xl font-black text-destructive mb-8">Generic Tools</h3>
                <div className="space-y-5">
                  {[
                    "Identical UI across every dealership",
                    "Leads dump into email — no workflow",
                    "No deal pipeline or stage management",
                    "No role-based access for your team",
                    "No document or photo collection",
                    "No customer-facing status portal",
                    "No appraisal tracking or attribution",
                    "No print-ready office documents",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground"><XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />{item}</div>
                  ))}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8">
                <h3 className="text-2xl font-black text-primary mb-8">Our Platform</h3>
                <div className="space-y-5">
                  {[
                    "100% branded to YOUR dealership",
                    "10-stage managed deal pipeline",
                    "4-tier role-based staff permissions",
                    "Built-in appraisal & check requests",
                    "Guided photo & document collection",
                    "Real-time customer status portal",
                    "Automatic appraiser attribution",
                    "Professional print-ready records",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{item}</div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 6 — SOLUTION INTRO ═══ */}
        <Section id="solution-intro" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "solution-intro"}>
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[140px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <GlowBadge label="The Platform" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-tight">
              One Platform.<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Every Touchpoint.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mx-auto mb-16">
              From the moment a consumer considers selling their car to the moment your accounting cuts the check — every step, managed, tracked, and optimized.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              <FeaturePill dark icon={Globe} title="Consumer Experience" desc="Branded landing page, guided submission form, personalized portal with real-time status tracking, and mobile-optimized uploads." />
              <FeaturePill dark icon={Cpu} title="Staff Command Center" desc="Role-based dashboard with full deal pipeline, appraisal workflows, document management, and one-click check requests." />
              <FeaturePill dark icon={Database} title="Enterprise Backend" desc="Encrypted storage, server-side RBAC, rate limiting, audit trails, and automated notifications via SMS and email." />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 7 — CUSTOMER EXPERIENCE ═══ */}
        <Section id="customer-exp" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "customer-exp"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="Consumer Experience" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Selling a Car<br />Should Feel <span className="text-primary">This Easy</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-2 gap-12 mt-14">
              <div className="space-y-8">
                {[
                  { icon: FileText, title: "Guided Multi-Step Intake", desc: "5-step intelligent form captures vehicle info, build details, condition & history, loan status, and contact — with real-time validation at every step." },
                  { icon: Eye, title: "Personal Customer Portal", desc: "Every customer gets a branded dashboard with a 7-stage progress tracker, completion checklist, next-step guidance, and direct dealer contact." },
                  { icon: Camera, title: "Mobile Photo Grid", desc: "6 mandatory photo categories (front, rear, both sides, dash, interior) with guided labels. Auto-marks complete when all photos are uploaded." },
                  { icon: CalendarDays, title: "Integrated Scheduling", desc: "One-click appointment booking pre-filled with their vehicle and contact info. Automated email & SMS confirmations to both customer and staff." },
                ].map((item, i) => (
                  <motion.div key={i} variants={fadeUp} custom={i + 2} className="flex gap-5">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div variants={scaleIn} custom={3} className="bg-gradient-to-br from-primary/5 via-primary/10 to-blue-500/5 border border-primary/15 rounded-3xl p-8 flex flex-col justify-center">
                <h3 className="text-xl font-bold mb-8">Customer Progress Tracker</h3>
                {[
                  { label: "Submission Received", done: true },
                  { label: "Under Review", done: true },
                  { label: "Initial Offer", done: true },
                  { label: "Inspection Scheduled", active: true },
                  { label: "Inspection Complete" },
                  { label: "Final Offer Accepted" },
                  { label: "Purchase Complete" },
                ].map((stage, i) => (
                  <div key={i} className="flex items-center gap-4 py-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      stage.done ? "bg-emerald-500 text-white" : stage.active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"
                    }`}>
                      {stage.done ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm ${stage.done ? "text-foreground font-medium" : stage.active ? "text-primary font-bold" : "text-muted-foreground"}`}>{stage.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 8 — EMPLOYEE EXPERIENCE ═══ */}
        <Section id="employee-exp" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "employee-exp"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Staff Experience" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Your Team Gets a<br /><span className="text-blue-400">Mission Control</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-14">
              Not a CRM add-on. A purpose-built command center designed for the direct-buy workflow from day one.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              <FeaturePill dark icon={BarChart3} title="Live Analytics" desc="Total leads, conversion rates, avg. pipeline days, active deals — real-time metrics that drive better decisions." />
              <FeaturePill dark icon={UserCheck} title="4-Tier RBAC" desc="Sales/BDC → Used Car Manager → GSM/GM → Admin. Server-enforced. No loopholes. No unauthorized actions." />
              <FeaturePill dark icon={DollarSign} title="Appraisal Attribution" desc="ACV entry restricted to managers. Auto-records appraiser name, initial, and title for full accountability." />
              <FeaturePill dark icon={FileText} title="Check Requests" desc="One-click formatted documents with customer details, agreed price, ACV, signature lines, and appended appraisals." />
              <FeaturePill dark icon={TrendingUp} title="10-Stage Pipeline" desc="New Lead → Customer Contacted → Inspection → Title → Ownership → Appraisal → Approval → Price Agreed → Purchase Complete." />
              <FeaturePill dark icon={Clock} title="Full Audit Trail" desc="Every status change, price update, and action logged with timestamp and attribution. Complete accountability." />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 9 — WORKFLOW ═══ */}
        <Section id="workflow" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "workflow"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="Automation" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-14 leading-tight">
              Intelligent Automation<br />at <span className="text-primary">Every Step</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-2 gap-6">
              {[
                { icon: "📱", title: "SMS & Email Alerts", desc: "Automatic appointment confirmations to customers and staff. No manual follow-up required." },
                { icon: "🔍", title: "Duplicate Detection", desc: "Phone and email matching instantly flags repeat submissions. No wasted effort on duplicates." },
                { icon: "🖨️", title: "Print-Ready Documents", desc: "Professional printouts of submissions, check requests, and appended appraisal files — one click." },
                { icon: "📎", title: "Secure Document Vault", desc: "Cloud storage for titles, registrations, Carfax, window stickers — all linked and accessible." },
                { icon: "⚡", title: "Pipeline Enforcement", desc: "Server-side triggers prevent unauthorized stage transitions. Only the right people make the right moves." },
                { icon: "📲", title: "QR Code Bridge", desc: "Every submission generates a unique QR for mobile uploads. Desktop to phone in one scan." },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeUp} custom={i + 2} className="flex gap-5 bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow">
                  <span className="text-3xl shrink-0">{item.icon}</span>
                  <div>
                    <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 10 — MOBILE ═══ */}
        <Section id="mobile" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "mobile"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
            <GlowBadge label="Mobile-First" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Designed for <span className="text-blue-400">Thumbs</span>,<br />Not Just Screens
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mx-auto mb-14">
              80% of car sellers start on their phone. Every pixel of this platform is optimized for mobile interaction — not retrofitted.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              <FeaturePill dark icon={Camera} title="Guided Photo Capture" desc="6-slot grid with category labels. Customers know exactly what to photograph — no guessing, no back-and-forth calls." />
              <FeaturePill dark icon={FileText} title="Document Scanning" desc="Title, registration, ID — upload directly from the phone camera into categorized slots. Automatically tracks completion." />
              <FeaturePill dark icon={Smartphone} title="Desktop ↔ Mobile Bridge" desc="QR codes on the desktop experience let customers seamlessly switch to their phone for photos and documents." />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 11 — SECURITY ═══ */}
        <Section id="security" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "security"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="Enterprise Security" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-14 leading-tight">
              Built Secure.<br /><span className="text-primary">Not Patched Later.</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Lock, title: "Role-Based Access Control", desc: "4-tier permission system enforced at the database level. Every action validated server-side. No client-side shortcuts." },
                { icon: Shield, title: "Anti-Spam & Rate Limiting", desc: "Honeypot fields, submission cooldowns, and database-level rate limits. 3 requests per email per hour. Bot-proof." },
                { icon: Database, title: "Encrypted Cloud Storage", desc: "All photos and documents in private buckets with time-limited signed URLs. No public access. No data leaks." },
                { icon: UserCheck, title: "Server-Side Validation", desc: "Email format, ZIP codes, mileage, VIN — all validated at the database level with constraints and triggers." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 2} className="bg-card border border-border rounded-2xl p-8 hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-lg text-foreground mb-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 12 — COMPARISON ═══ */}
        <Section id="comparison" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "comparison"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Feature Comparison" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-12 leading-tight">
              The <span className="text-blue-400">Definitive</span> Comparison
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-4 pb-4 border-b-2 border-white/10 mb-4">
                <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Capability</span>
                <span className="text-xs font-bold text-blue-400 text-center uppercase tracking-wider">Our Platform</span>
                <span className="text-xs font-bold text-white/40 text-center uppercase tracking-wider">Vendor Widgets</span>
              </div>
              {[
                ["100% dealer-branded experience", true, false],
                ["10-stage managed deal pipeline", true, false],
                ["Role-based staff permissions (4-tier)", true, false],
                ["In-house appraisal tracking & attribution", true, false],
                ["Check request document generation", true, false],
                ["Guided mobile photo uploads (6 categories)", true, false],
                ["Customer-facing status portal", true, false],
                ["Integrated appointment scheduling", true, false],
                ["SMS & email automated notifications", true, false],
                ["Full activity audit trail", true, false],
                ["Server-enforced pipeline stage gates", true, false],
                ["Print-ready office records", true, false],
                ["Basic lead capture form", true, true],
              ].map(([feature, us, them], i) => (
                <CompRow key={i} feature={feature as string} us={us as boolean} them={them as boolean} />
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 13 — TRACTION ═══ */}
        <Section id="traction" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "traction"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
            <LightBadge label="Built & Proven" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Not a Mockup.<br /><span className="text-primary">It's Live.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mx-auto mb-16">
              This isn't a pitch for something we're going to build. It's running in production today — processing real leads, real appraisals, and real purchases.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-4 gap-6">
              <MetricCard value={10} suffix="+" label="Pipeline stages managed" />
              <MetricCard value={4} label="Staff permission tiers" />
              <MetricCard value={6} label="Guided photo categories" />
              <MetricCard value={7} label="Customer progress stages" />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 14 — WHY US ═══ */}
        <Section id="why-us" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "why-us"}>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[140px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <GlowBadge label="Why Us" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-14 leading-tight">
              The <span className="text-blue-400">Unfair Advantage</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-4 gap-6">
              {[
                { icon: DollarSign, title: "Higher Margins", desc: "Acquire inventory at wholesale directly from consumers. Skip the auction. Skip the transportation. Keep the profit." },
                { icon: Zap, title: "Speed to Deal", desc: "From submission to check in hand — every step optimized. Less time per deal means more deals per month." },
                { icon: Award, title: "Your Brand", desc: "Not CarMax. Not a white-label vendor. YOUR dealership, YOUR relationship, YOUR customer experience. Full stop." },
                { icon: TrendingUp, title: "Market Moat", desc: "Be the only dealer in your market with a professional direct-buy platform. First-mover advantage that compounds." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 2} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:bg-white/8 transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto mb-6">
                    <item.icon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-lg text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 15 — CTA ═══ */}
        <Section id="cta" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cta"}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-[200px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0}>
              <img src={harteLogo} alt="Harte Auto Group" className="h-20 mx-auto brightness-0 invert opacity-80 mb-10" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-tight">
              Let's <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Transform</span><br />
              Your Dealership
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
              Custom-branded. Fully configured. Deployed in weeks, not months. Ready to compete with the biggest names in the industry.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="mailto:kenc@hartecars.com" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
                Get Started <ArrowRight className="w-5 h-5" />
              </a>
              <a href="tel:8668517390" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition">
                (866) 851-7390
              </a>
            </motion.div>
            <motion.p variants={fadeUp} custom={4} className="text-sm text-white/30 mt-10">
              kenc@hartecars.com · Harte Auto Group · Hartford, CT
            </motion.p>
          </motion.div>
        </Section>

      </AnimatePresence>
    </div>
  );
}
