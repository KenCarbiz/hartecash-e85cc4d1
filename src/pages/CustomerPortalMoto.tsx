// Customer portal dashboard — full Moto-template build per the
// product owner's detailed spec.
//
// All MOCK data for now (Alex Morgan / Liberty Automotive / 2021
// Toyota RAV4 XLE / $20,150 firm offer). Real data wiring is a
// follow-up; the structural goal of this rebuild is to land the
// polished dashboard layout the PO referenced.
//
// Anatomy:
//   * Left sidebar (220px) — brand wordmark + 8-item nav + Need Help
//     support card pinned at the bottom
//   * Top header — greeting + acquisition overview line on the left;
//     search / bell / avatar+name+dealer dropdown on the right
//   * KPI strip — 4 equal cards (Estimated Value range / Firm Offer
//     / Market Demand / Response Time) with tinted icon tiles
//   * Main row (2/3 + 1/3) — vehicle overview card with concentric
//     halo + VIN copy + value range + mini sparkline | next step
//     card with shaded firm-offer block + 3 trust chips + CTA
//   * Bottom row (1 / 1 / 1.4 / 1) — Dealer Communication / Documents
//     Status / Market Insights with 7-day chart / Quick Actions
//   * Two modals — Conversation thread + Manage Documents
//
// Reuses the existing shadcn Dialog primitive at @/components/ui/dialog.
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Handshake,
  Home,
  LifeBuoy,
  MessageCircle,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Tag,
  TrendingUp,
  Truck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ────────────────────────────────────────────────────────────────
// Mock data (replace with real submission/dealer/doc data later).
// ────────────────────────────────────────────────────────────────

const MOCK = {
  customer: { firstName: "Alex", fullName: "Alex Morgan", initials: "AM" },
  dealer: { name: "Liberty Automotive" },
  vehicle: {
    year: "2021",
    make: "Toyota",
    model: "RAV4",
    trim: "XLE",
    mileage: "26,540 mi",
    drivetrain: "2.5L AWD",
    bodyStyle: "SUV",
    vin: "2T3P1RFVXMW123456",
  },
  metrics: {
    estimatedLow: 19250,
    estimatedHigh: 21450,
    firmOffer: 20150,
    marketDemand: "High",
    responseTime: "2.4 hrs",
  },
  offer: {
    amount: 20150,
    expires: "May 17, 2025",
  },
  dealerComm: {
    status: "Active",
    lastUpdate: "2 min ago",
    preview:
      "Thanks! Your vehicle details look great. We're excited to make you a firm offer.",
  },
  documents: [
    { label: "Registration", status: "Uploaded" as const },
    { label: "Title", status: "Uploaded" as const },
    { label: "Odometer Photo", status: "Uploaded" as const },
    { label: "Inspection Report", status: "Uploaded" as const },
  ],
  conversation: [
    {
      from: "dealer" as const,
      name: "Liberty Automotive",
      time: "2 min ago",
      body: "Thanks! Your vehicle details look great. We're excited to make you a firm offer.",
    },
    {
      from: "customer" as const,
      name: "You",
      time: "Just now",
      body: "Great, thank you. What happens next?",
    },
    {
      from: "dealer" as const,
      name: "Liberty Automotive",
      time: "Just now",
      body: "We'll review your documents and keep you updated here.",
    },
  ],
} as const;

const NAV_ITEMS = [
  { label: "Dashboard", icon: Home, active: true },
  { label: "Vehicles", icon: CarFront, active: false },
  { label: "Offers", icon: Tag, active: false },
  { label: "Activity", icon: Activity, active: false },
  { label: "Messages", icon: MessageCircle, active: false },
  { label: "Documents", icon: FileText, active: false },
  { label: "Analytics", icon: BarChart3, active: false },
  { label: "Settings", icon: Settings, active: false },
];

const formatMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ────────────────────────────────────────────────────────────────
// Inline SVG charts.
// ────────────────────────────────────────────────────────────────

