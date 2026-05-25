import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, MapPin, Phone, Check, ChevronLeft, ChevronRight, Calendar, Home,
  Building2, Sparkles, Camera, ShieldCheck, Zap, Clock, FileSignature, KeyRound,
  DollarSign, Lock, Star, ArrowRight, ArrowLeft, RotateCcw, CheckCircle2,
  AlertCircle, Briefcase, Navigation, MessageSquare,
} from "lucide-react";
import { usePortalData } from "../PortalDataContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";
import { AIInspectionFlow, type InspectionResult } from "../AIInspectionFlow";

// ── Types ────────────────────────────────────────────────────────────────────
type Method = null | "dealership" | "ai";
type AiStatus = "idle" | "uploading" | "analyzing" | "approved" | "retry";

const TIME_WINDOWS = [
  { label: "9–11 AM",   tone: "high" as const, note: "20–30 min" },
  { label: "11 AM–1 PM", tone: "high" as const, note: "20–30 min" },
  { label: "1–3 PM",     tone: "limited" as const, note: "25–35 min" },
  { label: "3–5 PM",     tone: "limited" as const, note: "30–40 min" },
];

const AI_STEPS = [
  { id: "front",    label: "Front photos",       icon: Camera, hint: "Capture the full front from 6 ft back" },
  { id: "rear",     label: "Rear photos",        icon: Camera, hint: "Include license plate clearly" },
  { id: "sides",    label: "Side profiles",      icon: Camera, hint: "Driver and passenger side" },
  { id: "interior", label: "Interior photos",    icon: Camera, hint: "Dash, seats, cargo area" },
  { id: "odo",      label: "Odometer capture",   icon: Navigation, hint: "Engine on for digital clusters" },
  { id: "vin",      label: "VIN verification",   icon: ShieldCheck, hint: "Door jamb or windshield" },
  { id: "damage",   label: "Damage walkthrough", icon: AlertCircle, hint: "Slow video around vehicle" },
];

const WORKFLOW = [
  { id: 1, label: "Inspection Required", icon: Camera },
  { id: 2, label: "Inspection Approved", icon: CheckCircle2 },
  { id: 3, label: "Pickup Scheduled",    icon: Calendar },
  { id: 4, label: "Driver Assigned",     icon: Truck },
  { id: 5, label: "Vehicle In Transit",  icon: Navigation },
  { id: 6, label: "Payment Released",    icon: DollarSign },
  { id: 7, label: "Transaction Complete", icon: CheckCircle2 },
];

const PICKUP_STEPS = [
  { icon: ShieldCheck,  title: "Driver verifies VIN",        time: "~2 min", desc: "Quick scan against your file." },
  { icon: Check,        title: "Final condition confirmation", time: "~5 min", desc: "Matched to your AI inspection." },
  { icon: KeyRound,     title: "Keys and title collected",   time: "~3 min", desc: "Both sets of keys, signed title." },
  { icon: FileSignature, title: "Bill of sale signed",       time: "~3 min", desc: "Digital signature on the spot." },
  { icon: DollarSign,   title: "Payment released",            time: "~2 hrs", desc: "ACH initiated immediately after." },
];

const CHECKLIST = [
  "Remove all personal items",
  "Bring the title (signed)",
  "Bring both sets of keys",
  "Confirm odometer reading",
  "Have license / ID ready",
  "Cancel insurance after pickup",
];

type Dealership = {
  id: string;
  name: string;
  distance: string;
  rating: number;
  address: string;
  hours: string;
  earliest: string;
};

interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  hours: string | null;
  rating: number | null;
}

