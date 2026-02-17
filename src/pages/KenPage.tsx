import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, ChevronDown,
  Maximize2, Minimize2, Users, DollarSign,
  Award, TrendingUp, Briefcase, Target,
  Star, Shield, Handshake, Car, Zap,
} from "lucide-react";
import kenPortrait from "@/assets/ken-portrait.png";
import presenterLogo from "@/assets/pitch/pitch-top-logo.png";

/* ─── Slide IDs ─── */
const SLIDES = ["hero", "stats", "journey", "leadership", "philosophy", "cta"] as const;
type SlideId = typeof SLIDES[number];

/* ─── Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const } }),
};

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, prefix = "", suffix = "", className = "" }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    setStarted(true);
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
  }, [started, value]);

  return <span className={className}>{prefix}{displayed.toLocaleString()}{suffix}</span>;
}

/* ─── Section Wrapper ─── */
function Section({ id, children, isPresenting, currentSlide }: {
  id: SlideId; children: React.ReactNode; isPresenting: boolean; currentSlide: SlideId;
}) {
  if (isPresenting && id !== currentSlide) return null;
  return (
    <section
      id={id}
      className={`${isPresenting ? "w-full h-full flex items-center justify-center" : "min-h-screen flex items-center justify-center"} bg-[hsl(220,25%,6%)] text-white relative overflow-hidden`}
    >
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(210 100% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 100% 60%) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />
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

/* ─── Metric Card ─── */
function MetricCard({ value, prefix, suffix, label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  return (
    <div className="rounded-2xl p-8 text-center bg-white/5 border border-white/10 backdrop-blur-sm">
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} className="text-5xl md:text-6xl font-black text-blue-400" />
      <p className="text-sm mt-3 text-white/60">{label}</p>
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function KenPage() {
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
    document.title = "Ken Cieplinski | 20 Years of Automotive Excellence";
    return () => { document.title = "Sell Your Car - Get Cash Offer in 2 Minutes | Harte Auto Group"; };
  }, []);

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
        <Section id="hero" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "hero"}>
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              {/* Photo */}
              <motion.div variants={fadeUp} custom={0} className="shrink-0">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 blur-xl" />
                  <img
                    src={kenPortrait}
                    alt="Ken Cieplinski"
                    className="relative w-72 md:w-80 lg:w-96 rounded-2xl object-cover shadow-2xl shadow-blue-900/30 border border-white/10"
                  />
                </div>
              </motion.div>
              {/* Text */}
              <div className="text-center lg:text-left">
                <motion.div variants={fadeUp} custom={0.5}>
                  <img src={presenterLogo} alt="Harte Auto Group" className="h-16 mb-6 mx-auto lg:mx-0 opacity-60" />
                </motion.div>
                <motion.div variants={fadeUp} custom={1}>
                  <GlowBadge label="Meet the Leader" />
                </motion.div>
                <motion.h1 variants={fadeUp} custom={1.5} className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight mb-4">
                  Ken<br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    Cieplinski
                  </span>
                </motion.h1>
                <motion.p variants={fadeUp} custom={2} className="text-xl md:text-2xl text-white/50 mb-6 font-medium">
                  General Sales Manager · Harte Auto Group
                </motion.p>
                <motion.div variants={fadeUp} custom={2.5} className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-white/40">
                  {[
                    { icon: Briefcase, label: "20 Years in Auto" },
                    { icon: Users, label: "200+ Mentored" },
                    { icon: Car, label: "35,000 Vehicles Sold" },
                  ].map(({ icon: I, label }) => (
                    <span key={label} className="flex items-center gap-2">
                      <I className="w-4 h-4 text-blue-400" />{label}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 2 — BY THE NUMBERS ═══ */}
        <Section id="stats" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "stats"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="By the Numbers" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Two Decades of<br />
              <span className="text-blue-400">Proven Results</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-16">
              Numbers don't lie — Ken's career speaks for itself through consistent, measurable impact across every dealership he's touched.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-4 gap-6">
              <MetricCard value={20} suffix="+" label="Years in the Automotive Industry" />
              <MetricCard value={35000} suffix="+" label="Vehicles Sold Career-Wide" />
              <MetricCard value={200} suffix="+" label="Employees Mentored & Trained" />
              <MetricCard value={45} prefix="$" suffix="M+" label="Generated in F&I Revenue" />
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 3 — CAREER JOURNEY ═══ */}
        <Section id="journey" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "journey"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Journey" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Built From the<br />
              <span className="text-blue-400">Ground Up</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-16">
              From the showroom floor to the GM's office — a career forged by hustle, knowledge, and an obsession with getting the customer the best deal.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Star,
                  period: "The Foundation",
                  title: "Started on the Floor",
                  desc: "Began as a sales consultant, learning every angle of the deal — from first handshake to final signature. Mastered the art of earning trust quickly.",
                },
                {
                  icon: TrendingUp,
                  period: "The Rise",
                  title: "Finance & Leadership",
                  desc: "Moved into F&I, unlocking $45M+ in revenue. Trained teams, built processes, and turned finance departments into profit engines.",
                },
                {
                  icon: Target,
                  period: "The Present",
                  title: "General Sales Manager",
                  desc: "Now leading the entire sales operation at Harte Auto Group — setting strategy, mentoring the next generation, and driving record-breaking numbers.",
                },
              ].map(({ icon: Icon, period, title, desc }) => (
                <div key={title} className="rounded-2xl p-8 bg-white/5 border border-white/10 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-blue-500/20">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-2">{period}</p>
                  <h3 className="font-bold text-xl mb-3 text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 4 — LEADERSHIP STYLE ═══ */}
        <Section id="leadership" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "leadership"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Leadership" />
            <motion.h2 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              More Than a Manager —<br />
              <span className="text-blue-400">A Mentor</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-16">
              200+ employees have been coached, developed, and elevated under Ken's guidance. His approach blends old-school grit with modern strategy.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Handshake, title: "Relationship First", desc: "Every deal starts with trust. Ken builds relationships that last beyond the transaction." },
                { icon: Shield, title: "Integrity Always", desc: "Transparent pricing, honest assessments, no gimmicks — the Harte standard." },
                { icon: Zap, title: "Speed & Precision", desc: "Fast offers, streamlined processes, and a team that moves with purpose." },
                { icon: Award, title: "Culture of Winning", desc: "Setting goals, celebrating wins, and pushing every team member to their best." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:scale-[1.02] transition-transform duration-300">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-blue-500/20">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 5 — PHILOSOPHY ═══ */}
        <Section id="philosophy" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "philosophy"}>
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[150px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center max-w-4xl mx-auto">
            <motion.div variants={fadeUp} custom={0}>
              <GlowBadge label="Philosophy" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-black mb-10 leading-tight">
              <span className="text-blue-400">"</span>Every customer deserves<br />the best deal — <span className="text-blue-400">period.</span><span className="text-blue-400">"</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 leading-relaxed mb-12">
              In an industry full of noise, Ken keeps it simple: treat every person like family, give them a fair price, and make the process effortless. That philosophy has driven 35,000 sales and counting.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap justify-center gap-4">
              {["Customer-First", "Data-Driven", "Team Builder", "Process Innovator", "Results-Oriented"].map(tag => (
                <span key={tag} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-blue-500/30 text-blue-400 bg-blue-500/10">
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 6 — CTA ═══ */}
        <Section id="cta" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cta"}>
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0}>
              <GlowBadge label="Let's Connect" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-7xl font-black mb-6 leading-tight">
              Ready to Work With<br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                the Best?
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-xl mx-auto mb-12">
              Whether you're selling your car, joining the team, or looking for a leader who delivers — Ken is ready.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:kenc@hartecars.com"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/25"
              >
                Get In Touch
              </a>
              <a
                href="tel:+18668517390"
                className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition"
              >
                Call (866) 851-7390
              </a>
            </motion.div>
            <motion.div variants={fadeUp} custom={4} className="mt-16">
              <img src={presenterLogo} alt="Harte Auto Group" className="h-12 mx-auto opacity-30" />
            </motion.div>
          </motion.div>
        </Section>

      </AnimatePresence>
    </div>
  );
}
