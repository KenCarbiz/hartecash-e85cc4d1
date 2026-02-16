import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import harteLogo from "@/assets/harte-logo.png";
import screenshotLanding from "@/assets/pitch/screenshot-landing.jpg";
import screenshotPortal from "@/assets/pitch/screenshot-portal.jpg";
import screenshotUploadMobile from "@/assets/pitch/screenshot-upload-mobile.jpg";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";
import {
  Car, Users, Shield, Zap, BarChart3, ChevronRight, ChevronLeft,
  Maximize2, Minimize2, CheckCircle2, XCircle, Clock, DollarSign,
  Smartphone, FileText, Camera, CalendarDays, UserCheck, Lock,
  TrendingUp, Award, ArrowRight, Globe, Layers, Eye, Star,
  Target, Cpu, Database, ArrowUpRight, ChevronDown, Upload,
  ClipboardCheck, Printer, MessageSquare, Search, Inbox,
  BadgeDollarSign, Handshake, PartyPopper, CircleDot,
  ShieldCheck, MousePointerClick, Send, Phone, Mail,
  CreditCard, KeyRound, MapPin, AlertCircle, LayoutDashboard
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
  "cust-walk-1", "cust-walk-2", "cust-walk-3",
  "emp-walk-1", "emp-walk-2", "emp-walk-3",
  "workflow", "mobile", "security",
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

/* ─── Walkthrough Step ─── */
function WalkStep({ number, icon: Icon, title, desc, detail, dark }: {
  number: number; icon: any; title: string; desc: string; detail?: string; dark?: boolean;
}) {
  return (
    <div className={`flex gap-5 ${dark ? "" : ""}`}>
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${dark ? "bg-blue-500/20 text-blue-400" : "bg-primary/10 text-primary"}`}>
          {number}
        </div>
        <div className={`w-0.5 flex-1 mt-2 ${dark ? "bg-white/10" : "bg-border"}`} />
      </div>
      <div className="pb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`w-4 h-4 ${dark ? "text-blue-400" : "text-primary"}`} />
          <h3 className={`font-bold text-lg ${dark ? "text-white" : "text-foreground"}`}>{title}</h3>
        </div>
        <p className={`text-sm leading-relaxed mb-2 ${dark ? "text-white/60" : "text-muted-foreground"}`}>{desc}</p>
        {detail && (
          <div className={`text-xs px-3 py-2 rounded-lg inline-block ${dark ? "bg-white/5 text-white/40 border border-white/10" : "bg-muted text-muted-foreground border border-border"}`}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Mockup Frame ─── */
function MockupFrame({ title, dark, children }: { title: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl overflow-hidden border ${dark ? "border-white/10 bg-white/5" : "border-border bg-card shadow-lg"}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dark ? "border-white/10 bg-white/5" : "border-border bg-muted/50"}`}>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <span className={`text-xs font-mono ml-2 ${dark ? "text-white/30" : "text-muted-foreground"}`}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
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

      {/* ── Scroll indicator ── */}
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

        {/* ═══ 2 — MARKET ═══ */}
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

        {/* ═══ 3 — PROBLEM ═══ */}
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
            <motion.div variants={fadeUp} custom={3} className="mt-14 flex items-center justify-center gap-3 text-white/30 text-sm">
              <ArrowRight className="w-4 h-4" />
              <span>Let's walk through exactly what your <strong className="text-white/60">customers</strong> and <strong className="text-white/60">employees</strong> will see</span>
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════
            CUSTOMER WALKTHROUGH — 3 SLIDES
        ═══════════════════════════════════════════════════════════════ */}

        {/* ═══ 7 — CUSTOMER WALK 1: Landing & Form ═══ */}
        <Section id="cust-walk-1" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cust-walk-1"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <LightBadge label="Customer Walkthrough" />
              <span className="text-xs font-mono text-muted-foreground mb-8 inline-block">1 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Step 1: <span className="text-primary">Discover & Submit</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-muted-foreground max-w-3xl mb-12">
              A customer lands on your dealer-branded page. No third-party logos. No CarMax. Just YOUR dealership offering to buy their car — with a professional, guided experience.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-2 gap-10">
              {/* Left: Step-by-step walkthrough */}
              <div>
                <WalkStep number={1} icon={Globe} title="Branded Landing Page"
                  desc="Customer sees a hero section with your dealership logo, trust badges (BBB, Google Reviews), and a clear 'Get Your Cash Offer' call-to-action."
                  detail="🎯 100% your brand — no competing logos, no third-party affiliations"
                />
                <WalkStep number={2} icon={Car} title="Step 1: Vehicle Info"
                  desc="They enter Year, Make, Model — or paste a VIN for instant auto-decode. The form validates every field in real time."
                  detail="🔎 VIN decoder auto-fills Year, Make, Model instantly"
                />
                <WalkStep number={3} icon={Layers} title="Steps 2–3: Build & Condition"
                  desc="Drivetrain, color, moonroof, keys, tire condition, accident history, mechanical/cosmetic issues — all guided checkboxes. No free-text guessing."
                  detail="✅ Every question is mandatory — no half-complete submissions"
                />
                <WalkStep number={4} icon={Send} title="Steps 4–5: Details & Submit"
                  desc="Contact info, loan status (Paid Off / Has Loan / Lease), and a final review. One tap to submit. They immediately receive a confirmation with a link to their personal portal."
                  detail="📧 Instant email confirmation with unique portal link"
                />
              </div>

              {/* Right: Screenshot of the form */}
              <motion.div variants={scaleIn} custom={2}>
                <div className="rounded-2xl overflow-hidden border border-border shadow-2xl">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-muted-foreground">hartecash.com</span>
                  </div>
                  <img src={screenshotLanding} alt="Landing page with vehicle submission form" className="w-full" />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3 italic">Live screenshot — this is what your customers see</p>
              </motion.div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 8 — CUSTOMER WALK 2: Portal & Tracking ═══ */}
        <Section id="cust-walk-2" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cust-walk-2"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <GlowBadge label="Customer Walkthrough" />
              <span className="text-xs font-mono text-white/30 mb-8 inline-block">2 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Step 2: <span className="text-blue-400">Their Personal Portal</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-white/50 max-w-3xl mb-12">
              After submitting, every customer gets a dedicated portal — a branded dashboard they can return to anytime. No login required. Just their unique link.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-2 gap-10">
              {/* Left: Screenshot of portal */}
              <motion.div variants={scaleIn} custom={1.5}>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">hartecash.com/my-submission/...</span>
                  </div>
                  <img src={screenshotPortal} alt="Customer portal with offer and progress tracker" className="w-full" />
                </div>
                <p className="text-xs text-white/30 text-center mt-3 italic">Live screenshot — personalized customer portal</p>
              </motion.div>

              {/* Right: Step breakdown */}
              <div>
                <WalkStep number={1} icon={Eye} title="Personalized Dashboard" dark
                  desc="The customer is greeted by name — 'Welcome back, Sarah!' — with their vehicle prominently displayed. It feels personal, not transactional."
                  detail="👤 Name, vehicle, and progress all personalized"
                />
                <WalkStep number={2} icon={BadgeDollarSign} title="Cash Offer Front & Center" dark
                  desc="Once your team enters an offer, it appears as a bold card: '$24,500.00'. The customer can print it. It updates in real-time as negotiations progress."
                  detail="🖨️ One-click print of the offer for their records"
                />
                <WalkStep number={3} icon={CircleDot} title="7-Stage Progress Tracker" dark
                  desc="Animated progress bar shows exactly where they stand: Received → Review → Offer → Inspection → Verified → Agreed → Complete. No guessing, no phone calls asking 'what's the status?'"
                  detail="📊 Each stage has custom icons, animations, and helper text"
                />
                <WalkStep number={4} icon={ClipboardCheck} title="Smart 'What's Next' Card" dark
                  desc="Dynamically guides the customer: 'Upload photos' → 'Upload documents' → 'Schedule your visit'. Priorities shift automatically as they complete each step."
                  detail="🧠 Intelligent — always shows the most important next action"
                />
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 9 — CUSTOMER WALK 3: Photos, Docs, Schedule ═══ */}
        <Section id="cust-walk-3" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cust-walk-3"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <LightBadge label="Customer Walkthrough" />
              <span className="text-xs font-mono text-muted-foreground mb-8 inline-block">3 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Step 3: <span className="text-primary">Upload, Schedule & Close</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-muted-foreground max-w-3xl mb-12">
              The customer completes everything from their phone — photos, documents, and scheduling — without ever calling the dealership.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-3 gap-8">
              {/* Photo Upload - Real Screenshot */}
              <motion.div variants={scaleIn} custom={1}>
                <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-muted-foreground">📸 Vehicle Photos</span>
                  </div>
                  <img src={screenshotUploadMobile} alt="Mobile photo upload interface with 6 guided categories" className="w-full" />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2 italic">Live mobile screenshot</p>
              </motion.div>

              {/* Document Upload */}
              <motion.div variants={scaleIn} custom={2}>
                <MockupFrame title="📄 Documents">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Required documents with guided slots:</p>
                    <div className="space-y-2">
                      {[
                        { name: "Driver's License", done: true },
                        { name: "Registration", done: true },
                        { name: "Title (Front)", done: false },
                        { name: "Title (Back)", done: false },
                      ].map((doc) => (
                        <div key={doc.name} className={`flex items-center gap-3 p-2.5 rounded-lg border ${doc.done ? "border-emerald-400/30 bg-emerald-500/5" : "border-border bg-muted/30"}`}>
                          {doc.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Upload className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                          <span className={`text-xs ${doc.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{doc.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2 text-center">
                      📱 QR code on desktop → opens phone camera instantly
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>

              {/* Schedule Visit */}
              <motion.div variants={scaleIn} custom={3}>
                <MockupFrame title="📅 Schedule Visit">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Pre-filled appointment booking:</p>
                    <div className="space-y-2">
                      {[
                        { label: "Vehicle", value: "2021 Honda Accord" },
                        { label: "Name", value: "Sarah Johnson" },
                        { label: "Email", value: "sarah@email.com" },
                        { label: "Phone", value: "(860) 555-1234" },
                      ].map((field) => (
                        <div key={field.label} className="bg-muted/50 rounded-lg p-2.5 border border-border">
                          <span className="text-[10px] text-muted-foreground block">{field.label}</span>
                          <span className="text-xs text-foreground font-medium">{field.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-primary text-primary-foreground rounded-lg py-2.5 text-center font-bold text-xs">
                      Confirm Appointment →
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center">
                      📧 + 📱 Auto-sends email & SMS confirmation
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>
            </motion.div>

            {/* Additional context */}
            <motion.div variants={fadeUp} custom={4} className="mt-12 grid md:grid-cols-3 gap-6">
              {[
                { icon: Phone, title: "Zero Phone Calls", desc: "Everything the customer needs is in the portal. No 'call us for status.' No phone tag." },
                { icon: KeyRound, title: "No Login Required", desc: "Customers access their portal via unique token link. No password, no account, no friction." },
                { icon: MapPin, title: "What to Bring Card", desc: "Portal shows exactly what to bring: ID, registration, title, all keys. No surprises at the dealership." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 5} className="flex gap-4 bg-card border border-border rounded-xl p-5">
                  <item.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════
            EMPLOYEE WALKTHROUGH — 3 SLIDES
        ═══════════════════════════════════════════════════════════════ */}

        {/* ═══ 10 — EMPLOYEE WALK 1: Dashboard & Pipeline ═══ */}
        <Section id="emp-walk-1" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "emp-walk-1"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <GlowBadge label="Employee Walkthrough" />
              <span className="text-xs font-mono text-white/30 mb-8 inline-block">1 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              What Your <span className="text-blue-400">Team Sees</span>: Command Center
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-white/50 max-w-3xl mb-12">
              Your employees log in and see a purpose-built dashboard — not a repurposed CRM. Every lead, every stage, every action in one view.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-2 gap-10">
              {/* Left: Dashboard screenshot */}
              <motion.div variants={scaleIn} custom={1.5}>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">hartecash.com/admin</span>
                  </div>
                  <img src={screenshotDashboard} alt="Admin dashboard with leads table and analytics" className="w-full" />
                </div>
                <p className="text-xs text-white/30 text-center mt-3 italic">Live screenshot — admin command center</p>
              </motion.div>

              {/* Right: Steps */}
              <div>
                <WalkStep number={1} icon={LayoutDashboard} title="Real-Time Analytics Bar" dark
                  desc="Total leads, weekly intake, offers made, deals closed — live numbers updated with every status change. Your team knows the pulse of the operation instantly."
                  detail="📊 Sortable, filterable, and searchable by any field"
                />
                <WalkStep number={2} icon={Search} title="Lead Table with Smart Filters" dark
                  desc="Every submission in a sortable table. Filter by status, search by name/phone/vehicle, and click any row to open the full detail modal."
                  detail="🔍 Instant search across name, email, phone, vehicle, and VIN"
                />
                <WalkStep number={3} icon={TrendingUp} title="10-Stage Deal Pipeline" dark
                  desc="New Lead → Contacted → Offer Made → Inspection Scheduled → Inspection Complete → Title Verified → Ownership Verified → Appraisal → Approval → Purchase Complete. Each stage enforced server-side."
                  detail="🔒 Pipeline gates prevent unauthorized status transitions"
                />
                <WalkStep number={4} icon={AlertCircle} title="Dead Lead Tracking" dark
                  desc="Leads that go cold are marked 'Dead Lead' with red visual styling — keeping your pipeline clean while preserving the data for future re-engagement."
                  detail="💀 Red-flagged with distinct styling so they don't clutter active deals"
                />
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 11 — EMPLOYEE WALK 2: Appraisal & Check Request ═══ */}
        <Section id="emp-walk-2" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "emp-walk-2"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <LightBadge label="Employee Walkthrough" />
              <span className="text-xs font-mono text-muted-foreground mb-8 inline-block">2 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              The Money Moves: <span className="text-primary">Appraisal & Checkout</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-muted-foreground max-w-3xl mb-12">
              This is where deals get done. Your managers appraise, approve, and generate check requests — all within the same interface.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-2 gap-10">
              {/* Left: Steps */}
              <div>
                <WalkStep number={1} icon={DollarSign} title="Cash Offer Entry"
                  desc="Sales or Used Car Manager enters the initial cash offer. It instantly appears on the customer's portal. The customer gets notified and can view/print it immediately."
                  detail="💰 Offer visible to customer in real-time, no phone call needed"
                />
                <WalkStep number={2} icon={ClipboardCheck} title="In-House ACV (Actual Cash Value)"
                  desc="Only managers (Used Car Manager, GSM/GM, Admin) can enter the ACV. The system auto-records WHO appraised it: 'John S. — Used Car Manager'. Full accountability."
                  detail="🔐 Restricted to management roles only — enforced at database level"
                />
                <WalkStep number={3} icon={ShieldCheck} title="Manager Approval Gate"
                  desc="The pipeline can't advance to 'Manager Approval' or 'Purchase Complete' without a GSM/GM or Admin signing off. Server-side triggers enforce this — no workarounds."
                  detail="⛔ Server-side trigger rejects unauthorized transitions"
                />
                <WalkStep number={4} icon={Printer} title="One-Click Check Request"
                  desc="Generates a professional printout: customer name, address, agreed price, ACV, description ('Customer Direct Inventory Purchase'), GSM and Accounting signature lines, and appended appraisal documents."
                  detail="🖨️ Formatted for immediate accounting processing"
                />
              </div>

              {/* Right: Check request mockup */}
              <motion.div variants={scaleIn} custom={2} className="space-y-6">
                <MockupFrame title="Check Request — Print Preview">
                  <div className="space-y-4 text-foreground">
                    <div className="text-center border-b border-border pb-3">
                      <div className="font-black text-lg">CHECK REQUEST</div>
                      <div className="text-xs text-muted-foreground">Harte Auto Group</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <div className="font-bold">Sarah Johnson</div>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Date:</span>
                        <div className="font-bold">02/16/2026</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vehicle:</span>
                        <div className="font-bold">2021 Honda Accord</div>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Hartford, CT 06120</span>
                      </div>
                    </div>
                    <div className="border border-border rounded-lg p-3 text-xs">
                      <span className="text-muted-foreground">Description:</span>
                      <div className="font-medium mt-1">Customer Direct Inventory Purchase</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-lg p-3 text-center">
                        <span className="text-[10px] text-muted-foreground block">Check Amount</span>
                        <span className="text-xl font-black text-emerald-600">$24,500.00</span>
                      </div>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                        <span className="text-[10px] text-muted-foreground block">In-House ACV</span>
                        <span className="text-xl font-black text-primary">$26,200.00</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                      <div className="text-center">
                        <div className="border-b border-foreground/30 w-full mb-1 h-6" />
                        <span className="text-[10px] text-muted-foreground">GSM / GM Signature</span>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-foreground/30 w-full mb-1 h-6" />
                        <span className="text-[10px] text-muted-foreground">Accounting Signature</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground text-center">
                      Appraised by: John S. — Used Car Manager
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 12 — EMPLOYEE WALK 3: Docs, Staff, Roles ═══ */}
        <Section id="emp-walk-3" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "emp-walk-3"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <GlowBadge label="Employee Walkthrough" />
              <span className="text-xs font-mono text-white/30 mb-8 inline-block">3 of 3</span>
            </div>
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-5xl font-black mb-4 leading-tight">
              Full Control: <span className="text-blue-400">Docs, Roles & Oversight</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={0.5} className="text-lg text-white/50 max-w-3xl mb-12">
              Internal document management, staff permissions, and complete audit trails — everything a GM needs to run the operation with confidence.
            </motion.p>

            <motion.div variants={fadeUp} custom={1} className="grid lg:grid-cols-3 gap-8">
              {/* Document Management */}
              <motion.div variants={scaleIn} custom={1}>
                <MockupFrame title="📁 Internal Documents" dark>
                  <div className="space-y-3">
                    <p className="text-[10px] text-white/40 mb-2">Staff-only document types:</p>
                    <div className="space-y-2">
                      {[
                        { name: "Appraisal Report", tag: "Staff Only", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                        { name: "Carfax Report", tag: "Staff Only", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                        { name: "Window Sticker", tag: "If Available", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
                        { name: "Customer Title", tag: "Customer", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                        { name: "Registration", tag: "Customer", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                      ].map((doc) => (
                        <div key={doc.name} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                          <span className="text-xs text-white/70">{doc.name}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${doc.color}`}>{doc.tag}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/30 text-center mt-2">
                      Appraisal auto-appends to Check Request printout
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>

              {/* Role Management */}
              <motion.div variants={scaleIn} custom={2}>
                <MockupFrame title="👥 Staff Management" dark>
                  <div className="space-y-3">
                    <p className="text-[10px] text-white/40 mb-2">4-tier role hierarchy:</p>
                    <div className="space-y-2">
                      {[
                        { role: "Admin", desc: "Full access, staff management", icon: "🔑" },
                        { role: "GSM / GM", desc: "Approve deals, set prices", icon: "👔" },
                        { role: "Used Car Manager", desc: "Appraisals, ACV entry", icon: "🚗" },
                        { role: "Sales / BDC", desc: "Contact leads, update status", icon: "📞" },
                      ].map((r) => (
                        <div key={r.role} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/5 border border-white/10">
                          <span className="text-sm">{r.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-white/80">{r.role}</div>
                            <div className="text-[10px] text-white/40">{r.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/30 text-center">
                      🔒 All enforced at the database level
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>

              {/* Audit Trail */}
              <motion.div variants={scaleIn} custom={3}>
                <MockupFrame title="📋 Activity Log" dark>
                  <div className="space-y-3">
                    <p className="text-[10px] text-white/40 mb-2">Every action, logged:</p>
                    <div className="space-y-2">
                      {[
                        { time: "2:34 PM", action: "Status → Offer Made", by: "Mike R.", byRole: "Sales" },
                        { time: "2:35 PM", action: "Offer: $24,500", by: "Mike R.", byRole: "Sales" },
                        { time: "3:12 PM", action: "ACV: $26,200", by: "John S.", byRole: "UCM" },
                        { time: "3:15 PM", action: "Status → Approved", by: "Karen T.", byRole: "GSM" },
                        { time: "3:18 PM", action: "Check Request Done", by: "Karen T.", byRole: "GSM" },
                      ].map((log, i) => (
                        <div key={i} className="flex gap-2 text-[10px] p-2 rounded bg-white/5 border border-white/5">
                          <span className="text-white/30 font-mono shrink-0">{log.time}</span>
                          <span className="text-white/60 flex-1">{log.action}</span>
                          <span className="text-blue-400 shrink-0">{log.by}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/30 text-center">
                      Full timestamp, user, and before/after values
                    </div>
                  </div>
                </MockupFrame>
              </motion.div>
            </motion.div>

            {/* Bottom callouts */}
            <motion.div variants={fadeUp} custom={4} className="mt-12 grid md:grid-cols-3 gap-6">
              {[
                { icon: MessageSquare, title: "Appointment Management", desc: "View scheduled dates, reschedule, and see appointment status — all within the lead detail modal." },
                { icon: Users, title: "Staff Onboarding", desc: "Add new team members, assign roles, and remove access. The admin sees everyone, controls everything." },
                { icon: Mail, title: "Auto-Notifications", desc: "SMS and email confirmations fire automatically for appointments. Staff gets notified. Customer gets notified. No manual follow-up." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 5} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-5">
                  <item.icon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">{item.title}</h4>
                    <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════
            REMAINING SLIDES (unchanged content)
        ═══════════════════════════════════════════════════════════════ */}

        {/* ═══ 13 — WORKFLOW ═══ */}
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

        {/* ═══ 14 — MOBILE ═══ */}
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

        {/* ═══ 15 — SECURITY ═══ */}
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

        {/* ═══ 16 — COMPARISON ═══ */}
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

        {/* ═══ 17 — TRACTION ═══ */}
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

        {/* ═══ 18 — WHY US ═══ */}
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

        {/* ═══ 19 — CTA ═══ */}
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
              <a href="tel:2035095054" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
                (203) 509-5054 <ArrowRight className="w-5 h-5" />
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
