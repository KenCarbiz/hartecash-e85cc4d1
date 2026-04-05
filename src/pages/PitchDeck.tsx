import { useState, useEffect, useCallback, useRef } from "react";
import ServiceDriveInlineContent from "@/components/pitch/ServiceDriveInlineContent";
import TradePitchInlineContent from "@/components/pitch/TradePitchInlineContent";
import { motion, AnimatePresence, useInView } from "framer-motion";
import logoFallback from "@/assets/logo-placeholder.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import screenshotLanding from "@/assets/pitch/screenshot-landing.png";
import screenshotPortal from "@/assets/pitch/screenshot-portal.jpg";
import screenshotUploadMobile from "@/assets/pitch/screenshot-upload-mobile.jpg";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";
import {
  Car, Users, Shield, Zap, BarChart3, ChevronRight, ChevronLeft,
  Maximize2, Minimize2, CheckCircle2, XCircle, Clock, DollarSign,
  Smartphone, FileText, Camera, UserCheck, Lock,
  TrendingUp, Award, ArrowRight, Globe, Layers, Eye,
  Target, Cpu, Database, ArrowUpRight, ChevronDown,
  Handshake, ShieldCheck,
  ChevronUp, Repeat, MapPin
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
  "hero", "market", "problem", "solution", "platform",
  "screenshots", "scale", "roi", "why-us", "cta",
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
function MetricCard({ value, prefix, suffix, label, dark, citation }: { value: number; prefix?: string; suffix?: string; label: string; dark?: boolean; citation?: string }) {
  return (
    <div className={`rounded-2xl p-8 text-center ${dark ? "bg-white/5 border border-white/10 backdrop-blur-sm" : "bg-card border border-border shadow-sm"}`}>
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} className={`text-5xl md:text-6xl font-black ${dark ? "text-blue-400" : "text-primary"}`} />
      <p className={`text-sm mt-3 ${dark ? "text-white/60" : "text-muted-foreground"}`}>{label}</p>
      {citation && <p className={`text-[10px] mt-2 ${dark ? "text-white/30" : "text-muted-foreground/60"}`}>📎 {citation}</p>}
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

/* ─── Acquisition Channel Card ─── */
function ChannelCard({ icon: Icon, title, desc, active, iconColor, onClick }: { icon: any; title: string; desc: string; active?: boolean; iconColor: string; onClick?: () => void }) {
  const activeColor = iconColor.includes("blue") ? "border-blue-400/50 bg-blue-500/15 ring-2 ring-blue-400/30"
    : iconColor.includes("emerald") ? "border-emerald-400/50 bg-emerald-500/15 ring-2 ring-emerald-400/30"
    : "border-amber-400/50 bg-amber-500/15 ring-2 ring-amber-400/30";
  const hoverColor = iconColor.includes("blue") ? "hover:border-blue-400/50 hover:bg-blue-500/10"
    : iconColor.includes("emerald") ? "hover:border-emerald-400/50 hover:bg-emerald-500/10"
    : "hover:border-amber-400/50 hover:bg-amber-500/10";
  const dotColor = iconColor.includes("blue") ? "bg-blue-400"
    : iconColor.includes("emerald") ? "bg-emerald-400"
    : "bg-amber-400";
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-2xl border backdrop-blur-sm p-8 text-left transition-all duration-300 cursor-pointer ${
        active ? activeColor : `border-white/10 bg-white/5 ${hoverColor}`
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform ${iconColor}`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
      {active && <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />}
    </button>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function PitchDeck() {
  const { config } = useSiteConfig();
  const [activeProng, setActiveProng] = useState<"off-street" | "service" | "trade">("off-street");
  const heroRef = useRef<HTMLDivElement>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [idx, setIdx] = useState(0);
  const current = SLIDES[idx];

  const next = useCallback(() => setIdx(i => Math.min(i + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
    setActiveProng("off-street");
  }, []);

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
    const dealerName = config.dealership_name || "AutoCurb";
    const ogTags: Record<string, string> = {
      "og:title": `End-to-End Inventory Acquisition | ${dealerName}`,
      "og:description": "A dealer-branded platform that captures, manages, and converts direct consumer vehicle purchases — from submission to check request.",
      "og:image": `${window.location.origin}/og-pitch.jpg`,
      "og:url": `${window.location.origin}/pitch`,
      "twitter:title": `End-to-End Inventory Acquisition | ${dealerName}`,
      "twitter:description": "A dealer-branded platform for direct consumer vehicle purchases that scales with your business.",
      "twitter:image": `${window.location.origin}/og-pitch.jpg`,
    };
    const originals: Record<string, string | null> = {};
    Object.entries(ogTags).forEach(([prop, content]) => {
      const isOg = prop.startsWith("og:");
      const selector = isOg ? `meta[property="${prop}"]` : `meta[name="${prop}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      originals[prop] = el?.getAttribute("content") ?? null;
      if (!el) {
        el = document.createElement("meta");
        if (isOg) el.setAttribute("property", prop);
        else el.setAttribute("name", prop);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    });
    document.title = `End-to-End Inventory Acquisition | ${dealerName}`;
    return () => {
      Object.entries(originals).forEach(([prop, original]) => {
        const isOg = prop.startsWith("og:");
        const selector = isOg ? `meta[property="${prop}"]` : `meta[name="${prop}"]`;
        const el = document.querySelector(selector) as HTMLMetaElement | null;
        if (el && original !== null) el.setAttribute("content", original);
        else if (el && original === null) el.remove();
      });
      document.title = `Sell Your Car - Get Cash Offer in 2 Minutes | ${dealerName}`;
    };
  }, [config.dealership_name]);

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
          <div ref={heroRef} className="absolute top-0 left-0" />
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <img src={config.logo_white_url || config.logo_url || logoFallback} alt={config.dealership_name} className="h-40 md:h-60 mx-auto object-contain" />
            </motion.div>
            <motion.div variants={fadeUp} custom={0.5}>
              <GlowBadge label="End-to-End Platform" />
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-8">
              Acquire Inventory<br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                Directly from Consumers
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-14 leading-relaxed">
              One dealer-branded platform — from the moment a consumer considers selling to the moment accounting cuts the check. Three acquisition channels. Zero auction dependency.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40 mb-16">
              {[
                { icon: Globe, label: "100% Your Brand" },
                { icon: Zap, label: "Submission to Check Request" },
                { icon: BarChart3, label: "Full Deal Pipeline" },
                { icon: TrendingUp, label: "Scales With You" },
              ].map(({ icon: I, label }) => (
                <span key={label} className="flex items-center gap-2">
                  <I className="w-4 h-4 text-blue-400" />{label}
                </span>
              ))}
            </motion.div>

            {/* ── 3-Prong Selector ── */}
            <motion.div variants={fadeUp} custom={4} className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              <ChannelCard
                icon={Car}
                title="Off Street"
                desc="Direct consumer acquisition — customers sell their car to you from home, no trade required."
                active={activeProng === "off-street"}
                iconColor="bg-blue-500/20 text-blue-400"
                onClick={() => {
                  setActiveProng("off-street");
                  const el = document.getElementById("market");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              />
              <ChannelCard
                icon={Layers}
                title="Service Drive"
                desc="Capture vehicles from customers already in your service lane — a goldmine of trade opportunities."
                active={activeProng === "service"}
                iconColor="bg-emerald-500/20 text-emerald-400"
                onClick={() => {
                  setActiveProng("service");
                  setTimeout(() => {
                    const el = document.getElementById("prong-content");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
              />
              <ChannelCard
                icon={Handshake}
                title="In-Store Trade"
                desc="Shoppers at your lot submit their trade info before they arrive or after they leave."
                active={activeProng === "trade"}
                iconColor="bg-amber-500/20 text-amber-400"
                onClick={() => {
                  setActiveProng("trade");
                  setTimeout(() => {
                    const el = document.getElementById("prong-content");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
              />
            </motion.div>
          </motion.div>
        </Section>

        {/* ── Inline Prong Content ── */}
        <div id="prong-content">
          {activeProng === "service" && (
            <ServiceDriveInlineContent onBackToTop={scrollToHero} />
          )}
          {activeProng === "trade" && (
            <TradePitchInlineContent onBackToTop={scrollToHero} />
          )}
        </div>

        {/* ── Off Street Content ── */}
        {activeProng === "off-street" && (
        <>

        {/* ═══ 2 — MARKET ═══ */}
        <Section id="market" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "market"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Opportunity" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              <span className="text-blue-400">40 Million</span> Used Cars<br />Change Hands Every Year
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-16">
              CarMax and Carvana proved consumers will sell online. But they have zero relationship with your customer. You have trust, service history, and local presence — you just need the platform.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard value={40} suffix="M" label="Used vehicles sold annually" dark citation="Cox Automotive 2024" />
              <MetricCard value={73} suffix="%" label="Prefer more steps online" dark citation="CarGurus 2025" />
              <MetricCard value={2000} prefix="$" label="Saved per unit vs. auction" dark citation="Avg auction + transport fees" />
              <MetricCard value={1528} prefix="$" label="Current avg used PVR" dark citation="Haig Report Q3 2025" />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 3 — PROBLEM ═══ */}
        <Section id="problem" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "problem"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="The Problem" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              You're Buying Inventory<br />the <span className="text-destructive">Expensive Way</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-2xl mb-14">
              Every auction buy costs you $1,000–2,300 in fees and transport before you even recondition it. Meanwhile, your own service customers are selling to Carvana.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-8">
              {[
                { icon: "💸", title: "Auction Dependency", desc: "$500–1,500 in auction fees plus $300–800 transport per unit — eating into already-compressed margins." },
                { icon: "🚪", title: "Losing Your Own Customers", desc: "Your service customers — people who trust you — are selling to CarMax because you don't make it easy." },
                { icon: "🧩", title: "Duct-Taped Workflows", desc: "Generic vendor widgets dump leads into email. No pipeline. No tracking. No workflow. Leads die in inboxes." },
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

        {/* ═══ 4 — SOLUTION ═══ */}
        <Section id="solution" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "solution"}>
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[140px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
            <GlowBadge label="The Solution" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              One Platform.<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Submission to Check Request.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16">
              Not a widget. Not a form that dumps into email. A complete inventory acquisition system — branded to your dealership, managed by your team, scaled to your volume.
            </motion.p>

            {/* End-to-end flow */}
            <motion.div variants={fadeUp} custom={2} className="mb-16">
              <div className="flex flex-col md:flex-row items-stretch gap-3">
                {[
                  { icon: Globe, label: "Customer Lands", sub: "Dealer-branded page" },
                  { icon: Car, label: "Submits Vehicle", sub: "VIN decode + condition" },
                  { icon: DollarSign, label: "Gets Offer", sub: "Instant cash valuation" },
                  { icon: Camera, label: "Uploads Photos", sub: "Guided mobile capture" },
                  { icon: FileText, label: "Uploads Docs", sub: "Title, registration, ID" },
                  { icon: UserCheck, label: "Staff Appraises", sub: "Inspection + ACV" },
                  { icon: ShieldCheck, label: "Manager Approves", sub: "Pipeline-enforced gates" },
                  { icon: CheckCircle2, label: "Check Request", sub: "Print-ready, signed off" },
                ].map((step, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                      <step.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-xs font-bold text-white/80 mb-0.5">{step.label}</span>
                    <span className="text-[10px] text-white/40">{step.sub}</span>
                    {i < 7 && <ArrowRight className="w-3 h-3 text-white/15 mt-2 hidden md:block rotate-0" />}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Key differentiators grid */}
            <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-400" /></span>
                  Generic Vendor Widgets
                </h3>
                <ul className="space-y-3">
                  {["Same form on 10,000 dealer sites", "Leads dump into email inbox", "No deal pipeline or stages", "No staff roles or permissions", "No customer portal or tracking", "No document collection flow"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/60 text-sm"><XCircle className="w-4 h-4 text-red-400/60 mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-blue-500/5 border border-blue-400/20 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-blue-400" /></span>
                  This Platform
                </h3>
                <ul className="space-y-3">
                  {["100% branded to YOUR dealership", "Managed deal pipeline with 10+ stages", "Role-based permissions for every team member", "Customer portal with real-time status", "Guided photo & document collection", "Print-ready check requests & appraisals"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70 text-sm"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 5 — PLATFORM CAPABILITIES ═══ */}
        <Section id="platform" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "platform"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <LightBadge label="Built to Run Your Operation" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Everything You Need.<br /><span className="text-primary">Nothing You Don't.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-3xl mb-14">
              Every feature exists to move inventory from consumer to your lot faster, cheaper, and more profitably.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Eye, title: "AI Damage Detection", desc: "Every uploaded photo analyzed for dents, scratches, and paint damage — condition scores auto-adjust before your team even looks." },
                { icon: Camera, title: "Guided Photo & Doc Capture", desc: "Camera overlays show customers exactly what to photograph. Mobile-optimized upload flows with category slots and completion tracking." },
                { icon: Cpu, title: "Interactive Offer Builder", desc: "Waterfall visualization with real-time sliders, profit spread gauge, and what-if scenarios — so your managers make faster, smarter offers." },
                { icon: BarChart3, title: "Executive KPI Dashboard", desc: "Conversion funnels, pipeline value, trend analysis, and per-appraiser performance — the numbers a GM actually needs." },
                { icon: Repeat, title: "Automated Follow-Up Engine", desc: "Multi-touch SMS and email sequences for cold leads. Configurable intervals per touch. Leads don't die in inboxes anymore." },
                { icon: MapPin, title: "Smart Store Assignment", desc: "Leads auto-route to the right location by ZIP code, OEM brand match, or buying center rules. Multi-rooftop ready from day one." },
                { icon: Lock, title: "Enterprise-Grade Security", desc: "Role-based access enforced at the database level. Encrypted storage, audit trails, rate limiting. Built secure — not patched later." },
                { icon: Smartphone, title: "Mobile Inspection Sync", desc: "Technicians complete inspections on mobile — tire depths, brake measurements, and condition grades sync back to desktop instantly." },
                { icon: Target, title: "Inspection-to-Appraisal Pipeline", desc: "Completed inspection findings feed directly into the offer calculation — tire adjustments, recon costs, and condition grades auto-applied." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i * 0.3 + 3} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-base text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} custom={6} className="mt-10 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-600 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All features live in production — not a roadmap
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 6 — SCREENSHOTS ═══ */}
        <Section id="screenshots" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "screenshots"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="See It Live" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight text-center">
              Your Brand.<br /><span className="text-blue-400">Their Experience.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mx-auto mb-14 text-center">
              From consumer-facing landing page to staff command center — every screen, fully branded.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10 mb-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">Customer Landing Page</span>
                  </div>
                  <img src={screenshotLanding} alt="Dealer-branded customer landing page" className="w-full" />
                </div>
                <p className="text-xs text-white/30 text-center italic">Consumer experience — your brand, your trust signals</p>
              </div>
              <div>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10 mb-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">Staff Command Center</span>
                  </div>
                  <a href="/admin" target="_blank" rel="noopener noreferrer">
                    <img src={screenshotDashboard} alt="Admin dashboard with deal pipeline" className="w-full hover:opacity-90 transition-opacity" />
                  </a>
                </div>
                <p className="text-xs text-white/30 text-center italic">Staff dashboard — every lead, every stage, one view</p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">Customer Portal</span>
                  </div>
                  <img src={screenshotPortal} alt="Customer status portal showing offer and next steps" className="w-full" />
                </div>
                <p className="text-xs text-white/30 text-center italic">Customer portal — real-time status, offer details, next steps</p>
              </div>
              <div>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/60" />
                      <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                    </div>
                    <span className="text-xs font-mono ml-2 text-white/30">Mobile Photo Upload</span>
                  </div>
                  <img src={screenshotUploadMobile} alt="Mobile-optimized photo upload with camera overlays" className="w-full" />
                </div>
                <p className="text-xs text-white/30 text-center italic">Mobile capture — camera overlays guide consistent photos</p>
              </div>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 7 — SCALE ═══ */}
        <Section id="scale" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "scale"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
            <LightBadge label="Built to Scale" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              One Rooftop or Twenty.<br /><span className="text-primary">Same Platform.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-muted-foreground max-w-3xl mx-auto mb-14">
              Whether you're a single-point dealer doing 50 units a month or a multi-rooftop group doing 400 — this platform grows with you. Add locations, add staff, add channels. The system handles the complexity.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
              {[
                { icon: MapPin, title: "Multi-Location", desc: "Smart lead routing by ZIP, brand, or buying center. Each location sees their leads — GMs see everything." },
                { icon: Users, title: "Unlimited Staff", desc: "Add team members with role-based permissions. BDC, Sales, Managers, Admin — each tier sees what they need." },
                { icon: Layers, title: "3 Acquisition Channels", desc: "Off-street, service drive, and in-store trade — all feeding the same pipeline. One dashboard to manage it all." },
                { icon: Database, title: "Enterprise Infrastructure", desc: "Encrypted storage, server-side RBAC, audit trails, rate limiting. Built for real dealership volume." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 3}>
                  <FeaturePill icon={item.icon} title={item.title} desc={item.desc} />
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} custom={5} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard value={3} label="Acquisition channels" />
              <MetricCard value={10} suffix="+" label="Pipeline stages" />
              <MetricCard value={100} suffix="%" label="Dealer-branded" />
              <MetricCard value={0} label="Manual steps to capture a lead" />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 8 — ROI ═══ */}
        <Section id="roi" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "roi"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Math" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Shift 31% to Direct —<br /><span className="text-blue-400">Here's Your Upside</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16 leading-relaxed">
              Carvana sources 31% of inventory directly from consumers. CarMax sources 87%. Every unit you acquire direct saves ~$2,000 in auction fees, transport, and recon.
            </motion.p>

            {/* Savings per unit */}
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6 mb-14">
              {[
                { amount: "$500–1,500", label: "Auction Fee Eliminated" },
                { amount: "$300–800", label: "Transport Eliminated" },
                { amount: "$200–500", label: "Lower Recon Costs" },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <span className="text-2xl font-black text-blue-400 block mb-2">{item.amount}</span>
                  <span className="text-sm text-white/50">{item.label}</span>
                </div>
              ))}
            </motion.div>

            {/* ROI by dealer size */}
            <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-3 gap-8">
              {[
                { size: "Small Dealer", units: "~50 used/mo", direct: "~16 direct", monthly: "$32K/mo", annual: "$384K", highlight: false },
                { size: "Mid-Size Dealer", units: "~150 used/mo", direct: "~47 direct", monthly: "$94K/mo", annual: "$1.13M", highlight: true },
                { size: "High-Volume Group", units: "~400 used/mo", direct: "~124 direct", monthly: "$248K/mo", annual: "$2.98M", highlight: false },
              ].map((tier, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 4} className={`rounded-2xl p-8 text-center ${tier.highlight ? "bg-blue-500/10 border-2 border-blue-500/30 relative" : "bg-white/5 border border-white/10"}`}>
                  {tier.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-full tracking-wider uppercase">Most Common</span>}
                  <h3 className="text-xl font-black text-white mb-1">{tier.size}</h3>
                  <p className="text-sm text-white/40 mb-4">{tier.units}</p>
                  <p className="text-sm text-white/50 mb-6">31% = <strong className="text-white/80">{tier.direct}</strong>/mo × $2K saved</p>
                  <div className="border-t border-white/10 pt-4">
                    <span className="text-xs text-white/40 block mb-1">Monthly savings</span>
                    <span className="text-xl font-black text-blue-400 block mb-3">{tier.monthly}</span>
                    <div className="bg-white/5 rounded-xl p-4">
                      <span className="text-3xl font-black text-emerald-400 block">{tier.annual}</span>
                      <span className="text-xs text-white/40">Additional annual profit</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.p variants={fadeUp} custom={7} className="text-[10px] text-white/25 text-center mt-8 max-w-3xl mx-auto">
              Based on Carvana's 31% consumer-sourced ratio (Q3 2019) · $2,000 avg savings/unit · CarMax acquires 87% from consumers (FY26 10-Q)
            </motion.p>
          </motion.div>
        </Section>

        {/* ═══ 9 — WHY US ═══ */}
        <Section id="why-us" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "why-us"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="text-center mb-16">
              <GlowBadge label="Why This Platform" />
              <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                Your <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Unfair Advantage</span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto leading-relaxed">
                Other tools give you a widget. We give you the entire acquisition engine — from submission to check request — under your brand, on your domain.
              </motion.p>
            </div>

            {/* Competitive comparison table */}
            <motion.div variants={fadeUp} custom={2} className="mb-16 overflow-x-auto">
              <table className="w-full max-w-4xl mx-auto text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-white/40 font-medium uppercase text-xs tracking-wider">Capability</th>
                    <th className="text-center py-4 px-4">
                      <span className="text-blue-400 font-bold text-base">AutoCurb</span>
                    </th>
                    <th className="text-center py-4 px-4">
                      <span className="text-white/40 font-medium">AutoHub</span>
                    </th>
                    <th className="text-center py-4 px-4">
                      <span className="text-white/40 font-medium">KBB ICO / TradePending</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Off-Street Direct Purchase Channel", us: true, them: false, others: false },
                    { feature: "Service Drive Acquisition", us: true, them: true, others: false },
                    { feature: "In-Store Trade Capture", us: true, them: false, others: false },
                    { feature: "Full Deal Pipeline (Submit → Check)", us: true, them: false, others: false },
                    { feature: "Customer Portal & Offer Acceptance", us: true, them: false, others: false },
                    { feature: "Photo Upload with Camera Guides", us: true, them: false, others: false },
                    { feature: "Document Upload (DL, Title, Reg)", us: true, them: false, others: false },
                    { feature: "AI Damage Detection", us: true, them: false, others: false },
                    { feature: "Appointment Scheduling & Reminders", us: true, them: false, others: false },
                    { feature: "Custom Domain & Full White-Label", us: true, them: "partial", others: false },
                    { feature: "Multi-Location Smart Routing", us: true, them: false, others: false },
                    { feature: "Configurable Pricing Engine", us: true, them: true, others: "partial" },
                    { feature: "Dynamic Banners & Marketing Links", us: true, them: true, others: "partial" },
                    { feature: "AI Copilot / Messaging System", us: false, them: true, others: false },
                    { feature: "Referral Program Built-In", us: true, them: false, others: false },
                    { feature: "Transactional Email Sequences", us: true, them: false, others: false },
                    { feature: "Condition & Inspection Tools", us: true, them: "partial", others: false },
                    { feature: "DMS Integration", us: false, them: true, others: false },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white/70">{row.feature}</td>
                      <td className="py-3 px-4 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.them === true ? <CheckCircle2 className="w-5 h-5 text-white/30 mx-auto" /> :
                         row.them === "partial" ? <span className="text-xs text-yellow-400/70">Partial</span> :
                         <XCircle className="w-5 h-5 text-white/15 mx-auto" />}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.others === true ? <CheckCircle2 className="w-5 h-5 text-white/30 mx-auto" /> :
                         row.others === "partial" ? <span className="text-xs text-yellow-400/70">Partial</span> :
                         <XCircle className="w-5 h-5 text-white/15 mx-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {/* Differentiator cards */}
            <motion.div variants={fadeUp} custom={3} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: DollarSign, title: "Higher Margins", desc: "Skip the auction, transport, and recon surprises. Acquire at wholesale directly from consumers — keep the $2K+ spread per unit." },
                { icon: Layers, title: "3 Channels, 1 Pipeline", desc: "Others give you a trade widget. We give you off-street, service drive, AND in-store trade — all feeding one dashboard with full deal tracking." },
                { icon: Award, title: "Your Brand, Your Domain", desc: "Not a modal widget on your site. A standalone platform on YOUR domain, YOUR colors, YOUR emails. Customers think it's yours — because it is." },
                { icon: TrendingUp, title: "End-to-End, Not Just Leads", desc: "Competitors hand you a lead and walk away. We manage submission → offer → acceptance → photos → docs → inspection → check request." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 4} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-blue-400/30 transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
                    <item.icon className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-lg text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 10 — CTA ═══ */}
        <Section id="cta" dark isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cta"}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-[200px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0} className="mb-10" />
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-tight">
              Ready to <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Own</span><br />
              Your Acquisition?
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
              Custom-branded. Fully configured. See it live on your brand in 48 hours. No obligation.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="tel:2035095054" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
                Schedule a Demo <ArrowRight className="w-5 h-5" />
              </a>
              <a href="tel:2035095054" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition">
                (203) 509-5054
              </a>
            </motion.div>
            <motion.div variants={fadeUp} custom={4} className="mt-10 flex flex-col items-center gap-2">
              <p className="text-sm text-white/30">
                <a href="tel:2035095054" className="hover:text-white/50 transition">(203) 509-5054</a> · <a href="mailto:kenc@hartecars.com" className="hover:text-white/50 transition">kenc@hartecars.com</a>
              </p>
            </motion.div>
          </motion.div>
        </Section>

        {/* ── Back to Channels ── */}
        <section className="bg-[hsl(220,25%,6%)] px-6 py-16 text-center border-t border-white/5">
          <button
            onClick={scrollToHero}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/20 text-white font-bold text-lg hover:bg-white/5 transition-colors"
          >
            <ChevronUp className="w-5 h-5" /> Back to All Three Channels
          </button>
        </section>
        </>
        )}

      </AnimatePresence>
    </div>
  );
}
