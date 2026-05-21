import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck, Truck, Shield, Check, Clock, ArrowRight, MessageSquare,
  BarChart3, Sparkles, TrendingUp, Info, X, Zap, Lock, Award, Star,
  CheckCircle2, CalendarDays, Wallet,
  AlertTriangle, Users, FileText, HelpCircle, Paperclip,
  Activity as ActivityIcon, Eye, MapPin, ChevronRight,
} from "lucide-react";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, SectionLabel } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

type NavTarget = "messages" | "pickup" | "documents" | "payments";
type Props = { onNavigate: (k: NavTarget) => void };

/* ─── Live countdown ─────────────────────────────────────────── */
const useCountdown = (deadline: string) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const target = new Date(deadline + " 17:00:00").getTime();
  const diff = Math.max(0, target - now);
  const totalWindowMs = 8 * 86400000;
  return {
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins:  Math.floor((diff / 60000) % 60),
    secs:  Math.floor((diff / 1000) % 60),
    pct:   Math.min(100, Math.max(0, (diff / totalWindowMs) * 100)),
    urgent: diff < 86400000,
    expired: diff === 0,
  };
};

/* ─── Smooth counter ─────────────────────────────────────────── */
const Counter = ({ value, duration = 1100, prefix = "$" }: { value: number; duration?: number; prefix?: string }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{prefix}{n.toLocaleString()}</>;
};

/* ─── Hover info tooltip ─────────────────────────────────────── */
const InfoTip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <span className="relative inline-flex items-center group">
    {children}
    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-30 w-[220px] rounded-xl bg-[#06194A] text-white text-[11.5px] leading-snug px-3 py-2 shadow-lg opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
      {text}
    </span>
  </span>
);

/* ─── Breakdown data with copy ───────────────────────────────── */
const BREAKDOWN = [
  { label: "Market value",            value: 21450, why: "Based on Black Book wholesale comps for your year, trim, and region." },
  { label: "Mileage adjustment",      value: -650,  why: "Mileage adjustment based on regional average resale patterns." },
  { label: "Condition adjustment",    value: -350,  why: "Reflects minor cosmetic wear identified in uploaded photos." },
  { label: "Local demand bonus",      value: 400,   why: "SUV demand in your ZIP is currently above the 90-day average." },
  { label: "Reconditioning estimate", value: -700,  why: "Typical recon needed to bring the vehicle to retail-ready." },
];

const MAX_BAR = Math.max(...BREAKDOWN.map((b) => Math.abs(b.value)));

/* ─── Competitive advantage details for drawers ─────────────── */
type AdvantageKey = "best" | "pickup" | "payment" | "fees";
const ADVANTAGES: Record<AdvantageKey, { Icon: any; title: string; tagline: string; tone: "indigo" | "green"; body: string; bullets: string[] }> = {
  best: {
    Icon: Award, title: "Best Overall Offer", tagline: "Above wholesale baseline", tone: "indigo",
    body: "Your offer sits above the regional wholesale average for similar vehicles. We pair Black Book comps with live local demand to make sure our number is genuinely competitive — not just an opening bid.",
    bullets: ["Cross-checked against 30-day local sale comps", "Adjusted for current SUV demand in your ZIP", "Held firm — no surprises at pickup"],
  },
  pickup: {
    Icon: Truck, title: "Free Pickup", tagline: "We come to you", tone: "indigo",
    body: "No need to drive across town. A pickup coordinator will arrive at your home or office, perform a 5-minute confirmation walkaround, and take the keys.",
    bullets: ["Choose any 30-minute window we have available", "Insured transport — fully covered in transit", "No drop-off, no rental, no rideshare needed"],
  },
  payment: {
    Icon: Zap, title: "Fastest Payment", tagline: "ACH within 1 business day", tone: "green",
    body: "Funds release automatically the same business day pickup is confirmed. Most customers see the deposit settle in their account within 2 hours.",
    bullets: ["Secure ACH direct to your linked bank", "Encrypted transfer — no checks to deposit", "Confirmation email and SMS the moment funds clear"],
  },
  fees: {
    Icon: Lock, title: "No Hidden Fees", tagline: "Number you see is what you get", tone: "green",
    body: "The firm offer is the net payout. We don't subtract auction fees, prep fees, or surprise reconditioning at pickup — that's already baked into the number.",
    bullets: ["No prep, doc, or transport deductions", "No last-minute price drops at inspection", "Same number in writing, by email, and at pickup"],
  },
};

