import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Check,
  Circle,
  ArrowRight,
  ShieldCheck,
  Lock,
  BellRing,
  Upload,
  FileText,
  IdCard,
  Wallet,
  Truck,
  Store,
  PackageOpen,
  MessageCircle,
  Download,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { StepContext, JourneyAppointment } from "../types";
import VehicleImageCard from "../VehicleImageCard";
import { trackCtaClicked } from "../analytics";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const DEALER_NAME = "Harte Auto Group";
const REQUIRED_PHOTO_IDS = ["front", "rear", "driver", "passenger", "interior", "odometer"];

type TodoMeta = {
  id: string;
  icon: typeof Upload;
  helper: string;
  statusTag: string;
  action: "upload" | "payoff" | "id" | "payment" | "details" | "mark";
  actionLabel: string;
};

const TODO_META: Record<string, TodoMeta> = {
  registration: {
    id: "registration",
    icon: Upload,
    helper: "Add a photo or PDF of your current registration.",
    statusTag: "Required",
    action: "upload",
    actionLabel: "Upload",
  },
  payoff: {
    id: "payoff",
    icon: FileText,
    helper: "Needed if there is a loan or lien on the vehicle.",
    statusTag: "Required if financed",
    action: "payoff",
    actionLabel: "Upload",
  },
  title: {
    id: "title",
    icon: FileText,
    helper: "Bring your title if you own the vehicle outright.",
    statusTag: "Required",
    action: "details",
    actionLabel: "View details",
  },
  belongings: {
    id: "belongings",
    icon: PackageOpen,
    helper: "Check the glovebox, trunk, center console, and storage areas.",
    statusTag: "Recommended",
    action: "mark",
    actionLabel: "Mark done",
  },
  id: {
    id: "id",
    icon: IdCard,
    helper: "Verify your identity before payment is released.",
    statusTag: "Required",
    action: "id",
    actionLabel: "Start",
  },
  payment: {
    id: "payment",
    icon: Wallet,
    helper: "Choose how you'd like to receive payment.",
    statusTag: "Required",
    action: "payment",
    actionLabel: "Choose",
  },
};

const PURPLE = "hsl(263_70%_50%)";

/**
 * Post-acceptance command center — premium confirmation, mode picker,
 * actionable checklist, and clear portal pathway.
 */
