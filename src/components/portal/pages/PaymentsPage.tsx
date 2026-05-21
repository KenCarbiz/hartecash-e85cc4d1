import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, FileText, Check, CheckCircle2, Zap, Building2, Eye, Banknote,
  Sparkles, Lock, Landmark, CreditCard, ArrowRight, Search, Info, Loader2,
  Download, Clock, AlertCircle, Activity, Wallet, ChevronRight, Star,
  ScrollText, Receipt, ScanLine, KeyRound, PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

/* Premium fintech-grade Payment Center for the MOTO(acquire) portal.
   Inspired by Stripe / Ramp / modern banking dashboards. Sectioned, modular,
   and stage-aware. All visuals use the existing white/indigo design system. */

// ── Constants ───────────────────────────────────────────────────────────────

type PayoutStage = "inspection" | "method" | "handoff" | "verified" | "released" | "delivered";
type StageMeta = { id: PayoutStage; label: string; icon: typeof Check; sub: string };

const STAGES: StageMeta[] = [
  { id: "inspection", label: "Inspection Approved",    icon: CheckCircle2, sub: "AI verification complete" },
  { id: "method",     label: "Payment Method Setup",   icon: Wallet,       sub: "Connect your bank account" },
  { id: "handoff",    label: "Handoff Scheduled",      icon: Clock,        sub: "Pickup window confirmed" },
  { id: "verified",   label: "Vehicle Verified",       icon: ScanLine,     sub: "VIN + condition confirmed onsite" },
  { id: "released",   label: "Payment Released",       icon: Banknote,     sub: "ACH initiated by dealer" },
  { id: "delivered",  label: "Funds Delivered",        icon: CheckCircle2, sub: "Visible in your bank account" },
];