const VehicleMiniChart = () => (
  <svg
    viewBox="0 0 320 60"
    className="w-full h-12"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="vc-mini-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M 0 48 L 30 44 L 60 46 L 90 38 L 120 40 L 150 32 L 180 28 L 210 24 L 240 18 L 270 16 L 300 10 L 320 6 L 320 60 L 0 60 Z"
      fill="url(#vc-mini-fill)"
    />
    <path
      d="M 0 48 L 30 44 L 60 46 L 90 38 L 120 40 L 150 32 L 180 28 L 210 24 L 240 18 L 270 16 L 300 10 L 320 6"
      fill="none"
      stroke="#22c55e"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {[
      [0, 48],
      [120, 40],
      [240, 18],
      [320, 6],
    ].map(([x, y], i) => (
      <circle
        key={i}
        cx={x}
        cy={y}
        r="2.5"
        fill="#fff"
        stroke="#22c55e"
        strokeWidth="1.75"
      />
    ))}
  </svg>
);

const MarketInsightsChart = () => {
  const days = ["May 9", "May 10", "May 11", "May 12", "May 13", "May 14", "May 15"];
  const ys = [54, 48, 42, 36, 30, 22, 12];
  const w = 360;
  const h = 120;
  const stepX = w / (days.length - 1);
  const pts = ys.map((y, i) => [i * stepX, y] as const);
  const linePath = pts
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mi-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            x2={w}
            y1={h * p}
            y2={h * p}
            stroke="#e6eaf0"
            strokeWidth="0.5"
          />
        ))}
        <path d={areaPath} fill="url(#mi-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.5"
            fill="#fff"
            stroke="#22c55e"
            strokeWidth="1.75"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-slate-400">
        {days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// Vehicle illustration — placeholder white SUV silhouette so the
// page reads as finished without a real image. Pure SVG, scales.
// ────────────────────────────────────────────────────────────────

const VehicleIllustration = () => (
  <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true">
    <ellipse cx="160" cy="158" rx="120" ry="6" fill="#0f172a" opacity="0.08" />
    <path
      d="M 40 130 Q 40 105 60 100 L 95 92 Q 115 70 145 68 L 200 68 Q 235 70 252 92 L 285 105 Q 295 110 295 125 L 295 138 Q 295 142 290 142 L 250 142 Q 245 130 232 130 Q 219 130 214 142 L 122 142 Q 117 130 104 130 Q 91 130 86 142 L 45 142 Q 40 142 40 138 Z"
      fill="#f8fafc"
      stroke="#cbd5e1"
      strokeWidth="1.5"
    />
    <path
      d="M 100 96 Q 120 78 145 76 L 195 76 Q 220 78 237 96 L 195 96 L 100 96 Z"
      fill="#e0eaf5"
      stroke="#cbd5e1"
      strokeWidth="1"
    />
    <line x1="170" y1="78" x2="170" y2="96" stroke="#cbd5e1" strokeWidth="1" />
    <line x1="170" y1="100" x2="170" y2="130" stroke="#e2e8f0" strokeWidth="1" />
    <ellipse cx="278" cy="118" rx="6" ry="4" fill="#fde68a" opacity="0.6" />
    <circle cx="104" cy="142" r="14" fill="#1e293b" />
    <circle cx="104" cy="142" r="6" fill="#475569" />
    <circle cx="232" cy="142" r="14" fill="#1e293b" />
    <circle cx="232" cy="142" r="6" fill="#475569" />
  </svg>
);

// ────────────────────────────────────────────────────────────────
// Sidebar.
// ────────────────────────────────────────────────────────────────

const Sidebar = () => (
  <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-[#E6EAF0] bg-white">
    <div className="px-5 py-6 border-b border-[#E6EAF0]">
      <p className="text-[15px] font-bold tracking-tight text-[#06194A]">
        Harte Auto Group
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mt-1">
        Customer Portal
      </p>
    </div>
    <nav className="flex-1 px-3 py-4">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <button
                type="button"
                className={[
                  "w-full flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-colors",
                  item.active
                    ? "bg-[hsl(220_100%_96%)] text-[#3B35FF]"
                    : "text-[#53627A] hover:bg-slate-50 hover:text-[#06194A]",
                ].join(" ")}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
    <div className="p-3">
      <div className="rounded-2xl border border-[#E6EAF0] bg-slate-50/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(220_100%_96%)] flex items-center justify-center">
            <LifeBuoy className="w-4 h-4 text-[#3B35FF]" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-semibold text-[#06194A]">Need Help?</p>
        </div>
        <p className="text-xs text-[#53627A] leading-relaxed mb-3">
          Our team is here to help you every step of the way.
        </p>
        <button
          type="button"
          className="w-full h-9 rounded-xl bg-[#3B35FF] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#2f29e0] transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Contact Support
        </button>
      </div>
    </div>
  </aside>
);

// ────────────────────────────────────────────────────────────────
// Top header.
// ────────────────────────────────────────────────────────────────

const TopHeader = () => (
  <header className="flex items-center justify-between gap-4 px-6 lg:px-8 py-5 lg:py-7">
    <div>
      <h1 className="text-2xl lg:text-[28px] font-bold text-[#06194A] tracking-tight">
        Hi, {MOCK.customer.firstName} <span className="inline-block">👋</span>
      </h1>
      <p className="text-sm text-[#53627A] mt-1">Here's your acquisition overview.</p>
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Search"
        className="w-10 h-10 rounded-xl bg-white border border-[#E6EAF0] flex items-center justify-center text-[#53627A] hover:text-[#06194A] hover:border-slate-300 transition-colors"
      >
        <Search className="w-4 h-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Notifications"
        className="relative w-10 h-10 rounded-xl bg-white border border-[#E6EAF0] flex items-center justify-center text-[#53627A] hover:text-[#06194A] hover:border-slate-300 transition-colors"
      >
        <BellRing className="w-4 h-4" strokeWidth={2} />
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
      </button>
      <button
        type="button"
        className="flex items-center gap-3 pl-1 pr-3 h-10 rounded-xl bg-white border border-[#E6EAF0] hover:border-slate-300 transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-[hsl(220_100%_96%)] text-[#3B35FF] text-xs font-semibold inline-flex items-center justify-center">
          {MOCK.customer.initials}
        </span>
        <span className="text-left leading-tight hidden sm:block">
          <span className="block text-xs font-semibold text-[#06194A]">
            {MOCK.customer.fullName}
          </span>
          <span className="block text-[10px] text-[#53627A]">
            {MOCK.dealer.name}
          </span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#53627A]" />
      </button>
    </div>
  </header>
);

// ────────────────────────────────────────────────────────────────
// KPI strip.
// ────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  label: string;
  value: React.ReactNode;
  subline?: React.ReactNode;
}

const KpiCard = ({ icon: Icon, iconBg, iconFg, label, value, subline }: KpiProps) => (
  <div className="bg-white rounded-2xl border border-[#E6EAF0] p-5 flex items-center gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div
      className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
      style={{ background: iconBg }}
      aria-hidden="true"
    >
      <Icon className={`w-5 h-5 ${iconFg}`} strokeWidth={1.75} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#53627A] mb-1">
        {label}
      </p>
      <p className="text-base font-bold text-[#06194A] leading-tight tabular-nums truncate">
        {value}
      </p>
      {subline ? (
        <p className="text-xs text-[#53627A] mt-0.5 truncate">{subline}</p>
      ) : null}
    </div>
  </div>
);

const KpiStrip = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-6">
    <KpiCard
      icon={BarChart3}
      iconBg="hsl(220 100% 96%)"
      iconFg="text-[#3B35FF]"
      label="Estimated Value"
      value={`${formatMoney(MOCK.metrics.estimatedLow)} – ${formatMoney(MOCK.metrics.estimatedHigh)}`}
      subline={
        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
          <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
          Strong Market
        </span>
      }
    />
    <KpiCard
      icon={Tag}
      iconBg="hsl(142 71% 95%)"
      iconFg="text-emerald-600"
      label="Firm Offer"
      value={formatMoney(MOCK.metrics.firmOffer)}
      subline={MOCK.dealer.name}
    />
    <KpiCard
      icon={TrendingUp}
      iconBg="hsl(142 71% 95%)"
      iconFg="text-emerald-600"
      label="Market Demand"
      value={MOCK.metrics.marketDemand}
      subline="vs last 30 days"
    />
    <KpiCard
      icon={Clock}
      iconBg="hsl(38 92% 95%)"
      iconFg="text-amber-600"
      label="Response Time"
      value={MOCK.metrics.responseTime}
      subline="Dealer average"
    />
  </div>
);

// ────────────────────────────────────────────────────────────────
// Vehicle overview + next-step row.
// ────────────────────────────────────────────────────────────────

const VehicleOverviewCard = () => {
  const [copied, setCopied] = useState(false);
  const copyVin = async () => {
    try {
      await navigator.clipboard.writeText(MOCK.vehicle.vin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API can fail in non-secure contexts; silently ignore */
    }
  };
  return (
    <article className="bg-white rounded-3xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,1fr] gap-6 items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3B35FF] mb-3">
            Your Vehicle
          </p>
          <h2 className="text-2xl lg:text-[28px] font-bold text-[#06194A] leading-[1.15] tracking-tight mb-2">
            {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model} {MOCK.vehicle.trim}
          </h2>
          <p className="text-sm text-[#53627A] mb-3">
            {MOCK.vehicle.mileage}
            <span className="text-slate-300 mx-2">•</span>
            {MOCK.vehicle.drivetrain}
            <span className="text-slate-300 mx-2">•</span>
            {MOCK.vehicle.bodyStyle}
          </p>

          <button
            type="button"
            onClick={copyVin}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#53627A] hover:text-[#06194A] transition-colors mb-6 group"
            aria-label={copied ? "VIN copied" : `Copy VIN ${MOCK.vehicle.vin}`}
          >
            <span className="font-mono tabular-nums">{MOCK.vehicle.vin}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.5} />
            ) : (
              <Copy
                className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#06194A] transition-colors"
                strokeWidth={2}
              />
            )}
          </button>

          <div className="flex items-center gap-2 mb-6">
            <button
              type="button"
              aria-label="Previous"
              className="w-8 h-8 rounded-full border border-[#E6EAF0] bg-white text-[#53627A] hover:text-[#06194A] hover:border-slate-300 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next"
              className="w-8 h-8 rounded-full border border-[#E6EAF0] bg-white text-[#53627A] hover:text-[#06194A] hover:border-slate-300 transition-colors flex items-center justify-center"
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#53627A] mb-1">
            Estimated Value Range
          </p>
          <p className="text-2xl lg:text-[28px] font-bold text-[#06194A] tracking-tight tabular-nums leading-[1.1] mb-3">
            {formatMoney(MOCK.metrics.estimatedLow)} – {formatMoney(MOCK.metrics.estimatedHigh)}
          </p>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 mb-4">
            <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
            Strong Market
          </div>
          <VehicleMiniChart />
        </div>

        <div className="relative h-[220px] lg:h-[260px] flex items-center justify-center">
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute w-[360px] h-[360px] rounded-full"
              style={{ background: "hsl(220 100% 96% / 0.45)" }}
            />
            <div
              className="absolute w-[280px] h-[280px] rounded-full"
              style={{ background: "hsl(220 100% 96% / 0.7)" }}
            />
            <div
              className="absolute w-[200px] h-[200px] rounded-full"
              style={{ background: "hsl(220 100% 96%)" }}
            />
          </div>
          <div className="relative w-full max-w-md h-full flex items-center justify-center">
            <VehicleIllustration />
          </div>
        </div>
      </div>
    </article>
  );
};

