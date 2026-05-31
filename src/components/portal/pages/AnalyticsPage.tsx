import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Sparkles, Car, MapPin, Activity, Flame,
  Gauge, Search, Clock, ShieldCheck, Zap, ArrowUpRight, ArrowDownRight,
  Filter, Target, Brain, AlertTriangle, CircleDot, CheckCircle2, CalendarClock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceDot,
} from "recharts";
import { fmt } from "../portalMock";
import { usePortalData } from "../PortalDataContext";
import {
  PortalPageShell, Card, SectionLabel, StatusPill,
  PrimaryButton,
} from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

/* ------------------------------------------------------------------ */
/*  Mock market intelligence data                                     */
/* ------------------------------------------------------------------ */

type SeriesPoint = {
  label: string;
  value: number;
  event?: { title: string; detail: string; tone: "up" | "down" | "info" };
};

const SERIES: SeriesPoint[] = [
  { label: "Apr 14", value: 19600 },
  { label: "Apr 21", value: 19850, event: { title: "Spring SUV demand rising", detail: "Regional inventory began tightening.", tone: "up" } },
  { label: "Apr 28", value: 20050 },
  { label: "May 5",  value: 20300, event: { title: "Seasonal pricing lift", detail: "Hartford SUV asking prices +2.4%.", tone: "up" } },
  { label: "May 9",  value: 20450, event: { title: "Demand spike detected", detail: "Hartford SUV inventory declined 8%.", tone: "up" } },
  { label: "May 12", value: 20520 },
  { label: "May 15", value: 20150 },
];

const COMPS = [
  { id: "c1", ymm: "2021 Toyota RAV4 XLE",     trim: "XLE",       mi: "24,800", ask: 24990, dom: 12, dist: 18, status: "active" as const, source: "dealer",  trend: "up"   as const },
  { id: "c2", ymm: "2020 Toyota RAV4 XLE",     trim: "XLE",       mi: "31,540", ask: 22995, dom: 28, dist: 42, status: "active" as const, source: "dealer",  trend: "flat" as const },
  { id: "c3", ymm: "2021 Honda CR-V EX",       trim: "EX",        mi: "28,210", ask: 24450, dom: 18, dist: 26, status: "sold"   as const, source: "dealer",  trend: "up"   as const },
  { id: "c4", ymm: "2022 Mazda CX-5 Touring",  trim: "Touring",   mi: "19,860", ask: 26100, dom: 9,  dist: 31, status: "active" as const, source: "private", trend: "up"   as const },
  { id: "c5", ymm: "2021 Toyota RAV4 LE",      trim: "LE",        mi: "29,400", ask: 22800, dom: 22, dist: 47, status: "sold"   as const, source: "dealer",  trend: "flat" as const },
];

const VALUE_FACTORS = [
  { label: "Low mileage benefit",          delta: "+$420", tone: "green"  as const, note: "Under 30k miles qualifies for premium programs." },
  { label: "Strong local SUV/truck demand",delta: "+$310", tone: "green"  as const, note: "Hartford metro running 18% below seasonal supply." },
  { label: "Desirable trim/package",       delta: "+$180", tone: "green"  as const, note: "XLE trim attracts CPO buyers." },
  { label: "Clean ownership history",      delta: "+$150", tone: "green"  as const, note: "Single owner, no accidents reported." },
  { label: "Reconditioning estimate",      delta: "−$110", tone: "orange" as const, note: "Light cosmetic wear noted in photos." },
];

const DEALER_REASONS = [
  "Low mileage compared with similar vehicles",
  "Strong demand for SUVs and trucks in this segment",
  "Local supply remains limited",
  "Clean history and verified details increase confidence",
];

const MARKET_TIMING = [
  { tone: "green"  as const, icon: TrendingUp,    title: "Reduced days supply",   detail: "Local availability is limited." },
  { tone: "orange" as const, icon: AlertTriangle, title: "Price softening risk",  detail: "Values can change as supply increases." },
  { tone: "indigo" as const, icon: CalendarClock, title: "Seasonal demand",       detail: "Demand is currently favorable." },
];

