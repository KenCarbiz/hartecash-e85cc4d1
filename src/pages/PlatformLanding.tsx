import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import autocurbLogo from "@/assets/autocurb-logo.png";
import autocurbLogoWhite from "@/assets/autocurb-logo-white.png";
import autocurbLogoMain from "@/assets/autocurb-logo-main.png";
import autocurbLogoDark from "@/assets/autocurb-logo-dark.png";
import screenshotLanding from "@/assets/pitch/screenshot-landing.png";
import screenshotPortal from "@/assets/pitch/screenshot-portal.jpg";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";
import screenshotUploadMobile from "@/assets/pitch/screenshot-upload-mobile-phone.png";
import {
  Car, Users, Shield, Zap, BarChart3, CheckCircle2, DollarSign,
  Smartphone, Camera, Globe, Layers, Eye, Target, Cpu, Lock,
  TrendingUp, Award, ArrowRight, MapPin, Repeat, FileText,
  UserCheck, ShieldCheck, ChevronDown,
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

/* ─── Shared Components ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const } }),
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.1, duration: 0.6 } }),
};

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
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-blue-600/30 text-blue-600 bg-blue-600/5">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
      {label}
    </div>
  );
}

function Section({ dark, children, className = "", id }: { dark?: boolean; children: React.ReactNode; className?: string; id?: string }) {
  const bg = dark ? "bg-[hsl(220,25%,6%)] text-white" : "bg-white text-gray-900";
  return (
    <section id={id} className={`min-h-screen flex items-center justify-center ${bg} ${className} relative overflow-hidden`}>
      {dark && (
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(210 100% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 100% 60%) 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
      )}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 md:py-28">
        {children}
      </div>
    </section>
  );
}

/* ─── Screenshot Browser Frame ─── */
function BrowserFrame({ label, children, dark = true }: { label: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`rounded-2xl overflow-hidden border ${dark ? "border-white/10 shadow-2xl shadow-blue-500/10" : "border-gray-200 shadow-xl"} mb-3`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${dark ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"}`}>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <span className={`text-xs font-mono ml-2 ${dark ? "text-white/30" : "text-gray-400"}`}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function PlatformLanding() {
  useEffect(() => {
    document.title = "AutoCurb.io — Dealer Inventory Acquisition Platform";
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220,25%,6%)]">

      {/* ── Sticky Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(220,25%,6%)]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={autocurbLogoMain} alt="AutoCurb.io" className="h-10 object-contain" />
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#platform" className="hover:text-white transition">Platform</a>
            <a href="#screenshots" className="hover:text-white transition">Product</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#roi" className="hover:text-white transition">ROI</a>
          </div>
          <a href="#cta" className="h-9 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-blue-500 transition">
            Get a Demo <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* ═══ 1 — HERO ═══ */}
      <Section dark>
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        <motion.div initial="hidden" animate="visible" className="text-center relative pt-16">
          <motion.div variants={fadeUp} custom={0.5}>
            <GlowBadge label="Dealer Inventory Acquisition Platform" />
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-8">
            Stop Buying Inventory<br />
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              at Auction
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-3xl mx-auto mb-14 leading-relaxed">
            AutoCurb gives your dealership a fully branded, end-to-end platform to acquire vehicles directly from consumers. Three acquisition channels. One dashboard. Zero auction dependency.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="#cta" className="inline-flex items-center gap-3 h-14 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
              Schedule a Demo <ArrowRight className="w-5 h-5" />
            </a>
            <a href="#screenshots" className="inline-flex items-center gap-3 h-14 px-10 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition">
              See It Live
            </a>
          </motion.div>
          <motion.div variants={fadeUp} custom={4} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
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
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <span className="text-xs text-white/30 uppercase tracking-wider">Scroll</span>
          <ChevronDown className="w-4 h-4 text-white/30 animate-bounce" />
        </motion.div>
      </Section>

      {/* ═══ 2 — THE PROBLEM ═══ */}
      <Section dark>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <GlowBadge label="The Problem" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-8 leading-tight">
            Acquiring Used Inventory<br />Is <span className="text-red-400">Broken</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
            Every dealer knows the pain. Auction lanes are drying up, transport costs are climbing, and the vehicles you win often arrive with surprises your recon budget didn't plan for. Meanwhile, consumers are selling 40 million used cars a year — mostly to each other, to Carvana, or to CarMax. Your customers. Your market. Someone else's platform.
          </motion.p>

          {/* Pain points */}
          <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {[
              { emoji: "🔨", title: "Auction Dependency", desc: "You're competing against 200 other buyers for the same unit. Fees, transport, and arbitration eat your margin before you even start recon." },
              { emoji: "🚛", title: "Transport & Timing", desc: "Win a car at 10 AM, see it in 10 days. $300–800 in transport costs, plus lot rot while it waits for detail and photos." },
              { emoji: "🔧", title: "Recon Surprises", desc: "Auction condition reports miss half the damage. You budget $800 in recon and spend $2,200. PVR disappears on the lift." },
              { emoji: "📉", title: "Shrinking Supply", desc: "Lease returns are down. New-car incentives push trades to franchise stores. Independent and used-car-heavy dealers fight over scraps." },
            ].map((pain, i) => (
              <motion.div key={i} variants={scaleIn} custom={i + 3} className="bg-red-500/5 border border-red-500/15 rounded-2xl p-6">
                <span className="text-3xl mb-3 block">{pain.emoji}</span>
                <h3 className="font-bold text-white text-base mb-2">{pain.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{pain.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* The shift */}
          <motion.div variants={fadeUp} custom={5} className="rounded-3xl bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4">The market already shifted.</h3>
                <p className="text-white/50 leading-relaxed mb-6">
                  CarMax and Carvana proved consumers <em>will</em> sell their car online. But they don't have your local trust, your service history, or your relationship. You have every advantage — you just don't have the platform. <strong className="text-white/80">Until now.</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 40, suffix: "M", label: "Used cars sold annually", cite: "Cox Automotive 2024" },
                  { value: 73, suffix: "%", label: "Want more steps online", cite: "CarGurus 2025" },
                  { value: 2000, prefix: "$", label: "Saved per unit vs. auction", cite: "Avg fees + transport" },
                  { value: 1528, prefix: "$", label: "Current avg used PVR", cite: "Haig Report Q3 2025" },
                ].map((m, i) => (
                  <div key={i} className="rounded-xl p-5 text-center bg-white/5 border border-white/10">
                    <AnimatedNumber value={m.value} prefix={m.prefix} suffix={m.suffix} className="text-3xl md:text-4xl font-black text-blue-400" />
                    <p className="text-xs mt-2 text-white/50">{m.label}</p>
                    <p className="text-[9px] mt-1 text-white/25">📎 {m.cite}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 3 — THREE CHANNELS (Pitch-style) ═══ */}
      <Section>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <LightBadge label="Three Acquisition Channels" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-4 leading-tight">
            Capture Inventory<br />From <span className="text-blue-600">Every Direction</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-gray-500 max-w-3xl mb-16">
            One platform, three ways to acquire — all feeding the same pipeline, managed from one dashboard.
          </motion.p>

          {/* Channel 1 — Off-Street */}
          <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-10 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 text-blue-600 text-xs font-bold tracking-widest uppercase mb-4">
                <Globe className="w-3.5 h-3.5" /> Channel 1
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Off-Street Acquisitions</h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                Consumers sell their car to you from home — no trade required. Your fully branded landing page generates instant cash offers, collects vehicle details, and feeds leads directly into your pipeline. Digital-first customers who never planned to visit a dealership.
              </p>
              <ul className="space-y-3">
                {["Branded landing page with your logo, colors & domain", "Instant offer powered by Black Book + your pricing rules", "Guided mobile photo & document upload", "Automated SMS/email follow-up sequences", "Zero auction fees — acquire direct from consumer"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl p-8 border border-blue-200/50">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "2 min", label: "Avg. time to offer" },
                  { value: "38%", label: "Conversion rate" },
                  { value: "$0", label: "Auction fees" },
                  { value: "24/7", label: "Lead capture" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-sm">
                    <div className="text-2xl font-black text-blue-600">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Channel 2 — Service Drive */}
          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 gap-10 items-center mb-20">
            <div className="md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600/10 text-emerald-600 text-xs font-bold tracking-widest uppercase mb-4">
                <Layers className="w-3.5 h-3.5" /> Channel 2
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Service Drive Capture</h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                Your highest-quality inventory source. Customers already in your service lane get a personalized offer for their vehicle. Known service history, verified mileage, existing trust — these are the units your used car manager dreams about.
              </p>
              <ul className="space-y-3">
                {["Service advisor sends branded link via SMS during visit", "VIN or plate auto-decodes — no manual entry", "Factory options auto-detected from Black Book data", "Offer displayed before customer leaves the lane", "10DLC compliant messaging built in"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:order-1 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl p-8 border border-emerald-200/50">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "85%", label: "Known service history" },
                  { value: "3x", label: "Higher close rate" },
                  { value: "$800+", label: "Lower recon cost" },
                  { value: "1 click", label: "Advisor sends offer" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-sm">
                    <div className="text-2xl font-black text-emerald-600">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Channel 3 — In-Store Trade */}
          <motion.div variants={fadeUp} custom={4} className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/10 text-amber-600 text-xs font-bold tracking-widest uppercase mb-4">
                <Users className="w-3.5 h-3.5" /> Channel 3
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">In-Store Trade-Ins</h3>
              <p className="text-gray-500 leading-relaxed mb-6">
                Shoppers submit their trade info before they arrive — or after they leave without buying. Pre-appraised before they walk in, re-engaged if they walk out. Every ups customer becomes a potential inventory source.
              </p>
              <ul className="space-y-3">
                {["Customer fills trade details on their own phone in the showroom", "Pre-arrival submissions speed up the desk process", "Walk-aways get automatic follow-up with updated offers", "Salesperson attribution tracks who sourced the unit", "Feeds the same pipeline as off-street and service drive"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl p-8 border border-amber-200/50">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "100%", label: "Pre-appraised arrivals" },
                  { value: "45%", label: "Walk-away re-engagement" },
                  { value: "12 min", label: "Saved at the desk" },
                  { value: "1 link", label: "Text-to-trade" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-sm">
                    <div className="text-2xl font-black text-amber-600">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 3B — BRAND YOUR EXPERIENCE ═══ */}
      <Section dark>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <GlowBadge label="Your Brand, Not Ours" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            It's <span className="text-blue-400">Your</span> Platform.<br />We Just Power It.
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
            Unlike third-party lead providers that plaster their logo everywhere and train your customers to go somewhere else next time, AutoCurb is invisible. Your customers never know we exist. Every touchpoint — from the first landing page to the final check request — looks, feels, and <em>is</em> yours.
          </motion.p>

          <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6 mb-14">
            {[
              { icon: Globe, title: "Your Domain", desc: "sellmycar.yourdealership.com — a URL your customers trust. No 'powered by' watermarks, no third-party branding anywhere." },
              { icon: Award, title: "Your Colors & Logo", desc: "Primary color, accent color, logo, favicon — every pixel matches your dealership identity. Dark mode, light mode, your call." },
              { icon: Smartphone, title: "Your SMS & Email", desc: "Offer notifications, follow-up sequences, appointment confirmations — all sent from your name, your number, your templates." },
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} custom={i + 3} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-bold text-lg text-white mb-3">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} custom={5} className="grid md:grid-cols-2 gap-6">
            {[
              { icon: Lock, title: "Customer Data Stays Yours", desc: "Every lead, every phone number, every email address — stored in your database. We don't resell leads, we don't market to your customers, we don't build a competing dataset." },
              { icon: Users, title: "Customers Build Loyalty to You", desc: "When a consumer sells their car through your branded platform and has a great experience, they come back to YOU next time — not to a marketplace that sells them to five other dealers." },
              { icon: Shield, title: "No Lead Sharing, Ever", desc: "Your off-street leads aren't shared with competing dealers. Your service drive captures aren't cross-sold. Your data is yours. Period." },
              { icon: Target, title: "Multi-Location, One Brand", desc: "Five rooftops? Ten? Each location gets its own pipeline, assignment rules, and staff — but all under your single brand umbrella with one unified dashboard." },
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} custom={i + 6} className="flex gap-5 bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </Section>

      <Section dark id="platform">
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[140px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
          <GlowBadge label="End-to-End" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Submission to<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Check Request.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16">
            Not a widget. Not a form that dumps into email. A complete inventory acquisition system — branded to your dealership, managed by your team.
          </motion.p>
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
                  {i < 7 && <ArrowRight className="w-3 h-3 text-white/15 mt-2 hidden md:block" />}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Capabilities grid */}
          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Eye, title: "AI Damage Detection", desc: "Every photo analyzed for dents, scratches, paint damage — condition auto-adjusts." },
              { icon: Camera, title: "Guided Photo Capture", desc: "Camera overlays show customers exactly what to photograph. Mobile-optimized." },
              { icon: Cpu, title: "Interactive Offer Builder", desc: "Waterfall visualization with real-time sliders and profit spread gauge." },
              { icon: BarChart3, title: "Executive KPI Dashboard", desc: "Conversion funnels, pipeline value, per-appraiser performance." },
              { icon: Repeat, title: "Automated Follow-Up", desc: "Multi-touch SMS and email sequences. Leads don't die in inboxes." },
              { icon: MapPin, title: "Smart Store Assignment", desc: "Leads auto-route by ZIP, OEM brand, or buying center rules." },
              { icon: Lock, title: "Enterprise Security", desc: "Role-based access at database level. Encrypted storage, audit trails." },
              { icon: Smartphone, title: "Mobile Inspection Sync", desc: "Tire depths, brake measurements, and condition grades sync instantly." },
              { icon: Target, title: "Inspection-to-Appraisal", desc: "Findings feed directly into offer calculation. Auto-applied adjustments." },
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} custom={i * 0.2 + 4} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-base text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} custom={7} className="mt-10 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All features live in production — not a roadmap
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 5 — SCREENSHOTS ═══ */}
      <Section dark className="!min-h-0" id="screenshots">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <GlowBadge label="See It Live" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight text-center">
            Your Brand.<br /><span className="text-blue-400">Their Experience.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mx-auto mb-14 text-center">
            Every screen — consumer-facing and staff-facing — fully branded to your dealership.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <BrowserFrame label="Customer Landing Page">
                <img src={screenshotLanding} alt="Dealer-branded customer landing page" className="w-full" loading="lazy" />
              </BrowserFrame>
              <p className="text-xs text-white/30 text-center italic">Consumer experience — your brand, your trust signals</p>
            </div>
            <div>
              <BrowserFrame label="Staff Command Center">
                <img src={screenshotDashboard} alt="Admin dashboard" className="w-full" loading="lazy" />
              </BrowserFrame>
              <p className="text-xs text-white/30 text-center italic">Staff dashboard — every lead, every stage, one view</p>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 gap-8">
            <div>
              <BrowserFrame label="Customer Portal">
                <img src={screenshotPortal} alt="Customer portal" className="w-full" loading="lazy" />
              </BrowserFrame>
              <p className="text-xs text-white/30 text-center italic">Real-time status, offer details, next steps</p>
            </div>
            <div className="flex flex-col items-center">
              <img src={screenshotUploadMobile} alt="Mobile upload" className="w-full max-w-[280px] drop-shadow-2xl" loading="lazy" />
              <p className="text-xs text-white/30 text-center italic mt-3">Camera overlays guide consistent photos</p>
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 6 — PRICING ═══ */}
      <Section id="pricing">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
          <LightBadge label="Simple Pricing" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            One Plan. <span className="text-blue-600">Everything Included.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-gray-500 max-w-2xl mx-auto mb-14">
            No hidden fees. No per-lead charges. No feature gating. You get the entire platform.
          </motion.p>

          <motion.div variants={scaleIn} custom={2} className="max-w-lg mx-auto">
            <div className="bg-white border-2 border-blue-600/20 rounded-3xl p-10 shadow-xl shadow-blue-600/5 relative">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full tracking-wider uppercase">
                Full Platform
              </span>
              <div className="mb-8">
                <span className="text-6xl font-black text-gray-900">$1,995</span>
                <span className="text-xl text-gray-400 font-medium">/mo</span>
              </div>
              <ul className="space-y-3 text-left mb-10">
                {[
                  "Unlimited submissions & staff",
                  "All 3 acquisition channels",
                  "AI damage detection",
                  "Automated follow-up engine",
                  "Customer portal & notifications",
                  "Multi-location support",
                  "Enterprise security & RBAC",
                  "Custom domain & branding",
                  "Dedicated onboarding",
                  "48-hour go-live guarantee",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <a href="#cta" className="block w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-500 transition shadow-lg shadow-blue-600/20">
                Schedule a Demo <ArrowRight className="w-5 h-5" />
              </a>
              <p className="text-xs text-gray-400 mt-4">No contract. Cancel anytime.</p>
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 7 — ROI ═══ */}
      <Section dark id="roi">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <GlowBadge label="The Math" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            The ROI Writes<br /><span className="text-blue-400">Itself</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mb-16 leading-relaxed">
            Every unit you acquire direct saves ~$2,000 in auction fees, transport, and recon. Shift just 31% of your used volume to direct acquisition.
          </motion.p>

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
            Based on Carvana's 31% consumer-sourced ratio · $2,000 avg savings/unit · CarMax acquires 87% from consumers
          </motion.p>
        </motion.div>
      </Section>

      {/* ═══ 8 — WHY AUTOCURB ═══ */}
      <Section>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center">
          <LightBadge label="Why AutoCurb" />
          <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-14 leading-tight">
            Your <span className="text-blue-600">Unfair Advantage</span>
          </motion.h2>
          <motion.div variants={fadeUp} custom={1} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: DollarSign, title: "Higher Margins", desc: "Skip the auction. Acquire at wholesale directly from consumers and keep the spread." },
              { icon: Zap, title: "Faster Deals", desc: "Submission to check request — every step managed. More deals per month." },
              { icon: Award, title: "Your Brand", desc: "Not a white-label widget. YOUR dealership, YOUR customer, YOUR relationship." },
              { icon: TrendingUp, title: "First-Mover Moat", desc: "Be the only dealer in your market with a professional direct-buy platform." },
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} custom={i + 2} className="bg-white border border-gray-200 rounded-2xl p-8 text-center hover:shadow-md transition-shadow">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </Section>

      {/* ═══ 9 — CTA ═══ */}
      <Section dark id="cta">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-[200px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
          <motion.div variants={fadeUp} custom={0}>
            <img src={autocurbLogoWhite} alt="AutoCurb" className="h-16 mx-auto mb-10 object-contain" loading="lazy" />
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black mb-8 leading-tight">
            Ready to <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Own</span><br />
            Your Acquisition?
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Custom-branded. Fully configured. Live on your domain in 48 hours. No obligation.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:info@autocurb.io" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/30">
              Schedule a Demo <ArrowRight className="w-5 h-5" />
            </a>
            <a href="mailto:info@autocurb.io" className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition">
              info@autocurb.io
            </a>
          </motion.div>
        </motion.div>
      </Section>

      {/* ── Footer ── */}
      <footer className="bg-[hsl(220,25%,4%)] border-t border-white/5 px-6 py-10 text-center">
        <img src={autocurbLogoWhite} alt="AutoCurb" className="h-6 mx-auto mb-4 object-contain opacity-40" loading="lazy" />
        <p className="text-xs text-white/20">© {new Date().getFullYear()} AutoCurb.io — Dealer Inventory Acquisition Platform</p>
      </footer>
    </div>
  );
}
