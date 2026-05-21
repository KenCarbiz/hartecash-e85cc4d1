import { useState } from "react";
import { TrendingUp, Sparkles, Car, MapPin } from "lucide-react";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, StatusPill, SecondaryButton, PrimaryButton } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

const VALUE_TREND = [19600, 19850, 20050, 20100, 20300, 20450, 20150];
const TREND_LABELS = ["Apr 14", "Apr 21", "Apr 28", "May 5", "May 9", "May 12", "May 15"];

const ValueChart = () => {
  const pts = VALUE_TREND;
  const w = 700, h = 220, padX = 36, padY = 20;
  const max = Math.max(...pts) + 200, min = Math.min(...pts) - 200;
  const x = (i: number) => padX + (i * (w - padX * 2)) / (pts.length - 1);
  const y = (v: number) => h - padY - ((v - min) / (max - min)) * (h - padY * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${h - padY} L${x(0)},${h - padY} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      <defs>
        <linearGradient id="anFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padX} x2={w - padX} y1={padY + (h - padY * 2) * t} y2={padY + (h - padY * 2) * t}
          stroke="#EEF0F4" strokeDasharray="3 5" />
      ))}
      <path d={area} fill="url(#anFill)" className="origin-bottom" style={{ animation: "anGrow 0.8s ease-out both" }} />
      <path d={d} fill="none" stroke="#4F46E5" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="#fff" stroke="#4F46E5" strokeWidth="2" />
          <text x={x(i)} y={h - 4} textAnchor="middle" fontSize="9.5" fill="#8893A8">{TREND_LABELS[i]}</text>
        </g>
      ))}
      <style>{`@keyframes anGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}`}</style>
    </svg>
  );
};

const COMPS = [
  { ymm: "2021 Toyota RAV4 XLE", mi: "24,800", ask: 24990, dom: 12 },
  { ymm: "2020 Toyota RAV4 XLE", mi: "31,540", ask: 22995, dom: 28 },
  { ymm: "2021 Honda CR-V EX",   mi: "28,210", ask: 24450, dom: 18 },
  { ymm: "2022 Mazda CX-5 Touring", mi: "19,860", ask: 26100, dom: 9 },
];

export const AnalyticsPage = () => {
  const [comp, setComp] = useState<typeof COMPS[number] | null>(null);

  return (
    <PortalPageShell title="Market Analytics" subtitle="Track your vehicle's value and demand.">
      {/* Value trend */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <SectionLabel>Value Trend</SectionLabel>
            <div className="text-[20px] font-extrabold text-[#06194A] mt-1">
              {fmt(MOCK.firmOffer)} <span className="text-[#16A34A] text-sm font-semibold ml-2">+$550 (30d)</span>
            </div>
          </div>
          <StatusPill tone="green"><TrendingUp className="w-3 h-3" /> Trending Up</StatusPill>
        </div>
        <ValueChart />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Demand score */}
        <Card className="p-5">
          <SectionLabel>Market Demand Score</SectionLabel>
          <div className="text-[36px] font-extrabold text-[#06194A] mt-2 leading-none">High</div>
          <div className="text-sm text-[#53627A] mt-1">Local dealer demand is currently strong.</div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {["Low", "Medium", "High"].map((l, i) => (
              <div key={l} className={`text-center text-[11px] font-semibold py-2 rounded-lg ${i === 2 ? "bg-[#16A34A] text-white" : "bg-[#F4F6FA] text-[#53627A]"}`}>{l}</div>
            ))}
          </div>
          <p className="text-[11px] text-[#8893A8] mt-3 leading-snug">
            Based on 14 active acquisition searches matching your year/make/model within 75 miles.
          </p>
        </Card>

        {/* Best time to sell */}
        <Card className="p-5 bg-gradient-to-br from-[#EEF0FF] to-white border-[#E0E7FF]">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">
            <Sparkles className="w-3 h-3" /> AI Insight
          </div>
          <h3 className="text-[18px] font-bold mt-2 leading-snug">Best time to sell: Now</h3>
          <p className="text-sm text-[#53627A] mt-1">
            Used SUV inventory is 18% below seasonal average in your area. Selling within the next 14 days maximizes payout.
          </p>
          <PrimaryButton className="mt-4 w-full">Lock in Today's Offer</PrimaryButton>
        </Card>

        {/* Dealer demand */}
        <Card className="p-5">
          <SectionLabel>Why dealers want this</SectionLabel>
          <ul className="mt-3 space-y-2.5 text-sm">
            {[
              "RAV4 XLE is a top-3 turn unit at independent franchise stores.",
              "Mileage under 30k qualifies for CPO programs.",
              "Single-owner, clean title boosts wholesale margin.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-2 shrink-0" />
                <span className="text-[#06194A]">{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Comparables */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Comparable Vehicles Nearby</SectionLabel>
          <SecondaryButton className="px-3 py-1.5 text-xs"><MapPin className="w-3.5 h-3.5" /> 75 mi radius</SecondaryButton>
        </div>
        <ul className="divide-y divide-[#EEF0F4]">
          {COMPS.map((c) => (
            <li key={c.ymm}>
              <button onClick={() => setComp(c)} className="w-full flex items-center gap-4 py-3 text-left hover:bg-[#F7F8FB] rounded-xl px-2 transition">
                <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#06194A] truncate">{c.ymm}</div>
                  <div className="text-[11px] text-[#53627A]">{c.mi} mi · {c.dom} days on market</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[15px] font-extrabold text-[#06194A] tabular-nums">{fmt(c.ask)}</div>
                  <div className="text-[10px] text-[#8893A8] uppercase tracking-wide">Asking</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <SlideOver open={!!comp} onClose={() => setComp(null)} title={comp?.ymm ?? ""} subtitle="Comparable listing detail">
        {comp && (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl bg-[#F7F8FB] p-4 grid grid-cols-2 gap-3">
              <div><div className="text-[11px] uppercase text-[#8893A8] font-semibold">Asking</div><div className="text-[#06194A] font-bold">{fmt(comp.ask)}</div></div>
              <div><div className="text-[11px] uppercase text-[#8893A8] font-semibold">Mileage</div><div className="text-[#06194A] font-bold">{comp.mi}</div></div>
              <div><div className="text-[11px] uppercase text-[#8893A8] font-semibold">Days on Market</div><div className="text-[#06194A] font-bold">{comp.dom}</div></div>
              <div><div className="text-[11px] uppercase text-[#8893A8] font-semibold">Distance</div><div className="text-[#06194A] font-bold">~22 mi</div></div>
            </div>
            <p className="text-[#53627A]">
              Your firm offer of {fmt(MOCK.firmOffer)} reflects retail asking-to-wholesale spread, typical reconditioning, and local demand.
            </p>
          </div>
        )}
      </SlideOver>
    </PortalPageShell>
  );
};

export default AnalyticsPage;
