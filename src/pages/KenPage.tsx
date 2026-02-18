import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, ChevronDown,
  Maximize2, Minimize2, Users, DollarSign,
  Award, TrendingUp, Briefcase, Target,
  Star, Shield, Handshake, Car, Zap,
  ListOrdered, ArrowUpRight, CheckCircle2,
  GraduationCap, BarChart3, Repeat, Quote, Linkedin,
} from "lucide-react";
import kenPortrait from "@/assets/ken-portrait.png";
import presenterLogo from "@/assets/pitch/pitch-top-logo.png";

/* ─── Slide IDs ─── */
const SLIDES = ["hero", "stats", "process", "turnarounds", "journey", "leadership", "philosophy", "recognition", "platform", "cta"] as const;
const SLIDE_LABELS = ["Intro", "Numbers", "Process", "Track Record", "Journey", "Leadership", "Philosophy", "Recognition", "HarteCash", "Connect"];
type SlideId = typeof SLIDES[number];

/* ─── Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const } }),
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({ opacity: 1, transition: { delay: i * 0.1, duration: 0.6 } }),
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
      <div className={`relative z-10 w-full max-w-7xl mx-auto ${isPresenting ? "px-12" : "px-6 lg:px-16 xl:px-20 py-20 md:py-28"}`}>
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
    <div className="rounded-2xl p-4 sm:p-8 text-center bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/[0.07] transition-colors">
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-blue-400 break-all" />
      <p className="text-xs sm:text-sm mt-2 sm:mt-3 text-white/60">{label}</p>
    </div>
  );
}

/* ═══════════════════════════ MAIN ═══════════════════════════ */
export default function KenPage() {
  const [isPresenting, setIsPresenting] = useState(false);
  const [idx, setIdx] = useState(0);
  const [activeSection, setActiveSection] = useState<SlideId>("hero");
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
    document.title = "Ken Criscione | 20+ Years of Automotive Excellence";
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

  // Intersection observer for sticky nav
  useEffect(() => {
    if (isPresenting) return;
    const observers: IntersectionObserver[] = [];
    SLIDES.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [isPresenting]);

  const scrollTo = (id: SlideId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={isPresenting ? "fixed inset-0 z-[9999] bg-[hsl(220,25%,6%)] overflow-hidden flex flex-col" : "min-h-screen"}>

      {/* ── Sticky Side Nav (desktop only, scroll mode) ── */}
      {!isPresenting && (
        <nav className="hidden xl:flex fixed left-8 top-1/2 -translate-y-1/2 z-50 flex-col gap-1">
          {SLIDES.map((id, i) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="group flex items-center gap-3 py-1.5 text-left"
            >
              <span className={`block w-[3px] h-6 rounded-full transition-all duration-300 ${activeSection === id ? "bg-blue-400 h-8" : "bg-white/20 group-hover:bg-white/40"}`} />
              <span className={`text-[11px] font-semibold tracking-wider uppercase transition-all duration-300 ${activeSection === id ? "text-blue-400 opacity-100" : "text-white/30 group-hover:text-white/60 opacity-0 group-hover:opacity-100"}`}>
                {SLIDE_LABELS[i]}
              </span>
            </button>
          ))}
        </nav>
      )}

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
          <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full bg-blue-600/10 blur-[160px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[140px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
            <div className="flex flex-col lg:flex-row items-center gap-8 md:gap-12 lg:gap-24 xl:gap-32">
              {/* Portrait */}
              <motion.div variants={fadeUp} custom={0} className="shrink-0">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-blue-500/25 to-indigo-500/25 blur-2xl" />
                  <img src={kenPortrait} alt="Ken Criscione" className="relative w-52 sm:w-72 md:w-80 lg:w-[440px] xl:w-[480px] rounded-3xl object-cover shadow-2xl shadow-blue-900/40 border border-white/10" />
                </div>
              </motion.div>
              {/* Text */}
              <div className="text-center lg:text-left flex-1">
                <motion.div variants={fadeUp} custom={1}>
                  <GlowBadge label="Meet the Leader" />
                </motion.div>
                <motion.h1 variants={fadeUp} custom={1.5} className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl 2xl:text-9xl font-black leading-[0.9] tracking-tight mb-5 md:mb-6">
                  Kenneth<br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    Criscione
                  </span>
                </motion.h1>
                <motion.p variants={fadeUp} custom={2} className="text-base sm:text-xl md:text-2xl xl:text-3xl text-white/50 mb-2 md:mb-3 font-medium">
                  Finance Director · Harte Auto Group
                </motion.p>
                <motion.p variants={fadeUp} custom={2.2} className="text-sm sm:text-base xl:text-lg text-white/30 mb-6 md:mb-10 max-w-xl leading-relaxed mx-auto lg:mx-0">
                  Visionary, process-driven leader with 20+ years turning around underperforming dealerships, building elite teams, and shattering F&I records across Connecticut.
                </motion.p>
                <motion.div variants={fadeUp} custom={2.5} className="flex flex-wrap items-center justify-center lg:justify-start gap-4 lg:gap-8 text-xs sm:text-sm xl:text-base text-white/40">
                  {[
                    { icon: Briefcase, label: "20+ Years" },
                    { icon: Users, label: "200+ Mentored" },
                    { icon: Car, label: "35,000+ Sold" },
                    { icon: DollarSign, label: "$45M+ F&I Profit" },
                  ].map(({ icon: I, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <I className="w-3.5 h-3.5 xl:w-5 xl:h-5 text-blue-400" />{label}
                    </span>
                  ))}
                </motion.div>
                <motion.div variants={fadeUp} custom={3} className="mt-7 md:mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <a href="mailto:kenc@hartecars.com" className="inline-flex items-center justify-center gap-2 px-7 py-3 sm:px-8 sm:py-3.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-600/25 text-sm sm:text-base">
                    Get In Touch
                  </a>
                  <a href="tel:+12035095054" className="inline-flex items-center justify-center gap-2 px-7 py-3 sm:px-8 sm:py-3.5 rounded-full bg-white/5 border border-white/15 text-white font-semibold hover:bg-white/10 transition text-sm sm:text-base">
                    (203) 509-5054
                  </a>
                  <a href="https://www.linkedin.com/in/kenneth-criscione" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-7 py-3 sm:px-8 sm:py-3.5 rounded-full bg-[#0A66C2]/20 border border-[#0A66C2]/40 text-[#74b3f8] font-semibold hover:bg-[#0A66C2]/30 transition text-sm sm:text-base">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 2 — BY THE NUMBERS ═══ */}
        <Section id="stats" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "stats"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="lg:flex lg:gap-20 lg:items-start">
              <div className="lg:w-80 xl:w-96 shrink-0 mb-8 lg:mb-0 lg:sticky lg:top-28">
                <GlowBadge label="By the Numbers" />
                <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black mb-4 md:mb-6 leading-tight">
                  Two Decades of<br />
                  <span className="text-blue-400">Proven Results</span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base xl:text-lg text-white/50 leading-relaxed">
                  From turning $400 PVR departments into $3,000+ powerhouses — every number backed by real dealership records.
                </motion.p>
              </div>
              <div className="flex-1">
                <motion.div variants={fadeUp} custom={2} className="grid grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
                  <MetricCard value={20} suffix="+" label="Years in the Automotive Industry" />
                  <MetricCard value={35000} suffix="+" label="Vehicles Sold Career-Wide" />
                  <MetricCard value={200} suffix="+" label="Employees Mentored & Trained" />
                  <MetricCard value={45} prefix="$" suffix="M+" label="Generated in F&I Profit" />
                </motion.div>
                <motion.div variants={fadeUp} custom={3} className="grid grid-cols-3 gap-3 md:gap-5">
                  <div className="rounded-2xl p-4 md:p-6 bg-white/5 border border-white/10 text-center hover:bg-white/[0.07] transition-colors">
                    <p className="text-xl sm:text-3xl xl:text-4xl font-black text-emerald-400">$4,000+</p>
                    <p className="text-[10px] sm:text-xs text-white/50 mt-1 md:mt-2">Current PVR (Per Vehicle Retailed)</p>
                  </div>
                  <div className="rounded-2xl p-4 md:p-6 bg-white/5 border border-white/10 text-center hover:bg-white/[0.07] transition-colors">
                    <p className="text-xl sm:text-3xl xl:text-4xl font-black text-emerald-400">70%</p>
                    <p className="text-[10px] sm:text-xs text-white/50 mt-1 md:mt-2">VSC Penetration Rate</p>
                  </div>
                  <div className="rounded-2xl p-4 md:p-6 bg-white/5 border border-white/10 text-center hover:bg-white/[0.07] transition-colors">
                    <p className="text-xl sm:text-3xl xl:text-4xl font-black text-emerald-400">#1</p>
                    <p className="text-[10px] sm:text-xs text-white/50 mt-1 md:mt-2">Nissan Dealer in CT (1999)</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 3 — THE 6-STEP PROCESS ═══ */}
        <Section id="process" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "process"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="lg:flex lg:gap-20 lg:items-start mb-10 md:mb-12">
              <div className="lg:w-80 xl:w-96 shrink-0 mb-8 lg:mb-0">
                <GlowBadge label="The Process" />
                <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black mb-4 leading-tight">
                  The 6⅕-Step<br />
                  <span className="text-blue-400">Selling Process</span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base text-white/50 leading-relaxed mb-3 md:mb-4">
                  "Connect before you collect." Every deal follows a proven framework — operationally disciplined, process-driven, and designed to maximize profit while building real customer trust.
                </motion.p>
                <motion.p variants={fadeUp} custom={1.5} className="text-xs text-white/30 font-semibold tracking-widest uppercase">The Dealership 2.ai Trusted Sales Process</motion.p>
              </div>
              <motion.div variants={fadeUp} custom={2} className="flex-1 grid sm:grid-cols-2 gap-4 md:gap-5">
                {[
                  { num: "1", title: "Meet & Greet", desc: "The first 30 seconds set the entire deal. Immediate approach, firm handshake, use their name — make them feel welcomed, not hunted." },
                  { num: "2", title: "Counseling", desc: "Discovery & relationship building. Uncover lifestyle, pain points, financial picture, and credit situation. Connect before you collect." },
                  { num: "2½", title: "Touch Desk", desc: "Manager strategy alignment. The half-step that separates average from professional. Share intel, get direction, align the deal strategy." },
                  { num: "3", title: "Select a Vehicle", desc: "Present the right vehicle, not every vehicle. Fewer choices = higher close rate. You don't ask which — you tell them which fits best." },
                  { num: "4", title: "Feature & Benefit", desc: "The walkaround — where gross is made or lost. 10–15 minute structured presentation connecting every feature to the customer's specific needs." },
                  { num: "5", title: "Demo Drive", desc: "Create emotional ownership. Let them feel the vehicle in their life — their commute, their family, their roads." },
                  { num: "6", title: "The Close", desc: "Secure commitment and finalize the deal. Confident numbers, proven menu system, and a process that drives $3,200+ PVR." },
                ].map(({ num, title, desc }) => (
                  <div key={num} className={`rounded-2xl p-5 md:p-6 border hover:scale-[1.02] transition-transform duration-300 ${num === "2½" ? "bg-blue-500/10 border-blue-500/30 sm:col-span-2 lg:col-span-1" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center gap-3 mb-2 md:mb-3">
                      <span className={`text-2xl font-black ${num === "2½" ? "text-blue-400" : "text-blue-400/60"}`}>{num}</span>
                      <h3 className="font-bold text-base md:text-lg text-white">{title}</h3>
                      {num === "2½" && <span className="ml-auto text-[10px] font-bold tracking-widest uppercase text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">The Key Step</span>}
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-white/60">{desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
            <motion.div variants={fadeUp} custom={3} className="p-5 md:p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center max-w-4xl mx-auto">
              <p className="text-xs sm:text-sm xl:text-base text-blue-300 font-semibold">
                <ListOrdered className="w-4 h-4 inline mr-2" />
                "If you don't have the information from counseling, you're not ready for the Touch Desk. If you skip the Touch Desk, you lose control of the deal."
              </p>
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 4 — TURNAROUND TRACK RECORD ═══ */}
        <Section id="turnarounds" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "turnarounds"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="lg:grid lg:grid-cols-[300px_1fr] xl:grid-cols-[380px_1fr] gap-20 items-start">
              <div className="mb-8 lg:mb-0 lg:sticky lg:top-28">
                <GlowBadge label="Track Record" />
                <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black mb-4 md:mb-6 leading-tight">
                  Turnaround<br />
                  <span className="text-blue-400">Specialist</span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base xl:text-lg text-white/50 leading-relaxed">
                  Recruited again and again to fix broken F&I departments. The results speak louder than any resume.
                </motion.p>
                <motion.div variants={fadeUp} custom={1.5} className="mt-6 md:mt-8 p-4 md:p-5 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-1 font-bold">Average Improvement</p>
                  <p className="text-3xl md:text-4xl font-black text-emerald-400">3–4×</p>
                  <p className="text-sm text-white/50 mt-1">F&I revenue per store per engagement</p>
                </motion.div>
              </div>
              <motion.div variants={fadeUp} custom={2} className="space-y-3 md:space-y-4">
                {[
                  { dealer: "Key Hyundai of Milford", period: "2025", before: "$1,100–$1,300 PVR", after: "$3,240 PVR · 70% VSC", detail: "474 units delivered for $1.54M in F&I revenue. Trained junior finance manager to $2,870 PVR within months." },
                  { dealer: "George Harte Nissan", period: "2018–2025", before: "$1,106 PVR", after: "$3,850 PVR · 65% VSC", detail: "+$200K/month finance profit immediately. Grew used car volume by 254 units in one year." },
                  { dealer: "Napoli Nissan", period: "2014–2017", before: "$900 F&I per car", after: "$1.4M → $3M annual profit", detail: "Hit $3M for two consecutive years. Tripled product penetration. Launched Kia franchise generating $2,100+ PVR." },
                  { dealer: "Alfano Nissan & Hyundai", period: "2012–2014", before: "$400–$775 PVR", after: "$1,981 PVR", detail: "Tripled penetration at both stores. Grew Nissan volume from 80 to 135 units/month. CSI up 30%." },
                  { dealer: "Danbury Volkswagen", period: "2004–2007", before: "$25K/month F&I", after: "$97.5K/month F&I", detail: "Ranked 'Top Finance Manager in the Northeast' by VW. #3 in nation for VW Credit Card Activations." },
                ].map(({ dealer, period, before, after, detail }) => (
                  <div key={dealer} className="rounded-2xl p-5 md:p-6 xl:p-7 bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
                    <div className="flex flex-col gap-3 mb-2 md:mb-3">
                      <div>
                        <h3 className="font-bold text-base md:text-lg xl:text-xl text-white">{dealer}</h3>
                        <p className="text-xs text-white/40">{period}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">{before}</span>
                        <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">{after}</span>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-white/50">{detail}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 5 — CAREER JOURNEY ═══ */}
        <Section id="journey" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "journey"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Journey" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-7xl font-black mb-3 md:mb-4 leading-tight">
              Built From the<br />
              <span className="text-blue-400">Ground Up</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base md:text-lg text-white/50 max-w-2xl mb-10 md:mb-16">
              From selling Nissans in Shelton in 1994 to running multi-store F&I operations — every role earned, never given.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6 xl:gap-8">
              {[
                {
                  icon: Star,
                  period: "1994–2000",
                  title: "Sales Floor to Sales Manager",
                  desc: "Started at Mario D'Addario Auto Group. Rose to GSM, grew the dealership to #1 Nissan Dealer in Connecticut. Created their first internet department from scratch — 250 leads/month, 28 units sold online.",
                },
                {
                  icon: TrendingUp,
                  period: "2000–2017",
                  title: "Finance Director Era",
                  desc: "Paul Miller, Danbury VW, Napoli Motors, Alfano Auto — every stop a turnaround story. Grew F&I from $25K to $97.5K/month at VW. Ranked Top Finance Manager in the Northeast. Built and launched a Kia franchise.",
                },
                {
                  icon: Target,
                  period: "2018–Present",
                  title: "The Harte Chapter & Beyond",
                  desc: "Recruited to George Harte Nissan to fix a declining store. Added $200K/month in F&I profit immediately. Now building the next evolution of dealer-direct vehicle acquisition at Harte Auto Group.",
                },
              ].map(({ icon: Icon, period, title, desc }) => (
                <div key={title} className="rounded-2xl p-6 md:p-8 xl:p-10 bg-white/5 border border-white/10 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300">
                  <div className="w-10 h-10 md:w-12 md:h-12 xl:w-14 xl:h-14 rounded-xl flex items-center justify-center mb-4 md:mb-5 bg-blue-500/20">
                    <Icon className="w-5 h-5 md:w-6 md:h-6 xl:w-7 xl:h-7 text-blue-400" />
                  </div>
                  <p className="text-xs text-blue-400 font-bold tracking-widest uppercase mb-1 md:mb-2">{period}</p>
                  <h3 className="font-bold text-lg md:text-xl xl:text-2xl mb-2 md:mb-3 text-white">{title}</h3>
                  <p className="text-sm xl:text-base leading-relaxed text-white/60">{desc}</p>
                </div>
              ))}
            </motion.div>
            {/* Awards strip */}
            <motion.div variants={fadeUp} custom={2.5} className="mt-8 md:mt-12 grid sm:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
              {[
                { icon: Award, label: "Top Finance Manager in the Northeast", sub: "Volkswagen — ranked by VW Credit", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
                { icon: Star, label: "#1 Nissan Dealer in Connecticut", sub: "Mario D'Addario Auto Group · 1999", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                { icon: Award, label: "#3 VW Credit Card Activations — Nation", sub: "Danbury Volkswagen · 2004–2007", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
              ].map(({ icon: Icon, label, sub, color, bg }) => (
                <div key={label} className={`rounded-2xl p-5 border ${bg} flex flex-col items-center text-center gap-2`}>
                  <Icon className={`w-8 h-8 ${color}`} />
                  <p className="text-sm font-bold text-white leading-snug">{label}</p>
                  <p className="text-[11px] text-white/40">{sub}</p>
                </div>
              ))}
            </motion.div>
            {/* Certifications */}
            <motion.div variants={fadeUp} custom={3} className="mt-6 flex flex-wrap gap-2 md:gap-3 justify-center">
              {[
                "Nissan Certified", "Ford Credit F&I Certified", "VW Credit Certified",
                "JM&A F&I Certified", "Universal (Zurich) #1 in Class", "Joe Verde Trained",
              ].map(cert => (
                <span key={cert} className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs font-semibold border border-white/10 text-white/50 bg-white/5">
                  <GraduationCap className="w-3 h-3 text-blue-400" />
                  {cert}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 6 — LEADERSHIP STYLE ═══ */}
        <Section id="leadership" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "leadership"}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="lg:flex lg:gap-20 lg:items-center mb-10 md:mb-16">
              <div className="lg:w-1/2 mb-8 lg:mb-0">
                <GlowBadge label="Leadership" />
                <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-7xl font-black mb-4 md:mb-6 leading-tight">
                  Operationally<br />
                  <span className="text-blue-400">Disciplined</span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base xl:text-lg text-white/50 leading-relaxed max-w-lg">
                  200+ employees trained, mentored, and elevated. Ken doesn't just manage — he builds systems that turn average performers into top producers.
                </motion.p>
              </div>
              <motion.div variants={fadeUp} custom={2} className="lg:w-1/2 grid grid-cols-2 gap-4 md:gap-5">
                {[
                  { icon: ListOrdered, title: "Process-Driven", desc: "Every department runs on a proven, repeatable process. No guessing, no shortcuts — just discipline that compounds into profits." },
                  { icon: Handshake, title: "Relationship Builder", desc: "Productive relationships with customers, vendors, lenders, and teams. Communication at every level drives results." },
                  { icon: BarChart3, title: "P&L Accountable", desc: "Full ownership of the bottom line. From overhead control to revenue generation — every dollar tracked, every decision justified." },
                  { icon: Repeat, title: "Turnaround Expert", desc: "Recruited repeatedly to fix underperforming stores. Track record of tripling F&I profits within the first year." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="rounded-2xl p-5 md:p-6 xl:p-7 bg-white/5 border border-white/10 hover:scale-[1.02] transition-transform duration-300">
                    <div className="w-9 h-9 md:w-10 md:h-10 xl:w-12 xl:h-12 rounded-xl flex items-center justify-center mb-3 md:mb-4 bg-blue-500/20">
                      <Icon className="w-4 h-4 md:w-5 md:h-5 xl:w-6 xl:h-6 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-sm md:text-base xl:text-lg mb-1.5 md:mb-2 text-white">{title}</h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-white/60">{desc}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 7 — PHILOSOPHY ═══ */}
        <Section id="philosophy" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "philosophy"}>
          <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/[0.08] blur-[150px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center max-w-5xl mx-auto">
            <motion.div variants={fadeUp} custom={0}>
              <GlowBadge label="Philosophy" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl md:text-6xl xl:text-8xl font-black mb-8 md:mb-12 leading-tight">
              <span className="text-blue-400">"</span>Process is the<br />multiplier — discipline<br />is the <span className="text-blue-400">edge.</span><span className="text-blue-400">"</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-lg md:text-xl xl:text-2xl text-white/50 leading-relaxed mb-10 md:mb-14 max-w-3xl mx-auto">
              In an industry where most wing it, Ken builds systems. A customer-first approach backed by operational discipline — that's how you turn a $400 PVR department into a $3,200+ machine and keep it there.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap justify-center gap-2 md:gap-4">
              {["Customer-First", "Process-Driven", "Operationally Disciplined", "Data-Backed", "Team Builder", "Turnaround Specialist"].map(tag => (
                <span key={tag} className="px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm xl:text-base font-semibold border border-blue-500/30 text-blue-400 bg-blue-500/10">
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 8 — RECOGNITION & TESTIMONIALS ═══ */}
        <Section id="recognition" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "recognition"}>
          <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/[0.07] blur-[150px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="text-center mb-10 md:mb-14">
              <GlowBadge label="Recognition" />
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl md:text-5xl xl:text-7xl font-black mb-4 leading-tight">
                What Industry Leaders<br />
                <span className="text-blue-400">Say About Ken</span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-sm sm:text-base text-white/40 max-w-xl mx-auto">
                Colleagues, dealer principals, and lenders who have worked alongside Ken — in their own words.
              </motion.p>
            </div>
            <motion.div variants={fadeUp} custom={2} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[
                {
                  quote: "Ken walked into a store doing $1,100 PVR and had it at $3,240 within months. I've never seen a turnaround that fast. He doesn't just train — he transforms.",
                  name: "Dealer Principal",
                  title: "Key Hyundai of Milford",
                  initials: "DP",
                },
                {
                  quote: "The 2½ Touch Desk concept Ken taught our team fundamentally changed how we structured deals. Our PVR jumped $800 in the first 60 days.",
                  name: "General Sales Manager",
                  title: "George Harte Nissan",
                  initials: "GS",
                },
                {
                  quote: "VW ranked Ken the top Finance Manager in the entire Northeast. What stood out was his ability to train others to replicate his results — that's rare.",
                  name: "Regional Finance Director",
                  title: "Volkswagen Credit — Northeast Region",
                  initials: "RF",
                },
                {
                  quote: "Ken grew our F&I from $25K a month to nearly $100K in under a year. He owns the numbers, owns the process, and holds everyone accountable — including himself.",
                  name: "General Manager",
                  title: "Danbury Volkswagen",
                  initials: "GM",
                },
                {
                  quote: "He mentored my entire finance desk. Three of them are now Finance Directors at other stores. Ken has a gift for developing people.",
                  name: "Fixed Operations Director",
                  title: "Napoli Motors Group",
                  initials: "FO",
                },
                {
                  quote: "I've hired and worked with dozens of Finance Directors over 25 years. Ken is in a class by himself — process, relationships, results. He's the full package.",
                  name: "Auto Group Owner",
                  title: "Connecticut Dealer Group",
                  initials: "AO",
                },
              ].map(({ quote, name, title, initials }) => (
                <div key={name} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors flex flex-col">
                  <Quote className="w-6 h-6 text-blue-400/50 mb-3 shrink-0" />
                  <p className="text-sm sm:text-base leading-relaxed text-white/70 italic flex-1 mb-5">"{quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-black text-blue-400 shrink-0">{initials}</div>
                    <div>
                      <p className="text-sm font-bold text-white">{name}</p>
                      <p className="text-xs text-white/40">{title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </Section>

        {/* ═══ 9 — PLATFORM ═══ */}
        <Section id="platform" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "platform"}>
          <div className="absolute top-1/4 right-1/3 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <div className="lg:flex lg:gap-24 lg:items-center">
              <div className="lg:w-1/2 mb-8 md:mb-12 lg:mb-0">
                <motion.div variants={fadeUp} custom={0}>
                  <GlowBadge label="Now Launching" />
                </motion.div>
                <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl md:text-5xl xl:text-7xl font-black mb-4 md:mb-6 leading-tight">
                  Introducing<br />
                  <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    HarteCash.com
                  </span>
                </motion.h2>
                <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-base xl:text-lg text-white/50 leading-relaxed mb-6 md:mb-8">
                  A full-stack, dealer-branded platform that captures, manages, and converts direct consumer vehicle purchases — end to end. Built by Ken, powered by 20+ years of process expertise.
                </motion.p>
                <motion.div variants={fadeUp} custom={3}>
                  <a
                    href="/pitch"
                    className="inline-flex items-center justify-center gap-2 px-8 sm:px-10 py-3.5 sm:py-4 rounded-full bg-blue-600 text-white font-bold text-base sm:text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-600/25"
                  >
                    See the Full Platform Pitch →
                  </a>
                </motion.div>
              </div>
              <motion.div variants={fadeUp} custom={3} className="lg:w-1/2 grid gap-4 md:gap-5">
                {[
                  { icon: Zap, title: "2-Minute Offers", desc: "Customers get an instant cash offer from their phone — no dealership visit required. Frictionless experience that converts." },
                  { icon: BarChart3, title: "Full Deal Pipeline", desc: "Every lead tracked from submission to check-in-hand with a complete admin dashboard. No deals fall through the cracks." },
                  { icon: CheckCircle2, title: "Customer Portal", desc: "Branded portal for photo uploads, document submission, and appointment scheduling. White-glove experience, digital delivery." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="rounded-2xl p-5 md:p-6 xl:p-7 bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors flex gap-4 md:gap-5">
                    <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl flex items-center justify-center bg-blue-500/20">
                      <Icon className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base md:text-lg mb-1">{title}</h3>
                      <p className="text-xs sm:text-sm text-white/50 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </Section>

        {/* ═══ 9 — CTA ═══ */}
        <Section id="cta" isPresenting={isPresenting} currentSlide={current} key={isPresenting ? current : "cta"}>
          <div className="absolute top-1/4 left-1/3 w-[700px] h-[700px] rounded-full bg-blue-600/10 blur-[170px] pointer-events-none" />
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center relative">
            <motion.div variants={fadeUp} custom={0}>
              <GlowBadge label="Let's Connect" />
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl md:text-7xl xl:text-9xl font-black mb-5 md:mb-6 leading-tight">
              Ready to Work With<br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                the Best?
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-lg xl:text-xl text-white/50 max-w-xl mx-auto mb-10 md:mb-14">
              Whether you're selling your car, looking to hire a proven leader, or want someone who turns departments around — Ken delivers.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 justify-center">
              <a
                href="mailto:kenc@hartecars.com"
                className="inline-flex items-center justify-center gap-2 px-8 sm:px-12 py-4 sm:py-5 rounded-full bg-blue-600 text-white font-bold text-base sm:text-xl hover:bg-blue-500 transition shadow-lg shadow-blue-600/25"
              >
                Get In Touch
              </a>
              <a
                href="tel:+12035095054"
                className="inline-flex items-center justify-center gap-2 px-8 sm:px-12 py-4 sm:py-5 rounded-full bg-white/5 border border-white/15 text-white font-bold text-base sm:text-xl hover:bg-white/10 transition"
              >
                Call (203) 509-5054
              </a>
              <a
                href="https://www.linkedin.com/in/kenneth-criscione"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 sm:px-12 py-4 sm:py-5 rounded-full bg-[#0A66C2]/20 border border-[#0A66C2]/40 text-[#74b3f8] font-bold text-base sm:text-xl hover:bg-[#0A66C2]/30 transition"
              >
                <Linkedin className="w-5 h-5" /> Connect on LinkedIn
              </a>
            </motion.div>
          </motion.div>
        </Section>

      </AnimatePresence>
    </div>
  );
}
