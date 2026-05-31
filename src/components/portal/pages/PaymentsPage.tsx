import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, FileText, Check, CheckCircle2, Zap, Building2, Eye, Banknote,
  Lock, Landmark, CreditCard, ArrowRight, Search, Info, Loader2,
  Download, Clock, AlertCircle, Wallet, ChevronRight, ChevronDown,
  ScrollText, Receipt, ScanLine, KeyRound, PenTool, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { fmt } from "../portalMock";
import { usePortalData } from "../PortalDataContext";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/* Premium fintech-grade Payment Center for the MOTO(acquire) portal.
   Refactored to: render only dealer-enabled payout methods, use
   progressive disclosure on selection, calm the workflow tracker,
   and visually subordinate the documents block. */

// ── Types & constants ──────────────────────────────────────────────────────

type Method = "paper_check" | "ach" | "eft" | "instant_debit" | "wire_transfer";
type PayoutStage = "inspection" | "method" | "handoff" | "verified" | "released" | "delivered";
type StageMeta = { id: PayoutStage; label: string };

const STAGES: StageMeta[] = [
  { id: "inspection", label: "Inspection Approved" },
  { id: "method",     label: "Payout Method"       },
  { id: "handoff",    label: "Handoff Scheduled"   },
  { id: "verified",   label: "Vehicle Verified"    },
  { id: "released",   label: "Payment Released"    },
  { id: "delivered",  label: "Funds Delivered"     },
];

const BANKS = [
  { id: "chase",    name: "Chase",            color: "#117ACA" },
  { id: "boa",      name: "Bank of America",  color: "#E31837" },
  { id: "wells",    name: "Wells Fargo",      color: "#D71E28" },
  { id: "capone",   name: "Capital One",      color: "#004977" },
  { id: "usbank",   name: "U.S. Bank",        color: "#0F2A5C" },
  { id: "citi",     name: "Citi",             color: "#003B70" },
];

type AchConn = { status: "none" | "verified"; bankName?: string; mask?: string; mode?: "instant" | "manual" };

const METHOD_META: Record<Method, {
  title: string;
  description: string;
  timing: string;
  icon: typeof Wallet;
  accent: string;
  needsBank: boolean;
}> = {
  paper_check: {
    title: "Paper Check",
    description: "Receive a printed dealership check during vehicle handoff.",
    timing: "Available same day at appointment",
    icon: FileText,
    accent: "#64748B",
    needsBank: false,
  },
  ach: {
    title: "ACH Deposit",
    description: "Secure bank transfer directly to your account.",
    timing: "Typically arrives within 1–2 business days",
    icon: Landmark,
    accent: "#6D28D9",
    needsBank: true,
  },
  eft: {
    title: "EFT Transfer",
    description: "Electronic transfer between participating banks.",
    timing: "Usually clears within 1 business day",
    icon: ArrowLeftRight,
    accent: "#0EA5E9",
    needsBank: true,
  },
  instant_debit: {
    title: "Instant Debit Transfer",
    description: "Sent to your eligible debit card in minutes.",
    timing: "Delivered to your card in minutes",
    icon: Zap,
    accent: "#6D28D9",
    needsBank: true,
  },
  wire_transfer: {
    title: "Wire Transfer",
    description: "Same-day wire to the bank you specify.",
    timing: "Same-day before bank cutoff",
    icon: Building2,
    accent: "#0F172A",
    needsBank: false,
  },
};

// ── Workflow tracker (calmer, more spacing) ────────────────────────────────