const useDealerships = (): Dealership[] => {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const [rows, setRows] = useState<LocationRow[] | null>(null);
  useEffect(() => {
    (async () => {
      // Scope to the customer's dealer (tenant) — never surface another
      // dealership's locations in the portal.
      const { data } = await supabase
        .from("dealership_locations" as never)
        .select("id, name, address, city, state, hours, rating")
        .eq("dealership_id", tenant.dealership_id)
        .eq("is_active", true)
        .order("sort_order");
      setRows((data as unknown as LocationRow[]) || []);
    })();
  }, [tenant.dealership_id]);
  if (!rows) return [];
  if (rows.length === 0) {
    // No locations configured yet — show the customer's own dealer from
    // site_config rather than any placeholder/demo dealership.
    const hours = config.business_hours?.[0]
      ? `${config.business_hours[0].days} · ${config.business_hours[0].hours}`
      : "Call for hours";
    return [{
      id: "primary",
      name: config.dealership_name || "Your dealership",
      distance: "—",
      rating: 0,
      address: config.address || "Address shared during scheduling",
      hours,
      earliest: "Schedule a time",
    }];
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    distance: "—",
    rating: r.rating ?? 0,
    address: [r.address, [r.city, r.state].filter(Boolean).join(", ")]
      .filter(Boolean).join(", "),
    hours: r.hours || "Call for hours",
    earliest: "Schedule a time",
  }));
};

const buildDays = () => {
  const out: { date: Date; available: boolean; avail: "high" | "limited" | "none" }[] = [];
  const start = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const available = dow !== 0;
    const avail = !available ? "none" : (i % 5 === 2 ? "limited" : "high");
    out.push({ date: d, available, avail });
  }
  return out;
};

// ── Subcomponents ────────────────────────────────────────────────────────────

const MethodCard = ({
  active, onClick, icon: Icon, title, desc, benefits, cta, accent,
}: any) => (
  <motion.button
    whileHover={{ y: -3 }}
    onClick={onClick}
    className={`relative text-left rounded-2xl border-2 p-6 transition group overflow-hidden ${
      active
        ? "border-[#4F46E5] bg-gradient-to-br from-[#EEF0FF] to-white shadow-[0_20px_50px_-20px_rgba(79,70,229,0.45)]"
        : "border-[#E6EAF0] bg-white hover:border-[#C7D2FE] hover:shadow-[0_12px_30px_-12px_rgba(79,70,229,0.25)]"
    }`}
  >
    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
         style={{ background: `radial-gradient(circle, ${accent}25, transparent 70%)` }} />
    <div className="flex items-start justify-between relative">
      <motion.div
        whileHover={{ scale: 1.08, rotate: -4 }}
        className="w-12 h-12 rounded-xl grid place-items-center text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.5)]"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}DD)` }}
      >
        <Icon className="w-5 h-5" />
      </motion.div>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-7 h-7 rounded-full bg-[#4F46E5] grid place-items-center">
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </div>
    <div className="mt-4 text-base font-bold text-[#06194A]">{title}</div>
    <p className="text-sm text-[#53627A] mt-1 leading-relaxed">{desc}</p>
    <ul className="mt-4 space-y-1.5">
      {benefits.map((b: string) => (
        <li key={b} className="flex items-center gap-2 text-[12px] text-[#06194A]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" /> {b}
        </li>
      ))}
    </ul>
    <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${active ? "text-[#4F46E5]" : "text-[#06194A]"}`}>
      {cta} <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
    </div>
  </motion.button>
);

