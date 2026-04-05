import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ServiceDriveInlineContent from "@/components/pitch/ServiceDriveInlineContent";
import TradePitchInlineContent from "@/components/pitch/TradePitchInlineContent";
import OffStreetInlineContent from "@/components/pitch/OffStreetInlineContent";
import { motion, useInView } from "framer-motion";
import logoFallback from "@/assets/logo-placeholder.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import screenshotLanding from "@/assets/pitch/screenshot-landing.png";
import screenshotPortal from "@/assets/pitch/screenshot-portal.jpg";
import screenshotUploadMobile from "@/assets/pitch/screenshot-upload-mobile.jpg";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";
import {
  Car, Users, Shield, Zap, BarChart3, CheckCircle2, XCircle, Clock, DollarSign,
  Smartphone, FileText, Camera, UserCheck, Lock, TrendingUp, Award, ArrowRight,
  Globe, Layers, Eye, Target, Cpu, Database, ChevronDown, Handshake, ShieldCheck,
  ChevronUp, Repeat, MapPin, ArrowUpRight
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
      setDisplayed(Math.floor((1 - Math.pow(1 - progress, 3)) * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);
  return <span ref={ref} className={className}>{prefix}{displayed.toLocaleString()}{suffix}</span>;
}

/* ─── Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const } }),
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.1, duration: 0.6 } }),
};

/* ─── Reusable Components ─── */
function GlowBadge({ label, color = "blue" }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    red: "border-red-500/30 text-red-400 bg-red-500/10",
  };
  const dots: Record<string, string> = { blue: "bg-blue-400", amber: "bg-amber-400", emerald: "bg-emerald-400", red: "bg-red-400" };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border ${colors[color]} backdrop-blur-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[color]} animate-pulse`} />
      {label}
    </div>
  );
}

function BrowserFrame({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10 ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <span className="text-xs font-mono ml-2 text-white/30">{label}</span>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function PitchDeck() {
  const { config } = useSiteConfig();
  const [expandedChannel, setExpandedChannel] = useState<"off-street" | "service" | "trade" | null>(null);
  const channelRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const name = config.dealership_name || "AutoCurb";
    document.title = `End-to-End Inventory Acquisition | ${name}`;
    return () => { document.title = `Sell Your Car | ${name}`; };
  }, [config.dealership_name]);

  const handleChannelClick = useCallback((key: "off-street" | "service" | "trade") => {
    const isExpanding = expandedChannel !== key;
    setExpandedChannel(isExpanding ? key : null);
    if (isExpanding) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [expandedChannel]);

  const scrollToChannels = useCallback(() => {
    setExpandedChannel(null);
    setTimeout(() => {
      channelRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)] text-white">

      {/* ═══ 1 — HERO ═══ */}
      <section className="relative overflow-hidden px-6 py-24 md:py-36 text-center">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="mb-8">
            <img src={config.logo_white_url || config.logo_url || logoFallback} alt={config.dealership_name} className="h-32 md:h-48 mx-auto object-contain" />
          </motion.div>
          <motion.div variants={fadeUp} custom={0.5}>
            <GlowBadge label="End-to-End Acquisition Platform" />
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-8">
            Stop Buying Inventory<br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              the Expensive Way
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-14 leading-relaxed">
            A dealer-branded platform that acquires vehicles directly from consumers — from submission to check request. Three channels. One pipeline. Zero auction dependency.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
            {[
              { icon: Globe, label: "100% Your Brand" },
              { icon: Zap, label: "Submission → Check Request" },
              { icon: Layers, label: "3 Acquisition Channels" },
              { icon: TrendingUp, label: "~$2K Saved Per Unit" },
            ].map(({ icon: I, label }) => (
              <span key={label} className="flex items-center gap-2"><I className="w-4 h-4 text-blue-400" />{label}</span>
            ))}
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <span className="text-xs text-white/30 tracking-wider uppercase">Scroll</span>
          <ChevronDown className="w-4 h-4 text-white/30 animate-bounce" />
        </motion.div>
      </section>

      {/* ═══ 2 — THE PROBLEM ═══ */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Problem" color="red" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              Your Inventory Pipeline Is{" "}
              <span className="text-red-400">Bleeding Money</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16 leading-relaxed">
              Every auction buy costs $1,000–2,300 in fees and transport before you even recondition it. Meanwhile, your own customers are selling to Carvana. And the tools you have? They dump leads into email and call it a day.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6 mb-14">
              {[
                { icon: DollarSign, title: "Auction Dependency", stat: "$1K–2.3K", statLabel: "lost per unit", desc: "Auction fees ($500–1,500) + transport ($300–800) + recon surprises eat into already-compressed margins on every vehicle." },
                { icon: Users, title: "Losing Your Own Customers", stat: "70%", statLabel: "of trades lost", desc: "Your service customers — people who trust you — are selling to CarMax and Carvana because you don't make it easy." },
                { icon: XCircle, title: "Duct-Taped Workflows", stat: "0", statLabel: "pipeline stages", desc: "Generic vendor widgets dump leads into email. No tracking. No follow-up automation. No deal pipeline. Leads die in inboxes." },
              ].map(({ icon: I, title, stat, statLabel, desc }, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 3} className="rounded-2xl p-8 bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-5">
                    <I className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-black text-red-400">{stat}</span>
                    <span className="text-sm text-white/40 ml-2">{statLabel}</span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Auction vs Direct comparison */}
            <motion.div variants={fadeUp} custom={5} className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10 max-w-4xl mx-auto">
              <h3 className="text-xl font-bold mb-8 text-center">Cost Per Acquired Vehicle</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-red-400/70 mb-4">Auction Buy</div>
                  <div className="space-y-3">
                    {[
                      { label: "Auction fee", value: "$500–1,500" },
                      { label: "Transport", value: "$300–800" },
                      { label: "Recon surprises", value: "$200–500" },
                      { label: "Total added cost", value: "$1,000–2,800", bold: true },
                    ].map((row) => (
                      <div key={row.label} className={`flex justify-between text-sm ${row.bold ? "border-t border-red-500/20 pt-3 font-bold text-red-400" : "text-white/50"}`}>
                        <span>{row.label}</span><span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-emerald-400/70 mb-4">Direct from Consumer</div>
                  <div className="space-y-3">
                    {[
                      { label: "Auction fee", value: "$0" },
                      { label: "Transport", value: "$0" },
                      { label: "Known condition", value: "Photos + inspection" },
                      { label: "Total added cost", value: "~$0", bold: true },
                    ].map((row) => (
                      <div key={row.label} className={`flex justify-between text-sm ${row.bold ? "border-t border-emerald-500/20 pt-3 font-bold text-emerald-400" : "text-white/50"}`}>
                        <span>{row.label}</span><span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 3 — THE SOLUTION ═══ */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[140px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Solution" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              One Platform.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Submission to Check Request.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16 leading-relaxed">
              Not a widget. Not a form that dumps into email. A complete inventory acquisition system — branded to your dealership, managed by your team, scaled to your volume.
            </motion.p>

            {/* End-to-end pipeline */}
            <motion.div variants={fadeUp} custom={2} className="mb-16">
              <div className="flex flex-col md:flex-row items-stretch gap-3">
                {[
                  { icon: Globe, label: "Customer Lands", sub: "Dealer-branded page" },
                  { icon: Car, label: "Submits Vehicle", sub: "VIN decode + condition" },
                  { icon: DollarSign, label: "Gets Offer", sub: "Instant cash valuation" },
                  { icon: Camera, label: "Uploads Photos", sub: "Guided mobile capture" },
                  { icon: FileText, label: "Uploads Docs", sub: "Title, registration, ID" },
                  { icon: UserCheck, label: "Staff Appraises", sub: "Inspection + ACV" },
                  { icon: ShieldCheck, label: "Manager Approves", sub: "Pipeline gates" },
                  { icon: CheckCircle2, label: "Check Request", sub: "Print-ready, signed off" },
                ].map((step, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                      <step.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-xs font-bold text-white/80 mb-0.5">{step.label}</span>
                    <span className="text-[10px] text-white/40">{step.sub}</span>
                    {i < 7 && <ArrowRight className="w-3 h-3 text-white/15 mt-2 hidden md:block" />}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* vs Generic Widgets */}
            <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
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
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-blue-400" /></span>
                  This Platform
                </h3>
                <ul className="space-y-3">
                  {["100% branded to YOUR dealership", "Managed pipeline with 10+ stages", "Role-based permissions for every team member", "Customer portal with real-time status", "Guided photo & document collection", "Print-ready check requests & appraisals"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70 text-sm"><CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 4 — CUSTOMER JOURNEY ═══ */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Customer Experience" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              What Your Customer{" "}
              <span className="text-emerald-400">Actually Sees</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16 leading-relaxed">
              A premium, mobile-first experience that feels like selling to CarMax — but it's 100% your brand, your trust signals, and your relationship.
            </motion.p>

            {/* Screenshot + journey steps side by side */}
            <motion.div variants={fadeUp} custom={2} className="grid lg:grid-cols-2 gap-10 items-start mb-14">
              <div className="space-y-6">
                {[
                  { num: "01", title: "Land on your branded page", desc: "Your logo, your colors, your trust badges. Customers feel like they're dealing with you — not a third party.", icon: Globe },
                  { num: "02", title: "Enter VIN or plate — instant decode", desc: "17 characters auto-decodes year, make, model, trim. No dropdowns. No guessing. Takes 10 seconds.", icon: Car },
                  { num: "03", title: "Answer 5 condition questions", desc: "Guided flow asks about accidents, damage, mechanical issues, and keys. Clear checkboxes — no walls of text.", icon: Eye },
                  { num: "04", title: "Get an instant cash offer", desc: "Real-time valuation powered by Black Book data, adjusted for condition. 8-day price guarantee builds confidence.", icon: DollarSign },
                  { num: "05", title: "Upload photos from their phone", desc: "QR code launches mobile camera with silhouette overlays. Customers get consistent, usable photos on the first try.", icon: Camera },
                  { num: "06", title: "Track status in their portal", desc: "Customers see where their deal stands, what's next, and how to reach their appraiser — without calling the dealership.", icon: Smartphone },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <step.icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-400/60">{step.num}</span>
                        <h3 className="font-bold text-sm">{step.title}</h3>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <BrowserFrame label="Customer Landing Page">
                  <img src={screenshotLanding} alt="Dealer-branded customer landing page" className="w-full" />
                </BrowserFrame>
                <BrowserFrame label="Customer Portal — Offer & Status">
                  <img src={screenshotPortal} alt="Customer portal showing offer status" className="w-full" />
                </BrowserFrame>
              </div>
            </motion.div>

            {/* Mobile upload screenshot */}
            <motion.div variants={fadeUp} custom={4} className="max-w-sm mx-auto">
              <BrowserFrame label="Mobile Photo Upload">
                <img src={screenshotUploadMobile} alt="Mobile photo upload with camera overlays" className="w-full" />
              </BrowserFrame>
              <p className="text-xs text-white/30 text-center mt-3 italic">Camera overlays guide consistent, usable photos every time</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 5 — DEALER COMMAND CENTER ═══ */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Dealer Side" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              Your Team's{" "}
              <span className="text-blue-400">Command Center</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
              Every submission, every stage, every dollar — one dashboard. No switching between tools. No leads lost in email. Your team sees exactly what matters.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="mb-14">
              <BrowserFrame label="Admin Dashboard — Deal Pipeline">
                <a href="/admin" target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                  <img src={screenshotDashboard} alt="Admin dashboard with deal pipeline" className="w-full" />
                </a>
              </BrowserFrame>
            </motion.div>

            <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: BarChart3, title: "Full Deal Pipeline", desc: "10+ stages from New → Offer Sent → Accepted → Inspected → Check Requested. Every lead has a clear next action." },
                { icon: Cpu, title: "Interactive Offer Builder", desc: "Waterfall visualization with real-time sliders, profit spread gauge, and what-if scenarios for faster, smarter offers." },
                { icon: Eye, title: "AI Damage Detection", desc: "Every uploaded photo analyzed for dents, scratches, and paint damage. Condition scores auto-adjust before your team even looks." },
                { icon: Repeat, title: "Automated Follow-Ups", desc: "Multi-touch SMS and email sequences for cold leads. Configurable intervals. Leads don't die in inboxes anymore." },
                { icon: Lock, title: "Role-Based Permissions", desc: "BDC, Sales, Managers, Admin — each tier sees exactly what they need. Enforced at the database level, not just UI." },
                { icon: Target, title: "Inspection-to-Appraisal", desc: "Tire depths, brake measurements, and condition grades flow directly into the offer calculation. No re-keying data." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i * 0.3 + 4} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-400/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 6 — PLATFORM STRENGTHS ═══ */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Platform Strengths" color="amber" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-center">
              What Sets This{" "}
              <span className="text-amber-400">Apart</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto mb-14 text-center leading-relaxed">
              Other tools give you a widget. We give you the entire acquisition engine — from submission to check request — under your brand, on your domain.
            </motion.p>

            {/* 4 big differentiators */}
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {[
                { icon: DollarSign, title: "Higher Margins", desc: "Skip the auction. Acquire at wholesale directly from consumers — keep the $2K+ spread per unit." },
                { icon: Layers, title: "3 Channels, 1 Pipeline", desc: "Off-street, service drive, AND in-store trade — all feeding one dashboard with full deal tracking." },
                { icon: Award, title: "Your Brand, Your Domain", desc: "A standalone platform on YOUR domain, YOUR colors, YOUR emails. Customers think it's yours — because it is." },
                { icon: TrendingUp, title: "End-to-End, Not Just Leads", desc: "Submission → offer → acceptance → photos → docs → inspection → check request. Others hand you a lead and walk away." },
              ].map((item, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 3} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center hover:border-amber-400/30 transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                    <item.icon className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Competitive comparison */}
            <motion.div variants={fadeUp} custom={5} className="overflow-x-auto">
              <table className="w-full max-w-4xl mx-auto text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-white/40 font-medium uppercase text-xs tracking-wider">Capability</th>
                    <th className="text-center py-4 px-4"><span className="text-blue-400 font-bold text-base">AutoCurb</span></th>
                    <th className="text-center py-4 px-4"><span className="text-white/40 font-medium">AutoHub</span></th>
                    <th className="text-center py-4 px-4"><span className="text-white/40 font-medium">KBB ICO / TradePending</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Off-Street Direct Purchase", us: true, them: false, others: false },
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
                    { feature: "Referral Program Built-In", us: true, them: false, others: false },
                    { feature: "Automated Email Sequences", us: true, them: false, others: false },
                    { feature: "Condition & Inspection Tools", us: true, them: "partial", others: false },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white/70">{row.feature}</td>
                      <td className="py-3 px-4 text-center"><CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" /></td>
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

            <motion.div variants={fadeUp} custom={6} className="mt-10 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All features live in production — not a roadmap
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 7 — THREE CHANNELS ═══ */}
      <section ref={channelRef} className="px-6 py-20 md:py-28 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="3 Acquisition Channels" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-center">
              Three Ways to{" "}
              <span className="text-blue-400">Acquire Inventory</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto mb-14 text-center leading-relaxed">
              One platform, three channels — all feeding the same pipeline and managed from the same dashboard.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              {([
                { key: "off-street" as const, icon: Car, title: "Off Street", desc: "Consumers sell their car to you from home — no trade required. Your branded landing page, VIN decode, instant offer, photo upload, and deal pipeline.", color: "blue", stats: "Largest volume channel" },
                { key: "service" as const, icon: Layers, title: "Service Drive", desc: "A subtle link in every service appointment SMS. Customers raise their own hand — no pressure, no awkward pitch. Seeds planted over years of visits.", color: "emerald", stats: "Highest-quality leads" },
                { key: "trade" as const, icon: Handshake, title: "In-Store Trade", desc: "Shoppers at your lot submit their trade info before they arrive or after they leave. Tagged to their salesperson — BDC knows not to call.", color: "amber", stats: "Recovers stalled deals" },
              ] as const).map(({ key, icon: I, title, desc, color, stats }) => {
                const isExpanded = expandedChannel === key;
                const colorMap: Record<string, string> = {
                  blue: "border-blue-400/50 bg-blue-500/15 ring-2 ring-blue-400/30",
                  emerald: "border-emerald-400/50 bg-emerald-500/15 ring-2 ring-emerald-400/30",
                  amber: "border-amber-400/50 bg-amber-500/15 ring-2 ring-amber-400/30",
                };
                const iconColorMap: Record<string, string> = {
                  blue: "bg-blue-500/20 text-blue-400",
                  emerald: "bg-emerald-500/20 text-emerald-400",
                  amber: "bg-amber-500/20 text-amber-400",
                };
                const textColorMap: Record<string, string> = { blue: "text-blue-400", emerald: "text-emerald-400", amber: "text-amber-400" };
                return (
                  <button
                    key={key}
                    onClick={() => handleChannelClick(key)}
                    className={`group rounded-2xl border backdrop-blur-sm p-8 text-left transition-all duration-300 cursor-pointer ${
                      isExpanded ? colorMap[color] : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${iconColorMap[color]}`}>
                      <I className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed mb-4">{desc}</p>
                    <span className={`text-xs font-bold uppercase tracking-wider ${textColorMap[color]}`}>{stats}</span>
                    <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${textColorMap[color]}`}>
                      {isExpanded ? "Collapse" : "Deep Dive"} <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Expanded channel content */}
      <div ref={expandedRef}>
        {expandedChannel === "off-street" && <OffStreetInlineContent onBackToTop={scrollToChannels} />}
        {expandedChannel === "service" && <ServiceDriveInlineContent onBackToTop={scrollToChannels} />}
        {expandedChannel === "trade" && <TradePitchInlineContent onBackToTop={scrollToChannels} />}
      </div>

      {/* ═══ 8 — BOTTOM LINE ═══ */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Bottom Line" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight text-center">
              What This Means for{" "}
              <span className="text-emerald-400">Your P&L</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto mb-16 text-center leading-relaxed">
              Carvana sources 31% of inventory directly from consumers. CarMax sources 87%. Every unit you acquire direct saves ~$2,000 in auction fees, transport, and recon.
            </motion.p>

            {/* ROI tiers */}
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-8 mb-14">
              {[
                { size: "Small Dealer", units: "~50 used/mo", direct: "~16 direct", monthly: "$32K", annual: "$384K", highlight: false },
                { size: "Mid-Size Dealer", units: "~150 used/mo", direct: "~47 direct", monthly: "$94K", annual: "$1.13M", highlight: true },
                { size: "High-Volume Group", units: "~400 used/mo", direct: "~124 direct", monthly: "$248K", annual: "$2.98M", highlight: false },
              ].map((tier, i) => (
                <motion.div key={i} variants={scaleIn} custom={i + 3} className={`rounded-2xl p-8 text-center ${tier.highlight ? "bg-emerald-500/10 border-2 border-emerald-500/30 relative" : "bg-white/5 border border-white/10"}`}>
                  {tier.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full tracking-wider uppercase">Most Common</span>}
                  <h3 className="text-xl font-black mb-1">{tier.size}</h3>
                  <p className="text-sm text-white/40 mb-4">{tier.units}</p>
                  <p className="text-sm text-white/50 mb-6">31% = <strong className="text-white/80">{tier.direct}</strong>/mo × $2K saved</p>
                  <div className="border-t border-white/10 pt-4">
                    <span className="text-xs text-white/40 block mb-1">Monthly savings</span>
                    <span className="text-xl font-black text-emerald-400 block mb-3">{tier.monthly}/mo</span>
                    <div className="bg-white/5 rounded-xl p-4">
                      <span className="text-3xl font-black text-emerald-400 block">{tier.annual}</span>
                      <span className="text-xs text-white/40">Additional annual profit</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Scale note */}
            <motion.div variants={fadeUp} custom={5} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: 3, suffix: "", label: "Acquisition channels" },
                { value: 10, suffix: "+", label: "Pipeline stages" },
                { value: 100, suffix: "%", label: "Dealer-branded" },
                { value: 0, suffix: "", label: "Manual lead capture steps" },
              ].map((m, i) => (
                <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10 text-center">
                  <AnimatedNumber value={m.value} suffix={m.suffix} className="text-4xl font-black text-blue-400" />
                  <p className="text-sm text-white/50 mt-2">{m.label}</p>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeUp} custom={6} className="text-[10px] text-white/25 text-center mt-8 max-w-3xl mx-auto">
              Based on Carvana's 31% consumer-sourced ratio (Q3 2019) · $2,000 avg savings/unit · CarMax acquires 87% from consumers (FY26 10-Q)
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ═══ 9 — CTA ═══ */}
      <section className="px-6 py-24 md:py-36 relative text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-[200px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative max-w-4xl mx-auto">
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-tight">
            Ready to{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Own</span>
            <br />Your Acquisition?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Custom-branded. Fully configured. See it live on your brand in 48 hours. No obligation.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="tel:2035095054" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
              Schedule a Demo <ArrowRight className="w-5 h-5" />
            </a>
            <a href="tel:2035095054" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition">
              (203) 509-5054
            </a>
          </motion.div>
          <motion.div variants={fadeUp} custom={3} className="mt-10">
            <p className="text-sm text-white/30">
              <a href="tel:2035095054" className="hover:text-white/50 transition">(203) 509-5054</a> · <a href="mailto:kenc@hartecars.com" className="hover:text-white/50 transition">kenc@hartecars.com</a>
            </p>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
