import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, ShieldCheck,
  AlertTriangle, Sun, Image as ImageIcon, Loader2, Info, Car, Gauge, ScanLine,
  RotateCcw, ArrowRight, Lightbulb, Zap, FileCheck2, Crown, Trophy,
} from "lucide-react";

/**
 * Premium AI-assisted vehicle inspection workflow.
 * Fullscreen, guided, 8-step camera-first flow with simulated quality checks,
 * VIN verification, damage detection, confidence scoring, and inspection summary.
 *
 * Modular: drop in anywhere you have an "Inspection Required" state.
 *   <AIInspectionFlow open={open} onClose={...} onApproved={...} vehicle={...} />
 */

// ── Types & constants ───────────────────────────────────────────────────────

export type InspectionVehicle = { year: number | string; make: string; model: string; trim?: string };
export type InspectionResult = {
  status: "approved" | "review";
  score: number;
  capturedAt: number;
};

type QualityTone = "green" | "amber" | "red";
type QualityCheck = { tone: QualityTone; label: string };

type StepDef = {
  id: string;
  title: string;
  short: string;
  icon: typeof Camera;
  hint: string;
  tips: string[];
  framing: "wide" | "portrait" | "square" | "vin" | "odometer";
};

const STEPS: StepDef[] = [
  { id: "front",     title: "Front Exterior",     short: "Front",     icon: Car,
    hint: "Position the entire front bumper inside the frame.",
    tips: ["Stand 6–8 ft back", "Capture both headlights and grille", "Avoid harsh shadows"], framing: "wide" },
  { id: "rear",      title: "Rear Exterior",      short: "Rear",      icon: Car,
    hint: "Capture the full rear with taillights and license plate visible.",
    tips: ["Stand 6–8 ft back", "Include trunk or hatch", "Keep horizon level"], framing: "wide" },
  { id: "sides",     title: "Side Profiles",      short: "Sides",     icon: Car,
    hint: "Two photos — driver and passenger side, full length.",
    tips: ["Stand far enough back to fit bumper-to-bumper", "Use natural daylight", "Avoid glare on windows"], framing: "wide" },
  { id: "interior",  title: "Interior",           short: "Interior",  icon: ImageIcon,
    hint: "Front seats, dashboard, and rear seating from the driver side.",
    tips: ["Open the door for clear angle", "Show seat condition", "Use overhead light if dim"], framing: "square" },
  { id: "odometer",  title: "Odometer",           short: "Odometer",  icon: Gauge,
    hint: "Mileage must be clearly readable. Engine on for digital clusters.",
    tips: ["Hold phone steady, 10–12 inches away", "Turn off auto-flash for screens", "Wipe dust from cluster"], framing: "odometer" },
  { id: "vin",       title: "VIN Verification",   short: "VIN",       icon: ScanLine,
    hint: "Capture the windshield VIN plate or driver-side door jamb sticker.",
    tips: ["All 17 characters must be sharp", "Avoid angle distortion", "Use flash if low light"], framing: "vin" },
  { id: "damage",    title: "Damage Review",      short: "Damage",    icon: AlertTriangle,
    hint: "Photograph any visible scratches, dents, cracked glass, or wheel damage.",
    tips: ["Get within 1–2 ft of damage", "Include a wider context shot", "If none, mark as no damage"], framing: "portrait" },
  { id: "complete",  title: "Inspection Summary", short: "Summary",   icon: Trophy,
    hint: "Reviewing all photos and finalizing your AI verification.",
    tips: [], framing: "square" },
];