const WorkflowTracker = ({ activeStep }: { activeStep: number }) => (
  <div className="relative">
    <div className="absolute left-0 right-0 top-5 h-px bg-[#E6EAF0]" />
    <motion.div
      initial={{ scaleX: 0 }} animate={{ scaleX: (activeStep - 1) / (WORKFLOW.length - 1) }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformOrigin: "left" }}
      className="absolute left-0 right-0 top-5 h-px bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
    />
    <div className="relative grid grid-cols-7 gap-1 overflow-x-auto">
      {WORKFLOW.map((s) => {
        const Icon = s.icon;
        const done = s.id < activeStep;
        const active = s.id === activeStep;
        return (
          <div key={s.id} className="flex flex-col items-center text-center min-w-0">
            <motion.div
              animate={active ? { boxShadow: ["0 0 0 0 rgba(79,70,229,0.5)", "0 0 0 8px rgba(79,70,229,0)"] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
              className={`w-10 h-10 rounded-full grid place-items-center transition ${
                done   ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-[0_6px_14px_-4px_rgba(79,70,229,0.55)]"
              : active ? "bg-white border-2 border-[#4F46E5] text-[#4F46E5]"
                       : "bg-[#F4F6FA] text-[#8893A8]"
              }`}
            >
              <Icon className="w-4 h-4" />
            </motion.div>
            <div className={`text-[10px] font-semibold mt-2 leading-tight ${done || active ? "text-[#06194A]" : "text-[#8893A8]"}`}>
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const ProgressRing = ({ percent }: { percent: number }) => {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" className="-rotate-90">
      <circle cx="32" cy="32" r={r} stroke="#E6EAF0" strokeWidth="6" fill="none" />
      <motion.circle
        cx="32" cy="32" r={r} stroke="url(#ringGrad)" strokeWidth="6" fill="none" strokeLinecap="round"
        initial={{ strokeDasharray: c, strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (percent / 100) * c }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" /><stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const LiveStatusStrip = () => {
  const items = [
    { icon: CheckCircle2, tone: "text-[#16A34A]", text: "Pickup availability updated · just now" },
    { icon: Truck,        tone: "text-[#4F46E5]", text: "Coordinator reviewing route · 2 min ago" },
    { icon: Camera,       tone: "text-[#7C3AED]", text: "Inspection slot opened · 5 min ago" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % items.length), 5000); return () => clearInterval(id); }, []);
  const Icon = items[i].icon;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
        className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#53627A]">
        <Icon className={`w-3.5 h-3.5 ${items[i].tone}`} /> {items[i].text}
      </motion.div>
    </AnimatePresence>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

export const PickupPage = () => {
  const MOCK = usePortalData();
  const DEALERSHIPS = useDealerships();
  const [method, setMethod] = useState<Method>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiCompleted, setAiCompleted] = useState<Set<number>>(new Set());
  const [inspectionApproved, setInspectionApproved] = useState(false);
  const [dealershipPick, setDealershipPick] = useState<string | null>(null);
  const [pickupSpot, setPickupSpot] = useState<"home" | "work" | "dealership">("home");

  const [editLoc, setEditLoc] = useState(false);
  const [contact, setContact] = useState(false);
  const [whatHappens, setWhatHappens] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const days = useMemo(buildDays, []);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set([CHECKLIST[0], CHECKLIST[3]]));

  const scheduleUnlocked = method === "dealership" ? !!dealershipPick : inspectionApproved;
  const workflowStep = !method ? 1 : !inspectionApproved && method === "ai" ? 1 : !selectedDay ? 2 : !selectedWindow ? 3 : 3;
  const checklistPct = Math.round((checked.size / CHECKLIST.length) * 100);

  // AI simulation
  const runAiStep = () => {
    setAiStatus("uploading");
    setTimeout(() => setAiStatus("analyzing"), 1100);
    setTimeout(() => {
      setAiCompleted((p) => new Set(p).add(aiStep));
      if (aiStep < AI_STEPS.length - 1) {
        setAiStatus("idle");
        setAiStep((s) => s + 1);
      } else {
        setAiStatus("approved");
        setTimeout(() => { setInspectionApproved(true); setAiOpen(false); }, 1400);
      }
    }, 2400);
  };

  const toggleCheck = (t: string) =>
    setChecked((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  return (
    <PortalPageShell
      title="Pickup Scheduling"
      subtitle="A guided handoff — from inspection to payment, all coordinated."
      actions={<LiveStatusStrip />}
    >
      {/* Workflow Tracker */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <SectionLabel>Transaction Workflow</SectionLabel>
            <div className="text-[20px] font-extrabold text-[#06194A] mt-1">
              {workflowStep === 1 ? "Inspection Required" : workflowStep === 2 ? "Inspection Approved" : "Schedule Your Pickup"}
            </div>
            <p className="text-sm text-[#53627A] mt-1">
              {method ? "We'll guide you through each remaining step." : "Choose how you'd like to complete your handoff below."}
            </p>
          </div>
          <StatusPill tone={inspectionApproved ? "green" : "indigo"}>
            {inspectionApproved ? "On track" : "Action needed"}
          </StatusPill>
        </div>
        <WorkflowTracker activeStep={workflowStep} />
      </Card>

      {/* Step 1 — Handoff Method */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Step 1 · Handoff Method</SectionLabel>
          {method && (
            <button onClick={() => { setMethod(null); setInspectionApproved(false); setDealershipPick(null); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline">
              <RotateCcw className="w-3 h-3" /> Change method
            </button>
          )}
        </div>
        <h3 className="text-lg font-bold text-[#06194A] mt-1 mb-4">How would you like to complete your vehicle handoff?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MethodCard
            active={method === "dealership"}
            onClick={() => setMethod("dealership")}
            icon={Building2}
            title="Dealership Inspection & Drop-Off"
            desc="Bring your vehicle to a nearby dealership for a quick in-person inspection and immediate handoff."
            benefits={["Same-day completion", "In-person support", "Faster payment release", "Final verification onsite"]}
            cta="Schedule Dealership Visit"
            accent="#4F46E5"
          />
          <MethodCard
            active={method === "ai"}
            onClick={() => { setMethod("ai"); if (!inspectionApproved) setAiOpen(true); }}
            icon={Sparkles}
            title="AI Photo Inspection + Home Pickup"
            desc="Complete a guided AI-assisted inspection from your phone and we'll schedule pickup directly from your location."
            benefits={["No dealership visit required", "Pickup from home or work", "AI-guided photo capture", "Contactless experience"]}
            cta={inspectionApproved ? "Inspection Complete ✓" : "Start AI Inspection"}
            accent="#7C3AED"
          />
        </div>

        {method === "ai" && inspectionApproved && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl bg-gradient-to-r from-[#ECFDF5] to-white border border-[#A7F3D0] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white grid place-items-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#047857]">AI Inspection Approved</div>
              <div className="text-xs text-[#047857]/80">Pickup scheduling unlocked below.</div>
            </div>
            <SecondaryButton onClick={() => setAiOpen(true)}>Review</SecondaryButton>
          </motion.div>
        )}
      </Card>

      {/* Step 2 — Dealership picker OR Scheduling */}
      {method === "dealership" && (
        <Card className="p-5 mb-6">
          <SectionLabel>Step 2 · Choose Your Dealership</SectionLabel>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {DEALERSHIPS.map((d) => {
              const sel = dealershipPick === d.id;
              return (
                <motion.button key={d.id} whileHover={{ y: -2 }} onClick={() => setDealershipPick(d.id)}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition ${
                    sel ? "border-[#4F46E5] shadow-[0_12px_30px_-12px_rgba(79,70,229,0.4)]" : "border-[#E6EAF0] hover:border-[#C7D2FE]"
                  }`}>
                  <div className="h-24 bg-gradient-to-br from-[#EEF0FF] via-[#F5F3FF] to-[#FAFBFE] relative">
                    <div className="absolute inset-0 grid place-items-center text-[#4F46E5]/40"><Building2 className="w-10 h-10" /></div>
                    {d.rating > 0 && (
                      <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-white/90 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-bold text-[#06194A]">
                        <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" /> {d.rating}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-[#06194A] truncate">{d.name}</div>
                      <div className="text-[11px] font-semibold text-[#4F46E5]">{d.distance}</div>
                    </div>
                    <div className="text-[11px] text-[#53627A] mt-0.5 truncate">{d.address}</div>
                    <div className="text-[10px] text-[#8893A8] mt-1.5">{d.hours}</div>
                    <div className="mt-2 rounded-lg bg-[#F7F8FB] px-2 py-1.5 text-[11px] text-[#06194A] flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-[#F59E0B]" /> Earliest: <span className="font-semibold">{d.earliest}</span>
                    </div>
                    <div className="text-[10px] text-[#8893A8] mt-1.5">Most inspections take 15–20 min.</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Scheduling section — unlocked */}
      <AnimatePresence>
        {scheduleUnlocked && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
              {/* Calendar */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Step 3 · Choose a Pickup Date</SectionLabel>
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 rounded-lg border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <button className="w-7 h-7 rounded-lg border border-[#E6EAF0] grid place-items-center text-[#53627A] hover:bg-[#F4F6FA]"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Smart recommendations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  <div className="rounded-xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#C7D2FE] p-3 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#4F46E5] mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[#4F46E5] font-bold">Earliest pickup</div>
                      <div className="text-xs font-semibold text-[#06194A]">Tomorrow · 10 AM–12 PM</div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-[#ECFDF5] to-white border border-[#A7F3D0] p-3 flex items-start gap-2">
                    <Truck className="w-4 h-4 text-[#16A34A] mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[#047857] font-bold">Fastest payout</div>
                      <div className="text-xs font-semibold text-[#06194A]">Friday afternoon pickup</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {days.map((d) => {
                    const sel = selectedDay && d.date.toDateString() === selectedDay.toDateString();
                    const dot = d.avail === "high" ? "bg-[#16A34A]" : d.avail === "limited" ? "bg-[#F59E0B]" : "bg-[#CBD5E1]";
                    return (
                      <motion.button
                        key={d.date.toISOString()}
                        whileHover={d.available ? { y: -2, scale: 1.03 } : {}}
                        disabled={!d.available}
                        onClick={() => setSelectedDay(d.date)}
                        className={`relative aspect-square rounded-xl border text-sm font-semibold transition ${
                          !d.available ? "opacity-30 cursor-not-allowed border-[#E6EAF0] text-[#8893A8]"
                          : sel ? "bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white border-[#4F46E5] shadow-[0_10px_24px_-8px_rgba(79,70,229,0.6)]"
                          : "border-[#E6EAF0] text-[#06194A] hover:border-[#4F46E5]/40 hover:bg-[#EEF0FF]/40"
                        }`}
                      >
                        <div className="text-[10px] uppercase opacity-75 leading-none mt-1.5">{d.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
                        <div className="text-base leading-tight">{d.date.getDate()}</div>
                        <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${sel ? "bg-white" : dot}`} />
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-[#8893A8]">
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> High</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" /> Limited</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1]" /> Unavailable</span>
                </div>

                <div className="mt-5">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-[#8893A8] mb-2">Time Window</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIME_WINDOWS.map((w) => {
                      const sel = selectedWindow === w.label;
                      return (
                        <motion.button key={w.label} whileHover={{ y: -1 }} onClick={() => setSelectedWindow(w.label)} disabled={!selectedDay}
                          className={`rounded-xl py-2.5 text-left px-3 transition ${
                            sel ? "bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.5)]"
                                : "bg-[#F7F8FB] text-[#06194A] hover:bg-[#EEF0FF] disabled:opacity-50 disabled:cursor-not-allowed"
                          }`}>
                          <div className="text-sm font-bold">{w.label}</div>
                          <div className={`text-[10px] mt-0.5 ${sel ? "text-white/80" : "text-[#8893A8]"}`}>{w.note}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <PrimaryButton onClick={() => (selectedDay && selectedWindow) && setConfirmOpen(true)} className={`mt-5 w-full py-3 ${(!selectedDay || !selectedWindow) ? "opacity-50 cursor-not-allowed" : ""}`}>
                  Confirm Pickup
                </PrimaryButton>
              </Card>

              {/* Location + Driver */}
              <div className="flex flex-col gap-6">
                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Pickup Location</SectionLabel>
                    <button onClick={() => setEditLoc(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">Edit</button>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {([
                      { id: "home", icon: Home, label: "Home" },
                      { id: "work", icon: Briefcase, label: "Work" },
                      { id: "dealership", icon: Building2, label: "Dealer" },
                    ] as const).map((o) => {
                      const Icon = o.icon; const sel = pickupSpot === o.id;
                      return (
                        <button key={o.id} onClick={() => setPickupSpot(o.id)}
                          className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition flex flex-col items-center gap-1 ${
                            sel ? "border-[#4F46E5] bg-[#EEF0FF] text-[#4F46E5]" : "border-[#E6EAF0] text-[#53627A] hover:bg-[#F7F8FB]"
                          }`}>
                          <Icon className="w-4 h-4" /> {o.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-[#E6EAF0] h-28 bg-gradient-to-br from-[#EEF0FF] via-[#F5F3FF] to-[#FAFBFE]">
                    <div className="absolute inset-0" style={{
                      backgroundImage: "radial-gradient(circle at 30% 40%, rgba(79,70,229,0.15), transparent 50%), radial-gradient(circle at 70% 70%, rgba(124,58,237,0.12), transparent 50%)",
                    }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }}
                        className="w-3 h-3 rounded-full bg-[#4F46E5] ring-4 ring-[#4F46E5]/20" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold text-[#06194A]">{pickupSpot === "home" ? "Home address" : pickupSpot === "work" ? "Work address" : "Dealership drop-off"}</div>
                      {(() => {
                        const a = MOCK.customer.mailingAddress;
                        const line = [a.street, a.unit, [a.city, a.state].filter(Boolean).join(", "), a.zip]
                          .filter(Boolean).join(", ");
                        return line
                          ? <div className="text-[#53627A] text-xs">{line}</div>
                          : <div className="text-[#8893A8] text-xs italic">Add your address or upload your license to fill this in</div>;
                      })()}
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionLabel>Driver / Transport</SectionLabel>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center text-xs font-bold">MR</div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#16A34A] ring-2 ring-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#06194A]">Marcus R.</div>
                      <div className="text-[11px] text-[#53627A]">Transport Coordinator · 6 yrs</div>
                    </div>
                    <button onClick={() => setContact(true)} aria-label="Contact driver"
                      className="w-9 h-9 rounded-lg border border-[#E6EAF0] text-[#4F46E5] grid place-items-center hover:bg-[#EEF0FF] transition">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-[#F7F8FB] p-2"><div className="text-[#8893A8]">Transport</div><div className="font-semibold text-[#06194A] mt-0.5 flex items-center gap-1"><Truck className="w-3 h-3" /> Enclosed</div></div>
                    <div className="rounded-lg bg-[#F7F8FB] p-2"><div className="text-[#8893A8]">Driver ETA</div><div className="font-semibold text-[#06194A] mt-0.5">2 hrs before</div></div>
                  </div>
                  <SecondaryButton onClick={() => setContact(true)} className="mt-3 w-full"><MessageSquare className="w-4 h-4" /> Contact Coordinator</SecondaryButton>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* What Happens During Pickup */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between">
          <SectionLabel>What Happens During Pickup?</SectionLabel>
          <button onClick={() => setWhatHappens(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">View all details →</button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          {PICKUP_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="relative rounded-2xl border border-[#E6EAF0] p-4 hover:border-[#C7D2FE] hover:shadow-[0_8px_20px_-8px_rgba(79,70,229,0.2)] transition">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center mb-2.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-[11px] text-[#8893A8] font-semibold">Step {i + 1} · {s.time}</div>
                <div className="text-sm font-bold text-[#06194A] mt-0.5">{s.title}</div>
                <div className="text-[11px] text-[#53627A] mt-1 leading-snug">{s.desc}</div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#F7F8FB] p-3 flex items-center gap-2 text-[12px] text-[#06194A]"><DollarSign className="w-4 h-4 text-[#16A34A]" /> ACH initiated after VIN confirm</div>
          <div className="rounded-xl bg-[#F7F8FB] p-3 flex items-center gap-2 text-[12px] text-[#06194A]"><Zap className="w-4 h-4 text-[#F59E0B]" /> Most payments release within 2 hrs</div>
          <div className="rounded-xl bg-[#F7F8FB] p-3 flex items-center gap-2 text-[12px] text-[#06194A]"><Lock className="w-4 h-4 text-[#4F46E5]" /> Secure encrypted transaction</div>
        </div>
      </Card>

      {/* Checklist with progress ring */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Pickup Preparation</SectionLabel>
            <div className="text-sm text-[#53627A] mt-0.5">Auto-saved as you go.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[20px] font-extrabold text-[#06194A] leading-none">{checklistPct}%</div>
              <div className="text-[10px] text-[#8893A8] uppercase font-semibold">Complete</div>
            </div>
            <div className="relative">
              <ProgressRing percent={checklistPct} />
              <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-[#4F46E5]">
                {checked.size}/{CHECKLIST.length}
              </div>
            </div>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHECKLIST.map((t) => {
            const done = checked.has(t);
            return (
              <motion.li key={t} whileHover={{ x: 2 }}
                onClick={() => toggleCheck(t)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                  done ? "bg-[#ECFDF5] border-[#A7F3D0]" : "border-[#E6EAF0] hover:border-[#C7D2FE]"
                }`}>
                <span className={`w-5 h-5 rounded-md grid place-items-center transition ${
                  done ? "bg-[#16A34A] border-2 border-[#16A34A] text-white" : "border-2 border-[#C7D2FE] text-transparent"
                }`}>
                  <Check className="w-3 h-3" />
                </span>
                <span className={`text-sm transition ${done ? "text-[#047857] line-through" : "text-[#06194A]"}`}>{t}</span>
              </motion.li>
            );
          })}
        </ul>
      </Card>

      {/* ── Drawers ─────────────────────────────────────────────────── */}

      {/* AI Inspection — premium fullscreen guided workflow */}
      <AIInspectionFlow
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApproved={(result: InspectionResult) => {
          setInspectionApproved(true);
          setAiOpen(false);
          // Mark every internal AI step as completed for the legacy summary chip
          setAiCompleted(new Set(AI_STEPS.map((_, i) => i)));
          setAiStatus("approved");
          void result;
        }}
        vehicle={MOCK.vehicle}
      />

      {/* Confirm pickup */}
      <SlideOver open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Pickup Scheduled"
        subtitle={selectedDay ? `${selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ${selectedWindow}` : ""}
        footer={<PrimaryButton className="w-full" onClick={() => setConfirmOpen(false)}>Done</PrimaryButton>}>
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#ECFDF5] to-white border border-[#A7F3D0] p-5 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12 }}
              className="w-14 h-14 mx-auto rounded-full bg-[#16A34A] text-white grid place-items-center">
              <Check className="w-7 h-7" />
            </motion.div>
            <div className="text-base font-bold text-[#047857] mt-3">Pickup successfully scheduled</div>
            <div className="text-xs text-[#047857]/80 mt-1">A coordinator will confirm 24 hrs in advance.</div>
          </div>
          <ol className="space-y-2 text-sm">
            {["Date & window confirmed", "Pickup address saved", "Vehicle ready & keys in hand", "Title signed and ready"].map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#EEF0FF] text-[#4F46E5] font-bold text-xs grid place-items-center shrink-0">{i + 1}</span>
                <span className="text-[#06194A] pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </SlideOver>

      <SlideOver open={editLoc} onClose={() => setEditLoc(false)} title="Edit Pickup Location" width="md"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setEditLoc(false)} className="flex-1">Cancel</SecondaryButton><PrimaryButton onClick={() => setEditLoc(false)} className="flex-1">Save</PrimaryButton></div>}>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Address</span>
          <input defaultValue={[MOCK.customer.mailingAddress.street, MOCK.customer.mailingAddress.unit].filter(Boolean).join(", ")} placeholder="Street address" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">City</span>
            <input defaultValue={MOCK.customer.mailingAddress.city} placeholder="City" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">ZIP</span>
            <input defaultValue={MOCK.customer.mailingAddress.zip} placeholder="ZIP" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
          </label>
        </div>
        <label className="block mt-3">
          <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Delivery instructions</span>
          <textarea rows={3} placeholder="Gate code, apartment number, preferred parking area…" className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </label>
      </SlideOver>

      <SlideOver open={contact} onClose={() => setContact(false)} title="Contact Coordinator" subtitle="Marcus R."
        footer={<PrimaryButton className="w-full">Send Message</PrimaryButton>}>
        <textarea rows={4} placeholder="e.g. Please call when you're 10 minutes out." className="w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SecondaryButton><Phone className="w-4 h-4" /> Call</SecondaryButton>
          <SecondaryButton>Text Driver</SecondaryButton>
        </div>
      </SlideOver>

      <SlideOver open={whatHappens} onClose={() => setWhatHappens(false)} title="What Happens During Pickup" subtitle="Transparent, step-by-step" width="lg">
        <ol className="space-y-3">
          {PICKUP_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-[#E6EAF0] p-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[#06194A]">Step {i + 1} · {s.title}</div>
                    <span className="text-[10px] font-semibold text-[#8893A8] inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s.time}</span>
                  </div>
                  <div className="text-xs text-[#53627A] mt-1">{s.desc}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </SlideOver>
    </PortalPageShell>
  );
};

export default PickupPage;