const StepAccepted = ({ state, update }: StepContext) => {
  const navigate = useNavigate();
  const requiredPhotoReviewComplete =
    state.boost.analyzed && REQUIRED_PHOTO_IDS.every((id) => state.boost.uploadedCategories.includes(id));
  const firm = requiredPhotoReviewComplete && state.boost.boostedFirm
    ? state.boost.boostedFirm
    : state.valuation?.firm ?? 0;
  const [pickedSlot, setPickedSlot] = useState<string | null>(state.appointment?.timeSlot ?? null);
  const [mode, setMode] = useState<JourneyAppointment["mode"]>(state.appointment?.mode ?? "appointment");
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [paymentChoice, setPaymentChoice] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "payoff" | "id" | "payment" | "title">(null);
  const regInputRef = useRef<HTMLInputElement>(null);
  const payoffInputRef = useRef<HTMLInputElement>(null);

  const slots = useMemo(() => {
    const out: { date: string; label: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      out.push({
        date: d.toISOString(),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      });
    }
    return out;
  }, []);

  const markDone = (id: string, done = true) => {
    update({
      todos: state.todos.map((t) => (t.id === id ? { ...t, done } : t)),
    });
  };

  const setSlot = (date: string, label: string) => {
    setPickedSlot(label);
    update({ appointment: { mode, date, timeSlot: label } });
    trackCtaClicked("accepted", `slot:${label}`);
  };

  const handleFile = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFiles((u) => ({ ...u, [id]: file.name }));
    markDone(id, true);
    trackCtaClicked("accepted", `upload:${id}`);
  };

  const handleTaskAction = (id: string) => {
    const meta = TODO_META[id];
    if (!meta) return;
    switch (meta.action) {
      case "upload":
        regInputRef.current?.click();
        break;
      case "payoff":
        setModal("payoff");
        break;
      case "id":
        setModal("id");
        break;
      case "payment":
        setModal("payment");
        break;
      case "details":
        setModal("title");
        break;
      case "mark":
        markDone(id, true);
        trackCtaClicked("accepted", `mark:${id}`);
        break;
    }
  };

  const completed = state.todos.filter((t) => t.done).length;
  const total = state.todos.length;
  const pct = Math.round((completed / total) * 100);

  const goToPortal = () => {
    trackCtaClicked("accepted", "Go to My Offer Portal");
    navigate("/my-submission");
  };

  const vehicleLabel = state.vehicle
    ? `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`
    : "Your vehicle";

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for uploads */}
      <input
        ref={regInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFile("registration")}
      />
      <input
        ref={payoffInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFile("payoff")}
      />

      {/* ── Premium hero ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[22px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-7 shadow-[0_24px_70px_-30px_rgba(16,185,129,0.45)]"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220, delay: 0.1 }}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)]"
          >
            <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
          </motion.div>
          <span className="ml-3 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white align-middle">
            Offer Accepted
          </span>

          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Your offer is locked in.
          </h2>
          <p className="mt-2 text-base leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-900">{fmt(firm)} secured</span> with {DEALER_NAME}. We'll guide you through the final steps so your visit or pickup is fast and simple.
          </p>

          {state.vehicle && (
            <div className="mt-5 grid grid-cols-[140px_1fr] items-center gap-4 rounded-2xl border border-emerald-100 bg-white/70 p-3 backdrop-blur-sm">
              <div className="overflow-hidden rounded-xl border border-emerald-100">
                <VehicleImageCard
                  imageUrl={state.vehicle.imageUrl}
                  year={state.vehicle.year}
                  make={state.vehicle.make}
                  model={state.vehicle.model}
                  aspectClassName="aspect-[16/10]"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Your vehicle</p>
                <p className="mt-0.5 text-base font-semibold text-zinc-900">{vehicleLabel}</p>
                {state.vehicle.trim && <p className="text-sm text-zinc-500">{state.vehicle.trim}</p>}
                {state.contact.mileage && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {Number(state.contact.mileage).toLocaleString("en-US")} mi
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Pill icon={BellRing}>Dealer notified</Pill>
            <Pill icon={Lock}>Offer secured</Pill>
            <Pill icon={ShieldCheck}>No obligation</Pill>
          </div>

          <button
            onClick={goToPortal}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[hsl(263_70%_50%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.6)] transition-transform hover:scale-[1.02]"
          >
            Go to My Offer Portal
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* ── Mode picker ──────────────────────────────────────────────── */}
      <div className="rounded-[22px] border border-zinc-200 bg-white p-6 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold text-zinc-900">Choose how you'd like to complete your offer</p>
        <p className="mt-1 text-xs text-zinc-500">Your offer is secured. Pick the path that's easiest for you.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            { key: "appointment", icon: Store, title: "Visit our store", body: "Bring your vehicle in and we'll complete the final review with you." },
            { key: "pickup", icon: Truck, title: "Schedule pickup", body: "We'll coordinate pickup and help finish the paperwork." },
          ] as const).map((opt) => {
            const active = mode === opt.key;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  setMode(opt.key);
                  if (pickedSlot && state.appointment?.date) {
                    update({ appointment: { ...state.appointment, mode: opt.key } });
                  }
                }}
                className={`group relative flex flex-col rounded-2xl border-2 p-5 text-left transition-all ${
                  active
                    ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%)]/5 shadow-[0_10px_30px_-12px_rgba(124,58,237,0.35)]"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(263_70%_50%)] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                    active ? "bg-[hsl(263_70%_50%)] text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-base font-semibold text-zinc-900">{opt.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">{opt.body}</p>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Pick a {mode === "pickup" ? "pickup" : "visit"} day
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {slots.map((s) => {
            const active = pickedSlot === s.label;
            return (
              <button
                key={s.date}
                onClick={() => setSlot(s.date, s.label)}
                className={`rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all ${
                  active
                    ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%)] text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.5)]"
                    : "border-zinc-200 text-zinc-700 hover:border-[hsl(263_70%_50%)]/40"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Checklist ────────────────────────────────────────────────── */}
      <div className="rounded-[22px] border border-zinc-200 bg-white p-6 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              Complete these before {mode === "pickup" ? "pickup" : "your visit"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">A few quick steps and you're all set.</p>
          </div>
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {completed} of {total} complete
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(263_70%_50%)] to-[hsl(263_70%_70%)]"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <ul className="mt-5 space-y-2">
          {state.todos.map((t) => {
            const meta = TODO_META[t.id];
            if (!meta) return null;
            const Icon = meta.icon;
            const fileName = uploadedFiles[t.id];
            const paymentLabel = t.id === "payment" && paymentChoice ? paymentChoice : null;
            return (
              <li
                key={t.id}
                className={`group flex items-center gap-3 rounded-xl border p-3.5 transition-all sm:p-4 ${
                  t.done
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                {t.done ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                    <Icon className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${t.done ? "text-zinc-700" : "text-zinc-900"}`}>
                      {t.label}
                    </p>
                    <StatusTag done={t.done} label={meta.statusTag} />
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    {fileName ? `Uploaded: ${fileName}` : paymentLabel ? `Selected: ${paymentLabel}` : meta.helper}
                  </p>
                </div>
                <button
                  onClick={() => handleTaskAction(t.id)}
                  className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    t.done
                      ? "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      : "bg-[hsl(263_70%_50%)] text-white shadow-sm hover:bg-[hsl(263_70%_52%)]"
                  }`}
                >
                  {t.done ? (meta.action === "upload" || meta.action === "payoff" ? "Replace" : "View") : meta.actionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Bottom action bar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-[22px] border border-zinc-200 bg-gradient-to-br from-white to-zinc-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Manage everything in your portal</p>
          <p className="mt-0.5 text-xs text-zinc-500">Track status, message the dealer, and review pickup details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => trackCtaClicked("accepted", "Message Dealer")}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-300"
          >
            <MessageCircle className="h-4 w-4" />
            Message Dealer
          </button>
          <button
            onClick={() => trackCtaClicked("accepted", "Download Summary")}
            className="hidden items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-zinc-300 sm:inline-flex"
          >
            <Download className="h-4 w-4" />
            Download summary
          </button>
          <button
            onClick={goToPortal}
            className="inline-flex items-center gap-2 rounded-xl bg-[hsl(263_70%_50%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.6)] hover:bg-[hsl(263_70%_52%)]"
          >
            Go to My Offer Portal
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === "payoff" && (
          <ModalShell title="Upload payoff information" onClose={() => setModal(null)}>
            <p className="text-sm text-zinc-600">
              Add a payoff statement or enter your lender and payoff details so we can verify next steps.
            </p>
            <div className="mt-5 grid gap-2">
              <button
                onClick={() => {
                  payoffInputRef.current?.click();
                  setModal(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-left hover:border-[hsl(263_70%_50%)]"
              >
                <Upload className="h-5 w-5 text-[hsl(263_70%_50%)]" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Upload payoff statement</p>
                  <p className="text-xs text-zinc-500">PDF or image from your lender</p>
                </div>
              </button>
              <button
                onClick={() => {
                  markDone("payoff", true);
                  setModal(null);
                }}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4 text-left hover:border-[hsl(263_70%_50%)]"
              >
                <FileText className="h-5 w-5 text-[hsl(263_70%_50%)]" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Enter payoff details manually</p>
                  <p className="text-xs text-zinc-500">Lender name, account, and payoff amount</p>
                </div>
              </button>
            </div>
          </ModalShell>
        )}

        {modal === "id" && (
          <ModalShell title="Verify your identity" onClose={() => setModal(null)}>
            <p className="text-sm text-zinc-600">
              This helps us keep your payment secure. It takes about 60 seconds and uses your ID plus a quick selfie.
            </p>
            <button
              onClick={() => {
                markDone("id", true);
                setModal(null);
              }}
              className="mt-5 w-full rounded-xl bg-[hsl(263_70%_50%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(263_70%_52%)]"
            >
              Start ID Verification
            </button>
          </ModalShell>
        )}

        {modal === "payment" && (
          <ModalShell title="Select payment method" onClose={() => setModal(null)}>
            <p className="text-sm text-zinc-600">Choose how you'd like to receive your funds.</p>
            <div className="mt-4 grid gap-2">
              {["Check at dealership", "ACH / direct deposit", "Apply toward next vehicle"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setPaymentChoice(opt);
                    markDone("payment", true);
                    setModal(null);
                  }}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-left text-sm font-semibold text-zinc-900 hover:border-[hsl(263_70%_50%)]"
                >
                  {opt}
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </button>
              ))}
            </div>
          </ModalShell>
        )}

        {modal === "title" && (
          <ModalShell title="Bring your title" onClose={() => setModal(null)}>
            <p className="text-sm leading-relaxed text-zinc-600">
              If you own the vehicle outright, please bring the original title with you. If there's a lien or lease, we'll help you verify the next steps and coordinate with your lender directly.
            </p>
            <button
              onClick={() => {
                markDone("title", true);
                setModal(null);
              }}
              className="mt-5 w-full rounded-xl bg-[hsl(263_70%_50%)] px-4 py-3 text-sm font-semibold text-white hover:bg-[hsl(263_70%_52%)]"
            >
              Got it
            </button>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── small components ─────────────────────────────────────────────────
const Pill = ({ icon: Icon, children }: { icon: typeof BellRing; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
    <Icon className="h-3 w-3" />
    {children}
  </span>
);

const StatusTag = ({ done, label }: { done: boolean; label: string }) => {
  if (done) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        Completed
      </span>
    );
  }
  const isRequired = label.toLowerCase().startsWith("required");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isRequired ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}
    </span>
  );
};

const ModalShell = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/60 p-4 sm:items-center"
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </motion.div>
  </motion.div>
);

export default StepAccepted;