// Deterministic per-step quality check the AI "returns" after analyzing
const QUALITY_FOR_STEP: Record<string, QualityCheck[]> = {
  front:    [{ tone: "green", label: "Full bumper in frame" }, { tone: "green", label: "Headlights visible" }, { tone: "green", label: "Lighting excellent" }],
  rear:     [{ tone: "green", label: "Taillights visible" },   { tone: "amber", label: "Rear bumper slightly cropped" }, { tone: "green", label: "Plate readable" }],
  sides:    [{ tone: "green", label: "Both profiles captured" }, { tone: "green", label: "No glare detected" }],
  interior: [{ tone: "green", label: "Seats clearly visible" }, { tone: "green", label: "Dashboard captured" }],
  odometer: [{ tone: "green", label: "Mileage clearly readable" }, { tone: "green", label: "Cluster illuminated" }],
  vin:      [{ tone: "green", label: "VIN matched to submitted vehicle" }, { tone: "green", label: "Ownership record verified" }, { tone: "green", label: "Configuration confirmed" }],
  damage:   [{ tone: "amber", label: "Minor wheel scuff detected" }, { tone: "green", label: "No major exterior damage" }],
};

// ── Subcomponents ───────────────────────────────────────────────────────────

const ProgressHeader = ({ stepIdx, completed }: { stepIdx: number; completed: Set<number> }) => {
  const total = STEPS.length;
  const pct = ((Math.min(stepIdx, total - 1)) / (total - 1)) * 100;
  return (
    <div className="relative px-4 sm:px-6 pt-4 pb-3 border-b border-[#EEF0F5] bg-white/70 backdrop-blur">
      <div className="hidden sm:block relative pt-2">
        <div className="absolute left-5 right-5 top-[18px] h-px bg-[#E6EAF0]" />
        <motion.div
          initial={false}
          animate={{ width: `calc(${pct}% - 0px)` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-5 top-[18px] h-px bg-gradient-to-r from-[#6D28D9] to-[#6D28D9]"
        />
        <div className="relative grid grid-cols-8 gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = completed.has(i) || i < stepIdx;
            const active = i === stepIdx;
            return (
              <div key={s.id} className="flex flex-col items-center text-center min-w-0">
                <motion.div
                  animate={active ? { boxShadow: ["0 0 0 0 rgba(79,70,229,0.45)", "0 0 0 10px rgba(79,70,229,0)"] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className={`w-9 h-9 rounded-full grid place-items-center transition ${
                    done ? "bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] text-white"
                    : active ? "bg-white border-2 border-[#6D28D9] text-[#6D28D9]"
                    : "bg-[#F4F6FA] text-[#8893A8]"
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </motion.div>
                <div className={`text-[10px] font-semibold mt-1.5 leading-tight truncate w-full ${done || active ? "text-[#06194A]" : "text-[#8893A8]"}`}>
                  Step {i + 1}
                </div>
                <div className={`text-[9px] leading-tight truncate w-full ${active ? "text-[#6D28D9]" : "text-[#8893A8]"}`}>{s.short}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Mobile compact */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#53627A] mb-1.5">
          <span>Step {stepIdx + 1} of {STEPS.length}</span>
          <span>{STEPS[stepIdx].title}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-[#6D28D9] to-[#6D28D9]"
            animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>
    </div>
  );
};

const FrameGuide = ({ framing }: { framing: StepDef["framing"] }) => {
  // SVG framing overlay
  if (framing === "vin") {
    return (
      <svg viewBox="0 0 320 180" className="absolute inset-0 m-auto w-[78%] h-auto opacity-90">
        <rect x="10" y="60" width="300" height="60" rx="10" fill="none" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
        <text x="160" y="48" textAnchor="middle" fill="white" fontSize="10" fontFamily="ui-sans-serif">Align VIN inside the box</text>
      </svg>
    );
  }
  if (framing === "odometer") {
    return (
      <svg viewBox="0 0 320 180" className="absolute inset-0 m-auto w-[60%] h-auto opacity-90">
        <ellipse cx="160" cy="90" rx="120" ry="60" fill="none" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
        <text x="160" y="30" textAnchor="middle" fill="white" fontSize="10" fontFamily="ui-sans-serif">Center the odometer reading</text>
      </svg>
    );
  }
  const w = framing === "wide" ? 280 : framing === "portrait" ? 160 : 220;
  const h = framing === "wide" ? 140 : framing === "portrait" ? 220 : 220;
  return (
    <svg viewBox="0 0 320 260" className="absolute inset-0 m-auto w-full h-full opacity-90">
      <rect x={(320 - w) / 2} y={(260 - h) / 2} width={w} height={h} rx="14" fill="none" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
      {/* corner brackets */}
      {([
        [(320 - w) / 2, (260 - h) / 2],
        [(320 + w) / 2, (260 - h) / 2],
        [(320 - w) / 2, (260 + h) / 2],
        [(320 + w) / 2, (260 + h) / 2],
      ] as [number, number][]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="white" />
      ))}
    </svg>
  );
};

const CameraStage = ({
  step, status,
}: { step: StepDef; status: AnalyzeStatus }) => {
  // Premium "viewfinder" surface. We don't open the device camera; we render
  // a guided stage with framing overlay + simulated capture/analysis states.
  return (
    <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-3xl overflow-hidden border border-[#E6EAF0] bg-gradient-to-br from-[#0F1226] via-[#1B1E3D] to-[#2A1E47] shadow-[0_30px_60px_-30px_rgba(15,18,38,0.45)]">
      {/* subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.15]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "18px 18px",
      }} />
      {/* gradient glow */}
      <div className="absolute -inset-10 opacity-50" style={{
        background: "radial-gradient(60% 60% at 50% 40%, rgba(124,58,237,0.35), transparent 70%)",
      }} />
      {/* framing overlay */}
      <FrameGuide framing={step.framing} />

      {/* top status bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white/90">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 backdrop-blur rounded-full px-2.5 py-1 border border-white/15">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
          Live framing assist
        </div>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 backdrop-blur rounded-full px-2.5 py-1 border border-white/15">
          <Sun className="w-3 h-3" /> Daylight optimal
        </div>
      </div>

      {/* center hint */}
      <div className="absolute inset-x-0 bottom-3 px-3 flex justify-center">
        <div className="inline-flex items-center gap-2 max-w-[92%] text-center bg-black/40 backdrop-blur text-white text-[11.5px] sm:text-xs font-medium rounded-full px-3 py-1.5 border border-white/10">
          <Camera className="w-3.5 h-3.5 text-white/80" />
          <span className="truncate">{step.hint}</span>
        </div>
      </div>

      {/* analyzing overlay */}
      <AnimatePresence>
        {status !== "idle" && status !== "approved" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white"
          >
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: [-40, 40, -40], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#A78BFA] to-transparent"
            />
            <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] shadow-[0_10px_40px_-5px_rgba(124,58,237,0.6)]">
              {status === "uploading" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div className="text-sm font-bold">
              {status === "uploading" ? "Uploading photo…" : status === "analyzing" ? "Analyzing image quality…" : "Verifying vehicle…"}
            </div>
            <div className="text-[11px] text-white/70">Edge detection · brightness · framing</div>
          </motion.div>
        )}
        {status === "approved" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-emerald-500/15 backdrop-blur-[2px] flex items-center justify-center"
          >
            <div className="bg-white rounded-2xl px-4 py-3 shadow-2xl inline-flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-bold text-[#06194A]">Image quality approved</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QualityFeed = ({ checks, visible }: { checks: QualityCheck[]; visible: boolean }) => {
  const toneClasses: Record<QualityTone, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-rose-50 text-rose-700 border-rose-200",
  };
  const dot: Record<QualityTone, string> = {
    green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500",
  };
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {checks.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold ${toneClasses[c.tone]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dot[c.tone]}`} />
              <span className="flex-1">{c.label}</span>
              {c.tone === "green" ? <Check className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const VinMatchPanel = ({ vehicle }: { vehicle?: InspectionVehicle }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="mt-3 rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF0FF] via-white to-white p-4"
  >
    <div className="flex items-center gap-2 text-[#6D28D9] text-[11px] font-bold uppercase tracking-wide">
      <ShieldCheck className="w-3.5 h-3.5" /> VIN Intelligence
    </div>
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="rounded-xl bg-white p-3 border border-[#EEF0F5]">
        <div className="text-[10px] text-[#8893A8] font-bold uppercase">Vehicle Match</div>
        <div className="text-sm font-bold text-[#06194A] mt-0.5">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Matched"}</div>
        <div className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> Verified</div>
      </div>
      <div className="rounded-xl bg-white p-3 border border-[#EEF0F5]">
        <div className="text-[10px] text-[#8893A8] font-bold uppercase">Ownership Record</div>
        <div className="text-sm font-bold text-[#06194A] mt-0.5">Title on file</div>
        <div className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> Verified</div>
      </div>
      <div className="rounded-xl bg-white p-3 border border-[#EEF0F5]">
        <div className="text-[10px] text-[#8893A8] font-bold uppercase">Configuration</div>
        <div className="text-sm font-bold text-[#06194A] mt-0.5">{vehicle?.trim ?? "Confirmed"}</div>
        <div className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
      </div>
    </div>
  </motion.div>
);

const SummaryScreen = ({
  score, vehicle, onApprove, onClose,
}: { score: number; vehicle?: InspectionVehicle; onApprove: () => void; onClose: () => void }) => {
  const items: { icon: typeof Check; label: string; tone: "ok" | "warn"; sub: string }[] = [
    { icon: Check, label: "Exterior verified", tone: "ok", sub: "All four sides captured cleanly" },
    { icon: Check, label: "Interior verified", tone: "ok", sub: "Seats and dashboard documented" },
    { icon: ShieldCheck, label: "VIN confirmed", tone: "ok", sub: vehicle ? `Matched to ${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Matched to submitted vehicle" },
    { icon: Gauge, label: "Mileage confirmed", tone: "ok", sub: "Reading verified against record" },
    { icon: AlertTriangle, label: "Minor cosmetic wear detected", tone: "warn", sub: "Wheel scuff noted — within expectations" },
  ];
  const isUnderReview = score < 92;
  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#6D28D9] via-[#6D28D9] to-[#6D28D9] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }} />
        <div className="relative flex items-center gap-4 sm:gap-6">
          <ConfidenceRing score={score} />
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide bg-white/15 backdrop-blur rounded-full px-2.5 py-1 border border-white/20">
              <Crown className="w-3 h-3" /> AI Verification Complete
            </div>
            <div className="text-xl sm:text-2xl font-extrabold mt-2 leading-tight">
              {isUnderReview ? "Submitted for Specialist Review" : "Inspection Approved"}
            </div>
            <p className="text-white/80 text-sm mt-1">
              {isUnderReview
                ? "A vehicle specialist will review a few details. Estimated time: 15–30 minutes."
                : "Your vehicle has been successfully verified. You can now continue to scheduling and payment."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          const ok = it.tone === "ok";
          return (
            <div key={it.label} className={`rounded-2xl border p-4 flex items-start gap-3 ${
              ok ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50/60 border-amber-200"
            }`}>
              <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold ${ok ? "text-emerald-800" : "text-amber-800"}`}>{it.label}</div>
                <div className={`text-[12px] mt-0.5 ${ok ? "text-emerald-700/80" : "text-amber-700/80"}`}>{it.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#EEF0F5] bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8]">Live activity</div>
        <ul className="mt-2 space-y-1.5 text-[12.5px]">
          <li className="flex items-center gap-2 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> AI verification completed</li>
          <li className="flex items-center gap-2 text-[#6D28D9]"><span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" /> Fast-track approval eligible</li>
          <li className="flex items-center gap-2 text-[#6D28D9]"><span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" /> Pickup availability unlocked</li>
        </ul>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-semibold text-[#06194A] hover:bg-[#F7F8FB]">
          Close
        </button>
        <button onClick={onApprove}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:shadow-[0_14px_30px_-10px_rgba(124,58,237,0.6)] inline-flex items-center justify-center gap-1.5">
          {isUnderReview ? "Continue & track review" : "Continue to scheduling"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ConfidenceRing = ({ score }: { score: number }) => {
  const r = 36, c = 2 * Math.PI * r;
  return (
    <div className="relative w-[96px] h-[96px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="50" cy="50" r={r} stroke="white" strokeWidth="8" fill="none" strokeLinecap="round"
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (score / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center text-white">
        <div>
          <div className="text-2xl font-extrabold leading-none">{score}%</div>
          <div className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">Confidence</div>
        </div>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

type AnalyzeStatus = "idle" | "uploading" | "analyzing" | "verifying" | "approved";

type Props = {
  open: boolean;
  onClose: () => void;
  onApproved: (result: InspectionResult) => void;
  vehicle?: InspectionVehicle;
};

export const AIInspectionFlow = ({ open, onClose, onApproved, vehicle }: Props) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<AnalyzeStatus>("idle");
  const [showChecks, setShowChecks] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const timers = useRef<number[]>([]);

  const step = STEPS[stepIdx];
  const isSummary = step.id === "complete";
  const isVin = step.id === "vin";

  const score = useMemo(() => {
    // Simple confidence model: weight by completed steps + base
    const base = 70;
    const perStep = 4; // 7 capture steps × 4 = 28
    return Math.min(99, base + Math.min(completed.size, STEPS.length - 1) * perStep - 3); // pinned ~95
  }, [completed]);

  useEffect(() => {
    if (!open) {
      setStepIdx(0); setCompleted(new Set()); setStatus("idle"); setShowChecks(false);
      timers.current.forEach(clearTimeout); timers.current = [];
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const advance = () => {
    setShowChecks(false);
    setCompleted((p) => new Set(p).add(stepIdx));
    setStatus("idle");
    setStepIdx((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const capture = () => {
    if (status !== "idle") return;
    setShowChecks(false);
    setStatus("uploading");
    const t1 = window.setTimeout(() => setStatus("analyzing"), 900);
    const t2 = window.setTimeout(() => isVin ? setStatus("verifying") : setStatus("approved"), 2100);
    const t3 = window.setTimeout(() => setStatus("approved"), isVin ? 3200 : 2200);
    const t4 = window.setTimeout(() => { setShowChecks(true); }, isVin ? 3300 : 2300);
    timers.current.push(t1, t2, t3, t4);
  };

  const handleApprove = () => {
    onApproved({ status: score >= 92 ? "approved" : "review", score, capturedAt: Date.now() });
  };

  const retake = () => {
    setStatus("idle"); setShowChecks(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ai-inspection"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-[#06081A]/70 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-[#F7F8FB] w-full sm:max-w-[1080px] sm:rounded-3xl overflow-hidden shadow-[0_50px_120px_-30px_rgba(15,18,38,0.5)] flex flex-col h-full sm:max-h-[92vh]"
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[#EEF0F5] bg-white">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] grid place-items-center text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.6)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#6D28D9]">AI Vehicle Verification</div>
              <div className="text-sm font-extrabold text-[#06194A] truncate">
                {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " · " + vehicle.trim : ""}` : "Guided inspection"}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-full hover:bg-[#F4F6FA] grid place-items-center text-[#53627A]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <ProgressHeader stepIdx={stepIdx} completed={completed} />

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            <AnimatePresence mode="wait">
              {isSummary ? (
                <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <SummaryScreen score={score} vehicle={vehicle} onApprove={handleApprove} onClose={onClose} />
                </motion.div>
              ) : (
                <motion.div key={step.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8]">Step {stepIdx + 1} of {STEPS.length}</div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-[#06194A] mt-0.5">{step.title}</h2>
                        <p className="text-sm text-[#53627A] mt-1">{step.hint}</p>
                      </div>
                      <button onClick={() => setTipsOpen((v) => !v)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#EEF0FF] text-[#6D28D9] text-[11px] font-bold px-2.5 py-1.5 border border-[#C7D2FE]">
                        <Lightbulb className="w-3.5 h-3.5" /> {tipsOpen ? "Hide tips" : "Tips"}
                      </button>
                    </div>

                    <CameraStage step={step} status={status} />

                    <QualityFeed checks={QUALITY_FOR_STEP[step.id] ?? []} visible={showChecks && status === "approved"} />
                    {isVin && showChecks && status === "approved" && <VinMatchPanel vehicle={vehicle} />}

                    {/* Action row */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {status === "approved" ? (
                        <>
                          <button onClick={retake}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-sm font-semibold text-[#06194A] hover:bg-[#F7F8FB]">
                            <RotateCcw className="w-4 h-4" /> Retake
                          </button>
                          <button onClick={advance}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:shadow-[0_14px_30px_-10px_rgba(124,58,237,0.6)]">
                            {stepIdx === STEPS.length - 2 ? "Finish & review" : "Looks good — continue"} <ArrowRight className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => stepIdx > 0 && status === "idle" && setStepIdx((s) => s - 1)}
                            disabled={stepIdx === 0 || status !== "idle"}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-2 text-sm font-semibold text-[#06194A] hover:bg-[#F7F8FB] disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronLeft className="w-4 h-4" /> Back
                          </button>
                          <button onClick={capture} disabled={status !== "idle"}
                            className="ml-auto inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:shadow-[0_14px_30px_-10px_rgba(124,58,237,0.6)] disabled:opacity-70 disabled:cursor-not-allowed">
                            <Camera className="w-4 h-4" />
                            {status === "uploading" ? "Uploading…"
                              : status === "analyzing" ? "Analyzing…"
                              : status === "verifying" ? "Verifying VIN…"
                              : "Capture photo"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Side panel — guidance + live confidence */}
                  <aside className="space-y-3">
                    <div className="rounded-2xl border border-[#EEF0F5] bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8]">Live confidence</div>
                        <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1"><Zap className="w-3 h-3" /> Enterprise-grade</span>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <div className="text-3xl font-extrabold text-[#06194A]">{score}<span className="text-base text-[#8893A8]">%</span></div>
                          <div className="text-[11px] text-[#53627A]">{completed.size}/{STEPS.length - 1} captures verified</div>
                        </div>
                        <div className="w-16 h-16 relative">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="40" stroke="#E6EAF0" strokeWidth="10" fill="none" />
                            <motion.circle cx="50" cy="50" r="40" stroke="url(#gradConfidence)" strokeWidth="10" fill="none" strokeLinecap="round"
                              animate={{ strokeDasharray: 2 * Math.PI * 40, strokeDashoffset: 2 * Math.PI * 40 * (1 - score / 100) }}
                              transition={{ duration: 0.6 }} />
                            <defs>
                              <linearGradient id="gradConfidence" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#6D28D9" /><stop offset="100%" stopColor="#6D28D9" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5 text-[11px]">
                        {[
                          { label: "Image clarity", ok: completed.size >= 1 },
                          { label: "VIN match", ok: completed.has(5) },
                          { label: "Mileage match", ok: completed.has(4) },
                          { label: "Exterior completeness", ok: completed.has(0) && completed.has(1) && completed.has(2) },
                          { label: "Lighting quality", ok: completed.size >= 2 },
                        ].map((f) => (
                          <div key={f.label} className="flex items-center justify-between">
                            <span className={f.ok ? "text-[#06194A]" : "text-[#8893A8]"}>{f.label}</span>
                            {f.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 rounded-full border border-[#E6EAF0]" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {tipsOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF0FF] to-white p-4 overflow-hidden">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-[#6D28D9]">Tips for this shot</div>
                          <ul className="mt-2 space-y-1.5 text-[12.5px] text-[#06194A]">
                            {step.tips.map((t) => (
                              <li key={t} className="flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-[#6D28D9] shrink-0" /> {t}</li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="rounded-2xl border border-[#EEF0F5] bg-white p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[#8893A8]">Live activity</div>
                      <ul className="mt-2 space-y-1.5 text-[12px]">
                        <li className="flex items-center gap-2 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> AI ready · vision model online</li>
                        <li className="flex items-center gap-2 text-[#6D28D9]"><span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" /> Specialist on standby for review</li>
                        <li className="flex items-center gap-2 text-[#6D28D9]"><span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]" /> Pickup slots refresh every 60s</li>
                      </ul>
                    </div>
                  </aside>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom reassurance bar */}
          <div className="px-4 sm:px-6 py-2.5 border-t border-[#EEF0F5] bg-white flex items-center justify-between text-[11px] text-[#53627A]">
            <div className="inline-flex items-center gap-1.5"><FileCheck2 className="w-3.5 h-3.5 text-[#6D28D9]" /> Photos are private and used only to verify your vehicle.</div>
            <div className="hidden sm:inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Encrypted transmission</div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIInspectionFlow;