/* ------------------------------------------------------------------ */
/*  Atomic UI helpers                                                 */
/* ------------------------------------------------------------------ */

const Sparkline = ({ trend }: { trend: "up" | "flat" | "down" }) => {
  const path = trend === "up"
    ? "M0 16 L8 14 L16 12 L24 9 L32 6 L40 3"
    : trend === "down"
    ? "M0 4 L8 6 L16 9 L24 11 L32 14 L40 17"
    : "M0 10 L8 9 L16 11 L24 10 L32 11 L40 10";
  const color = trend === "up" ? "#16A34A" : trend === "down" ? "#DC2626" : "#8893A8";
  return (
    <svg viewBox="0 0 40 20" className="w-10 h-5">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* Simple, premium live-update banner. */
const LiveMarketBanner = () => (
  <Card className="px-4 py-3 mb-6 flex items-center gap-3 bg-gradient-to-r from-[#F0FDF4] via-white to-[#F0F9FF] border-[#D1FAE5]">
    <span className="relative flex w-2 h-2 shrink-0">
      <span className="absolute inset-0 rounded-full bg-[#16A34A] opacity-60 animate-ping" />
      <span className="relative rounded-full w-2 h-2 bg-[#16A34A]" />
    </span>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#0F7A3E]">
        Live Market Update
      </div>
      <div className="text-[13px] text-[#06194A] font-semibold mt-0.5 truncate">
        SUVs under 30k miles are trending higher this week.
      </div>
    </div>
    <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#8893A8] shrink-0">
      <Clock className="w-3 h-3" /> Updated 2 hrs ago
    </div>
  </Card>
);

/* ------------------------------------------------------------------ */
/*  Chart                                                             */
/* ------------------------------------------------------------------ */

const ChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SeriesPoint;
  return (
    <div className="rounded-xl bg-white border border-[#E6EAF0] shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] px-3 py-2 min-w-[180px]">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#8893A8]">{p.label}</div>
      <div className="text-[15px] font-extrabold text-[#06194A] tabular-nums mt-0.5">{fmt(p.value)}</div>
      {p.event && (
        <div className="mt-2 pt-2 border-t border-[#EEF0F4]">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#6D28D9]">
            {p.event.tone === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {p.event.title}
          </div>
          <div className="text-[11px] text-[#53627A] mt-0.5 leading-snug">{p.event.detail}</div>
        </div>
      )}
    </div>
  );
};

const ValueChart = () => {
  const current = SERIES[SERIES.length - 1];
  return (
    <div className="h-[240px] w-full -ml-2">
      <ResponsiveContainer>
        <AreaChart data={SERIES} margin={{ top: 14, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="anFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"  stopColor="#6D28D9" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6D28D9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EEF0F4" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#8893A8", fontSize: 10 }} />
          <YAxis domain={["dataMin - 250", "dataMax + 250"]} tickLine={false} axisLine={false}
                 tick={{ fill: "#8893A8", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={48} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#6D28D9", strokeOpacity: 0.25, strokeWidth: 1 }} />
          <Area
            type="monotone" dataKey="value" stroke="#6D28D9" strokeWidth={2.75}
            fill="url(#anFill)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: "#6D28D9" }}
            animationDuration={900} animationEasing="ease-out"
          />
          <ReferenceDot x={current.label} y={current.value} r={5} fill="#6D28D9" stroke="#fff" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

type DrawerKind = "comp" | "factors" | "forecast" | "strength" | "region" | null;

export const AnalyticsPage = () => {
  const MOCK = usePortalData();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [comp, setComp] = useState<typeof COMPS[number] | null>(null);
  const [filters, setFilters] = useState({ radius: 75, status: "all" as "all" | "active" | "sold", source: "all" as "all" | "dealer" | "private" });

  const filteredComps = useMemo(
    () => COMPS.filter((c) =>
      c.dist <= filters.radius
      && (filters.status === "all" || c.status === filters.status)
      && (filters.source === "all" || c.source === filters.source)
    ),
    [filters]
  );

  const stage = MOCK.transactionStage;
  const ctaSub = stage === "pre_schedule"
    ? `Offer expires ${MOCK.offerExpires}`
    : "Schedule your visit or pickup while demand remains strong.";

  return (
    <PortalPageShell
      title="Market Insights"
      subtitle="See what current demand, pricing trends, and local market activity mean for your vehicle."
      actions={
        <StatusPill tone="gray">
          <Clock className="w-3 h-3" /> Updated 2 hrs ago
        </StatusPill>
      }
    >
      <LiveMarketBanner />

      {/* ----- Hero: three clear blocks ----- */}
      <Card className="p-5 mb-6 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#6D28D9]/[0.06] blur-3xl pointer-events-none" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Block 1: Current Market Offer */}
          <div>
            <SectionLabel>Current Market Offer</SectionLabel>
            <div className="flex items-baseline gap-3 mt-1">
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="text-[34px] sm:text-[38px] font-extrabold text-[#06194A] tabular-nums leading-none"
              >
                {fmt(MOCK.firmOffer)}
              </motion.div>
              <StatusPill tone="green"><TrendingUp className="w-3 h-3" /> Trending up</StatusPill>
            </div>
            <div className="text-sm text-[#16A34A] font-semibold mt-1">+$550 past 30 days</div>
            <div className="text-[11px] text-[#8893A8] mt-1">
              Range {fmt(MOCK.range.low)} – {fmt(MOCK.range.high)} · Verified market data
            </div>
          </div>

          {/* Block 2: Market Score */}
          <div className="border-t lg:border-t-0 lg:border-l border-[#EEF0F4] pt-4 lg:pt-0 lg:pl-6">
            <SectionLabel>Market Score</SectionLabel>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-[34px] font-extrabold text-[#06194A] tabular-nums leading-none">88</div>
              <StatusPill tone="green">High</StatusPill>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[#EEF0FF] overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: "88%" }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#6D28D9]"
              />
            </div>
            <div className="text-[12px] text-[#53627A] mt-2">Strong buyer activity</div>
          </div>

          {/* Block 3: Market Demand */}
          <div className="border-t lg:border-t-0 lg:border-l border-[#EEF0F4] pt-4 lg:pt-0 lg:pl-6">
            <SectionLabel>Market Demand</SectionLabel>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="text-[34px] font-extrabold text-[#06194A] leading-none">High</div>
              <StatusPill tone="indigo"><Flame className="w-3 h-3" /> Hot</StatusPill>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {["Low", "Med", "High"].map((l, i) => (
                <div key={l} className={`text-center text-[10px] font-semibold py-1.5 rounded-md ${i === 2 ? "bg-[#16A34A] text-white" : "bg-[#F4F6FA] text-[#53627A]"}`}>{l}</div>
              ))}
            </div>
            <div className="text-[12px] text-[#53627A] mt-2">Regional demand is above average</div>
          </div>
        </div>
      </Card>

      {/* ----- 30-Day Market Value Trend ----- */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <SectionLabel>30-Day Market Value Trend</SectionLabel>
            <div className="text-[13px] text-[#53627A] mt-1">
              Your vehicle segment has gained value over the past month.
            </div>
          </div>
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#0F7A3E] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Trending Up
            </div>
            <div className="text-[13px] font-bold text-[#0F7A3E] tabular-nums">+$550 in the last 30 days</div>
          </div>
        </div>
        <div className="mt-3">
          <ValueChart />
        </div>
      </Card>

      {/* ----- Market Signals ----- */}
      <div className="mb-2">
        <SectionLabel>Market Signals</SectionLabel>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#EEF0FF] text-[#6D28D9]">
            <Gauge className="w-4 h-4" />
          </div>
          <div className="text-[12px] text-[#53627A] mt-2 font-semibold uppercase tracking-wide">Demand Score</div>
          <div className="text-[24px] font-extrabold text-[#06194A] tabular-nums leading-none mt-1">88</div>
          <div className="text-[12px] text-[#0F7A3E] font-semibold mt-1">Top 12% regionally</div>
        </Card>

        <Card className="p-4">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#E8F8EE] text-[#0F7A3E]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-[12px] text-[#53627A] mt-2 font-semibold uppercase tracking-wide">Market Insight</div>
          <div className="text-[13px] font-semibold text-[#06194A] mt-1 leading-snug">
            Verified maintenance history may improve buyer confidence.
          </div>
          <button
            onClick={() => setDrawer("forecast")}
            className="mt-2 text-[11px] font-semibold text-[#6D28D9] hover:text-[#3730A3] inline-flex items-center gap-1"
          >
            View demand breakdown <ArrowUpRight className="w-3 h-3" />
          </button>
        </Card>

        <Card className="p-4">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#FEF3E2] text-[#B45309]">
            <Target className="w-4 h-4" />
          </div>
          <div className="text-[12px] text-[#53627A] mt-2 font-semibold uppercase tracking-wide">Best Selling Window</div>
          <div className="text-[15px] font-extrabold text-[#06194A] mt-1">Next 7–14 days</div>
          <div className="text-[12px] text-[#53627A] mt-1">Demand is currently elevated.</div>
        </Card>
      </div>

      {/* ----- Why dealers want this + What's influencing your offer ----- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <SectionLabel>Why dealers want this vehicle</SectionLabel>
          <ul className="mt-3 space-y-2.5 text-[13px]">
            {DEALER_REASONS.map((t, i) => (
              <motion.li
                key={t}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35 }}
                className="flex items-start gap-2.5"
              >
                <span className="w-5 h-5 rounded-md bg-[#E8F8EE] text-[#0F7A3E] grid place-items-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                </span>
                <span className="text-[#06194A]">{t}</span>
              </motion.li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>What is influencing your offer</SectionLabel>
            <button
              onClick={() => setDrawer("factors")}
              className="text-[11px] font-semibold text-[#6D28D9] hover:text-[#3730A3] inline-flex items-center gap-1"
            >
              Full breakdown <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {VALUE_FACTORS.map((f, i) => (
              <motion.li
                key={f.label}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.3 }}
                className="flex items-center gap-3 py-2 border-b border-[#EEF0F4] last:border-0"
              >
                <span className={`w-1.5 h-8 rounded-full ${f.tone === "green" ? "bg-[#16A34A]" : "bg-[#F59E0B]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#06194A]">{f.label}</div>
                  <div className="text-[11px] text-[#53627A] truncate">{f.note}</div>
                </div>
                <div className={`text-[13px] font-bold tabular-nums ${f.tone === "green" ? "text-[#0F7A3E]" : "text-[#B45309]"}`}>
                  {f.delta}
                </div>
              </motion.li>
            ))}
          </ul>
          <div className="text-[11px] text-[#8893A8] mt-3">
            These factors help explain how your firm offer was calculated.
          </div>
        </Card>
      </div>

      {/* ----- Market Timing ----- */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Market Timing</SectionLabel>
          <div className="text-[11px] text-[#8893A8] flex items-center gap-1">
            <Activity className="w-3 h-3" /> Updated recently
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MARKET_TIMING.map((s, i) => {
            const Icon = s.icon;
            const palette: Record<string, string> = {
              green:  "bg-[#E8F8EE] text-[#0F7A3E] border-[#BBF7D0]",
              indigo: "bg-[#EEF0FF] text-[#6D28D9] border-[#E0E7FF]",
              orange: "bg-[#FEF3E2] text-[#B45309] border-[#FED7AA]",
            };
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.35 }}
                className="rounded-2xl border bg-white border-[#EEF0F4] p-3.5 hover:shadow-[0_8px_24px_-14px_rgba(15,23,42,0.18)] transition"
              >
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border ${palette[s.tone]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-bold text-[#06194A] mt-2">{s.title}</div>
                <div className="text-[12px] text-[#53627A] mt-0.5 leading-snug">{s.detail}</div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* ----- Comparables (unchanged for now) ----- */}
      <Card className="p-5 mb-6">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-3 flex-col sm:flex-row">
          <div>
            <SectionLabel>Comparable Vehicles Nearby</SectionLabel>
            <div className="text-[12px] text-[#8893A8] mt-1">
              {filteredComps.length} of {COMPS.length} matching your filters
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              icon={MapPin}
              label={`${filters.radius} mi`}
              active
              onClick={() => setFilters((f) => ({ ...f, radius: f.radius === 75 ? 50 : f.radius === 50 ? 25 : 75 }))}
            />
            <FilterChip
              icon={Filter}
              label={filters.status === "all" ? "Active + Sold" : filters.status === "active" ? "Active" : "Sold"}
              active={filters.status !== "all"}
              onClick={() => setFilters((f) => ({
                ...f, status: f.status === "all" ? "active" : f.status === "active" ? "sold" : "all",
              }))}
            />
            <FilterChip
              icon={Car}
              label={filters.source === "all" ? "All sellers" : filters.source === "dealer" ? "Dealer" : "Private"}
              active={filters.source !== "all"}
              onClick={() => setFilters((f) => ({
                ...f, source: f.source === "all" ? "dealer" : f.source === "dealer" ? "private" : "all",
              }))}
            />
          </div>
        </div>
        <ul className="divide-y divide-[#EEF0F4]">
          {filteredComps.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => { setComp(c); setDrawer("comp"); }}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#F7F8FB] rounded-xl px-2 transition group"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#6D28D9] grid place-items-center shrink-0 group-hover:scale-105 transition">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[13px] font-semibold text-[#06194A] truncate">{c.ymm}</div>
                    {c.status === "sold"
                      ? <StatusPill tone="gray">Sold</StatusPill>
                      : <StatusPill tone="green">Active</StatusPill>}
                  </div>
                  <div className="text-[11px] text-[#53627A] mt-0.5">
                    {c.mi} mi · {c.dom} days on market · {c.dist} mi away · {c.source}
                  </div>
                </div>
                <div className="hidden sm:block"><Sparkline trend={c.trend} /></div>
                <div className="text-right shrink-0">
                  <div className="text-[14px] font-extrabold text-[#06194A] tabular-nums">{fmt(c.ask)}</div>
                  <div className="text-[10px] text-[#8893A8] uppercase tracking-wide">
                    {c.status === "sold" ? "Sold for" : "Asking"}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {filteredComps.length === 0 && (
            <li className="py-8 text-center text-[13px] text-[#8893A8]">
              No comparables match your filters.
            </li>
          )}
        </ul>
      </Card>

      {/* ----- Sticky CTA bar on mobile ----- */}
      <div className="lg:hidden sticky bottom-3 z-10">
        <Card className="p-3 flex items-center gap-3 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)]">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#8893A8]">Market favors selling</div>
            <div className="text-[13px] font-bold text-[#06194A] truncate">Offer {fmt(MOCK.firmOffer)}</div>
          </div>
          <PrimaryButton className="shrink-0">Continue to Scheduling →</PrimaryButton>
        </Card>
      </div>

      {/* ----- Desktop CTA strip ----- */}
      <Card className="hidden lg:flex p-5 items-center justify-between gap-4 bg-gradient-to-r from-[#06194A] to-[#1E1B4B] text-white border-transparent">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#A5B4FC]">Recommendation</div>
            <div className="text-[15px] font-bold">The market currently favors selling your vehicle.</div>
            <div className="text-[12px] text-[#CBD5F5] mt-0.5">{ctaSub}</div>
          </div>
        </div>
        <PrimaryButton className="shrink-0">
          <ShieldCheck className="w-4 h-4" /> Continue to Scheduling →
        </PrimaryButton>
      </Card>

      {/* ============== Drawers ============== */}
      <SlideOver
        open={drawer === "comp" && !!comp}
        onClose={() => { setDrawer(null); setComp(null); }}
        title={comp?.ymm ?? ""}
        subtitle="Comparable listing detail"
        width="lg"
      >
        {comp && (
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl bg-[#F7F8FB] p-4 grid grid-cols-2 gap-3">
              <Stat label={comp.status === "sold" ? "Sold for" : "Asking"} value={fmt(comp.ask)} />
              <Stat label="Mileage"  value={`${comp.mi} mi`} />
              <Stat label="Trim"     value={comp.trim} />
              <Stat label="Days on Market" value={`${comp.dom}`} />
              <Stat label="Distance" value={`${comp.dist} mi`} />
              <Stat label="Seller"   value={comp.source === "dealer" ? "Dealer" : "Private"} />
            </div>
            <div className="rounded-2xl border border-[#EEF0F4] p-4">
              <SectionLabel>How this compares</SectionLabel>
              <p className="text-[13px] text-[#06194A] mt-2 leading-relaxed">
                Your firm offer of <b>{fmt(MOCK.firmOffer)}</b> reflects the retail asking-to-wholesale
                spread, typical reconditioning, and local demand. This listing is
                {" "}{comp.ask > MOCK.firmOffer + 3000 ? "a high retail comp" : "closely aligned with current market"}.
              </p>
            </div>
          </div>
        )}
      </SlideOver>

      <SlideOver
        open={drawer === "factors"}
        onClose={() => setDrawer(null)}
        title="What is influencing your offer"
        subtitle="Transparent factor breakdown"
        width="lg"
      >
        <div className="space-y-3">
          {VALUE_FACTORS.map((f) => (
            <div key={f.label} className="rounded-2xl border border-[#EEF0F4] p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-[#06194A]">{f.label}</div>
                <div className={`text-[13px] font-bold tabular-nums ${f.tone === "green" ? "text-[#0F7A3E]" : "text-[#B45309]"}`}>
                  {f.delta}
                </div>
              </div>
              <div className="text-[12px] text-[#53627A] mt-1">{f.note}</div>
            </div>
          ))}
        </div>
      </SlideOver>

      <SlideOver
        open={drawer === "forecast"}
        onClose={() => setDrawer(null)}
        title="Demand breakdown"
        subtitle="30-day market outlook for your vehicle"
        width="lg"
      >
        <div className="space-y-3 text-[13px] text-[#06194A]">
          <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#E0E7FF] p-4">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-[#6D28D9]">
              <Sparkles className="w-3 h-3" /> Market read
            </div>
            <div className="text-[15px] font-bold mt-1.5">Sell within the next 7–14 days</div>
            <div className="text-[12px] text-[#53627A] mt-1">
              Local inventory is 18% below seasonal average. Off-lease supply expected late June.
            </div>
          </div>
          <Stat row label="Projected value (14 days)" value={`${fmt(MOCK.firmOffer + 180)} · +0.9%`} />
          <Stat row label="Projected value (30 days)" value={`${fmt(MOCK.firmOffer - 220)} · −1.1%`} />
          <Stat row label="Range"                      value="±$310" />
          <Stat row label="Data refresh"               value="Every 2 hours" />
        </div>
      </SlideOver>

      <SlideOver
        open={drawer === "region"}
        onClose={() => setDrawer(null)}
        title="Regional market"
        subtitle="Hartford metro · 75 mi radius"
        width="lg"
      >
        <div className="space-y-3 text-[13px]">
          <Stat row label="Active dealer searches" value="14 in last 7 days" />
          <Stat row label="Avg. days on market"    value="11 days (↓ from 19)" />
          <Stat row label="Inventory vs. seasonal" value="−18%" />
          <Stat row label="Top buyer profile"      value="Franchise + CPO" />
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

/* ------------------------------------------------------------------ */
/*  Small primitives                                                  */
/* ------------------------------------------------------------------ */

const FilterChip = ({
  icon: Icon, label, active, onClick,
}: { icon: any; label: string; active?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition ${
      active
        ? "bg-[#EEF0FF] text-[#6D28D9] border-[#C7D2FE]"
        : "bg-white text-[#53627A] border-[#E6EAF0] hover:border-[#C7D2FE] hover:text-[#6D28D9]"
    }`}
  >
    <Icon className="w-3 h-3" /> {label}
  </button>
);

const Stat = ({
  label, value, row = false,
}: { label: string; value: string; row?: boolean }) =>
  row ? (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#F7F8FB]">
      <span className="text-[12px] text-[#53627A]">{label}</span>
      <span className="text-[13px] font-bold text-[#06194A] tabular-nums">{value}</span>
    </div>
  ) : (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[#8893A8] font-semibold">{label}</div>
      <div className="text-[13px] font-bold text-[#06194A] tabular-nums">{value}</div>
    </div>
  );

export default AnalyticsPage;
