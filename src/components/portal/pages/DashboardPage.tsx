import { useRef, useState } from "react";
import {
  TrendingUp, Clock, Tag, BarChart3, ChevronLeft, ChevronRight, ChevronDown,
  ShieldCheck, Truck, Shield, Check, Copy, Handshake, MessageCircle,
  ArrowRight, Upload, MessageSquare, LineChart as LineIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { fmt } from "../portalMock";
import { usePortalData } from "../PortalDataContext";
import { SlideOver } from "../SlideOver";
import { PrimaryButton, SecondaryButton } from "../PortalPageShell";
import { VehicleHeroCarousel } from "../VehicleHeroCarousel";


/* ── small visuals (kept inline so the dashboard page is portable) ── */
const TINTS = {
  indigo:  "bg-[#EEF0FF] text-[#4F46E5]",
  green:   "bg-[#E8F8EE] text-[#16A34A]",
  emerald: "bg-[#E6F7F1] text-[#0E9F6E]",
  orange:  "bg-[#FEF3E2] text-[#F59E0B]",
} as const;

type Tint = keyof typeof TINTS;
const Metric = ({ label, value, sub, Icon, tint }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>; tint: Tint;
}) => (
  <div className="flex items-center gap-3.5 px-4 py-3">
    <div className={`w-11 h-11 rounded-2xl grid place-items-center shrink-0 ring-1 ring-inset ring-black/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${TINTS[tint]}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#53627A] font-semibold">{label}</div>
      <div className="text-[17px] font-extrabold text-[#06194A] leading-tight truncate mt-0.5 tracking-tight">{value}</div>
      {sub && <div className="text-[11.5px] text-[#53627A] mt-0.5">{sub}</div>}
    </div>
  </div>
);

const MiniTrend = () => {
  const pts = [10, 18, 14, 22, 26, 24, 32, 36, 34, 42, 46, 52];
  const w = 520, h = 84, pad = 6;
  const max = Math.max(...pts), min = Math.min(...pts);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${h} L${x(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[84px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dashFill)" />
      <path d={d} fill="none" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const MarketChart = () => {
  const pts = [22, 28, 24, 33, 38, 44, 52];
  const labels = ["May 9", "May 10", "May 11", "May 12", "May 13", "May 14", "May 15"];
  const w = 620, h = 170, padX = 28, padY = 14;
  const max = Math.max(...pts), min = Math.min(...pts);
  const x = (i: number) => padX + (i * (w - padX * 2)) / (pts.length - 1);
  const y = (v: number) => h - padY - ((v - min) / (max - min)) * (h - padY * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${h - padY} L${x(0)},${h - padY} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[110px]">
      <defs>
        <linearGradient id="mktFill2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mktFill2)" />
      <path d={d} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.75" fill="#fff" stroke="#16A34A" strokeWidth="1.75" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={h - 1} textAnchor="middle" fontSize="9" fill="#8893A8">{l}</text>
      ))}
    </svg>
  );
};

const MarketPill = () => (
  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#16A34A] bg-[#E8F8EE] px-2.5 py-1 rounded-full w-fit">
    <TrendingUp className="w-3 h-3" /> Strong Market
  </span>
);

/* Vehicle hero carousel slide labels */
const SLIDES = [
  "Vehicle Overview", "Photo Gallery", "Condition Report",
  "Offer Breakdown", "Market Intelligence", "Transaction Progress",
];

type Props = {
  onNavigate: (k: "offers" | "documents" | "messages" | "pickup" | "payments") => void;
};

export const DashboardPage = ({ onNavigate }: Props) => {
  const MOCK = usePortalData();
  const [copied, setCopied] = useState(false);
  const [slide, setSlide] = useState(0);
  const [showConv, setShowConv] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const offerRef = useRef<HTMLDivElement>(null);

  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(MOCK.vehicle.vin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const nextSlide = () => setSlide((s) => (s + 1) % SLIDES.length);
  const prevSlide = () => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#06194A] leading-tight">
            Hi, {MOCK.customer.name.split(" ")[0]} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-[#53627A] mt-1">Here's your acquisition overview.</p>
        </div>
      </div>

      {/* TOP — four-metric strip */}
      <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-4 grid grid-cols-2 lg:grid-cols-4">
        {[
          <Metric key="ev" label="Estimated Value" value={`${fmt(MOCK.range.low)} – ${fmt(MOCK.range.high)}`}
            sub={<span className="text-[#16A34A] font-medium inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" />Strong Market</span>}
            Icon={BarChart3} tint="indigo" />,
          <Metric key="fo" label="Firm Offer" value={fmt(MOCK.firmOffer)} sub={MOCK.customer.dealer}
            Icon={Tag} tint="emerald" />,
          <Metric key="md" label="Market Demand" value={MOCK.marketDemand} sub="vs last 30 days"
            Icon={TrendingUp} tint="green" />,
          <Metric key="rt" label="Response Time" value={MOCK.responseTime} sub="Dealer average"
            Icon={Clock} tint="orange" />,
        ].map((m, i) => (
          <div key={i} className={`relative ${i > 0 ? "lg:before:content-[''] lg:before:absolute lg:before:left-0 lg:before:top-1/2 lg:before:-translate-y-1/2 lg:before:h-[45%] lg:before:w-px lg:before:bg-[#E6EAF0]" : ""} ${i === 2 ? "before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[45%] before:w-px before:bg-[#E6EAF0] lg:before:hidden" : ""}`}>
            {m}
          </div>
        ))}
      </div>

      {/* MAIN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-stretch">
        {/* Vehicle hero carousel — 6-slide intelligent transaction center */}
        <div className="lg:col-span-2 min-h-0">
          <VehicleHeroCarousel onViewOfferDetails={() => onNavigate("offers")} />
        </div>


        {/* Next Step card */}
        <div ref={offerRef} className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 flex flex-col">
          <div className="flex items-start justify-between">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Your Next Step</div>
            <div className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-[17px] font-bold mt-2 leading-snug">Your firm offer is ready!</h3>
          <p className="text-[12.5px] text-[#53627A] mt-0.5">Review your offer from {MOCK.customer.dealer}.</p>

          <div className="mt-3 rounded-2xl p-3.5 bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] border border-[#E0E7FF]">
            <div className="text-[10px] uppercase tracking-wide text-[#4F46E5] font-semibold">Firm Offer</div>
            <div className="text-[22px] font-extrabold leading-tight">{fmt(MOCK.firmOffer)}</div>
            <div className="text-[11px] text-[#53627A] mt-0.5">Offer Expires {MOCK.offerExpires}</div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-2.5 text-[11.5px] text-[#06194A]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />No Obligation</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#16A34A]" />Free Pickup</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#16A34A]" />Secure &amp; Private</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-[#BBF0D0] bg-[#E8F8EE] px-3 py-2">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#0F7A3E]">Deal Status</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0F7A3E]">
              <span className="w-4 h-4 rounded-full bg-[#16A34A] grid place-items-center">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </span>
              Ready to Move Forward
            </span>
          </div>

          <PrimaryButton onClick={() => setShowOffer(true)} className="mt-auto pt-3 w-full py-3">
            View Firm Offer <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>
      </div>

      {/* BOTTOM ROW — polished supporting dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr_1fr] gap-4 items-stretch">
        {/* Dealer Communication */}
        <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3.5 flex flex-col">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-2">Dealer Communication</div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full bg-[#FEF3E2] text-[#F59E0B] grid place-items-center shrink-0">
              <Handshake className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#16A34A] ring-2 ring-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13.5px] font-semibold text-[#06194A] truncate">{MOCK.customer.dealer}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#53627A] leading-tight mt-0.5">
                <span className="inline-flex items-center gap-1 text-[#0F7A3E] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Active now
                </span>
                <span className="text-[#CBD5E1]">·</span>
                <span>Replies quickly</span>
              </div>
            </div>
          </div>
          <div className="mt-2.5 rounded-xl bg-[#F4F6FA] border border-[#EAEDF3] px-3 py-2 text-[12.5px] text-[#0B1F4A] leading-snug">
            <span className="line-clamp-3">“{MOCK.dealerMessage}”</span>
            <div className="text-[10.5px] text-[#53627A] mt-1.5">{MOCK.lastUpdate}</div>
          </div>
          <PrimaryButton onClick={() => setShowConv(true)} className="mt-auto pt-2.5 w-full py-2">
            <MessageCircle className="w-4 h-4" /> View Conversation <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>

        {/* Documents */}
        {(() => {
          const docs = MOCK.docs.slice(0, 4);
          const approved = docs.filter((d) => d.status === "Approved").length;
          const pct = Math.round((approved / docs.length) * 100);
          const statusStyle = (s: string) =>
            s === "Approved"
              ? "bg-[#E8F8EE] text-[#0F7A3E]"
              : s === "Under Review"
              ? "bg-[#FEF3E2] text-[#B45309]"
              : "bg-[#EEF0FF] text-[#4F46E5]";
          return (
            <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3.5 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Documents</div>
                <span className="text-[11px] font-semibold text-[#06194A]">{approved} of {docs.length} approved</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#EEF0F4] overflow-hidden mb-2.5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#16A34A] to-[#22C55E] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <ul className="space-y-1.5">
                {docs.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-[#0B1F4A] font-medium truncate">{d.name}</span>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle(d.status)}`}>
                      {d.status === "Approved" && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      {d.status}
                    </span>
                  </li>
                ))}
              </ul>
              <SecondaryButton onClick={() => onNavigate("documents")} className="mt-auto pt-2.5 w-full py-2">
                Manage Documents
              </SecondaryButton>
            </div>
          );
        })()}

        {/* Market Pulse */}
        <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3.5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Market Pulse</div>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0F7A3E] bg-[#E8F8EE] px-1.5 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" /> +$550 · 7d
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#F7F8FB] border border-[#EEF0F4] px-2.5 py-1.5">
              <div className="text-[9.5px] uppercase tracking-wide text-[#53627A] font-semibold">Trend</div>
              <div className="text-[13px] font-bold text-[#0B1F4A] leading-tight">Strong</div>
            </div>
            <div className="rounded-xl bg-[#F7F8FB] border border-[#EEF0F4] px-2.5 py-1.5">
              <div className="text-[9.5px] uppercase tracking-wide text-[#53627A] font-semibold">Demand</div>
              <div className="text-[13px] font-bold text-[#0B1F4A] leading-tight">High</div>
            </div>
          </div>
          <div className="mt-2 text-[12px] text-[#06194A] font-medium leading-snug">
            Similar SUVs are trending upward in your area.
          </div>
          <div className="mt-1 flex-1 flex items-center">
            <MarketChart />
          </div>
          <div className="text-[10.5px] text-[#53627A] mt-1">7-day trend · updated recently</div>
        </div>

        {/* Next Best Actions */}
        <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3.5">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-1.5">Next Best Actions</div>
          <ul className="divide-y divide-[#EEF0F4]">
            {[
              { title: "Upload Documents", desc: "Finish your paperwork.",   Icon: Upload,        tint: "green" as Tint,   onClick: () => onNavigate("documents") },
              { title: "Schedule Pickup",  desc: "Pick a handoff date.",     Icon: Truck,         tint: "indigo" as Tint,  onClick: () => onNavigate("pickup") },
              { title: "Message Dealer",   desc: "Chat with your dealer.",   Icon: MessageSquare, tint: "orange" as Tint,  onClick: () => setShowConv(true) },
              { title: "Track Offer",      desc: "See status and updates.",  Icon: BarChart3,     tint: "emerald" as Tint, onClick: () => onNavigate("offers") },
            ].map(({ title, desc, Icon, tint, onClick }) => (
              <li key={title}>
                <button onClick={onClick}
                  className="group w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg hover:bg-[#F7F8FB] active:bg-[#EEF0FF] transition text-left">
                  <div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${TINTS[tint]} ring-1 ring-inset ring-black/[0.03] group-hover:scale-[1.06] transition-transform`}>
                    <Icon className="w-[15px] h-[15px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#06194A] leading-tight group-hover:text-[#4F46E5] transition-colors">{title}</div>
                    <div className="text-[10.5px] text-[#53627A] truncate mt-0.5">{desc}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#4F46E5] group-hover:translate-x-0.5 transition" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Slide-overs */}
      <SlideOver open={showConv} onClose={() => setShowConv(false)}
        title={`Conversation with ${MOCK.customer.dealer}`}
        subtitle="Secure messaging with your dealer team"
        footer={
          <div className="flex items-center gap-2">
            <input placeholder="Type a message…" className="flex-1 rounded-xl border border-[#E6EAF0] bg-[#F7F8FB] px-3 py-2.5 text-sm" />
            <PrimaryButton>Send</PrimaryButton>
          </div>
        }>
        <div className="space-y-3">
          {[
            { who: "dealer", text: MOCK.dealerMessage, time: "2 min ago" },
            { who: "you",    text: "Great, thank you. What happens next?", time: "1 min ago" },
            { who: "dealer", text: "We'll review your documents and keep you updated here.", time: "Just now" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                m.who === "you" ? "bg-[#4F46E5] text-white" : "bg-[#F4F6FA] text-[#06194A]"
              }`}>
                {m.text}
                <div className={`text-[10px] mt-1 ${m.who === "you" ? "text-white/70" : "text-[#53627A]"}`}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
      </SlideOver>

      <SlideOver open={showOffer} onClose={() => setShowOffer(false)}
        title="Firm Offer Details" subtitle={MOCK.customer.dealer} width="lg"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setShowOffer(false)}>Close</SecondaryButton>
            <PrimaryButton onClick={() => { setShowOffer(false); onNavigate("offers"); }}>
              Open Offers <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </div>
        }>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] border border-[#E0E7FF]">
          <div className="text-[10px] uppercase tracking-wide text-[#4F46E5] font-semibold">Firm Offer</div>
          <div className="text-[28px] font-extrabold leading-tight">{fmt(MOCK.firmOffer)}</div>
          <div className="text-xs text-[#53627A]">Offer Expires {MOCK.offerExpires}</div>
        </div>
        <p className="text-sm text-[#53627A] mt-3 leading-snug">
          This firm cash offer is held for you by {MOCK.customer.dealer}. No obligation, secure &amp; private, and free pickup included.
        </p>
      </SlideOver>
    </motion.div>
  );
};

export default DashboardPage;
