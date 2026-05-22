import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Copy, Check, TrendingUp, Sparkles, Camera,
  ShieldCheck, Gauge, Star, Image as ImageIcon, Wrench, AlertCircle,
  Activity, Flame, Zap, MapPin, Clock, FileText, Truck, Wallet, Trophy,
  CircleDot, Plus, Brain,
} from "lucide-react";
import vehicleHero from "@/assets/portal-vehicle-rav4.png";
import { PORTAL_MOCK as MOCK, fmt } from "./portalMock";

/* ============================================================== */
/*  Slide data — single source of truth                            */
/* ============================================================== */

const PHOTO_CATEGORIES = [
  { id: "ext",  label: "Exterior",  count: 8,  ai: "Excellent Lighting",   tone: "green"  as const },
  { id: "int",  label: "Interior",  count: 6,  ai: "Dealer Ready",          tone: "green"  as const },
  { id: "whl",  label: "Wheels",    count: 4,  ai: "Sharp Focus",           tone: "green"  as const },
  { id: "odo",  label: "Odometer",  count: 1,  ai: "Minor Glare",           tone: "orange" as const },
  { id: "dmg",  label: "Damage",    count: 2,  ai: "Reviewed",              tone: "indigo" as const },
  { id: "doc",  label: "Documents", count: 3,  ai: "All Legible",           tone: "green"  as const },
];

const CONDITION = [
  { label: "Exterior",       tone: "green"  as const, status: "Excellent",          note: "Paint and panels in great shape." },
  { label: "Interior",       tone: "orange" as const, status: "Minor wear",         note: "Light driver-seat bolster wear." },
  { label: "Tires",          tone: "green"  as const, status: "Above average tread", note: "6/32\" remaining on all four." },
  { label: "Windshield",     tone: "green"  as const, status: "No cracks",          note: "Clean, no chips reported." },
  { label: "Mechanical",     tone: "green"  as const, status: "Healthy",            note: "No active codes detected." },
  { label: "Warning lights", tone: "green"  as const, status: "None active",        note: "Clean cluster on scan." },
  { label: "Accident history", tone: "green" as const, status: "Clean record",      note: "No reported incidents on file." },
];

const CONDITION_SCORE = 8.7;

const OFFER_FACTORS = [
  { label: "Base market value",       value:  19200, pct:  92, tone: "green"  as const, tip: "Wholesale baseline for your trim & year." },
  { label: "Low mileage adjustment",  value:    420, pct:  20, tone: "green"  as const, tip: "Under 30k miles increases dealer demand." },
  { label: "Condition adjustment",    value:    180, pct:   9, tone: "green"  as const, tip: "Above-average inspection grade." },
  { label: "Regional demand bonus",   value:    310, pct:  15, tone: "green"  as const, tip: "Hartford metro inventory down 18%." },
  { label: "Trim premium (XLE)",      value:    260, pct:  12, tone: "green"  as const, tip: "XLE attracts CPO buyers." },
  { label: "Seasonal adjustment",     value:    100, pct:   5, tone: "green"  as const, tip: "Spring SUV demand uplift." },
  { label: "Reconditioning estimate", value:   -320, pct:  15, tone: "red"    as const, tip: "Light detail and one tire rotation." },
];

const MARKET_TICKER = [
  { icon: TrendingUp, text: "SUVs under 30k miles trending upward",     tone: "green"  as const },
  { icon: Flame,      text: "Hartford inventory down 8% this week",      tone: "indigo" as const },
  { icon: Zap,        text: "High demand for clean-title RAV4 XLE",      tone: "indigo" as const },
  { icon: Activity,   text: "Pricing model refreshed 2 hours ago",       tone: "gray"   as const },
];

const TIMELINE = [
  { id: 1, label: "Vehicle Submitted",     state: "done"    as const, when: "May 11",            icon: FileText },
  { id: 2, label: "Offer Generated",       state: "done"    as const, when: "May 11",            icon: Wallet },
  { id: 3, label: "Documents Verified",    state: "done"    as const, when: "May 13",            icon: ShieldCheck },
  { id: 4, label: "Inspection Scheduled",  state: "active"  as const, when: "Awaiting",          icon: Gauge },
  { id: 5, label: "Pickup / Drop-Off",     state: "pending" as const, when: "Est. May 18",       icon: Truck },
  { id: 6, label: "Payment Released",      state: "pending" as const, when: "Within 2 hrs",      icon: Wallet },
  { id: 7, label: "Transaction Complete",  state: "pending" as const, when: "Final",             icon: Trophy },
];

