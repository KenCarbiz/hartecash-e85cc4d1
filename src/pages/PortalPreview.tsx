import { useState, useEffect, useRef } from "react";
import {
  Home, Car, Tag, Activity, MessageCircle, FileText, BarChart3, Settings,
  Search, Bell, ChevronDown, ChevronLeft, ChevronRight, Copy, Check,
  TrendingUp, Clock, Shield, ShieldCheck, Truck, Handshake,
  Upload, MessageSquare, LineChart as LineIcon, X, ArrowRight,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────
   Premium customer portal dashboard (preview / mock).
   Route: /portal-preview
   All data is static; meant to match the supplied reference image.
   ────────────────────────────────────────────────────────────────── */

const MOCK = {
  customer: { name: "Alex Morgan", initials: "AM", dealer: "Liberty Automotive" },
  vehicle: {
    year: 2021, make: "Toyota", model: "RAV4", trim: "XLE",
    miles: "26,540", engine: "2.5L", body: "SUV",
    vin: "2T3P1RFVXMW123456",
  },
  range: { low: 19250, high: 21450 },
  firmOffer: 20150,
  offerExpires: "May 17, 2025",
  marketDemand: "High" as "High" | "Medium" | "Low" | "Minimal",
  responseTime: "2.4 hrs",
  lastUpdate: "2 min ago",
  dealerMessage:
    "Thanks! Your vehicle details look great. We're excited to make you a firm offer.",
  docs: [
    { name: "Registration", status: "Uploaded" },
    { name: "Title", status: "Uploaded" },
    { name: "Odometer Photo", status: "Uploaded" },
    { name: "Inspection Report", status: "Uploaded" },
  ],
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

/* ── Sidebar ─────────────────────────────────────────────────────── */
const NAV = [
  { key: "dashboard", label: "Dashboard", Icon: Home, active: true },
  { key: "vehicles", label: "Vehicles", Icon: Car },
  { key: "offers", label: "Offers", Icon: Tag },
  { key: "activity", label: "Activity", Icon: Activity },
  { key: "messages", label: "Messages", Icon: MessageCircle },
  { key: "documents", label: "Documents", Icon: FileText },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "settings", label: "Settings", Icon: Settings },
];

const Sidebar = () => (
  <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-white border-r border-[#E6EAF0] py-6 px-3">
    <div className="px-3 mb-8">
      <div className="text-[15px] font-black tracking-tight text-[#06194A]">
        Harte<span className="text-[#4F46E5]"> Auto</span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#53627A]">Group</div>
    </div>
    <nav className="flex-1 flex flex-col gap-1">
      {NAV.map(({ key, label, Icon, active }) => (
        <button
          key={key}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors text-left ${
            active
              ? "bg-[#EEF0FF] text-[#4F46E5] font-semibold"
              : "text-[#53627A] hover:bg-[#F4F6FA]"
          }`}
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.25 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
    <div className="mt-6 rounded-2xl border border-[#E6EAF0] bg-white p-4">
      <div className="text-sm font-semibold text-[#06194A]">Need Help?</div>
      <p className="text-xs text-[#53627A] mt-1 mb-3 leading-snug">
        Our team is here to help you every step of the way.
      </p>
      <button className="w-full rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] text-white text-xs font-semibold py-2.5 inline-flex items-center justify-center gap-1.5 transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
        Contact Support
      </button>
    </div>
  </aside>
);

/* ── Header ──────────────────────────────────────────────────────── */
const Header = () => (
  <header className="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 className="text-[22px] sm:text-[26px] font-bold text-[#06194A] leading-tight">
        Hi, {MOCK.customer.name.split(" ")[0]} <span aria-hidden>👋</span>
      </h1>
      <p className="text-sm text-[#53627A] mt-1">Here's your acquisition overview.</p>
    </div>
    <div className="flex items-center gap-3">
      <button aria-label="Search" className="w-9 h-9 rounded-full hover:bg-white grid place-items-center text-[#53627A]">
        <Search className="w-[18px] h-[18px]" />
      </button>
      <button aria-label="Notifications" className="w-9 h-9 rounded-full hover:bg-white grid place-items-center text-[#53627A] relative">
        <Bell className="w-[18px] h-[18px]" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-[#F7F8FB]" />
      </button>
      <div className="flex items-center gap-2.5 pl-3 border-l border-[#E6EAF0]">
        <div className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-xs font-semibold">
          {MOCK.customer.initials}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-sm font-semibold text-[#06194A]">{MOCK.customer.name}</div>
          <div className="text-[11px] text-[#53627A]">{MOCK.customer.dealer}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-[#53627A]" />
      </div>
    </div>
  </header>
);

/* ── Summary metric ───────────────────────────────────────────────── */
type MetricProps = {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  tint: "indigo" | "green" | "emerald" | "orange";
};
const TINTS: Record<MetricProps["tint"], string> = {
  indigo: "bg-[#EEF0FF] text-[#4F46E5]",
  green: "bg-[#E8F8EE] text-[#16A34A]",
  emerald: "bg-[#E6F7F1] text-[#0E9F6E]",
  orange: "bg-[#FEF3E2] text-[#F59E0B]",
};
const Metric = ({ label, value, sub, Icon, tint }: MetricProps) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${TINTS[tint]}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-[#53627A] font-medium">{label}</div>
      <div className="text-[15px] font-bold text-[#06194A] leading-tight truncate">{value}</div>
      {sub && <div className="text-[11px] text-[#53627A] mt-0.5">{sub}</div>}
    </div>
  </div>
);

/* ── SVG line charts ─────────────────────────────────────────────── */
const MiniTrend = () => {
  // gentle rising curve
  const pts = [10, 18, 14, 22, 26, 24, 32, 36, 34, 42, 46, 52];
  const w = 520, h = 90, pad = 4;
  const max = Math.max(...pts), min = Math.min(...pts);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (pts.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${h} L${x(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[90px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="miniFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#miniFill)" />
      <path d={d} fill="none" stroke="#16A34A" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3.5" fill="#16A34A" />
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[170px]">
      <defs>
        <linearGradient id="mktFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padX} x2={w - padX} y1={padY + (h - padY * 2) * t} y2={padY + (h - padY * 2) * t}
          stroke="#EEF0F4" strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#mktFill)" />
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

/* ── Vehicle illustration (SVG SUV w/ shadow) ─────────────────────── */
const VehicleSVG = () => (
  <svg viewBox="0 0 360 220" className="w-full h-full" aria-label="Vehicle preview">
    <defs>
      <radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.55" />
        <stop offset="65%" stopColor="#E0E7FF" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="body" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#D9DEE8" />
      </linearGradient>
      <linearGradient id="window" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#2A3550" />
        <stop offset="100%" stopColor="#0F1A33" />
      </linearGradient>
      <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="180" cy="110" r="115" fill="url(#halo)" />
    {/* shadow */}
    <ellipse cx="190" cy="185" rx="125" ry="10" fill="url(#shadow)" />
    {/* body */}
    <path d="M55 150 Q60 110 100 100 L150 85 Q180 75 215 78 L260 84 Q295 90 318 115 L335 132 Q340 138 338 150 L335 162 Q333 168 325 168 L295 168 Q290 150 272 150 Q254 150 250 168 L145 168 Q140 150 122 150 Q104 150 100 168 L70 168 Q60 168 58 162 Z"
      fill="url(#body)" stroke="#B7BFCE" strokeWidth="0.75" />
    {/* windows */}
    <path d="M125 102 L155 90 Q180 82 210 85 L245 92 Q260 95 268 110 L255 118 L140 118 Z"
      fill="url(#window)" opacity="0.92" />
    <path d="M188 90 L188 118" stroke="#0B1530" strokeWidth="1.25" opacity="0.6" />
    {/* trim */}
    <path d="M60 150 L335 150" stroke="#9AA4B8" strokeWidth="0.5" opacity="0.6" />
    {/* headlight */}
    <path d="M320 128 L335 132 L334 142 L318 140 Z" fill="#F4F7FF" />
    {/* wheels */}
    <g>
      <circle cx="122" cy="170" r="22" fill="#1B2336" />
      <circle cx="122" cy="170" r="14" fill="#2A3550" />
      <circle cx="122" cy="170" r="6" fill="#0B1530" />
    </g>
    <g>
      <circle cx="272" cy="170" r="22" fill="#1B2336" />
      <circle cx="272" cy="170" r="14" fill="#2A3550" />
      <circle cx="272" cy="170" r="6" fill="#0B1530" />
    </g>
  </svg>
);

/* ── Modal ────────────────────────────────────────────────────────── */
const Modal = ({
  open, onClose, title, children, width = "max-w-md",
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1530]/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${width} bg-white rounded-2xl shadow-2xl border border-[#E6EAF0] overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6EAF0]">
          <h3 className="text-sm font-semibold text-[#06194A]">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[#F4F6FA] text-[#53627A]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

/* ── Page ─────────────────────────────────────────────────────────── */
const PortalPreview = () => {
  const [copied, setCopied] = useState(false);
  const [showConv, setShowConv] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const offerRef = useRef<HTMLDivElement>(null);

  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(MOCK.vehicle.vin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#06194A] flex">
      <Sidebar />

      <div className="flex-1 min-w-0 p-5 sm:p-7 lg:p-8">
        <Header />

        {/* TOP — four-metric strip */}
        <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-6 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EEF0F4]">
          <Metric label="Estimated Value" value={`${fmt(MOCK.range.low)} – ${fmt(MOCK.range.high)}`}
            sub={<span className="text-[#16A34A] font-medium inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" />Strong Market</span>}
            Icon={BarChart3} tint="indigo" />
          <Metric label="Best Offer" value={fmt(MOCK.firmOffer)} sub={MOCK.customer.dealer}
            Icon={Tag} tint="emerald" />
          <Metric label="Market Demand" value={MOCK.marketDemand} sub="vs last 30 days"
            Icon={TrendingUp} tint="green" />
          <Metric label="Response Time" value={MOCK.responseTime} sub="Dealer average"
            Icon={Clock} tint="orange" />
        </div>

        {/* MAIN ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Vehicle card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-2">Your Vehicle</div>
                <h2 className="text-[22px] font-bold leading-tight">
                  {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model} {MOCK.vehicle.trim}
                </h2>
                <p className="text-sm text-[#53627A] mt-1">
                  {MOCK.vehicle.miles} mi • {MOCK.vehicle.engine} • {MOCK.vehicle.body}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-[#53627A]">
                  <span className="font-mono tracking-tight">{MOCK.vehicle.vin}</span>
                  <button onClick={copyVin} aria-label="Copy VIN"
                    className="p-1 rounded-md hover:bg-[#F4F6FA] text-[#53627A]">
                    {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {copied && <span className="text-[10px] text-[#16A34A] font-medium">Copied</span>}
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <button aria-label="Previous" className="w-8 h-8 rounded-full border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button aria-label="Next" className="w-8 h-8 rounded-full border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="relative h-[200px] md:h-[220px]">
                <VehicleSVG />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#EEF0F4]">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-[#53627A]">Estimated Value Range</div>
                  <div className="text-[22px] font-bold leading-tight">
                    {fmt(MOCK.range.low)} – {fmt(MOCK.range.high)}
                  </div>
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-[#16A34A] bg-[#E8F8EE] px-2.5 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" /> Strong Market
                  </span>
                </div>
              </div>
              <div className="mt-3"><MiniTrend /></div>
            </div>
          </div>

          {/* Next Step card */}
          <div ref={offerRef} className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 flex flex-col">
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Your Next Step</div>
              <div className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-[18px] font-bold mt-2 leading-snug">Your firm offer is ready!</h3>
            <p className="text-sm text-[#53627A] mt-1">Review your offer from {MOCK.customer.dealer}.</p>

            <div className="mt-4 rounded-2xl p-4 bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] border border-[#E0E7FF]">
              <div className="text-[10px] uppercase tracking-wide text-[#4F46E5] font-semibold">Firm Offer</div>
              <div className="text-[24px] font-extrabold leading-tight">{fmt(MOCK.firmOffer)}</div>
              <div className="text-[11px] text-[#53627A] mt-0.5">Offer Expires {MOCK.offerExpires}</div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-3 text-[12px] text-[#06194A]">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />No Obligation</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#16A34A]" />Free Pickup</span>
                <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#16A34A]" />Secure &amp; Private</span>
              </div>
            </div>

            <button
              onClick={() => setShowOffer(true)}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-95 transition shadow-[0_8px_20px_-8px_rgba(79,70,229,0.55)]"
            >
              View Firm Offer <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr] gap-6">
          {/* Dealer Communication */}
          <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-3">Dealer Communication</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF3E2] text-[#F59E0B] grid place-items-center">
                <Handshake className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{MOCK.customer.dealer}</span>
                  <span className="text-[10px] font-semibold text-[#16A34A] bg-[#E8F8EE] px-1.5 py-0.5 rounded-full">Active</span>
                </div>
                <div className="text-[11px] text-[#53627A]">Last update: {MOCK.lastUpdate}</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-[#F4F6FA] p-3 text-[12px] text-[#06194A] leading-snug">
              {MOCK.dealerMessage}
            </div>
            <button onClick={() => setShowConv(true)}
              className="mt-3 w-full text-sm font-semibold text-[#4F46E5] bg-[#EEF0FF] hover:bg-[#E2E5FF] rounded-xl py-2.5 transition">
              View Conversation
            </button>
          </div>

          {/* Document Status */}
          <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-3">Documents Status</div>
            <ul className="space-y-2.5">
              {MOCK.docs.map((d) => (
                <li key={d.name} className="flex items-center justify-between text-sm">
                  <span className="text-[#06194A]">{d.name}</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#16A34A] font-medium">
                    Uploaded <span className="w-4 h-4 rounded-full bg-[#16A34A] grid place-items-center"><Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /></span>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowDocs(true)}
              className="mt-4 w-full text-sm font-semibold text-[#16A34A] bg-[#E8F8EE] hover:bg-[#D4F0E0] rounded-xl py-2.5 transition">
              Manage Documents
            </button>
          </div>

          {/* Market Insights */}
          <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">Market Insights</div>
              <button className="text-[11px] text-[#53627A] inline-flex items-center gap-1 border border-[#E6EAF0] rounded-lg px-2 py-1 hover:bg-[#F4F6FA]">
                7 Days <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E8F8EE] text-[#16A34A] grid place-items-center"><TrendingUp className="w-4 h-4" /></div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[#53627A]">Market Trend</div>
                  <div className="text-sm font-bold">Strong</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E8F8EE] text-[#16A34A] grid place-items-center"><LineIcon className="w-4 h-4" /></div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[#53627A]">Market Demand</div>
                  <div className="text-sm font-bold">High</div>
                </div>
              </div>
            </div>
            <MarketChart />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5] mb-3">Quick Actions</div>
            <ul className="space-y-2">
              {[
                { title: "Upload Documents", desc: "Upload and manage documents safely.", Icon: Upload, tint: "green" as const, onClick: () => setShowDocs(true) },
                { title: "Message Dealer", desc: "Chat securely with your dealer and get answers.", Icon: MessageSquare, tint: "orange" as const, onClick: () => setShowConv(true) },
                { title: "Track Offer", desc: "Monitor your offer status and next steps.", Icon: BarChart3, tint: "indigo" as const, onClick: () => setShowOffer(true) },
              ].map(({ title, desc, Icon, tint, onClick }) => (
                <li key={title}>
                  <button onClick={onClick}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F4F6FA] transition text-left">
                    <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${TINTS[tint]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#06194A]">{title}</div>
                      <div className="text-[11px] text-[#53627A] truncate">{desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#53627A]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Conversation modal */}
      <Modal open={showConv} onClose={() => setShowConv(false)} title={`Conversation with ${MOCK.customer.dealer}`}>
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {[
            { who: "dealer", text: MOCK.dealerMessage, time: "2 min ago" },
            { who: "you", text: "Great, thank you. What happens next?", time: "1 min ago" },
            { who: "dealer", text: "We'll review your documents and keep you updated here.", time: "Just now" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                m.who === "you" ? "bg-[#4F46E5] text-white" : "bg-[#F4F6FA] text-[#06194A]"
              }`}>
                {m.text}
                <div className={`text-[10px] mt-1 ${m.who === "you" ? "text-white/70" : "text-[#53627A]"}`}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input disabled placeholder="Type a message…" className="flex-1 rounded-xl border border-[#E6EAF0] bg-[#F4F6FA] px-3 py-2 text-sm text-[#53627A]" />
          <button disabled className="rounded-xl bg-[#4F46E5]/70 text-white text-sm font-semibold px-4 py-2">Send</button>
        </div>
      </Modal>

      {/* Documents modal */}
      <Modal open={showDocs} onClose={() => setShowDocs(false)} title="Manage Documents">
        <ul className="space-y-2.5">
          {MOCK.docs.map((d) => (
            <li key={d.name} className="flex items-center justify-between border border-[#E6EAF0] rounded-xl px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold text-[#06194A]">{d.name}</div>
                <div className="text-[11px] text-[#16A34A] font-medium inline-flex items-center gap-1">
                  <Check className="w-3 h-3" /> {d.status}
                </div>
              </div>
              <button className="text-xs font-semibold text-[#4F46E5] hover:bg-[#EEF0FF] rounded-lg px-3 py-1.5">Replace</button>
            </li>
          ))}
        </ul>
        <button className="mt-4 w-full rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] text-white text-sm font-semibold py-2.5 inline-flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> Upload New Document
        </button>
      </Modal>

      {/* Offer modal */}
      <Modal open={showOffer} onClose={() => setShowOffer(false)} title="Firm Offer Details">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] border border-[#E0E7FF]">
          <div className="text-[10px] uppercase tracking-wide text-[#4F46E5] font-semibold">Firm Offer</div>
          <div className="text-[28px] font-extrabold leading-tight">{fmt(MOCK.firmOffer)}</div>
          <div className="text-xs text-[#53627A]">Offer Expires {MOCK.offerExpires}</div>
        </div>
        <p className="text-sm text-[#53627A] mt-3 leading-snug">
          This firm cash offer is held for you by {MOCK.customer.dealer}. No obligation, secure &amp; private, and free pickup included.
        </p>
        <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm font-semibold py-2.5">
          Accept Offer
        </button>
      </Modal>
    </div>
  );
};

export default PortalPreview;