const NextStepCard = () => (
  <article className="bg-white rounded-3xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 lg:p-7 flex flex-col h-full">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3B35FF] mb-2">
          Your Next Step
        </p>
        <h2 className="text-lg lg:text-xl font-bold text-[#06194A] leading-[1.2] tracking-tight">
          Your firm offer is ready!
        </h2>
        <p className="text-sm text-[#53627A] mt-1">
          Review your offer from {MOCK.dealer.name}.
        </p>
      </div>
      <div
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: "hsl(220 100% 96%)" }}
        aria-hidden="true"
      >
        <Tag className="w-4 h-4 text-[#3B35FF]" strokeWidth={1.75} />
      </div>
    </div>

    <div className="rounded-2xl bg-slate-50 border border-[#E6EAF0] p-4 mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#53627A] mb-1">
        Firm Offer
      </p>
      <p className="text-3xl lg:text-[32px] font-bold text-[#06194A] tracking-tight tabular-nums leading-[1.05] mb-1">
        {formatMoney(MOCK.offer.amount)}
      </p>
      <p className="text-xs text-[#53627A] mb-3">Offer Expires {MOCK.offer.expires}</p>
      <ul className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs text-[#53627A]">
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
          No Obligation
        </li>
        <li className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
          Free Pickup
        </li>
        <li className="flex items-center gap-1.5 col-span-2">
          <Shield className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
          Secure &amp; Private
        </li>
      </ul>
    </div>

    <button
      type="button"
      className="mt-auto w-full h-11 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-95 active:opacity-90"
      style={{
        background:
          "linear-gradient(135deg, #6D28D9 0%, #3B35FF 50%, #6D28D9 100%)",
      }}
    >
      View Firm Offer
      <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
    </button>
  </article>
);