const PayoutTracker = ({ activeIdx }: { activeIdx: number }) => (
  <div className="relative pt-1">
    <div className="absolute left-4 right-4 top-[14px] h-px bg-[#E6EAF0]" />
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${(activeIdx / (STAGES.length - 1)) * 100}%` }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-4 top-[14px] h-px bg-[#6D28D9]"
    />
    <div className="relative grid grid-cols-3 gap-y-5 sm:grid-cols-6">
      {STAGES.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex flex-col items-center text-center">
            <motion.div
              animate={active ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold transition ${
                done
                  ? "bg-[#6D28D9] text-white"
                  : active
                  ? "bg-white text-[#6D28D9] ring-2 ring-[#6D28D9]"
                  : "bg-[#F4F6FA] text-[#C2CAD8]"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </motion.div>
            <div
              className={`mt-3 text-[11px] leading-tight transition ${
                active
                  ? "font-bold text-[#06194A]"
                  : done
                  ? "font-medium text-[#53627A]"
                  : "font-medium text-[#C2CAD8]"
              }`}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Simplified method card ─────────────────────────────────────────────────

const MethodRow = ({
  method, active, onSelect, ach,
}: {
  method: Method;
  active: boolean;
  onSelect: (m: Method) => void;
  ach: AchConn;
}) => {
  const m = METHOD_META[method];
  const Icon = m.icon;
  const connected = m.needsBank && ach.status === "verified";

  return (
    <motion.button
      layout
      onClick={() => onSelect(method)}
      className={`relative w-full text-left rounded-2xl border transition group ${
        active
          ? "border-[#6D28D9] bg-white shadow-[0_18px_44px_-22px_rgba(79,70,229,0.45)]"
          : "border-[#E6EAF0] bg-white hover:border-[#C7D2FE]"
      }`}
    >
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <div
          className="h-11 w-11 shrink-0 rounded-xl grid place-items-center text-white"
          style={{ background: `linear-gradient(135deg, ${m.accent}, ${m.accent}DD)` }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-[#06194A]">{m.title}</span>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Bank connected
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-[#53627A] line-clamp-1">{m.description}</p>
          <p className="mt-1 text-[11.5px] font-medium text-[#8893A8] inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {m.timing}
          </p>
        </div>
        <div className={`shrink-0 grid place-items-center h-7 w-7 rounded-full transition ${
          active ? "bg-[#6D28D9] text-white" : "bg-[#F4F6FA] text-[#C2CAD8] group-hover:text-[#8893A8]"
        }`}>
          {active ? <Check className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </div>
    </motion.button>
  );
};

// ── Progressive-disclosure detail panel ────────────────────────────────────

const MethodDetail = ({
  method, ach, onConnect,
}: {
  method: Method;
  ach: AchConn;
  onConnect: () => void;
}) => {
  const m = METHOD_META[method];
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="mx-1 mt-2 rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-5">
        <p className="text-[13px] text-[#06194A] leading-relaxed">{m.description}</p>

        {method === "paper_check" && (
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-[#53627A]">
            <li className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-[#6D28D9]" /> Printed at the dealership before your appointment.</li>
            <li className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-[#6D28D9]" /> Handed to you the moment you drop off your vehicle.</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-[#6D28D9]" /> Verifiable check number on your transaction record.</li>
          </ul>
        )}

        {method === "wire_transfer" && (
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-[#53627A]">
            <li className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-[#6D28D9]" /> Provide your bank's wire instructions at handoff.</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-[#6D28D9]" /> Often free for amounts over your bank's threshold.</li>
          </ul>
        )}

        {m.needsBank && (
          <div className="mt-3">
            {ach.status === "verified" ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-emerald-800 truncate">
                    {ach.bankName} •••• {ach.mask}
                  </div>
                  <div className="text-[11.5px] text-emerald-700/80">
                    {ach.mode === "instant" ? "Instant verification" : "Manual entry verified"}
                  </div>
                </div>
                <button onClick={onConnect} className="text-xs font-bold text-emerald-700 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <PrimaryButton onClick={onConnect} className="w-full justify-center">
                <Landmark className="h-4 w-4" /> Connect your bank
              </PrimaryButton>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ── Bank connection drawer (unchanged behaviour) ───────────────────────────

const BankConnectionDrawer = ({
  open, onClose, onConnected,
}: { open: boolean; onClose: () => void; onConnected: (c: AchConn) => void }) => {
  const MOCK = usePortalData();
  // Timer cleanup — the "instant bank link" simulation schedules a
  // setInterval + two nested setTimeouts. If the user closes the
  // drawer mid-link (or unmounts the page), all three keep firing
  // setState on an unmounted form panel. Track every id and cancel
  // them on close + unmount.
  const linkTimers = useRef<{ interval?: number; t1?: number; t2?: number }>({});
  const cancelLinkTimers = () => {
    const t = linkTimers.current;
    if (t.interval !== undefined) clearInterval(t.interval);
    if (t.t1 !== undefined) clearTimeout(t.t1);
    if (t.t2 !== undefined) clearTimeout(t.t2);
    linkTimers.current = {};
  };
  useEffect(() => () => cancelLinkTimers(), []);

  const [mode, setMode] = useState<"instant" | "manual">("instant");
  const [linking, setLinking] = useState<string | null>(null);
  const [linkProgress, setLinkProgress] = useState(0);
  const [consent, setConsent] = useState(false);
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
      // Drawer closed mid-link → cancel any in-flight timers AND
      // reset the form. Without the cancel, the interval kept firing
      // setLinkProgress on an unmounted form panel.
      cancelLinkTimers();
      setMode("instant"); setLinking(null); setLinkProgress(0);
      setRouting(""); setAccount(""); setName(MOCK.customer.name); setConsent(false);
    }
  }, [open]);

  const startInstant = (bank: typeof BANKS[number]) => {
    cancelLinkTimers();
    setLinking(bank.id); setLinkProgress(0);
    linkTimers.current.interval = window.setInterval(
      () => setLinkProgress((p) => Math.min(100, p + 12)),
      220,
    );
    linkTimers.current.t1 = window.setTimeout(() => {
      if (linkTimers.current.interval !== undefined) {
        clearInterval(linkTimers.current.interval);
        linkTimers.current.interval = undefined;
      }
      setLinkProgress(100);
      linkTimers.current.t2 = window.setTimeout(() => {
        onConnected({ status: "verified", bankName: bank.name, mask: "4127", mode: "instant" });
        toast.success(`${bank.name} verified`, { description: "Ready to receive your payout." });
        onClose();
      }, 350);
    }, 1800);
  };

  const submitManual = () => {
    if (!manualValid) return;
    onConnected({ status: "verified", bankName: "Verified bank", mask: account.slice(-4), mode: "manual" });
    toast.success("Bank account saved");
    onClose();
  };

  return (
    <SlideOver
      open={open} onClose={onClose}
      title="Connect Bank Account"
      subtitle="Encrypted, tokenized, never stored in plain text"
      width="lg"
      footer={mode === "manual" ? (
        <div className="flex gap-2">
          <SecondaryButton onClick={onClose} className="flex-1">Cancel</SecondaryButton>
          <PrimaryButton onClick={submitManual} className={`flex-1 ${!manualValid ? "opacity-60 cursor-not-allowed" : ""}`}>
            <ShieldCheck className="w-4 h-4" /> Verify & Save
          </PrimaryButton>
        </div>
      ) : undefined}
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F4F6FA] p-1 mb-4">
        {([
          { id: "instant" as const, label: "Instant Verification", Icon: Zap },
          { id: "manual"  as const, label: "Manual Entry",         Icon: KeyRound },
        ]).map((opt) => {
          const sel = mode === opt.id;
          return (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-bold transition ${
                sel ? "bg-white text-[#6D28D9] shadow-[0_6px_14px_-6px_rgba(79,70,229,0.35)]" : "text-[#53627A] hover:text-[#06194A]"
              }`}>
              <opt.Icon className="w-3.5 h-3.5" /> {opt.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {mode === "instant" ? (
          <motion.div key="instant" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {linking ? (
              <div className="rounded-3xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF0FF] via-white to-white p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] text-white grid place-items-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="text-sm font-extrabold text-[#06194A] mt-3">Securely linking your bank…</div>
                <div className="mt-4 h-2 rounded-full bg-white border border-[#E6EAF0] overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-[#6D28D9] to-[#6D28D9]"
                    animate={{ width: `${linkProgress}%` }} transition={{ duration: 0.25 }} />
                </div>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8893A8]" />
                  <input placeholder="Search 11,000+ banks"
                    className="w-full rounded-xl border border-[#E6EAF0] bg-white pl-9 pr-3 py-2.5 text-sm focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 outline-none" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8] mb-2">Most popular</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BANKS.map((b) => (
                    <motion.button key={b.id} whileHover={{ y: -2 }} onClick={() => startInstant(b)}
                      className="rounded-2xl border border-[#E6EAF0] bg-white p-3 text-left hover:border-[#C7D2FE] transition group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-extrabold text-sm shrink-0"
                          style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}CC)` }}>
                          {b.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[#06194A] truncate">{b.name}</div>
                          <div className="text-[10.5px] text-[#8893A8]">Instant verification</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#8893A8] group-hover:text-[#6D28D9] transition" />
                      </div>
                    </motion.button>
                  ))}
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
                        sel ? "border-[#6D28D9] bg-[#EEF0FF] text-[#6D28D9]" : "border-[#E6EAF0] text-[#06194A] hover:border-[#C7D2FE]"
                      }`}>{t}</button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-start gap-2 mt-3 rounded-2xl border border-[#E6EAF0] bg-[#F7F8FB] p-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-[#6D28D9]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-[12px] text-[#06194A] leading-snug">
                I authorize the dealership to send my payout to this account and confirm I am the account holder.
              </span>
            </label>
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
          : "border-[#E6EAF0] focus:border-[#6D28D9] focus:ring-[#6D28D9]/20"
        }`} />
      {ok && <CheckCircle2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
      {errorMsg && <AlertCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-rose-500" />}
    </div>
    {errorMsg && <div className="text-[11px] text-rose-600 mt-1 inline-flex items-center gap-1"><Info className="w-3 h-3" /> {errorMsg}</div>}
  </label>
);

// ── Main page ──────────────────────────────────────────────────────────────

export const PaymentsPage = () => {
  const MOCK = usePortalData();
  const { config } = useSiteConfig();
  const enabledMap = config.enabled_payout_methods;

  const enabledMethods = useMemo<Method[]>(() => {
    const order: Method[] = ["paper_check", "ach", "eft", "instant_debit", "wire_transfer"];
    const list = order.filter((k) => enabledMap?.[k]);
    return list.length > 0 ? list : ["paper_check"];
  }, [enabledMap]);

  // Default selection: first enabled method.
  const [method, setMethod] = useState<Method | null>(null);
  useEffect(() => {
    if (!method || !enabledMethods.includes(method)) {
      setMethod(enabledMethods[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledMethods.join("|")]);

  const [ach, setAch] = useState<AchConn>({ status: "none" });
  const [bankOpen, setBankOpen] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const selectedMeta = method ? METHOD_META[method] : null;
  const methodReady = !!selectedMeta && (!selectedMeta.needsBank || ach.status === "verified");
  const activeStageIdx = !methodReady ? 1 : 2;

  const estimateLabel = selectedMeta ? selectedMeta.timing : "Choose a payout method";

  const docs = useMemo(() => ([
    { name: "Bill of Sale",        icon: PenTool },
    { name: "Payment Receipt",     icon: Receipt },
    { name: "ACH Confirmation",    icon: Banknote },
    { name: "Transaction Summary", icon: ScrollText },
  ]), []);

  const onSelect = (m: Method) => {
    setMethod(m);
    const meta = METHOD_META[m];
    if (meta.needsBank && ach.status !== "verified") setBankOpen(true);
  };

  return (
    <PortalPageShell
      title="Payment Center"
      subtitle="A simple, guided way to receive your payout."
    >
      {/* ── Workflow tracker (calmer) ── */}
      <Card className="p-6 mb-6">
        <div className="mb-6">
          <SectionLabel>Payout Workflow</SectionLabel>
          <h2 className="mt-1 text-[20px] font-extrabold text-[#06194A]">
            {methodReady ? "Ready for handoff" : "Choose how you'd like to be paid"}
          </h2>
        </div>
        <PayoutTracker activeIdx={activeStageIdx} />
      </Card>

      {/* ── Method selection + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 mb-6">
        {/* LEFT — payout methods (active focus) */}
        <Card className="p-5 sm:p-6">
          <div className="mb-1">
            <SectionLabel>Step 1 · Choose How You Get Paid</SectionLabel>
          </div>
          <h3 className="text-[17px] font-bold text-[#06194A] mt-1">
            {enabledMethods.length === 1
              ? "Here's how your dealership pays sellers."
              : "Pick the option that works best for you."}
          </h3>
          <p className="mt-1 text-[13px] text-[#53627A]">
            Tap a method to see details. You can change this any time before handoff.
          </p>

          <div className="mt-4 space-y-2.5">
            {enabledMethods.map((m) => (
              <div key={m}>
                <MethodRow method={m} active={method === m} onSelect={onSelect} ach={ach} />
                <AnimatePresence initial={false}>
                  {method === m && (
                    <MethodDetail method={m} ach={ach} onConnect={() => setBankOpen(true)} />
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT — simplified summary */}
        <Card className="p-5 lg:sticky lg:top-4 self-start">
          <SectionLabel>Transaction Summary</SectionLabel>

          {/* Calmer payout card — solid navy, no dot pattern */}
          <div className="mt-3 rounded-2xl bg-[#06194A] text-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Net Payout</div>
            <div className="text-4xl font-extrabold mt-1 tabular-nums leading-none">
              {fmt(MOCK.payment.netPayout)}
            </div>
            <div className="mt-3 text-[12px] opacity-80">
              {selectedMeta ? selectedMeta.title : "Method not selected"} ·{" "}
              <span className="opacity-90">{estimateLabel}</span>
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
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
              <dd className="text-[18px] font-extrabold text-emerald-600 tabular-nums">{fmt(MOCK.payment.netPayout)}</dd>
            </div>
          </dl>

          <div className="mt-4 inline-flex items-start gap-2 text-[11.5px] text-[#53627A]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            Protected with bank-level security at every step.
          </div>
        </Card>
      </div>

      {/* ── Documents (visually subordinate) ── */}
      <Card className="p-5 mb-6 bg-[#FAFBFD] border-[#EEF0F5]">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Documents Available After Payment</SectionLabel>
            <p className="mt-1 text-[12px] text-[#8893A8]">
              These generate automatically once your payout is released.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {docs.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.name}
                disabled
                className="flex items-center gap-2 rounded-xl border border-dashed border-[#E6EAF0] bg-white px-3 py-2.5 text-left opacity-80"
              >
                <Icon className="h-4 w-4 text-[#8893A8] shrink-0" />
                <span className="text-[12px] font-semibold text-[#53627A] truncate">{d.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Drawers ── */}
      <BankConnectionDrawer open={bankOpen} onClose={() => setBankOpen(false)} onConnected={setAch} />

      <SlideOver open={!!receipt} onClose={() => setReceipt(null)}
        title={receipt ?? ""} subtitle="Document preview" width="lg"
        footer={<div className="flex gap-2">
          <SecondaryButton onClick={() => setReceipt(null)} className="flex-1">Close</SecondaryButton>
          <PrimaryButton className="flex-1"><Download className="w-4 h-4" /> Download PDF</PrimaryButton>
        </div>}>
        <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-[#6D28D9]" />
          <div className="text-sm font-semibold text-[#06194A] mt-2">{receipt}</div>
          <div className="text-[12px] text-[#53627A] mt-1">Generated and time-stamped automatically.</div>
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default PaymentsPage;
