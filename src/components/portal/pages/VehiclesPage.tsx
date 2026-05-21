import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Car, Upload, Edit3, Trash2, ArrowRight, Camera, ChevronLeft,
  ChevronRight, X, ImageIcon, Gauge, Cog, Palette, ShieldCheck, FileText,
  CalendarDays, MessageSquare, DollarSign, Check, CheckCircle2, AlertCircle,
  Clock, Search, Sparkles, Settings2, ZoomIn, MoreHorizontal, Archive, Download,
  Pencil, Lightbulb, Fingerprint, History, FileCheck2,
} from "lucide-react";
import vehicleHero from "@/assets/portal-vehicle-rav4.png";
import { PORTAL_MOCK as MOCK, fmt } from "../portalMock";
import {
  PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill, SectionLabel,
} from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

/* VehiclesPage — premium acquisition workspace.
   Interactive hero w/ gallery modal, clickable status pills, animated
   photo-upload card, hover-lifted previous submissions w/ history drawer,
   and a fullscreen multi-step "Add Vehicle" wizard. */

type NavTarget = "offers" | "documents" | "pickup" | "messages";
type Props = { onNavigate: (k: NavTarget) => void };

type PhotoStatus = "approved" | "review" | "missing" | "uploaded";
type PhotoBucket = { label: string; count: number; target: number; status: PhotoStatus };

const PHOTO_BUCKETS: PhotoBucket[] = [
  { label: "Exterior", count: 6, target: 8, status: "uploaded" },
  { label: "Interior", count: 4, target: 4, status: "approved" },
  { label: "Odometer", count: 1, target: 1, status: "approved" },
  { label: "Title",    count: 1, target: 1, status: "review"   },
  { label: "Damage",   count: 0, target: 0, status: "missing"  },
];

const GALLERY = [
  { src: vehicleHero, caption: "Exterior • Front 3/4" },
  { src: vehicleHero, caption: "Exterior • Rear 3/4" },
  { src: vehicleHero, caption: "Exterior • Driver side" },
  { src: vehicleHero, caption: "Interior • Front seats" },
  { src: vehicleHero, caption: "Odometer • 26,540 mi" },
  { src: vehicleHero, caption: "Title • Front" },
];

const STATUS_META: Record<PhotoStatus, { label: string; cls: string; Icon: any }> = {
  approved: { label: "Approved",     cls: "text-[#0F7A3E] bg-[#E8F8EE]", Icon: CheckCircle2 },
  uploaded: { label: "Uploaded",     cls: "text-[#4F46E5] bg-[#EEF0FF]", Icon: Check },
  review:   { label: "Under Review", cls: "text-[#B45309] bg-[#FEF3E2]", Icon: Clock },
  missing:  { label: "Missing",      cls: "text-[#53627A] bg-[#F4F6FA]", Icon: AlertCircle },
};

/* Lightweight number counter — animates 0 → target on mount. */
const Counter = ({ value, prefix = "", duration = 700 }: { value: number; prefix?: string; duration?: number }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{prefix}{n.toLocaleString()}</>;
};