// ────────────────────────────────────────────────────────────────
// Bottom-row cards.
// ────────────────────────────────────────────────────────────────

const DealerCommCard = ({ onOpen }: { onOpen: () => void }) => (
  <article className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 flex flex-col">
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3B35FF] mb-4">
      Dealer Communication
    </p>
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
        <Handshake className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#06194A] truncate">
          {MOCK.dealer.name}
        </p>
        <p className="text-[11px] text-[#53627A]">
          Last update: {MOCK.dealerComm.lastUpdate}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {MOCK.dealerComm.status}
      </span>
    </div>
    <div className="rounded-xl bg-slate-50 border border-[#E6EAF0] p-3 text-xs text-[#53627A] leading-relaxed mb-4">
      {MOCK.dealerComm.preview}
    </div>
    <button
      type="button"
      onClick={onOpen}
      className="mt-auto w-full h-10 rounded-xl border border-[#E6EAF0] text-sm font-semibold text-[#3B35FF] hover:bg-slate-50 transition-colors"
    >
      View Conversation
    </button>
  </article>
);

const DocumentsCard = ({ onOpen }: { onOpen: () => void }) => (
  <article className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 flex flex-col">
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3B35FF] mb-4">
      Documents Status
    </p>
    <ul className="space-y-2.5 mb-4">
      {MOCK.documents.map((d) => (
        <li key={d.label} className="flex items-center justify-between">
          <span className="text-sm text-[#06194A]">{d.label}</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            {d.status}
            <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
            </span>
          </span>
        </li>
      ))}
    </ul>
    <button
      type="button"
      onClick={onOpen}
      className="mt-auto w-full h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
    >
      Manage Documents
    </button>
  </article>
);