/* ─── Live market status messages — rotate every 6s ─────────── */
type MarketTone = "green" | "orange" | "indigo";
const MARKET_MESSAGES: { tone: MarketTone; title: string; sub: string }[] = [
  { tone: "green",  title: "Stable market",          sub: "Offer likely stable through Friday" },
  { tone: "indigo", title: "High demand window",     sub: "Regional SUV demand elevated this week" },
  { tone: "orange", title: "Moderate volatility",    sub: "SUV values may shift this weekend" },
];
const MARKET_TONE: Record<MarketTone, { bg: string; text: string; dot: string }> = {
  green:  { bg: "bg-[#E8F8EE]", text: "text-[#0F7A3E]", dot: "bg-[#16A34A]" },
  orange: { bg: "bg-[#FEF3E2]", text: "text-[#B45309]", dot: "bg-[#F59E0B]" },
  indigo: { bg: "bg-[#EEF0FF]", text: "text-[#4F46E5]", dot: "bg-[#4F46E5]" },
};

const useRotatingMarketStatus = () => {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % MARKET_MESSAGES.length), 6000); return () => clearInterval(id); }, []);
  return MARKET_MESSAGES[i];
};

/* ─── Acceptance wizard ──────────────────────────────────────── */
const ACCEPT_STEPS = ["Terms", "Ownership", "Pickup", "Signature", "Done"];
const AcceptFlow = ({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (k: NavTarget) => void }) => {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const next = () => setStep((s) => Math.min(ACCEPT_STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[75] bg-[#F7F8FB] flex flex-col"
          role="dialog" aria-modal="true"
        >
          <header className="flex items-center justify-between px-5 sm:px-8 py-4 bg-white border-b border-[#E6EAF0]">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                <ShieldCheck className="w-[18px] h-[18px]" />
              </div>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-[#06194A]">Accept your offer</div>
                <div className="text-[11px] text-[#53627A]">Step {step + 1} of {ACCEPT_STEPS.length} • {ACCEPT_STEPS[step]}</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-lg hover:bg-[#F4F6FA] text-[#53627A] grid place-items-center transition">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="px-5 sm:px-8 py-3 bg-white border-b border-[#E6EAF0]">
            <div className="flex items-center gap-2">
              {ACCEPT_STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" : "bg-[#E6EAF0]"}`} />
                  <div className={`mt-1 text-[10px] uppercase tracking-wide font-semibold ${i <= step ? "text-[#4F46E5]" : "text-[#8893A8]"}`}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
            <div className="max-w-[640px] mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Review offer terms</h2>
                      <p className="text-sm text-[#53627A] mt-1">Your firm number is locked once accepted, subject to a quick inspection at pickup.</p>
                      <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#E0E7FF]">
                        <div className="text-[11px] uppercase tracking-wide text-[#4F46E5] font-semibold">Final firm offer</div>
                        <div className="text-[34px] font-extrabold text-[#06194A] tracking-tight mt-1">{fmt(MOCK.firmOffer)}</div>
                        <div className="text-[12.5px] text-[#53627A] mt-1">from {MOCK.customer.dealer}</div>
                      </div>
                      <ul className="mt-4 space-y-2 text-[13px] text-[#06194A]">
                        {[
                          "Free pickup at a time of your choosing",
                          "Secure ACH payout within 1 business day of pickup",
                          "No hidden fees or last-minute reductions",
                        ].map((t) => (
                          <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 text-[#16A34A] mt-0.5" />{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {step === 1 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Confirm ownership</h2>
                      <p className="text-sm text-[#53627A] mt-1">Make sure the title holder matches the legal owner.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                        {[["Full name", MOCK.customer.name], ["Email", MOCK.customer.email], ["Phone", MOCK.customer.phone], ["Title status", MOCK.vehicle.ownership]].map(([k, v]) => (
                          <label key={k} className="block">
                            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{k}</span>
                            <input defaultValue={v as string} className="mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {step === 2 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Pickup &amp; payment</h2>
                      <p className="text-sm text-[#53627A] mt-1">We'll come to you and pay via secure ACH after inspection.</p>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-xl border border-[#E6EAF0]">
                          <div className="flex items-center gap-2 text-[#06194A] font-semibold text-[13.5px]"><CalendarDays className="w-4 h-4 text-[#4F46E5]" /> Preferred pickup</div>
                          <div className="text-[12.5px] text-[#53627A] mt-1">You'll choose a date next.</div>
                        </div>
                        <div className="p-4 rounded-xl border border-[#E6EAF0]">
                          <div className="flex items-center gap-2 text-[#06194A] font-semibold text-[13.5px]"><Wallet className="w-4 h-4 text-[#4F46E5]" /> ACH • Chase •••• 4127</div>
                          <div className="text-[12.5px] text-[#53627A] mt-1">Funds within 1 business day.</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {step === 3 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Digital signature</h2>
                      <p className="text-sm text-[#53627A] mt-1">Type your full legal name to sign the bill of sale.</p>
                      <input placeholder="Full legal name" className="mt-5 w-full rounded-xl border border-[#E6EAF0] bg-white px-4 py-4 text-[18px] font-serif italic text-[#06194A] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                      <div className="mt-3 text-[11.5px] text-[#8893A8] inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Encrypted and stored securely.</div>
                    </div>
                  )}
                  {step === 4 && (
                    <div className="text-center py-6">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} className="w-16 h-16 mx-auto rounded-full bg-[#E8F8EE] text-[#0F7A3E] grid place-items-center">
                        <CheckCircle2 className="w-8 h-8" />
                      </motion.div>
                      <h2 className="text-[22px] font-bold text-[#06194A] mt-4">Offer accepted</h2>
                      <p className="text-sm text-[#53627A] mt-1">Nicely done. Here's what happens next.</p>
                      <ol className="mt-6 space-y-3 max-w-[360px] mx-auto text-left">
                        {[
                          { Icon: CalendarDays, t: "Schedule pickup", d: "Pick a date and we'll come to you" },
                          { Icon: FileText,     t: "Final documents", d: "Sign off on the bill of sale at pickup" },
                          { Icon: Wallet,       t: "Receive payment", d: "ACH within 1 business day" },
                        ].map((s) => (
                          <li key={s.t} className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F8FB]">
                            <span className="w-8 h-8 rounded-lg bg-white border border-[#E6EAF0] text-[#4F46E5] grid place-items-center"><s.Icon className="w-4 h-4" /></span>
                            <div>
                              <div className="text-[13px] font-semibold text-[#06194A]">{s.t}</div>
                              <div className="text-[11.5px] text-[#53627A]">{s.d}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer className="px-5 sm:px-8 py-4 bg-white border-t border-[#E6EAF0] flex items-center justify-between gap-2">
            <SecondaryButton onClick={step === 0 ? onClose : back}>{step === 0 ? "Cancel" : "Back"}</SecondaryButton>
            {step < ACCEPT_STEPS.length - 1 ? (
              <PrimaryButton onClick={next}>Continue <ArrowRight className="w-4 h-4" /></PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => { onClose(); toast.success("Offer accepted", { description: "Let's schedule your pickup." }); onNavigate("pickup"); }}>
                Schedule Pickup <ArrowRight className="w-4 h-4" />
              </PrimaryButton>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ─── Page ───────────────────────────────────────────────────── */
export const OffersPage = ({ onNavigate }: Props) => {
  const [accept, setAccept] = useState(false);
  const [counter, setCounter] = useState(false);
  const [ask, setAsk] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const [advantage, setAdvantage] = useState<AdvantageKey | null>(null);
  const { days, hours, mins, secs, pct, urgent, expired } = useCountdown(MOCK.offerExpires);
  const marketStatus = useRotatingMarketStatus();

  const minCounter = MOCK.firmOffer + 500;
  const maxCounter = MOCK.firmOffer + 1200;
  const [counterAmt, setCounterAmt] = useState(MOCK.firmOffer + 750);
  const [askMsg, setAskMsg] = useState("Question regarding current offer.\n\n");

  return (
    <PortalPageShell title="Your Offers" subtitle="Review, compare, and accept your acquisition offer.">
      {/* Hero offer */}
      <Card className="relative overflow-hidden p-6 mb-6 bg-gradient-to-br from-[#EEF0FF] via-white to-[#F5F3FF] border-[#E0E7FF]">
        {/* ambient orb */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#7C3AED]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#4F46E5]/10 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SectionLabel>Current Firm Offer</SectionLabel>
              <InfoTip text="Based on local sale comps, condition photos, mileage, and live SUV demand in your area.">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F8EE] text-[#0F7A3E] cursor-help">
                  <Sparkles className="w-3 h-3" /> High Confidence
                </span>
              </InfoTip>
              <InfoTip text="AI-verified means our pricing engine cross-checked your offer against the latest Black Book and regional sale data.">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#4F46E5] cursor-help">
                  <ShieldCheck className="w-3 h-3" /> AI-Verified
                </span>
              </InfoTip>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="text-[48px] sm:text-[52px] font-extrabold tracking-tight leading-none text-[#06194A] tabular-nums"
            >
              <Counter value={MOCK.firmOffer} />
            </motion.div>
            <p className="text-sm text-[#53627A] mt-2">
              Held for you by <span className="font-semibold text-[#06194A]">{MOCK.customer.dealer}</span>
            </p>

            <div className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-[#0F7A3E] bg-[#E8F8EE] px-3 py-1.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Above regional wholesale average — strong SUV demand boosted your valuation.
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-[12px] text-[#06194A]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />No Obligation</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#16A34A]" />Free Pickup</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#16A34A]" />Secure &amp; Private</span>
            </div>
          </div>

          {/* Countdown — soft amber urgency, animated digits */}
          <div className={`rounded-2xl bg-white border p-4 transition-shadow ${urgent ? "border-[#FCD9A8] shadow-[0_0_0_4px_rgba(245,158,11,0.12),0_18px_36px_-22px_rgba(245,158,11,0.45)]" : "border-[#E6EAF0]"}`}>
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#53627A] inline-flex items-center gap-1.5">
                <Clock className={`w-3.5 h-3.5 ${urgent ? "text-[#B45309]" : ""}`} /> Offer Expires
              </div>
              <span className="relative flex h-2 w-2">
                {urgent && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-70" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${urgent ? "bg-[#F59E0B]" : "bg-[#16A34A]"}`} />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { n: days,  l: "Days",    k: "d" },
                { n: hours, l: "Hours",   k: "h" },
                { n: mins,  l: "Minutes", k: "m" },
                { n: secs,  l: "Seconds", k: "s" },
              ].map((b) => (
                <div key={b.k} className={`rounded-xl py-3 ${urgent ? "bg-[#FEF8EE]" : "bg-[#F7F8FB]"}`}>
                  <div className="h-[30px] overflow-hidden relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={String(b.n)}
                        initial={{ y: -18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 18, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className={`text-[26px] font-extrabold leading-none tabular-nums ${urgent ? "text-[#B45309]" : "text-[#06194A]"}`}
                      >
                        {String(b.n).padStart(2, "0")}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="text-[9px] uppercase tracking-wide text-[#8893A8] mt-1 font-semibold">{b.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                className={`h-full ${urgent ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706]" : "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"}`}
              />
            </div>
            <div className="text-[11px] text-[#53627A] text-center mt-2">{expired ? "Expired" : `Held through ${MOCK.offerExpires}`}</div>

            {/* Rotating market intelligence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={marketStatus.title}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className={`mt-3 flex items-center gap-2 text-[11.5px] px-2.5 py-1.5 rounded-lg ${MARKET_TONE[marketStatus.tone].bg} ${MARKET_TONE[marketStatus.tone].text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${MARKET_TONE[marketStatus.tone].dot}`} />
                <span className="font-semibold">{marketStatus.title}</span>
                <span className="text-[#53627A] truncate">— {marketStatus.sub}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* CTAs */}
        <div className="relative grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-2 mt-5">
          <button
            onClick={() => setAccept(true)}
            className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl py-4 px-5 text-[15px] font-bold text-white bg-gradient-to-r from-[#4F46E5] via-[#5B47EA] to-[#7C3AED] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_14px_30px_-12px_rgba(79,70,229,0.7)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_22px_40px_-12px_rgba(79,70,229,0.9)] active:scale-[0.98] transition-all"
          >
            {/* periodic shimmer every ~9s + faster hover sweep */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:via-white/55"
              style={{ animation: "acceptShimmer 9s ease-in-out infinite" }}
            />
            <style>{`@keyframes acceptShimmer { 0%, 78%, 100% { transform: translateX(-120%) skewX(-20deg); opacity: 0; } 84% { opacity: 1; } 96% { transform: translateX(420%) skewX(-20deg); opacity: 0; } }`}</style>
            <Check className="w-[18px] h-[18px] relative z-10" />
            <span className="relative z-10">Accept Offer</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 relative z-10" />
          </button>
          <SecondaryButton onClick={() => setCounter(true)} className="py-4">Counter Offer</SecondaryButton>
          <SecondaryButton onClick={() => setAsk(true)} className="py-4"><MessageSquare className="w-4 h-4" /> Ask Question</SecondaryButton>
        </div>

        {/* Live activity strip — premium SaaS intelligence */}
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#53627A]"
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#16A34A]" /></span>
            <Eye className="w-3.5 h-3.5 text-[#0F7A3E]" /> Dealer reviewed your offer <strong className="text-[#06194A] font-semibold">12 min ago</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5]" /> Regional SUV demand <strong className="text-[#06194A] font-semibold">+8%</strong> this week
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#B45309]" /> Pickup available <strong className="text-[#06194A] font-semibold">within 24 hrs</strong>
          </span>
        </motion.div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown with bars */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Offer Breakdown</SectionLabel>
            <button onClick={() => setBreakdown(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">Full detail</button>
          </div>
          <ul className="space-y-3">
            {BREAKDOWN.map((b, i) => {
              const w = (Math.abs(b.value) / MAX_BAR) * 100;
              const positive = b.value >= 0;
              return (
                <li key={b.label} className="group">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#06194A] font-medium inline-flex items-center gap-1.5">
                      {b.label}
                      <InfoTip text={b.why}>
                        <Info className="w-3 h-3 text-[#B6BECC] hover:text-[#4F46E5] transition-colors" />
                      </InfoTip>
                    </span>
                    <span className={`font-bold tabular-nums ${positive ? "text-[#0F7A3E]" : "text-[#B45309]"}`}>
                      {positive ? "+" : "−"}{fmt(Math.abs(b.value))}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[#F4F6FA] overflow-hidden group-hover:bg-white transition-colors">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${w}%` }}
                      transition={{ duration: 0.7, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full transition-shadow group-hover:shadow-[0_0_10px_currentColor] ${positive ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-[#16A34A]/60" : "bg-gradient-to-r from-[#FCD9A8] to-[#F59E0B] text-[#F59E0B]/60"}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 pt-3 border-t border-[#EEF0F4] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#06194A]">Final Firm Offer</span>
            <span className="text-[20px] font-extrabold text-[#06194A] tabular-nums">{fmt(MOCK.firmOffer)}</span>
          </div>
        </Card>

        {/* Why your offer is competitive */}
        <Card className="p-5">
          <SectionLabel>Why Your Offer Is Competitive</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {([
              { key: "best",    Icon: Award, t: "Best Overall Offer", d: "Above wholesale baseline" },
              { key: "pickup",  Icon: Truck, t: "Free Pickup",        d: "We come to you" },
              { key: "payment", Icon: Zap,   t: "Fastest Payment",    d: "ACH within 1 day" },
              { key: "fees",    Icon: Lock,  t: "No Hidden Fees",     d: "Number you see is what you get" },
            ] as { key: AdvantageKey; Icon: any; t: string; d: string }[]).map((x) => (
              <button
                key={x.key}
                onClick={() => setAdvantage(x.key)}
                className="group text-left rounded-xl border border-[#E6EAF0] p-3 hover:border-[#4F46E5]/40 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(79,70,229,0.5)] transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-[#EEF0FF] text-[#4F46E5] grid place-items-center transition-transform group-hover:scale-110 group-hover:rotate-[-4deg]">
                    <x.Icon className="w-[14px] h-[14px]" />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#B6BECC] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[12.5px] font-bold text-[#06194A] mt-2">{x.t}</div>
                <div className="text-[11px] text-[#53627A]">{x.d}</div>
              </button>
            ))}
          </div>

          {/* Private party tradeoffs — emphasize friction, de-emphasize upside */}
          <div className="mt-4 rounded-xl border border-[#E6EAF0] p-4 bg-[#FAFBFE]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#06194A]">Selling it yourself instead?</div>
                <div className="text-[11.5px] text-[#53627A] mt-0.5">
                  Potentially higher resale value <span className="text-[#0F7A3E] font-semibold tabular-nums">(~+{fmt(1950)})</span> — but with real trade-offs.
                </div>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-[#8893A8] bg-white border border-[#E6EAF0] px-2 py-0.5 rounded-full">
                Private sale
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-[12px] text-[#53627A]">
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-md bg-[#FEF3E2] text-[#B45309] grid place-items-center shrink-0"><Clock className="w-3.5 h-3.5" /></span>
                <div><span className="font-semibold text-[#06194A]">Longer selling process</span> — 2 to 6 weeks on average</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-md bg-[#FEF3E2] text-[#B45309] grid place-items-center shrink-0"><Users className="w-3.5 h-3.5" /></span>
                <div><span className="font-semibold text-[#06194A]">Multiple buyer meetings</span> — test drives, negotiations, no-shows</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-md bg-[#FEF3E2] text-[#B45309] grid place-items-center shrink-0"><AlertTriangle className="w-3.5 h-3.5" /></span>
                <div><span className="font-semibold text-[#06194A]">Payment uncertainty</span> — bounced checks, fraud, chargebacks</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-md bg-[#FEF3E2] text-[#B45309] grid place-items-center shrink-0"><FileText className="w-3.5 h-3.5" /></span>
                <div><span className="font-semibold text-[#06194A]">Self-managed paperwork</span> — title transfer, DMV, release of liability</div>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* What happens next — clickable steps with animated connectors */}
      <Card className="p-5 mt-6">
        <SectionLabel>What Happens Next</SectionLabel>
        <ol className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
          {/* Connector line (desktop only) */}
          <span aria-hidden className="hidden sm:block absolute top-[34px] left-[8%] right-[8%] h-[2px] bg-[#EEF0F4] rounded-full" />
          <motion.span
            aria-hidden initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ transformOrigin: "left" }}
            className="hidden sm:block absolute top-[34px] left-[8%] right-[8%] h-[2px] bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#4F46E5]/30 rounded-full"
          />
          {([
            { key: "accept",   Icon: Check,         t: "Accept Offer",    d: "Lock in your firm number", time: "1 min",          onClick: () => setAccept(true) },
            { key: "docs",     Icon: FileText,      t: "Final Documents", d: "Upload or sign at pickup", time: "5 min",          onClick: () => onNavigate("documents") },
            { key: "pickup",   Icon: CalendarDays,  t: "Schedule Pickup", d: "We come to you",           time: "Free",           onClick: () => onNavigate("pickup") },
            { key: "payment",  Icon: Wallet,        t: "Receive Payment", d: "Secure ACH transfer",      time: "1 business day", onClick: () => onNavigate("payments") },
          ] as { key: string; Icon: any; t: string; d: string; time: string; onClick: () => void }[]).map((s, i) => (
            <motion.li
              key={s.key}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.07 }}
              className="relative"
            >
              <button
                onClick={s.onClick}
                className="group w-full text-left rounded-xl border border-[#E6EAF0] bg-white p-4 hover:border-[#4F46E5]/40 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(79,70,229,0.5)] transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#EEF0FF] to-[#E9E2FF] text-[#4F46E5] grid place-items-center transition-transform group-hover:scale-110">
                    <s.Icon className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8893A8]">Step {i + 1}</span>
                </div>
                <div className="text-[13.5px] font-bold text-[#06194A] mt-3 flex items-center gap-1">
                  {s.t}
                  <ChevronRight className="w-3.5 h-3.5 text-[#B6BECC] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[11.5px] text-[#53627A] mt-0.5">{s.d}</div>
                <div className="text-[10.5px] text-[#4F46E5] font-semibold mt-2">{s.time}</div>
              </button>
            </motion.li>
          ))}
        </ol>
      </Card>

      {/* Trust strip */}
      <Card className="p-4 mt-6">
        <div className="flex flex-wrap items-center justify-around gap-3 text-[12px] text-[#06194A]">
          {[
            { Icon: ShieldCheck, t: "BBB Accredited" },
            { Icon: Star,        t: "4.9 Dealer Rating" },
            { Icon: Lock,        t: "Secure ACH Payments" },
            { Icon: Truck,       t: "Pickup Included" },
            { Icon: HelpCircle,  t: "Support 7 days a week" },
          ].map((x) => (
            <span key={x.t} className="inline-flex items-center gap-2 font-semibold">
              <x.Icon className="w-4 h-4 text-[#4F46E5]" /> {x.t}
            </span>
          ))}
        </div>
      </Card>

      {/* Mobile sticky accept */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-white/90 backdrop-blur border-t border-[#E6EAF0]">
        <button
          onClick={() => setAccept(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] shadow-[0_14px_30px_-12px_rgba(79,70,229,0.7)]"
        >
          Accept {fmt(MOCK.firmOffer)} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Drawers ── */}

      {/* Counter offer */}
      <SlideOver
        open={counter} onClose={() => setCounter(false)} title="Counter Offer"
        subtitle="Send a number back to your dealer" width="lg"
        footer={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setCounter(false)} className="flex-1">Cancel</SecondaryButton>
            <PrimaryButton
              onClick={() => { setCounter(false); toast.success("Counter offer submitted", { description: `${fmt(counterAmt)} sent to ${MOCK.customer.dealer}` }); }}
              className="flex-1"
            >Send Counter</PrimaryButton>
          </div>
        }
      >
        <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#E0E7FF] p-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-[#4F46E5]">Your counter</div>
          <div className="text-[32px] font-extrabold text-[#06194A] tabular-nums mt-1">{fmt(counterAmt)}</div>
          <div className="text-[11.5px] text-[#53627A] mt-1">
            {fmt(counterAmt - MOCK.firmOffer)} above current offer
          </div>
        </div>

        <div className="mt-4">
          <input
            type="range" min={minCounter - 500} max={maxCounter + 800} step={50}
            value={counterAmt} onChange={(e) => setCounterAmt(Number(e.target.value))}
            className="w-full accent-[#4F46E5]"
          />
          <div className="flex items-center justify-between text-[11px] text-[#8893A8] mt-1 tabular-nums">
            <span>{fmt(minCounter - 500)}</span>
            <span className="text-[#4F46E5] font-semibold">Recommended {fmt(minCounter)}–{fmt(maxCounter)}</span>
            <span>{fmt(maxCounter + 800)}</span>
          </div>
        </div>

        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Custom amount</span>
          <div className="mt-1 flex items-center rounded-xl border border-[#E6EAF0] px-3 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#4F46E5]/20">
            <span className="text-[#53627A]">$</span>
            <input
              type="number" value={counterAmt}
              onChange={(e) => setCounterAmt(Number(e.target.value) || 0)}
              className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none"
            />
          </div>
        </label>

        <div className="mt-4 rounded-xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 text-[12px] text-[#53627A]">
          <div className="font-semibold text-[#06194A] inline-flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-[#4F46E5]" /> Market guidance</div>
          <p className="mt-1">Most successful counter offers fall within $500–$1,200 of your current offer. Dealers typically respond in under 2 hours.</p>
        </div>

        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Notes for dealer (optional)</span>
          <textarea rows={3} placeholder="Share context (e.g. recent maintenance, comparable offers)…" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </label>
      </SlideOver>

      {/* Ask question */}
      <SlideOver
        open={ask} onClose={() => setAsk(false)} title="Ask a Question"
        subtitle={`${MOCK.customer.dealer} typically replies in ${MOCK.responseTime}`}
        width="lg"
        footer={
          <PrimaryButton
            onClick={() => { setAsk(false); toast.success("Message sent", { description: "Your dealer will reply shortly." }); }}
            className="w-full"
          >Send Message</PrimaryButton>
        }
      >
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F7F8FB] border border-[#E6EAF0]">
          <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center font-bold">
            {MOCK.customer.dealer.split(" ").map(w => w[0]).slice(0,2).join("")}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-[#06194A] truncate">{MOCK.customer.dealer}</div>
            <div className="text-[11.5px] text-[#0F7A3E] inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Online now</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-[#8893A8] mb-1.5">Quick questions</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Can I get more for trade-in vs sale?",
              "How is the offer calculated?",
              "When will I receive payment?",
              "What if my mileage changes?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setAskMsg((m) => m + q + "\n")}
                className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-full bg-[#EEF0FF] text-[#4F46E5] hover:bg-[#DCE0FF] transition"
              >{q}</button>
            ))}
          </div>
        </div>

        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-[#8893A8]">Your message</span>
          <textarea
            rows={6} value={askMsg} onChange={(e) => setAskMsg(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none"
          />
        </label>

        <button className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#4F46E5] font-semibold hover:underline">
          <Paperclip className="w-3.5 h-3.5" /> Attach a file
        </button>
      </SlideOver>

      {/* Full breakdown */}
      <SlideOver open={breakdown} onClose={() => setBreakdown(false)} title="Full Offer Breakdown" subtitle="How we arrived at your firm number" width="lg">
        <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#E0E7FF] p-4 mb-4">
          <div className="text-[11px] uppercase tracking-wide text-[#4F46E5] font-semibold">Final Firm Offer</div>
          <div className="text-[28px] font-extrabold text-[#06194A] tabular-nums">{fmt(MOCK.firmOffer)}</div>
        </div>
        <ul className="space-y-4">
          {BREAKDOWN.map((b) => {
            const w = (Math.abs(b.value) / MAX_BAR) * 100;
            const positive = b.value >= 0;
            return (
              <li key={b.label}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#06194A] font-medium">{b.label}</span>
                  <span className={`font-bold tabular-nums ${positive ? "text-[#0F7A3E]" : "text-[#B45309]"}`}>{positive ? "+" : "−"}{fmt(Math.abs(b.value))}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-[#F4F6FA] overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${positive ? "bg-gradient-to-r from-[#22C55E] to-[#16A34A]" : "bg-gradient-to-r from-[#FCD9A8] to-[#F59E0B]"}`} />
                </div>
                <p className="text-[11.5px] text-[#53627A] mt-1.5">{b.why}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex items-center gap-2 text-[12px] text-[#53627A]">
          <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
          Adjustments derived from local sale data and your submitted condition.
        </div>
      </SlideOver>

      <AcceptFlow open={accept} onClose={() => setAccept(false)} onNavigate={onNavigate} />
    </PortalPageShell>
  );
};

export default OffersPage;
