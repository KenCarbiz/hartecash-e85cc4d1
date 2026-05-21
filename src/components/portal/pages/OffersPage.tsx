import { useEffect, useState } from "react";
import { ShieldCheck, Truck, Shield, Check, Clock, ArrowRight, MessageSquare, BarChart3 } from "lucide-react";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

type Props = { onNavigate: (k: "messages" | "pickup") => void };

const useCountdown = (deadline: string) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Static-ish mock: 3 days 11 hours away from "now"
  const target = new Date(deadline + " 17:00:00").getTime();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const mins = Math.floor((diff / 60000) % 60);
  return { days, hours, mins, expired: diff === 0 };
};

const BREAKDOWN = [
  { label: "Market value",           value: 21450 },
  { label: "Mileage adjustment",     value: -650 },
  { label: "Condition adjustment",   value: -350 },
  { label: "Local demand bonus",     value: 400 },
  { label: "Reconditioning estimate", value: -700 },
];

export const OffersPage = ({ onNavigate }: Props) => {
  const [accept, setAccept] = useState(false);
  const [counter, setCounter] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const { days, hours, mins, expired } = useCountdown(MOCK.offerExpires);

  return (
    <PortalPageShell title="Your Offers" subtitle="Review, compare, and accept your acquisition offer.">
      {/* Hero offer */}
      <Card className="p-6 mb-6 bg-gradient-to-br from-[#EEF0FF] via-white to-[#F5F3FF] border-[#E0E7FF]">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SectionLabel>Current Firm Offer</SectionLabel>
              <StatusPill tone="green"><Check className="w-3 h-3" /> AI-Verified</StatusPill>
            </div>
            <div className="text-[44px] font-extrabold tracking-tight leading-none text-[#06194A]">
              {fmt(MOCK.firmOffer)}
            </div>
            <p className="text-sm text-[#53627A] mt-2">Held for you by <span className="font-semibold text-[#06194A]">{MOCK.customer.dealer}</span></p>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-[12px] text-[#06194A]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />No Obligation</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#16A34A]" />Free Pickup</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#16A34A]" />Secure &amp; Private</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#E6EAF0] p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#53627A] inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Offer Expires
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[{ n: days, l: "Days" }, { n: hours, l: "Hours" }, { n: mins, l: "Min" }].map((b) => (
                <div key={b.l} className="rounded-xl bg-[#F7F8FB] py-3">
                  <div className="text-[22px] font-extrabold text-[#06194A] leading-none">{String(b.n).padStart(2, "0")}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[#8893A8] mt-1 font-semibold">{b.l}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-[#53627A] text-center mt-2">{expired ? "Expired" : `Through ${MOCK.offerExpires}`}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
          <PrimaryButton onClick={() => setAccept(true)} className="w-full py-3">Accept Offer <ArrowRight className="w-4 h-4" /></PrimaryButton>
          <SecondaryButton onClick={() => setCounter(true)} className="w-full py-3">Counter Offer</SecondaryButton>
          <SecondaryButton onClick={() => onNavigate("messages")} className="w-full py-3"><MessageSquare className="w-4 h-4" /> Ask Question</SecondaryButton>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Offer Breakdown</SectionLabel>
            <button onClick={() => setBreakdown(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">Full detail</button>
          </div>
          <ul className="space-y-2">
            {BREAKDOWN.map((b) => (
              <li key={b.label} className="flex items-center justify-between text-sm">
                <span className="text-[#53627A]">{b.label}</span>
                <span className={`font-semibold tabular-nums ${b.value < 0 ? "text-[#DC2626]" : "text-[#0F7A3E]"}`}>
                  {b.value < 0 ? "−" : "+"}{fmt(Math.abs(b.value))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[#EEF0F4] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#06194A]">Final Firm Offer</span>
            <span className="text-[18px] font-extrabold text-[#06194A] tabular-nums">{fmt(MOCK.firmOffer)}</span>
          </div>
        </Card>

        {/* Compare offers */}
        <Card className="p-5">
          <SectionLabel>Compare Offers</SectionLabel>
          <ul className="mt-3 space-y-2">
            {[
              { name: MOCK.customer.dealer, label: "Firm Offer", value: MOCK.firmOffer, tone: "green" as const, primary: true },
              { name: "Estimated wholesale", label: "Trade-in baseline", value: 18200, tone: "gray" as const },
              { name: "Private party (est.)", label: "Sell-it-yourself", value: 22100, tone: "indigo" as const },
            ].map((o) => (
              <li key={o.name} className={`flex items-center justify-between rounded-xl px-3 py-3 border ${o.primary ? "border-[#C7D2FE] bg-[#EEF0FF]/60" : "border-[#E6EAF0]"}`}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#06194A] truncate">{o.name}</div>
                  <div className="text-[11px] text-[#53627A]">{o.label}</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-extrabold tabular-nums text-[#06194A]">{fmt(o.value)}</div>
                  <StatusPill tone={o.tone}>{o.primary ? "Best for you" : "Reference"}</StatusPill>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#8893A8] mt-3">
            Wholesale + private party shown as references. Your firm offer includes pickup and no fees.
          </p>
        </Card>
      </div>

      {/* Slide-overs */}
      <SlideOver open={accept} onClose={() => setAccept(false)} title="Accept Your Offer" subtitle={`Final amount: ${fmt(MOCK.firmOffer)}`}
        footer={<PrimaryButton className="w-full py-3" onClick={() => { setAccept(false); onNavigate("pickup"); }}>Accept &amp; Schedule Pickup</PrimaryButton>}>
        <ol className="space-y-3">
          {[
            "Confirm your offer amount and dealer",
            "Verify your contact information",
            "Choose a pickup date",
            "Sign the bill of sale digitally",
            "Get paid after pickup",
          ].map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF0FF] text-[#4F46E5] text-xs font-bold grid place-items-center shrink-0">{i + 1}</span>
              <span className="text-sm text-[#06194A] pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-4 text-[12.5px] text-[#53627A]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#06194A]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> Locked-in price
          </span>
          <p className="mt-1">Your accepted offer is honored at pickup as long as the vehicle matches the condition described.</p>
        </div>
      </SlideOver>

      <SlideOver open={counter} onClose={() => setCounter(false)} title="Counter Offer" subtitle="Send a number back to your dealer" width="md"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setCounter(false)} className="flex-1">Cancel</SecondaryButton><PrimaryButton onClick={() => setCounter(false)} className="flex-1">Send Counter</PrimaryButton></div>}>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Your counter amount</span>
          <div className="mt-1 flex items-center rounded-xl border border-[#E6EAF0] px-3 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#4F46E5]/20">
            <span className="text-[#53627A]">$</span>
            <input defaultValue="20,750" className="flex-1 px-2 py-2.5 text-sm bg-transparent outline-none" />
          </div>
        </label>
        <label className="block mt-3">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Note to dealer (optional)</span>
          <textarea rows={3} placeholder="Share context (e.g. recent maintenance, comparable offers)…" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </label>
      </SlideOver>

      <SlideOver open={breakdown} onClose={() => setBreakdown(false)} title="Full Offer Breakdown" subtitle="How we arrived at your firm number" width="lg">
        <div className="rounded-2xl bg-[#F7F8FB] p-4 mb-4">
          <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Final Firm Offer</div>
          <div className="text-[28px] font-extrabold text-[#06194A] tabular-nums">{fmt(MOCK.firmOffer)}</div>
        </div>
        <ul className="space-y-3">
          {BREAKDOWN.map((b) => (
            <li key={b.label} className="flex items-center justify-between border-b border-[#EEF0F4] pb-2">
              <span className="text-sm text-[#06194A]">{b.label}</span>
              <span className={`font-semibold tabular-nums ${b.value < 0 ? "text-[#DC2626]" : "text-[#0F7A3E]"}`}>
                {b.value < 0 ? "−" : "+"}{fmt(Math.abs(b.value))}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center gap-2 text-[12px] text-[#53627A]">
          <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
          Adjustments derived from local sale data and your submitted condition.
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default OffersPage;