const SummaryChip = ({
  label, value, prefix, Icon, tone = "indigo",
}: { label: string; value: number; prefix?: string; Icon: any; tone?: "indigo" | "orange" | "green" }) => {
  const tones = {
    indigo: "text-[#4F46E5] bg-[#EEF0FF]",
    orange: "text-[#B45309] bg-[#FEF3E2]",
    green:  "text-[#0F7A3E] bg-[#E8F8EE]",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <span className={`w-7 h-7 rounded-lg grid place-items-center ${tones[tone]}`}><Icon className="w-[14px] h-[14px]" /></span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-[#8893A8]">{label}</div>
        <div className="text-[13px] font-bold text-[#06194A]"><Counter value={value} prefix={prefix} /></div>
      </div>
    </motion.div>
  );
};

/* Clickable status pill with hover lift + glow. Pending states subtly pulse. */
const ActionPill = ({
  tone, Icon, children, onClick, pulse = false,
}: { tone: "green" | "orange" | "gray" | "indigo"; Icon: any; children: React.ReactNode; onClick: () => void; pulse?: boolean }) => {
  const tones: Record<string, string> = {
    green:  "text-[#0F7A3E] bg-[#E8F8EE] hover:shadow-[0_8px_18px_-10px_rgba(15,122,62,0.55)]",
    orange: "text-[#B45309] bg-[#FEF3E2] hover:shadow-[0_8px_18px_-10px_rgba(180,83,9,0.5)]",
    gray:   "text-[#53627A] bg-[#F4F6FA] hover:shadow-[0_8px_18px_-10px_rgba(83,98,122,0.4)]",
    indigo: "text-[#4F46E5] bg-[#EEF0FF] hover:shadow-[0_8px_18px_-10px_rgba(79,70,229,0.55)]",
  };
  const dotTone: Record<string, string> = {
    green: "bg-[#16A34A]", orange: "bg-[#F59E0B]", gray: "bg-[#94A3B8]", indigo: "bg-[#4F46E5]",
  };
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center gap-1.5 text-[11.5px] font-semibold pl-2 pr-2.5 py-1.5 rounded-full transition-all hover:-translate-y-0.5 active:scale-[0.97] ${tones[tone]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{children}</span>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotTone[tone]}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotTone[tone]}`} />
        </span>
      )}
      <ChevronRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
    </button>
  );
};

/* Smart contextual guidance banner. Adapts CTA + tone to vehicle state. */
const SmartGuidanceBanner = ({
  tone, Icon, title, description, ctaLabel, onCta,
}: { tone: "indigo" | "orange" | "green"; Icon: any; title: string; description: string; ctaLabel: string; onCta: () => void }) => {
  const tones = {
    indigo: { bg: "from-[#EEF0FF] to-white", border: "border-[#C7D2FE]", icon: "bg-white text-[#4F46E5]", btn: "bg-[#4F46E5] hover:bg-[#4338CA] text-white" },
    orange: { bg: "from-[#FEF3E2] to-white", border: "border-[#FCD9A8]", icon: "bg-white text-[#B45309]", btn: "bg-[#B45309] hover:bg-[#92400E] text-white" },
    green:  { bg: "from-[#E8F8EE] to-white", border: "border-[#BBE5C6]", icon: "bg-white text-[#0F7A3E]", btn: "bg-[#0F7A3E] hover:bg-[#0B5C2F] text-white" },
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className={`mb-5 rounded-2xl border ${tones.border} bg-gradient-to-r ${tones.bg} p-3.5 sm:p-4 flex items-start sm:items-center gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tones.icon} shadow-sm`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-[#06194A]">{title}</div>
        <div className="text-[12px] text-[#53627A] mt-0.5">{description}</div>
      </div>
      <button
        onClick={onCta}
        className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-xl transition ${tones.btn}`}
      >
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