/* ============================================================== */
/*  Slides                                                         */
/* ============================================================== */

const SLIDE_TITLES = [
  "Vehicle Overview", "Photo Gallery", "Condition Report",
  "Offer Breakdown", "Market Intelligence", "Transaction Progress",
];

// Fixed slide content height — keeps every slide visually consistent
// and prevents the carousel from pushing the bottom row off-screen.
const SLIDE_HEIGHT = "h-[280px] md:h-[300px]";

/* ---------- 1. Vehicle Overview --------------------------------- */
const VehicleOverviewSlide = ({ copied, onCopy }: { copied: boolean; onCopy: () => void }) => (
  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-center h-full">
    <div className="relative h-[140px] md:h-[200px] flex items-center justify-center overflow-hidden group">
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="w-[88%] h-[88%] rounded-full bg-[radial-gradient(circle_at_center,_rgba(167,139,250,0.32)_0%,_rgba(199,210,254,0.42)_38%,_rgba(224,231,255,0.18)_62%,_transparent_78%)] blur-[2px]" />
      </div>
      <img
        src={vehicleHero}
        alt={`${MOCK.vehicle.year} ${MOCK.vehicle.make} ${MOCK.vehicle.model}`}
        loading="lazy"
        className="relative z-10 max-h-full w-auto object-contain scale-[1.18] drop-shadow-[0_18px_14px_rgba(15,23,42,0.22)] transition-transform duration-500 group-hover:scale-[1.24]"
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[68%] h-[10px] rounded-[50%] bg-black/25 blur-md z-0" />
    </div>

    <div className="min-w-0">
      <h2 className="text-[19px] font-bold leading-tight tracking-tight text-[#06194A] truncate">
        {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model} {MOCK.vehicle.trim}
      </h2>
      <p className="text-[12px] text-[#53627A] mt-0.5 truncate">
        {MOCK.vehicle.miles} mi · {MOCK.vehicle.engine} · {MOCK.vehicle.body} · {MOCK.vehicle.drivetrain}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#53627A]">
        <span className="font-mono tracking-tight truncate">{MOCK.vehicle.vin}</span>
        <button onClick={onCopy} aria-label="Copy VIN" className="p-1 rounded-md hover:bg-[#F4F6FA] transition shrink-0">
          {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="mt-2.5 rounded-2xl border border-[#E6EEFB] bg-gradient-to-br from-[#F4F8FF] via-[#F2FBF6] to-[#F0FAF4] px-3.5 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#53627A]">Estimated Value Range</div>
        <div className="text-[20px] font-extrabold leading-none text-[#06194A] mt-1 whitespace-nowrap tracking-tight">
          {fmt(MOCK.range.low)} <span className="text-[#94A3B8] font-bold">–</span> {fmt(MOCK.range.high)}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#16A34A] bg-[#E8F8EE] px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" /> Strong Market
          </span>
          <span className="text-[10px] text-[#8893A8] inline-flex items-center gap-1">
            <Activity className="w-3 h-3" /> Updated 14 min ago
          </span>
        </div>
        <Mini />
      </div>
    </div>
  </div>
);

const Mini = () => {
  const pts = [10, 16, 14, 22, 26, 24, 32, 30, 38, 42, 46, 52];
  const w = 520, h = 56, pad = 4;
  const max = Math.max(...pts), min = Math.min(...pts);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${h} L${x(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[56px] mt-2" preserveAspectRatio="none">
      <defs>
        <linearGradient id="vhcMini" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#16A34A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#vhcMini)" />
      <path d={d} fill="none" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/* ---------- 2. Photo Gallery ------------------------------------ */
const PHOTO_STATUS: Record<string, { label: string; cls: string }> = {
  ext: { label: "Approved",     cls: "bg-[#E8F8EE] text-[#0F7A3E]" },
  int: { label: "Approved",     cls: "bg-[#E8F8EE] text-[#0F7A3E]" },
  whl: { label: "Approved",     cls: "bg-[#E8F8EE] text-[#0F7A3E]" },
  odo: { label: "Under Review", cls: "bg-[#FEF3E2] text-[#B45309]" },
  dmg: { label: "Optional",     cls: "bg-[#F4F6FA] text-[#53627A]" },
  doc: { label: "Uploaded",     cls: "bg-[#EEF0FF] text-[#4F46E5]" },
};

const PhotoGallerySlide = () => {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const cat = PHOTO_CATEGORIES[active];
  const TONE: Record<string, string> = {
    green:  "bg-[#E8F8EE] text-[#0F7A3E]",
    orange: "bg-[#FEF3E2] text-[#B45309]",
    indigo: "bg-[#EEF0FF] text-[#4F46E5]",
  };
  const totalPhotos = PHOTO_CATEGORIES.reduce((s, p) => s + p.count, 0);
  const approvedCount = PHOTO_CATEGORIES.filter((p) => PHOTO_STATUS[p.id].label === "Approved")
    .reduce((s, p) => s + p.count, 0);
  const reviewCount = PHOTO_CATEGORIES.filter((p) => PHOTO_STATUS[p.id].label === "Under Review")
    .reduce((s, p) => s + p.count, 0);

  const next = () => setActive((i) => (i + 1) % PHOTO_CATEGORIES.length);
  const prev = () => setActive((i) => (i - 1 + PHOTO_CATEGORIES.length) % PHOTO_CATEGORIES.length);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 h-full">
        {/* Left: preview + tabs */}
        <div className="flex flex-col min-h-0">
          <button
            onClick={() => setLightbox(true)}
            className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#EEF0FF] via-white to-[#F5F3FF] grid place-items-center group cursor-pointer text-left"
            aria-label={`View ${cat.label} gallery`}
          >
            {/* Soft floor glow */}
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="w-[80%] h-[80%] rounded-full bg-[radial-gradient(circle_at_center,_rgba(167,139,250,0.28)_0%,_rgba(199,210,254,0.32)_40%,_transparent_72%)] blur-[2px]" />
            </div>
            {/* Vehicle — vertically centered, with ground shadow */}
            <img
              src={vehicleHero}
              alt={cat.label}
              loading="lazy"
              className="relative z-10 max-h-[86%] w-auto object-contain scale-[1.06] drop-shadow-[0_18px_14px_rgba(15,23,42,0.22)] transition-transform duration-500 group-hover:scale-[1.12]"
            />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[58%] h-[10px] rounded-[50%] bg-black/25 blur-md z-0" />

            {/* AI lighting chip */}
            <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TONE[cat.tone]} z-20`}>
              <Sparkles className="w-3 h-3" /> {cat.ai}
            </span>
            {/* Photo count */}
            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-black/55 backdrop-blur px-2 py-0.5 rounded-full z-20">
              <ImageIcon className="w-3 h-3" /> {cat.count} {cat.label.toLowerCase()} photos
            </span>
            {/* Hover overlay */}
            <span className="absolute inset-0 bg-[#06194A]/0 group-hover:bg-[#06194A]/35 transition-colors z-10 flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#06194A]/85 backdrop-blur px-3 py-1.5 rounded-full">
                <ImageIcon className="w-3.5 h-3.5" /> View gallery
              </span>
            </span>
          </button>

          {/* Tabs */}
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 shrink-0">
            {PHOTO_CATEGORIES.map((p, i) => (
              <button key={p.id} onClick={() => setActive(i)}
                className={`px-3 h-8 rounded-lg shrink-0 text-[10.5px] font-semibold transition ${
                  i === active
                    ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_14px_-8px_rgba(79,70,229,0.6)]"
                    : "bg-white text-[#53627A] border border-[#E6EEFB] hover:bg-[#EEF0FF] hover:text-[#4F46E5]"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: list + summary + upload */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Photo Sets</div>
            <div className="text-[10px] text-[#8893A8]">
              {totalPhotos} added · <span className="text-[#0F7A3E] font-semibold">{approvedCount} approved</span>
              {reviewCount > 0 && <> · <span className="text-[#B45309] font-semibold">{reviewCount} in review</span></>}
            </div>
          </div>
          <ul className="mt-1.5 space-y-1 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {PHOTO_CATEGORIES.map((p, i) => {
              const status = PHOTO_STATUS[p.id];
              return (
                <li key={p.id}>
                  <button onClick={() => setActive(i)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition text-left ${
                      i === active ? "bg-[#EEF0FF] ring-1 ring-[#C7D2FE]" : "hover:bg-[#F7F8FB]"
                    }`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${TONE[p.tone]}`}>
                        <Camera className="w-3 h-3" />
                      </span>
                      <span className="text-[12.5px] font-semibold text-[#06194A] truncate">{p.label}</span>
                      <span className={`hidden sm:inline-flex items-center text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </span>
                    <span className="text-[11px] text-[#8893A8] tabular-nums shrink-0">{p.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#4F46E5] bg-[#FAFBFF] border border-dashed border-[#C7D2FE] hover:bg-[#EEF0FF] hover:border-[#A5B4FC] rounded-xl py-2 transition shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add More Photos
          </button>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#06194A]/85 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6EEFB]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TONE[cat.tone]}`}>
                    {cat.label}
                  </span>
                  <span className="text-[12px] text-[#53627A] truncate">{cat.ai}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#8893A8] tabular-nums">{active + 1} / {PHOTO_CATEGORIES.length}</span>
                  <button onClick={() => setLightbox(false)} aria-label="Close gallery"
                    className="w-8 h-8 rounded-full bg-[#F4F6FA] hover:bg-[#EEF0FF] grid place-items-center text-[#06194A]">
                    ✕
                  </button>
                </div>
              </div>
              <div className="relative bg-gradient-to-br from-[#EEF0FF] via-white to-[#F5F3FF] grid place-items-center h-[420px]">
                <img src={vehicleHero} alt={cat.label}
                  className="max-h-[88%] w-auto object-contain drop-shadow-[0_24px_24px_rgba(15,23,42,0.22)]" />
                <button onClick={prev} aria-label="Previous"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg grid place-items-center text-[#06194A]">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={next} aria-label="Next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg grid place-items-center text-[#06194A]">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/55 backdrop-blur px-2.5 py-1 rounded-full">
                  <ImageIcon className="w-3 h-3" /> {cat.count} {cat.label.toLowerCase()} photos
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};


/* ---------- 3. Condition Report --------------------------------- */
const ConditionSlide = () => {
  const TONE: Record<string, string> = {
    green:  "bg-[#E8F8EE] text-[#0F7A3E] border-[#BBF7D0]",
    orange: "bg-[#FEF3E2] text-[#B45309] border-[#FED7AA]",
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 h-full">
      <div className="rounded-2xl bg-gradient-to-br from-[#F5F3FF] via-white to-[#EEF0FF] border border-[#E0E7FF] p-3 flex flex-col items-center text-center min-h-0">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Condition Score</div>
        <div className="relative w-[96px] h-[96px] mt-2">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" stroke="#EEF0F4" strokeWidth="9" fill="none" />
            <motion.circle cx="60" cy="60" r="50" stroke="url(#cond)" strokeWidth="9" fill="none" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 50}
              initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - CONDITION_SCORE / 10) }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
            <defs>
              <linearGradient id="cond" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#16A34A" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-[22px] font-extrabold text-[#06194A] tabular-nums leading-none">{CONDITION_SCORE}</div>
              <div className="text-[10px] text-[#8893A8] mt-0.5">out of 10</div>
            </div>
          </div>
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[#4F46E5] bg-[#EEF0FF] px-2 py-0.5 rounded-full">
          <Brain className="w-3 h-3" /> AI confidence 94%
        </div>
        <div className="mt-2 text-[10.5px] text-[#53627A] leading-snug">
          Multi-source review of photos, scans, and notes.
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 content-start overflow-y-auto pr-0.5">
        {CONDITION.map((c) => (
          <li key={c.label} className={`rounded-xl border p-2.5 ${TONE[c.tone]}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-[#06194A]">{c.label}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold">
                {c.tone === "green" ? <CircleDot className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {c.status}
              </span>
            </div>
            <div className="text-[10.5px] text-[#53627A] mt-0.5 leading-snug">{c.note}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ---------- 4. Offer Breakdown --------------------------------- */
const OfferBreakdownSlide = () => {
  const maxAbs = Math.max(...OFFER_FACTORS.map((f) => Math.abs(f.value)));
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 h-full">
      <ul className="space-y-1.5 overflow-y-auto pr-1">
        {OFFER_FACTORS.map((f, i) => {
          const pct = (Math.abs(f.value) / maxAbs) * 100;
          const positive = f.value >= 0;
          return (
            <li key={f.label} className="group" title={f.tip}>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-[#06194A] truncate">{f.label}</span>
                <span className={`tabular-nums font-bold ${positive ? "text-[#0F7A3E]" : "text-[#B91C1C]"}`}>
                  {positive ? "+" : "−"}${Math.abs(f.value).toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 mt-1 rounded-full bg-[#F4F6FA] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${positive ? "bg-gradient-to-r from-[#16A34A] to-[#22C55E]" : "bg-gradient-to-r from-[#F87171] to-[#DC2626]"}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="rounded-2xl bg-gradient-to-br from-[#06194A] to-[#1E1B4B] text-white p-3.5 flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#A5B4FC]">Final Firm Offer</div>
        <div className="text-[26px] font-extrabold leading-none mt-1 tabular-nums">{fmt(MOCK.firmOffer)}</div>
        <div className="text-[11px] text-[#CBD5F5] mt-1">Held by {MOCK.customer.dealer}</div>
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1"><ShieldCheck className="w-3 h-3" /> No obligation</span>
          <span className="inline-flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1"><Truck className="w-3 h-3" /> Free pickup</span>
        </div>
        <div className="mt-auto pt-2 text-[10px] text-[#CBD5F5]">Expires {MOCK.offerExpires}</div>
      </div>
    </div>
  );
};

/* ---------- 5. Market Intelligence ------------------------------ */
const MarketSlide = () => {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((i) => (i + 1) % MARKET_TICKER.length), 3200); return () => clearInterval(id); }, []);
  const item = MARKET_TICKER[t];
  const Icon = item.icon;
  const TONE_BG: Record<string, string> = {
    green:  "bg-[#E8F8EE] text-[#0F7A3E]",
    indigo: "bg-[#EEF0FF] text-[#4F46E5]",
    gray:   "bg-[#F4F6FA] text-[#53627A]",
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 h-full">
      <div className="flex flex-col gap-2 min-h-0">
        <div className="rounded-2xl border border-[#E6EEFB] bg-gradient-to-br from-[#F4F8FF] to-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">30-Day Trend</div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#16A34A] bg-[#E8F8EE] px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" /> +$550
            </span>
          </div>
          <Mini />
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#8893A8]">
            <Activity className="w-3 h-3" /> Pricing refreshed 2 hrs ago
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#EEF0F4] bg-white p-2 text-center">
            <div className="text-[9.5px] uppercase tracking-wide text-[#8893A8] font-semibold">Demand</div>
            <div className="text-[13px] font-extrabold text-[#0F7A3E] mt-0.5">High</div>
          </div>
          <div className="rounded-xl border border-[#EEF0F4] bg-white p-2 text-center">
            <div className="text-[9.5px] uppercase tracking-wide text-[#8893A8] font-semibold">Regional Rank</div>
            <div className="text-[13px] font-extrabold text-[#06194A] mt-0.5">Top 12%</div>
          </div>
          <div className="rounded-xl border border-[#EEF0F4] bg-white p-2 text-center">
            <div className="text-[9.5px] uppercase tracking-wide text-[#8893A8] font-semibold">Avg DoM</div>
            <div className="text-[13px] font-extrabold text-[#06194A] mt-0.5">11 days</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#EEF0F4] bg-white px-3 py-2 flex items-center gap-3 overflow-hidden">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-[#16A34A] opacity-60 animate-ping" />
            <span className="relative rounded-full w-2 h-2 bg-[#16A34A]" />
          </span>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] shrink-0">Live</div>
          <div className="h-5 flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={t}
                initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex items-center gap-2 text-[12px] text-[#06194A]">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${TONE_BG[item.tone]}`}>
                  <Icon className="w-3 h-3" />
                </span>
                <span className="truncate">{item.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#E0E7FF] p-3.5 min-h-0">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">
          <Sparkles className="w-3 h-3" /> Best selling window
        </div>
        <div className="text-[16px] font-bold text-[#06194A] mt-1 leading-snug">Next 7–14 days</div>
        <div className="text-[11px] text-[#53627A] mt-0.5">May maximize your payout potential.</div>
        <ul className="mt-2 space-y-1 text-[11px]">
          <li className="flex items-start gap-1.5 text-[#06194A]"><MapPin className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> Hartford metro — high demand</li>
          <li className="flex items-start gap-1.5 text-[#06194A]"><Star className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> Top 12% offer regionally</li>
          <li className="flex items-start gap-1.5 text-[#06194A]"><Clock className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> Avg. days on market: 11</li>
        </ul>
      </div>
    </div>
  );
};

/* ---------- 6. Transaction Process ------------------------------ */
const TimelineSlide = () => (
  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 h-full">
    <ol className="space-y-1.5 overflow-y-auto pr-1">
      {TIMELINE.map((step, i) => {
        const Icon = step.icon;
        const done = step.state === "done";
        const active = step.state === "active";
        return (
          <li key={step.id} className="flex items-start gap-2.5">
            <div className="relative">
              <div className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                done ? "bg-[#16A34A] text-white" :
                active ? "bg-[#EEF0FF] text-[#4F46E5] ring-2 ring-[#4F46E5]/30" :
                "bg-[#F4F6FA] text-[#94A3B8]"
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
              </div>
              {i < TIMELINE.length - 1 && (
                <span className={`absolute left-1/2 -translate-x-1/2 top-7 h-[10px] w-px ${done ? "bg-[#16A34A]/50" : "bg-[#E6EAF0]"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#06194A] truncate">{step.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  done ? "bg-[#E8F8EE] text-[#0F7A3E]" :
                  active ? "bg-[#EEF0FF] text-[#4F46E5]" :
                  "bg-[#F4F6FA] text-[#8893A8]"
                }`}>
                  {done ? "Complete" : active ? "In progress" : step.when}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
    <div className="rounded-2xl border border-[#E0E7FF] bg-gradient-to-br from-[#F5F3FF] to-white p-3.5 min-h-0">
      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">
        <Zap className="w-3 h-3" /> What happens next?
      </div>
      <p className="text-[12px] text-[#06194A] mt-1.5 leading-snug">
        Your dealer is reviewing the documents. Once approved, you'll select a pickup time and inspection slot.
      </p>
      <ul className="mt-2 space-y-1 text-[11px] text-[#06194A]">
        <li className="flex items-start gap-1.5"><Wrench className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> AI-assisted inspection in minutes</li>
        <li className="flex items-start gap-1.5"><Truck className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> Free pickup, scheduled around you</li>
        <li className="flex items-start gap-1.5"><Wallet className="w-3 h-3 mt-0.5 text-[#4F46E5]" /> ACH released within 2 hrs of verification</li>
      </ul>
    </div>
  </div>
);

/* ============================================================== */
/*  Carousel shell                                                 */
/* ============================================================== */

export const VehicleHeroCarousel = () => {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [copied, setCopied] = useState(false);

  const go = useCallback((d: 1 | -1) => {
    setDirection(d);
    setSlide((s) => (s + d + SLIDE_TITLES.length) % SLIDE_TITLES.length);
  }, []);

  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(MOCK.vehicle.vin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) go(1);
    else if (info.offset.x > 60) go(-1);
  };

  const slideEl = useMemo(() => {
    switch (slide) {
      case 0: return <VehicleOverviewSlide copied={copied} onCopy={copyVin} />;
      case 1: return <PhotoGallerySlide />;
      case 2: return <ConditionSlide />;
      case 3: return <OfferBreakdownSlide />;
      case 4: return <MarketSlide />;
      case 5: return <TimelineSlide />;
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, copied]);

  return (
    <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 relative overflow-hidden h-full flex flex-col">
      {/* Header strip */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">
            {SLIDE_TITLES[slide]}
          </div>
          <div className="text-[12px] text-[#53627A] mt-0.5 truncate">
            {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model} {MOCK.vehicle.trim} · {MOCK.vehicle.miles} mi
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => go(-1)} aria-label="Previous slide"
            className="w-9 h-9 rounded-full border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#EEF0FF] hover:text-[#4F46E5] hover:border-[#C7D2FE] hover:scale-105 active:scale-95 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => go(1)} aria-label="Next slide"
            className="w-9 h-9 rounded-full border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#EEF0FF] hover:text-[#4F46E5] hover:border-[#C7D2FE] hover:scale-105 active:scale-95 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-semibold text-[#53627A] tabular-nums ml-1">{slide + 1} / {SLIDE_TITLES.length}</span>
        </div>
      </div>

      {/* Swipeable slide area with consistent height */}
      <div className={`relative ${SLIDE_HEIGHT}`}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide}
            custom={direction}
            initial={{ opacity: 0, x: direction * 32, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -direction * 32, scale: 0.985 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="absolute inset-0 touch-pan-y cursor-grab active:cursor-grabbing"
          >
            {slideEl}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot pagination */}
      <div className="flex items-center justify-center gap-1.5 mt-auto pt-3">
        {SLIDE_TITLES.map((_, i) => (
          <button key={i} onClick={() => { setDirection(i > slide ? 1 : -1); setSlide(i); }}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === slide ? "w-6 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" : "w-1.5 bg-[#E6EAF0] hover:bg-[#C7D2FE]"
            }`} />
        ))}
      </div>
    </div>
  );
};

export default VehicleHeroCarousel;