const BANKS = [
  { id: "chase",    name: "Chase",            color: "#117ACA" },
  { id: "boa",      name: "Bank of America",  color: "#E31837" },
  { id: "wells",    name: "Wells Fargo",      color: "#D71E28" },
  { id: "capone",   name: "Capital One",      color: "#004977" },
  { id: "usbank",   name: "U.S. Bank",        color: "#0F2A5C" },
  { id: "citi",     name: "Citi",             color: "#003B70" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

type Method = "ach" | "instant" | "check";
type AchConn = { status: "none" | "connecting" | "verified"; bankName?: string; mask?: string; mode?: "instant" | "manual" };
type PayoutStatus = "awaiting_method" | "ready" | "processing" | "delivered" | "review";

const tonePill = (s: PayoutStatus) => {
  switch (s) {
    case "awaiting_method": return { tone: "indigo" as const, label: "Action needed" };
    case "ready":           return { tone: "green"  as const, label: "Ready for release" };
    case "processing":      return { tone: "indigo" as const, label: "ACH processing" };
    case "delivered":       return { tone: "green"  as const, label: "Funds delivered" };
    case "review":          return { tone: "orange" as const, label: "Under review" };
  }
};

// ── Subcomponents ───────────────────────────────────────────────────────────

const PayoutTracker = ({ activeIdx }: { activeIdx: number }) => {
  const pct = (activeIdx / (STAGES.length - 1)) * 100;
  return (
    <div className="relative">
      <div className="absolute left-5 right-5 top-5 h-px bg-[#E6EAF0]" />
      <motion.div
        initial={{ width: 0 }} animate={{ width: `calc(${pct}% - 0px)` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-5 top-5 h-px bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
      />
      <div className="relative grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={s.id} className="flex flex-col items-center text-center min-w-0">
              <motion.div
                animate={active ? { boxShadow: ["0 0 0 0 rgba(79,70,229,0.45)", "0 0 0 10px rgba(79,70,229,0)"] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
                className={`w-10 h-10 rounded-full grid place-items-center transition ${
                  done   ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_8px_18px_-6px_rgba(79,70,229,0.55)]"
                : active ? "bg-white border-2 border-[#4F46E5] text-[#4F46E5]"
                         : "bg-[#F4F6FA] text-[#8893A8]"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </motion.div>
              <div className={`text-[10.5px] font-bold mt-2 leading-tight ${done || active ? "text-[#06194A]" : "text-[#8893A8]"}`}>{s.label}</div>
              <div className="hidden sm:block text-[10px] text-[#8893A8] mt-0.5 leading-tight truncate w-full">{s.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MethodCard = ({
  method, active, onSelect, badge, accent, icon: Icon, title, desc, perks, cta,
}: {
  method: Method;
  active: boolean;
  onSelect: (m: Method) => void;
  badge?: string;
  accent: string;
  icon: typeof Wallet;
  title: string;
  desc: string;
  perks: { icon: typeof Zap; label: string }[];
  cta: string;
}) => (
  <motion.button
    whileHover={{ y: -3 }}
    onClick={() => onSelect(method)}
    className={`relative text-left rounded-3xl border-2 p-5 transition group overflow-hidden ${
      active
        ? "border-[#4F46E5] bg-gradient-to-br from-[#EEF0FF] to-white shadow-[0_24px_50px_-22px_rgba(79,70,229,0.45)]"
        : "border-[#E6EAF0] bg-white hover:border-[#C7D2FE] hover:shadow-[0_16px_36px_-18px_rgba(79,70,229,0.28)]"
    }`}
  >
    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ background: `radial-gradient(circle, ${accent}25, transparent 70%)` }} />

    {badge && (
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 shadow-[0_8px_18px_-6px_rgba(124,58,237,0.55)]">
        <Star className="w-3 h-3 fill-white" /> {badge}
      </div>
    )}

    <div className="flex items-start gap-3 relative">
      <motion.div
        whileHover={{ scale: 1.08, rotate: -4 }}
        className="w-12 h-12 rounded-2xl grid place-items-center text-white shadow-[0_10px_20px_-8px_rgba(79,70,229,0.5)] shrink-0"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}DD)` }}
      >
        <Icon className="w-5 h-5" />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-extrabold text-[#06194A]">{title}</div>
        <p className="text-[12.5px] text-[#53627A] mt-0.5 leading-relaxed">{desc}</p>
      </div>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-7 h-7 rounded-full bg-[#4F46E5] grid place-items-center shrink-0">
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </div>

    <ul className="mt-4 space-y-1.5">
      {perks.map((p) => {
        const PI = p.icon;
        return (
          <li key={p.label} className="flex items-center gap-2 text-[12.5px] text-[#06194A]">
            <PI className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" /> {p.label}
          </li>
        );
      })}
    </ul>

    <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-bold ${active ? "text-[#4F46E5]" : "text-[#06194A]"}`}>
      {cta} <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
    </div>
  </motion.button>
);

const SecurityBar = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
    {[
      { Icon: Lock,        label: "Bank-level encryption",   sub: "256-bit TLS in transit" },
      { Icon: ShieldCheck, label: "Secure ACH processing",   sub: "NACHA compliant" },
      { Icon: ScanLine,    label: "Verified payout system",  sub: "Tokenized account data" },
      { Icon: Activity,    label: "Real-time monitoring",    sub: "Anomaly detection 24/7" },
    ].map((s) => (
      <div key={s.label} className="rounded-2xl border border-[#EEF0F5] bg-white p-3 flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center shrink-0">
          <s.Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-[#06194A] leading-tight">{s.label}</div>
          <div className="text-[10.5px] text-[#8893A8] mt-0.5">{s.sub}</div>
        </div>
      </div>
    ))}
  </div>
);

const LiveActivityStrip = () => {
  const items = [
    { icon: CheckCircle2, tone: "text-emerald-500", text: "Bank verification successful · 1 min ago" },
    { icon: Zap,          tone: "text-[#4F46E5]",   text: "Fast payout eligible · 2 min ago" },
    { icon: ScrollText,   tone: "text-[#7C3AED]",   text: "Dealer approved transaction · 4 min ago" },
    { icon: Banknote,     tone: "text-emerald-500", text: "ACH rails healthy · just now" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % items.length), 4500); return () => clearInterval(id); }, []);
  const Icon = items[i].icon;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
        className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-[#53627A]">
        <Icon className={`w-3.5 h-3.5 ${items[i].tone}`} /> {items[i].text}
      </motion.div>
    </AnimatePresence>
  );
};

const BankLogoChip = ({ bank, onClick }: { bank: typeof BANKS[number]; onClick: () => void }) => (
  <motion.button
    whileHover={{ y: -2 }} onClick={onClick}
    className="rounded-2xl border border-[#E6EAF0] bg-white p-3 text-left hover:border-[#C7D2FE] hover:shadow-[0_12px_24px_-14px_rgba(79,70,229,0.3)] transition group"
  >
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-extrabold text-sm shrink-0"
        style={{ background: `linear-gradient(135deg, ${bank.color}, ${bank.color}CC)` }}>
        {bank.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[#06194A] truncate">{bank.name}</div>
        <div className="text-[10.5px] text-[#8893A8]">Instant verification</div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#8893A8] group-hover:text-[#4F46E5] transition" />
    </div>
  </motion.button>
);

// ── Bank Connection Drawer ─────────────────────────────────────────────────

const BankConnectionDrawer = ({
  open, onClose, onConnected,
}: { open: boolean; onClose: () => void; onConnected: (c: AchConn) => void }) => {
  const [mode, setMode] = useState<"instant" | "manual">("instant");
  const [linking, setLinking] = useState<string | null>(null);
  const [linkProgress, setLinkProgress] = useState(0);
  const [consent, setConsent] = useState(false);

  // Manual form
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [acctType, setAcctType] = useState<"checking" | "savings">("checking");
  const [name, setName] = useState(MOCK.customer.name);

  const routingOk = /^\d{9}$/.test(routing);
  const accountOk = /^\d{6,17}$/.test(account);
  const nameOk = name.trim().length >= 3;
  const manualValid = routingOk && accountOk && nameOk && consent;

  useEffect(() => {
    if (!open) {
      setMode("instant"); setLinking(null); setLinkProgress(0);
      setRouting(""); setAccount(""); setName(MOCK.customer.name); setConsent(false);
    }
  }, [open]);

  const startInstant = (bank: typeof BANKS[number]) => {
    setLinking(bank.id); setLinkProgress(0);
    const tick = () => setLinkProgress((p) => Math.min(100, p + 12));
    const id = setInterval(tick, 220);
    setTimeout(() => {
      clearInterval(id);
      setLinkProgress(100);
      setTimeout(() => {
        onConnected({ status: "verified", bankName: bank.name, mask: "4127", mode: "instant" });
        toast.success(`${bank.name} verified`, { description: "Eligible for fast ACH payouts." });
        onClose();
      }, 450);
    }, 2000);
  };

  const submitManual = () => {
    if (!manualValid) return;
    onConnected({ status: "verified", bankName: "Verified bank", mask: account.slice(-4), mode: "manual" });
    toast.success("Bank account saved", { description: "Micro-deposits verified instantly." });
    onClose();
  };

  return (
    <SlideOver
      open={open} onClose={onClose}
      title="Connect Bank Account"
      subtitle="Encrypted, tokenized, never stored in plain text"
      width="lg"
      footer={
        mode === "manual" ? (
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} className="flex-1">Cancel</SecondaryButton>
            <PrimaryButton onClick={submitManual} className={`flex-1 ${!manualValid ? "opacity-60 cursor-not-allowed" : ""}`}>
              <ShieldCheck className="w-4 h-4" /> Verify & Save
            </PrimaryButton>
          </div>
        ) : undefined
      }
    >
      {/* Method toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F4F6FA] p-1 mb-4">
        {([
          { id: "instant", label: "Instant Verification", Icon: Zap },
          { id: "manual",  label: "Manual Entry",         Icon: KeyRound },
        ] as const).map((opt) => {
          const sel = mode === opt.id;
          return (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-bold transition ${
                sel ? "bg-white text-[#4F46E5] shadow-[0_6px_14px_-6px_rgba(79,70,229,0.35)]" : "text-[#53627A] hover:text-[#06194A]"
              }`}>
              <opt.Icon className="w-3.5 h-3.5" /> {opt.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {mode === "instant" ? (
          <motion.div key="instant" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {/* Linking state */}
            {linking ? (
              <div className="rounded-3xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF0FF] via-white to-white p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white grid place-items-center shadow-[0_10px_30px_-8px_rgba(124,58,237,0.55)]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="text-sm font-extrabold text-[#06194A] mt-3">Securely linking your bank…</div>
                <div className="text-[12px] text-[#53627A] mt-1">256-bit encryption · token never leaves your bank</div>
                <div className="mt-4 h-2 rounded-full bg-white border border-[#E6EAF0] overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
                    animate={{ width: `${linkProgress}%` }} transition={{ duration: 0.25 }} />
                </div>
                <div className="mt-3 text-[11px] font-semibold text-[#4F46E5] inline-flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Authenticating with bank
                </div>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8893A8]" />
                  <input placeholder="Search 11,000+ banks"
                    className="w-full rounded-xl border border-[#E6EAF0] bg-white pl-9 pr-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8] mb-2">Most popular</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BANKS.map((b) => <BankLogoChip key={b.id} bank={b} onClick={() => startInstant(b)} />)}
                </div>
                <div className="mt-4 rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 text-[11.5px] text-[#53627A] inline-flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  Read-only access. We only see your account & routing numbers to send your payout.
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="manual" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="space-y-3">
            <Field label="Name on Account" value={name} onChange={setName} ok={nameOk} placeholder="Jane A. Driver" />
            <Field label="Routing Number" value={routing} onChange={(v) => setRouting(v.replace(/\D/g, "").slice(0, 9))}
              ok={routingOk} hint="9 digits" placeholder="123456789" inputMode="numeric"
              errorMsg={routing && !routingOk ? "Routing number must be exactly 9 digits." : undefined} />
            <Field label="Account Number" value={account} onChange={(v) => setAccount(v.replace(/\D/g, "").slice(0, 17))}
              ok={accountOk} hint="6–17 digits" placeholder="000123456789" inputMode="numeric"
              errorMsg={account && !accountOk ? "Account number looks too short." : undefined} />

            <div>
              <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Account Type</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["checking", "savings"] as const).map((t) => {
                  const sel = acctType === t;
                  return (
                    <button key={t} onClick={() => setAcctType(t)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold capitalize transition ${
                        sel ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5]" : "border-[#E6EAF0] text-[#06194A] hover:border-[#C7D2FE]"
                      }`}>{t}</button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-start gap-2 mt-3 rounded-2xl border border-[#E6EAF0] bg-[#F7F8FB] p-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-[#4F46E5]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-[12px] text-[#06194A] leading-snug">
                I authorize <b>{MOCK.customer.name?.split(" ")[0] ?? "the dealership"}</b>'s acquisition platform to initiate ACH credit entries to this account.
                I agree to the <span className="underline">payout agreement</span> and confirm I am the account holder.
              </span>
            </label>

            {/* Live validation summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ValidationChip ok={routingOk} label="Routing number valid" pending="Enter 9-digit routing" />
              <ValidationChip ok={accountOk} label="Account number valid" pending="Enter account number" />
              <ValidationChip ok={nameOk} label="Account holder name set" pending="Enter the name on the account" />
              <ValidationChip ok={consent} label="ACH authorization consented" pending="Awaiting consent" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SlideOver>
  );
};

const Field = ({
  label, value, onChange, ok, hint, placeholder, errorMsg, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void; ok: boolean;
  hint?: string; placeholder?: string; errorMsg?: string; inputMode?: "numeric";
}) => (
  <label className="block">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{label}</span>
      {hint && <span className="text-[10px] text-[#8893A8]">{hint}</span>}
    </div>
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 transition ${
          errorMsg ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
          : ok ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100"
          : "border-[#E6EAF0] focus:border-[#4F46E5] focus:ring-[#4F46E5]/20"
        }`} />
      {ok && <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
      {errorMsg && <AlertCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-rose-500" />}
    </div>
    {errorMsg && <div className="text-[11px] text-rose-600 mt-1 inline-flex items-center gap-1"><Info className="w-3 h-3" /> {errorMsg}</div>}
  </label>
);

const ValidationChip = ({ ok, label, pending }: { ok: boolean; label: string; pending: string }) => (
  <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold ${
    ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-[#F7F8FB] border-[#E6EAF0] text-[#8893A8]"
  }`}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#8893A8]" />}
    <span className="truncate">{ok ? label : pending}</span>
  </div>
);

// ── Main page ──────────────────────────────────────────────────────────────

export const PaymentsPage = () => {
  const [method, setMethod] = useState<Method | null>("ach");
  const [ach, setAch] = useState<AchConn>({ status: "none" });
  const [bankOpen, setBankOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);

  // Derived state
  const inspectionApproved = true; // wired via Pickup workflow in real app
  const methodReady = method === "check" || (method === "ach" && ach.status === "verified") || (method === "instant" && ach.status === "verified");
  const activeStageIdx: number = !inspectionApproved ? 0 : !methodReady ? 1 : 2; // fixed at "Handoff" once method set

  const payoutStatus: PayoutStatus = !methodReady ? "awaiting_method" : "ready";
  const pill = tonePill(payoutStatus);

  const fulfillment: "home" | "dropoff" | "inspection_only" =
    MOCK.dealerCapabilities.pickupEnabled && MOCK.dealerCapabilities.dropoffEnabled ? "home"
    : MOCK.dealerCapabilities.pickupEnabled ? "home"
    : MOCK.dealerCapabilities.dropoffEnabled ? "dropoff" : "inspection_only";

  const fulfillmentNote = fulfillment === "home"
    ? "Payment released after pickup verification at your address."
    : fulfillment === "dropoff"
    ? "Payment released after dealership inspection completion."
    : "Final payout released after in-person appraisal approval.";

  const estimateLabel = method === "instant" && ach.status === "verified"
    ? "Within minutes of vehicle verification"
    : method === "check"
    ? "Handed to you at vehicle handoff"
    : method === "ach" && ach.status === "verified"
    ? "Within hours of vehicle verification"
    : "Choose a payment method to estimate";

  const docs = useMemo(() => ([
    { name: "Bill of Sale",        ready: false, icon: PenTool },
    { name: "Payment Receipt",     ready: false, icon: Receipt },
    { name: "ACH Confirmation",    ready: ach.status === "verified", icon: Banknote },
    { name: "Transaction Summary", ready: false, icon: ScrollText },
  ]), [ach.status]);

  return (
    <PortalPageShell
      title="Payment Center"
      subtitle="A secure, real-time view of your payout — encrypted end-to-end."
      actions={<LiveActivityStrip />}
    >
      {/* Workflow tracker */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <SectionLabel>Payout Workflow</SectionLabel>
            <div className="text-[20px] font-extrabold text-[#06194A] mt-1">
              {payoutStatus === "awaiting_method" ? "Set up your payout" : "Ready for release"}
            </div>
            <p className="text-sm text-[#53627A] mt-1">{fulfillmentNote}</p>
          </div>
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </div>
        <PayoutTracker activeIdx={activeStageIdx} />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => setTrackOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF0FF] text-[#4F46E5] text-[11.5px] font-bold px-3 py-1.5 hover:bg-[#E0E7FF] transition">
            <Activity className="w-3.5 h-3.5" /> Live payment tracker
          </button>
          <button onClick={() => setSecurityOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E6EAF0] text-[#06194A] text-[11.5px] font-bold px-3 py-1.5 hover:border-[#C7D2FE] transition">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Security details
          </button>
        </div>
      </Card>

      {/* Method selection + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Step 1 · Choose How You Get Paid</SectionLabel>
            {ach.status === "verified" && (
              <button onClick={() => { setAch({ status: "none" }); toast("Bank disconnected"); }}
                className="text-xs font-semibold text-[#4F46E5] hover:underline">Change bank</button>
            )}
          </div>
          <h3 className="text-lg font-bold text-[#06194A] mt-1 mb-4">Pick a payout method tailored to how fast you want your money.</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MethodCard
              method="ach" active={method === "ach"} onSelect={(m) => { setMethod(m); if (ach.status !== "verified") setBankOpen(true); }}
              badge="Recommended" accent="#4F46E5" icon={Landmark}
              title="ACH Direct Deposit"
              desc="Sent directly to your checking account. Most payouts delivered within hours."
              perks={[
                { icon: Zap,         label: "Fastest standard payout" },
                { icon: Lock,        label: "Bank-level encrypted transfer" },
                { icon: ShieldCheck, label: "No fees" },
              ]}
              cta={ach.status === "verified" && method === "ach" ? "Bank connected ✓" : "Connect bank account"}
            />
            <MethodCard
              method="instant" active={method === "instant"} onSelect={(m) => { setMethod(m); if (ach.status !== "verified") setBankOpen(true); }}
              accent="#7C3AED" icon={Zap}
              title="Instant Debit Transfer"
              desc="Sent to your eligible debit card in minutes. Supported banks only."
              perks={[
                { icon: Zap,         label: "Instant when eligible" },
                { icon: CreditCard,  label: "Sent to debit card" },
                { icon: Info,        label: "Small 1% network fee" },
              ]}
              cta={ach.status === "verified" && method === "instant" ? "Card connected ✓" : "Connect debit card"}
            />
            <MethodCard
              method="check" active={method === "check"} onSelect={(m) => { setMethod(m); toast.success("Paper check selected"); }}
              accent="#64748B" icon={FileText}
              title="Paper Check"
              desc="Receive a printed check handed to you during vehicle handoff."
              perks={[
                { icon: FileText,    label: "Printed at the dealership" },
                { icon: Building2,   label: "Given at vehicle handoff" },
                { icon: Lock,        label: "Verifiable serial number" },
              ]}
              cta="Choose check payment"
            />
          </div>

          {/* Connected bank banner */}
          <AnimatePresence>
            {ach.status === "verified" && (method === "ach" || method === "instant") && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-emerald-800">{ach.bankName ?? "Bank"} •••• {ach.mask}</div>
                  <div className="text-[12px] text-emerald-700/80">
                    {ach.mode === "instant" ? "Instant verification · " : "Manual entry verified · "}
                    Eligible for fast ACH payouts.
                  </div>
                </div>
                <button onClick={() => setBankOpen(true)} className="text-xs font-bold text-emerald-700 hover:underline">Manage</button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5">
            <SectionLabel>Security &amp; Trust</SectionLabel>
            <div className="mt-3"><SecurityBar /></div>
          </div>
        </Card>

        {/* Transaction Summary */}
        <Card className="p-5 lg:sticky lg:top-4 self-start">
          <SectionLabel>Transaction Summary</SectionLabel>
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#06194A] via-[#0F1F5A] to-[#1B2A6E] text-white p-5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }} />
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">Final Offer</div>
              <div className="text-4xl font-extrabold mt-1 tabular-nums leading-none">{fmt(MOCK.payment.netPayout)}</div>
              <div className="text-[12px] opacity-80 mt-1">Liberty Automotive · accepted</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[11.5px]">
                <div>
                  <div className="opacity-70 uppercase font-bold tracking-wide text-[10px]">Method</div>
                  <div className="font-bold mt-0.5 truncate">
                    {method === "ach" ? "ACH Deposit" : method === "instant" ? "Instant Debit" : method === "check" ? "Paper Check" : "Not selected"}
                  </div>
                </div>
                <div>
                  <div className="opacity-70 uppercase font-bold tracking-wide text-[10px]">Est. Delivery</div>
                  <div className="font-bold mt-0.5">{estimateLabel}</div>
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 text-sm">
            {[
              ["Accepted offer",            MOCK.payment.offer],
              ["Lien payoff",               -MOCK.payment.payoff],
              ["Pickup & processing fees",  -MOCK.payment.fees],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between">
                <dt className="text-[#53627A]">{k as string}</dt>
                <dd className={`font-semibold tabular-nums ${(v as number) < 0 ? "text-[#DC2626]" : "text-[#06194A]"}`}>
                  {(v as number) < 0 ? "−" : ""}{fmt(Math.abs(v as number))}
                </dd>
              </div>
            ))}
            <div className="border-t border-[#EEF0F4] pt-3 flex items-center justify-between">
              <dt className="font-bold text-[#06194A]">Net Payout</dt>
              <dd className="text-[20px] font-extrabold text-emerald-600 tabular-nums">{fmt(MOCK.payment.netPayout)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            <div className="rounded-2xl bg-[#EEF0FF] border border-[#C7D2FE] p-3 text-[11.5px] text-[#06194A] inline-flex items-start gap-2">
              <Zap className="w-3.5 h-3.5 text-[#4F46E5] mt-0.5 shrink-0" />
              Most ACH transfers are initiated within minutes of vehicle verification.
            </div>
            <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 text-[11.5px] text-[#53627A] inline-flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              Your payment is protected with encrypted banking security.
            </div>
            <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 text-[11.5px] text-[#53627A] inline-flex items-start gap-2">
              <ScrollText className="w-3.5 h-3.5 text-[#7C3AED] mt-0.5 shrink-0" />
              Digital bill of sale generated automatically after transfer completion.
            </div>
          </div>
        </Card>
      </div>

      {/* Documents */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between">
          <SectionLabel>Digital Documents</SectionLabel>
          <span className="text-[11px] text-[#8893A8] font-semibold">Generated automatically</span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {docs.map((d) => {
            const Icon = d.icon;
            return (
              <motion.div key={d.name} whileHover={{ y: -2 }}
                className={`rounded-2xl border p-4 flex flex-col h-full transition ${
                  d.ready ? "bg-white border-[#C7D2FE] hover:shadow-[0_12px_30px_-12px_rgba(79,70,229,0.3)]"
                          : "bg-[#F7F8FB] border-[#E6EAF0]"
                }`}>
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center ${d.ready ? "bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5]" : "bg-white border border-[#E6EAF0] text-[#8893A8]"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <StatusPill tone={d.ready ? "green" : "gray"}>
                    {d.ready ? "Ready" : "Pending"}
                  </StatusPill>
                </div>
                <div className="text-sm font-extrabold text-[#06194A] mt-3">{d.name}</div>
                <div className="text-[11.5px] text-[#53627A] mt-1 flex-1">
                  {d.ready ? "Signed and available to download." : "Available after payout is released."}
                </div>
                <div className="mt-3">
                  {d.ready ? (
                    <SecondaryButton onClick={() => setReceipt(d.name)} className="px-3 py-2 text-xs w-full justify-center">
                      <Eye className="w-3.5 h-3.5" /> View
                    </SecondaryButton>
                  ) : (
                    <button disabled className="w-full text-xs font-semibold text-[#8893A8] inline-flex items-center justify-center gap-1 py-2">
                      <Clock className="w-3 h-3" /> Awaiting release
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* ── Drawers ───────────────────────────────────────────────────────── */}

      <BankConnectionDrawer open={bankOpen} onClose={() => setBankOpen(false)} onConnected={setAch} />

      <SlideOver open={securityOpen} onClose={() => setSecurityOpen(false)}
        title="Security & Compliance" subtitle="How we protect your payment" width="md"
        footer={<PrimaryButton className="w-full" onClick={() => setSecurityOpen(false)}><Check className="w-4 h-4" /> Got it</PrimaryButton>}>
        <div className="space-y-3">
          <SecurityBar />
          <div className="rounded-2xl border border-[#EEF0F5] bg-white p-4 space-y-2 text-[12.5px] text-[#06194A]">
            {[
              "256-bit TLS encryption on every transmission",
              "Tokenized bank credentials — never stored in plain text",
              "NACHA-compliant ACH initiation and reconciliation",
              "Continuous anomaly monitoring with alerting",
              "SOC 2 Type II processing partners",
            ].map((s) => (
              <div key={s} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /> {s}</div>
            ))}
          </div>
          <div className="rounded-2xl bg-[#EEF0FF] border border-[#C7D2FE] p-3 text-[11.5px] text-[#06194A] inline-flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#4F46E5] mt-0.5 shrink-0" />
            Each consent and bank connection is timestamped and stored to your transaction record.
          </div>
        </div>
      </SlideOver>

      <SlideOver open={trackOpen} onClose={() => setTrackOpen(false)}
        title="Live Payment Tracker" subtitle="Stage-by-stage payout visibility" width="lg"
        footer={<PrimaryButton className="w-full" onClick={() => setTrackOpen(false)}>Close</PrimaryButton>}>
        <ol className="space-y-2">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = i < activeStageIdx;
            const active = i === activeStageIdx;
            return (
              <li key={s.id} className={`flex items-start gap-3 rounded-2xl border p-3 ${
                done ? "border-emerald-200 bg-emerald-50/60"
                : active ? "border-[#C7D2FE] bg-[#EEF0FF]/60"
                : "border-[#E6EAF0] bg-white"
              }`}>
                <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                  done ? "bg-emerald-500 text-white"
                  : active ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white"
                  : "bg-[#F4F6FA] text-[#8893A8]"
                }`}><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm font-extrabold ${done ? "text-emerald-800" : active ? "text-[#06194A]" : "text-[#53627A]"}`}>{s.label}</div>
                    <span className="text-[10px] font-bold text-[#8893A8]">
                      {done ? "Completed" : active ? "In progress" : "Up next"}
                    </span>
                  </div>
                  <div className={`text-[12px] mt-0.5 ${done ? "text-emerald-700/80" : active ? "text-[#4F46E5]" : "text-[#8893A8]"}`}>{s.sub}</div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 text-[11.5px] text-[#53627A] inline-flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-[#4F46E5] mt-0.5 shrink-0" />
          You'll receive real-time SMS and email updates at each stage.
        </div>
      </SlideOver>

      <SlideOver open={!!receipt} onClose={() => setReceipt(null)}
        title={receipt ?? ""} subtitle="Document preview" width="lg"
        footer={<div className="flex gap-2">
          <SecondaryButton onClick={() => setReceipt(null)} className="flex-1">Close</SecondaryButton>
          <PrimaryButton className="flex-1"><Download className="w-4 h-4" /> Download PDF</PrimaryButton>
        </div>}>
        <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-[#4F46E5]" />
          <div className="text-sm font-semibold text-[#06194A] mt-2">{receipt}</div>
          <div className="text-[12px] text-[#53627A] mt-1">Generated and time-stamped automatically.</div>
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default PaymentsPage;