/* Overflow menu — danger actions live here so they don't compete with primary CTA. */
const OverflowMenu = ({
  onRemove, onArchive, onDownload,
}: { onRemove: () => void; onArchive: () => void; onDownload: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} className="ml-auto relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        className="w-9 h-9 rounded-xl text-[#53627A] hover:text-[#06194A] hover:bg-[#F4F6FA] grid place-items-center transition"
      >
        <MoreHorizontal className="w-[18px] h-[18px]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1 w-56 rounded-xl bg-white border border-[#E6EAF0] shadow-[0_18px_40px_-14px_rgba(15,23,42,0.18)] p-1.5 z-20"
          >
            <button onClick={() => { setOpen(false); onDownload(); }} className="w-full flex items-center gap-2.5 text-left text-[13px] font-medium text-[#06194A] px-2.5 py-2 rounded-lg hover:bg-[#F4F6FA] transition">
              <Download className="w-4 h-4 text-[#53627A]" /> Download Vehicle Data
            </button>
            <button onClick={() => { setOpen(false); onArchive(); }} className="w-full flex items-center gap-2.5 text-left text-[13px] font-medium text-[#06194A] px-2.5 py-2 rounded-lg hover:bg-[#F4F6FA] transition">
              <Archive className="w-4 h-4 text-[#53627A]" /> Archive Vehicle
            </button>
            <div className="h-px bg-[#E6EAF0] my-1" />
            <button onClick={() => { setOpen(false); onRemove(); }} className="w-full flex items-center gap-2.5 text-left text-[13px] font-medium text-[#53627A] hover:text-[#B91C1C] px-2.5 py-2 rounded-lg hover:bg-[#FEF2F2] transition">
              <Trash2 className="w-4 h-4" /> Remove Vehicle
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Fullscreen photo gallery modal
   ────────────────────────────────────────────────────────────── */
const GalleryModal = ({ open, onClose, startIndex = 0 }: { open: boolean; onClose: () => void; startIndex?: number }) => {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => { if (open) setIdx(startIndex); }, [open, startIndex]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % GALLERY.length);
      if (e.key === "ArrowLeft")  setIdx((i) => (i - 1 + GALLERY.length) % GALLERY.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-[#06194A]/85 backdrop-blur-md flex flex-col"
          role="dialog" aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 sm:px-8 pt-5">
            <div className="text-white/90 text-sm font-medium">
              {idx + 1} / {GALLERY.length} <span className="text-white/50">• {GALLERY[idx].caption}</span>
            </div>
            <button onClick={onClose} aria-label="Close gallery" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 relative grid place-items-center px-4">
            <motion.img
              key={idx}
              src={GALLERY[idx].src}
              alt={GALLERY[idx].caption}
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="max-h-[70vh] max-w-[92vw] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]"
            />
            <button
              onClick={() => setIdx((i) => (i - 1 + GALLERY.length) % GALLERY.length)}
              aria-label="Previous"
              className="hidden sm:grid absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white place-items-center transition"
            ><ChevronLeft className="w-6 h-6" /></button>
            <button
              onClick={() => setIdx((i) => (i + 1) % GALLERY.length)}
              aria-label="Next"
              className="hidden sm:grid absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white place-items-center transition"
            ><ChevronRight className="w-6 h-6" /></button>
          </div>

          <div className="px-4 sm:px-8 pb-6">
            <div className="flex gap-2 overflow-x-auto justify-center">
              {GALLERY.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition ${i === idx ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={g.src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ──────────────────────────────────────────────────────────────
   Add-Vehicle multi-step wizard (fullscreen)
   ────────────────────────────────────────────────────────────── */
const WIZARD_STEPS = ["Lookup", "Details", "Photos", "Condition", "Offer"];
const AddVehicleWizard = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const next = () => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const finish = () => { onClose(); toast.success("Vehicle added", { description: "We'll have an estimate ready in a moment." }); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[75] bg-[#F7F8FB] flex flex-col"
          role="dialog" aria-modal="true"
        >
          <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[#E6EAF0] bg-white">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                <Sparkles className="w-[18px] h-[18px]" />
              </div>
              <div className="leading-tight">
                <div className="text-[13.5px] font-bold text-[#06194A]">Add a vehicle</div>
                <div className="text-[11px] text-[#53627A]">Step {step + 1} of {WIZARD_STEPS.length} • {WIZARD_STEPS[step]}</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-lg hover:bg-[#F4F6FA] text-[#53627A] grid place-items-center transition">
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Progress tracker */}
          <div className="px-5 sm:px-8 py-3 bg-white border-b border-[#E6EAF0]">
            <div className="flex items-center gap-2">
              {WIZARD_STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" : "bg-[#E6EAF0]"}`} />
                  <div className={`mt-1 text-[10px] uppercase tracking-wide font-semibold ${i <= step ? "text-[#4F46E5]" : "text-[#8893A8]"}`}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
            <div className="max-w-[640px] mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Start with your VIN or plate</h2>
                      <p className="text-sm text-[#53627A] mt-1">We'll pull factory specs and pre-fill the rest.</p>
                      <div className="mt-5 space-y-3">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8893A8]" />
                          <input placeholder="Enter 17-digit VIN" className="w-full rounded-xl border border-[#E6EAF0] bg-white pl-10 pr-3 py-3 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                        </div>
                        <div className="text-center text-[11px] text-[#8893A8] uppercase tracking-wider">or</div>
                        <div className="grid grid-cols-[2fr_1fr] gap-2">
                          <input placeholder="License plate" className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-3 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                          <select className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-3 text-sm focus:border-[#4F46E5] outline-none">
                            <option>State</option><option>CA</option><option>NY</option><option>TX</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Verify the basics</h2>
                      <p className="text-sm text-[#53627A] mt-1">Confirm what we found so the offer stays accurate.</p>
                      <div className="grid grid-cols-2 gap-3 mt-5">
                        {[["Year","2021"],["Make","Toyota"],["Model","RAV4"],["Trim","XLE"],["Mileage","26,540"],["Drivetrain","AWD"]].map(([k,v]) => (
                          <label key={k} className="block">
                            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{k}</span>
                            <input defaultValue={v} className="mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {step === 2 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">Add photos</h2>
                      <p className="text-sm text-[#53627A] mt-1">More angles = stronger offer. You can add more later.</p>
                      <button className="mt-5 w-full border-2 border-dashed border-[#C7D2FE] bg-white rounded-2xl p-10 text-center hover:border-[#4F46E5] hover:bg-[#EEF0FF] transition">
                        <Upload className="w-7 h-7 mx-auto text-[#4F46E5] mb-2" />
                        <div className="text-sm font-semibold text-[#06194A]">Drop files or tap to upload</div>
                        <div className="text-[11px] text-[#53627A] mt-1">Exterior, interior, odometer & damage shots</div>
                      </button>
                    </div>
                  )}
                  {step === 3 && (
                    <div>
                      <h2 className="text-[20px] font-bold text-[#06194A]">How's the condition?</h2>
                      <p className="text-sm text-[#53627A] mt-1">Honest answers = no surprises at pickup.</p>
                      <div className="space-y-2 mt-5">
                        {["Excellent — like-new", "Good — minor wear", "Fair — visible damage", "Has accident history"].map((o) => (
                          <label key={o} className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E6EAF0] bg-white hover:border-[#4F46E5]/40 cursor-pointer transition">
                            <input type="radio" name="cond" className="accent-[#4F46E5]" />
                            <span className="text-sm font-medium text-[#06194A]">{o}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {step === 4 && (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 mx-auto rounded-full bg-[#E8F8EE] text-[#0F7A3E] grid place-items-center"><CheckCircle2 className="w-7 h-7" /></div>
                      <h2 className="text-[20px] font-bold text-[#06194A] mt-4">You're all set</h2>
                      <p className="text-sm text-[#53627A] mt-1">We'll have a firm offer ready shortly.</p>
                      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#EEF0FF] text-[#4F46E5] text-sm font-semibold">
                        <DollarSign className="w-4 h-4" /> Estimated range $19,250 – $21,450
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer className="px-5 sm:px-8 py-4 border-t border-[#E6EAF0] bg-white flex items-center justify-between gap-2">
            <SecondaryButton onClick={step === 0 ? onClose : back}>
              {step === 0 ? "Cancel" : "Back"}
            </SecondaryButton>
            {step < WIZARD_STEPS.length - 1 ? (
              <PrimaryButton onClick={next}>Continue <ArrowRight className="w-4 h-4" /></PrimaryButton>
            ) : (
              <PrimaryButton onClick={finish}>Finish <Check className="w-4 h-4" /></PrimaryButton>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */
export const VehiclesPage = ({ onNavigate }: Props) => {
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [verify, setVerify] = useState(false);
  const [gallery, setGallery] = useState<{ open: boolean; idx: number }>({ open: false, idx: 0 });
  const [history, setHistory] = useState<null | { y: number; mk: string; mdl: string; mi: string; amount?: number; date: string; outcome: "sold" | "declined" }>(null);
  const [wizard, setWizard] = useState(false);
  const v = MOCK.vehicle;

  const pendingDocs = MOCK.docs.filter((d) => d.status !== "Approved").length;
  const exterior = PHOTO_BUCKETS.find((b) => b.label === "Exterior")!;
  const remainingExterior = Math.max(0, exterior.target - exterior.count);

  return (
    <PortalPageShell
      title="My Vehicles"
      subtitle="Manage vehicles connected to your acquisition offers."
      actions={
        <PrimaryButton onClick={() => setWizard(true)} className="group px-5 py-3 text-[14px]">
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" /> Add Vehicle
        </PrimaryButton>
      }
    >
      {/* Header summary chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SummaryChip label="Active Vehicles" value={1} Icon={Car} tone="indigo" />
        <SummaryChip label="Pending Docs" value={pendingDocs} Icon={FileText} tone="orange" />
        <SummaryChip label="Current Offer" value={MOCK.firmOffer} prefix="$" Icon={DollarSign} tone="green" />
      </div>

      {/* Smart next-step guidance — adapts to vehicle state */}
      {remainingExterior > 0 ? (
        <SmartGuidanceBanner
          tone="orange" Icon={Lightbulb}
          title="Action needed"
          description={`Upload ${remainingExterior} more exterior photo${remainingExterior > 1 ? "s" : ""} to finalize your firm offer.`}
          ctaLabel="Upload now" onCta={() => setUpload(true)}
        />
      ) : (
        <SmartGuidanceBanner
          tone="green" Icon={Sparkles}
          title="Great progress"
          description="Your vehicle is ready — schedule pickup to lock in your offer."
          ctaLabel="Schedule pickup" onCta={() => onNavigate("pickup")}
        />
      )}

      {/* Active vehicle hero */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <Card className="p-5 mb-6 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] transition-shadow">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-5 items-center">
            {/* Image area — better framed, centered, slightly elevated */}
            <button
              onClick={() => setGallery({ open: true, idx: 0 })}
              className="group relative h-[240px] rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#EEF0FF] to-[#E9E2FF] border border-[#E6EAF0] cursor-pointer"
              aria-label="Open photo gallery"
            >
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[68%] h-7 bg-[#06194A]/22 blur-2xl rounded-full pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center px-6 pt-2 pb-6">
                <img
                  src={vehicleHero} alt={`${v.year} ${v.make} ${v.model}`}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_18px_14px_rgba(15,23,42,0.18)] transition-transform duration-500 ease-out group-hover:scale-[1.05] -translate-y-1"
                />
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_45%,rgba(79,70,229,0.18),transparent_60%)] pointer-events-none" />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[#06194A] border border-white/60 shadow-sm">
                <ImageIcon className="w-3.5 h-3.5" /> {GALLERY.length} Photos
              </span>
              <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 backdrop-blur grid place-items-center text-[#06194A] opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-4 h-4" />
              </span>
            </button>

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <SectionLabel>Active Vehicle</SectionLabel>
                <button
                  onClick={() => setVerify(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F8EE] text-[#0F7A3E] hover:bg-[#D6F0DF] transition"
                >
                  <ShieldCheck className="w-3 h-3" /> Verified VIN
                </button>
              </div>
              <h2 className="text-[22px] font-bold mt-1 leading-tight text-[#06194A]">
                {v.year} {v.make} {v.model} {v.trim}
              </h2>
              <p className="text-sm text-[#53627A]">{v.miles} mi • {v.engine} • {v.body}</p>
              <p className="text-xs font-mono text-[#53627A] mt-1">{v.vin}</p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <ActionPill tone="green"  Icon={DollarSign}  onClick={() => onNavigate("offers")}>Firm Offer Ready</ActionPill>
                <ActionPill tone="orange" Icon={FileText}    onClick={() => onNavigate("documents")} pulse>{pendingDocs} docs pending</ActionPill>
                <ActionPill tone="gray"   Icon={CalendarDays} onClick={() => onNavigate("pickup")} pulse>Pickup not scheduled</ActionPill>
                <ActionPill tone="indigo" Icon={ShieldCheck}  onClick={() => setVerify(true)}>Verified VIN</ActionPill>
              </div>

              {/* Action hierarchy */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <PrimaryButton onClick={() => onNavigate("offers")} className="group relative overflow-hidden px-5 py-3 text-[14px]">
                  <span className="relative z-10 inline-flex items-center gap-2">
                    View Offer <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                    style={{ animation: "viewOfferShimmer 9s ease-in-out infinite" }}
                  />
                  <style>{`@keyframes viewOfferShimmer { 0%, 80%, 100% { transform: translateX(-120%) skewX(-20deg); opacity: 0; } 85% { opacity: 1; } 95% { transform: translateX(420%) skewX(-20deg); opacity: 0; } }`}</style>
                </PrimaryButton>
                <SecondaryButton onClick={() => setEdit(true)} className="group">
                  <Edit3 className="w-4 h-4 transition-transform group-hover:rotate-[-8deg]" /> Edit Vehicle
                </SecondaryButton>
                <SecondaryButton onClick={() => setUpload(true)} className="group">
                  <Camera className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> Upload Photos
                </SecondaryButton>
                <OverflowMenu
                  onRemove={() => setConfirmRemove(true)}
                  onArchive={() => toast.success("Vehicle archived")}
                  onDownload={() => toast.success("Vehicle data export started")}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Details + photos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Vehicle Details</SectionLabel>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF0FF] text-[#4F46E5]">
              <ShieldCheck className="w-3 h-3" /> Verified Vehicle Data
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            {([
              ["Trim",       v.trim,       Settings2],
              ["Drivetrain", v.drivetrain, Cog],
              ["Engine",     v.engine,     Gauge],
              ["Body",       v.body,       Car],
              ["Exterior",   v.exterior,   Palette],
              ["Interior",   v.interior,   Palette],
              ["Ownership",  v.ownership,  ShieldCheck],
              ["Payoff",     v.payoff ? fmt(v.payoff) : "None", DollarSign],
            ] as [string, string, any][]).map(([k, val, Icon]) => (
              <div key={k} className="rounded-lg px-2 py-2 hover:bg-[#F4F6FA] transition-colors flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-md bg-[#F4F6FA] text-[#4F46E5] grid place-items-center shrink-0">
                  <Icon className="w-[13px] h-[13px]" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-wide text-[#8893A8] font-semibold">{k}</dt>
                  <dd className="text-[#06194A] font-semibold text-[13px] mt-0.5 truncate">{val}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Photo Upload</SectionLabel>
            <button onClick={() => setUpload(true)} className="text-xs font-semibold text-[#4F46E5] hover:underline">
              Manage
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {PHOTO_BUCKETS.map((b) => {
              const pct = b.target ? Math.min(100, (b.count / b.target) * 100) : 0;
              const meta = STATUS_META[b.status];
              return (
                <li key={b.label}>
                  <button
                    onClick={() => setUpload(true)}
                    className="group w-full text-left rounded-xl px-2.5 py-2 hover:bg-[#F4F6FA] transition-all"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#06194A] font-semibold">{b.label}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                          <meta.Icon className="w-2.5 h-2.5" /> {meta.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#53627A] tabular-nums">
                        {b.count}{b.target ? ` / ${b.target}` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden group-hover:bg-white transition-colors">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${b.target ? pct : 0}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full ${b.status === "approved" ? "bg-[#16A34A]" : b.status === "review" ? "bg-[#F59E0B]" : "bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"}`}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Previous submissions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Previous Submissions</SectionLabel>
          <span className="text-[11px] text-[#8893A8]">2 vehicles</span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { y: 2018, mk: "Honda",  mdl: "Accord Sport",    mi: "62,180", amount: 14800, date: "May 2025", outcome: "sold"     as const },
            { y: 2016, mk: "Subaru", mdl: "Outback Limited", mi: "98,450", date: "Jan 2025", outcome: "declined" as const },
          ].map((p) => (
            <motion.li
              key={`${p.y}${p.mdl}`}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => setHistory(p)}
                className="w-full text-left rounded-2xl border border-[#E6EAF0] p-4 flex items-center gap-3 hover:border-[#4F46E5]/40 hover:shadow-[0_14px_28px_-18px_rgba(79,70,229,0.4)] transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${p.outcome === "sold" ? "bg-[#EEF0FF] text-[#4F46E5]" : "bg-[#F4F6FA] text-[#8893A8]"}`}>
                  <Car className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${p.outcome === "sold" ? "text-[#06194A]" : "text-[#53627A]"}`}>
                    {p.y} {p.mk} {p.mdl}
                  </div>
                  <div className="text-[11px] text-[#8893A8]">{p.mi} mi • {p.date}</div>
                  {p.outcome === "sold" ? (
                    <div className="text-[12px] font-bold text-[#0F7A3E] mt-1">{fmt(p.amount!)} • Sold to {MOCK.customer.dealer}</div>
                  ) : (
                    <div className="text-[12px] font-medium text-[#8893A8] mt-1">Offer declined</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-[#B6BECC]" />
              </button>
            </motion.li>
          ))}
        </ul>
      </Card>

      {/* ── Drawers ───────────────────────────────────────── */}
      <SlideOver
        open={edit} onClose={() => setEdit(false)} title="Edit Vehicle"
        subtitle={`${v.year} ${v.make} ${v.model} ${v.trim}`}
        footer={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setEdit(false)} className="flex-1">Cancel</SecondaryButton>
            <PrimaryButton
              onClick={() => { setEdit(false); toast.success("Vehicle updated successfully"); }}
              className="flex-1"
            >Save Changes</PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          {[
            { label: "Mileage", value: v.miles },
            { label: "Exterior color", value: v.exterior },
            { label: "Interior color", value: v.interior },
            { label: "Ownership status", value: v.ownership },
          ].map((f) => (
            <label key={f.label} className="block">
              <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{f.label}</span>
              <input defaultValue={f.value} className="mt-1 w-full rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
            </label>
          ))}
        </div>
      </SlideOver>

      <SlideOver
        open={upload} onClose={() => setUpload(false)} title="Upload Vehicle Photos"
        subtitle="Add exterior, interior, odometer & damage shots" width="lg"
        footer={
          <PrimaryButton
            onClick={() => { setUpload(false); toast.success("Photos queued for review"); }}
            className="w-full"
          >Continue</PrimaryButton>
        }
      >
        <button className="w-full border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFE] rounded-2xl p-8 text-center hover:border-[#4F46E5] hover:bg-[#EEF0FF] transition">
          <Upload className="w-8 h-8 mx-auto text-[#4F46E5] mb-2" />
          <div className="text-sm font-semibold text-[#06194A]">Drop files or tap to upload</div>
          <div className="text-[11px] text-[#53627A] mt-1">JPG, PNG or HEIC up to 25MB</div>
        </button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PHOTO_BUCKETS.map((b) => {
            const meta = STATUS_META[b.status];
            return (
              <div key={b.label} className="rounded-xl border border-[#E6EAF0] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[#06194A]">{b.label}</div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                    <meta.Icon className="w-2.5 h-2.5" /> {meta.label}
                  </span>
                </div>
                <div className="text-[11px] text-[#53627A] mt-1">{b.count}{b.target ? ` / ${b.target}` : ""} uploaded</div>
              </div>
            );
          })}
        </div>
      </SlideOver>

      <SlideOver
        open={!!history} onClose={() => setHistory(null)}
        title={history ? `${history.y} ${history.mk} ${history.mdl}` : ""}
        subtitle={history ? `${history.mi} mi • ${history.date}` : ""}
        width="lg"
      >
        {history && (
          <div className="space-y-5">
            <div className={`p-4 rounded-2xl ${history.outcome === "sold" ? "bg-gradient-to-br from-[#E8F8EE] to-white border border-[#BBE5C6]" : "bg-[#F4F6FA] border border-[#E6EAF0]"}`}>
              <div className="text-[10.5px] uppercase tracking-wide font-semibold text-[#8893A8]">Outcome</div>
              {history.outcome === "sold" ? (
                <>
                  <div className="text-[24px] font-extrabold text-[#0F7A3E] mt-1">{fmt(history.amount!)}</div>
                  <div className="text-[12px] text-[#0F7A3E] font-semibold">Sold to {MOCK.customer.dealer}</div>
                </>
              ) : (
                <div className="text-[16px] font-bold text-[#53627A] mt-1">Offer declined</div>
              )}
            </div>

            <div>
              <SectionLabel>Transaction Timeline</SectionLabel>
              <ol className="mt-3 space-y-3 relative pl-5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-[#E6EAF0]">
                {[
                  { t: "Vehicle submitted",  d: "Apr 28" },
                  { t: "Offer issued",       d: "Apr 29 • $14,800" },
                  ...(history.outcome === "sold"
                    ? [{ t: "Offer accepted", d: "Apr 30" }, { t: "Vehicle picked up", d: "May 2" }, { t: "Payout sent", d: "May 3 • ACH" }]
                    : [{ t: "Offer declined", d: "Jan 18" }]),
                ].map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#4F46E5] ring-4 ring-[#EEF0FF]" />
                    <div className="text-[13px] font-semibold text-[#06194A]">{e.t}</div>
                    <div className="text-[11.5px] text-[#53627A]">{e.d}</div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton><FileText className="w-4 h-4" /> Documents</SecondaryButton>
              <SecondaryButton><MessageSquare className="w-4 h-4" /> Messages</SecondaryButton>
            </div>
          </div>
        )}
      </SlideOver>

      <SlideOver
        open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove vehicle?" width="md"
        footer={
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmRemove(false)} className="flex-1">Cancel</SecondaryButton>
            <button
              onClick={() => { setConfirmRemove(false); toast.success("Vehicle removed"); }}
              className="flex-1 rounded-xl bg-[#DC2626] text-white text-sm font-semibold py-2.5 hover:bg-[#B91C1C] transition"
            >Remove</button>
          </div>
        }
      >
        <p className="text-sm text-[#53627A]">
          Removing this vehicle will cancel your active offer from {MOCK.customer.dealer} and delete uploaded photos and documents. This cannot be undone.
        </p>
      </SlideOver>

      <GalleryModal open={gallery.open} onClose={() => setGallery({ open: false, idx: 0 })} startIndex={gallery.idx} />
      <AddVehicleWizard open={wizard} onClose={() => setWizard(false)} />
    </PortalPageShell>
  );
};

export default VehiclesPage;