const MarketInsightsCard = () => (
  <article className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
    <div className="flex items-center justify-between mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3B35FF]">
        Market Insights
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#53627A] border border-[#E6EAF0] rounded-lg px-2 py-1 hover:border-slate-300"
      >
        7 Days
        <ChevronDown className="w-3 h-3" strokeWidth={2} />
      </button>
    </div>
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#53627A]">
            Market Trend
          </p>
          <p className="text-sm font-bold text-[#06194A]">Strong</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Activity className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[#53627A]">
            Market Demand
          </p>
          <p className="text-sm font-bold text-[#06194A]">High</p>
        </div>
      </div>
    </div>
    <MarketInsightsChart />
  </article>
);

interface QuickActionRow {
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  onClick?: () => void;
}

const QuickActionsCard = ({
  onUploadDocs,
  onMessage,
  onTrackOffer,
}: {
  onUploadDocs: () => void;
  onMessage: () => void;
  onTrackOffer: () => void;
}) => {
  const rows: QuickActionRow[] = [
    {
      icon: Upload,
      iconBg: "bg-emerald-50",
      iconFg: "text-emerald-600",
      title: "Upload Documents",
      body: "Upload and manage documents safely.",
      onClick: onUploadDocs,
    },
    {
      icon: MessageCircle,
      iconBg: "bg-amber-50",
      iconFg: "text-amber-600",
      title: "Message Dealer",
      body: "Message securely with your dealer to get answers.",
      onClick: onMessage,
    },
    {
      icon: BarChart3,
      iconBg: "bg-[hsl(220_100%_96%)]",
      iconFg: "text-[#3B35FF]",
      title: "Track Offer",
      body: "Monitor your offer status and your next steps.",
      onClick: onTrackOffer,
    },
  ];
  return (
    <article className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3B35FF] mb-4">
        Quick Actions
      </p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.title}>
              <button
                type="button"
                onClick={r.onClick}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors group"
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${r.iconBg}`}
                >
                  <Icon className={`w-4 h-4 ${r.iconFg}`} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#06194A] truncate">
                    {r.title}
                  </p>
                  <p className="text-[11px] text-[#53627A] truncate">{r.body}</p>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-slate-300 group-hover:text-[#3B35FF] transition-colors"
                  strokeWidth={2}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
};

// ────────────────────────────────────────────────────────────────
// Modals.
// ────────────────────────────────────────────────────────────────

const ConversationModal = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden">
      <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E6EAF0]">
        <DialogTitle className="text-base font-bold text-[#06194A]">
          Conversation with {MOCK.dealer.name}
        </DialogTitle>
        <DialogDescription className="text-xs text-[#53627A]">
          Messages between you and your dealer appear here.
        </DialogDescription>
      </DialogHeader>
      <div className="px-6 py-5 space-y-3 max-h-[420px] overflow-y-auto bg-slate-50/40">
        {MOCK.conversation.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={[
                "max-w-[80%] rounded-2xl p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                m.from === "customer"
                  ? "bg-[#3B35FF] text-white"
                  : "bg-white border border-[#E6EAF0] text-[#06194A]",
              ].join(" ")}
            >
              <p className="text-[11px] font-semibold mb-1 opacity-80">
                {m.name} <span className="font-normal opacity-60">· {m.time}</span>
              </p>
              <p className="text-sm leading-relaxed">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4 border-t border-[#E6EAF0] bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            disabled
            placeholder="Reply (sending disabled in demo)…"
            className="flex-1 h-10 px-3 rounded-xl border border-[#E6EAF0] bg-slate-50 text-sm text-[#06194A] placeholder:text-slate-400 cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            className="h-10 px-4 rounded-xl bg-[#3B35FF] text-white text-sm font-semibold opacity-50 cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const ManageDocumentsModal = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden">
      <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#E6EAF0]">
        <DialogTitle className="text-base font-bold text-[#06194A]">
          Manage Documents
        </DialogTitle>
        <DialogDescription className="text-xs text-[#53627A]">
          All your required documents are uploaded. Replace any below if needed.
        </DialogDescription>
      </DialogHeader>
      <ul className="px-6 py-5 space-y-3 max-h-[420px] overflow-y-auto">
        {MOCK.documents.map((d) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#E6EAF0] p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#06194A] truncate">
                  {d.label}
                </p>
                <p className="text-[11px] text-[#53627A]">
                  Uploaded · ready for review
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-[#3B35FF] hover:underline"
            >
              Replace
            </button>
          </li>
        ))}
      </ul>
    </DialogContent>
  </Dialog>
);

// ────────────────────────────────────────────────────────────────
// Page.
// ────────────────────────────────────────────────────────────────

const CustomerPortalMoto = () => {
  const [convoOpen, setConvoOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  // "Track Offer" focuses the firm-offer card by scrolling to its
  // anchor. Lightweight stand-in for a dedicated offer-status modal.
  const trackOffer = () => {
    const el = document.getElementById("next-step-card");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen flex bg-[#F7F8FB]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader />
        <main className="flex-1 px-6 lg:px-8 pb-10">
          <KpiStrip />

          <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-5 mb-5 items-stretch">
            <VehicleOverviewCard />
            <div id="next-step-card">
              <NextStepCard />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr,1fr,1.4fr,1fr] gap-5">
            <DealerCommCard onOpen={() => setConvoOpen(true)} />
            <DocumentsCard onOpen={() => setDocsOpen(true)} />
            <MarketInsightsCard />
            <QuickActionsCard
              onUploadDocs={() => setDocsOpen(true)}
              onMessage={() => setConvoOpen(true)}
              onTrackOffer={trackOffer}
            />
          </div>
        </main>
      </div>

      <ConversationModal open={convoOpen} onOpenChange={setConvoOpen} />
      <ManageDocumentsModal open={docsOpen} onOpenChange={setDocsOpen} />
    </div>
  );
};

export default CustomerPortalMoto;
