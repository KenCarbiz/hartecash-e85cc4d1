import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Check, Loader2, AlertTriangle, RefreshCw,
  ShieldCheck, Smartphone, QrCode, Send, X, Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PhotoQuality, PhotoQualityResult, StepContext } from "../types";
import {
  trackAiAnalysisCompleted,
  trackAiAnalysisStarted,
  trackAiBoostCompleted,
  trackAppraiserQueueTriggered,
  trackCtaClicked,
  trackEnhancedOfferViewed,
  trackEnhancementGenerated,
  trackEnhancementNotGenerated,
  trackImageQuality,
  trackUploadAbandoned,
  trackUploadRetry,
} from "../analytics";

type Category = { id: string; label: string; required: boolean };

const REQUIRED: Category[] = [
  { id: "front", label: "Front exterior", required: true },
  { id: "rear", label: "Rear exterior", required: true },
  { id: "driver", label: "Driver side", required: true },
  { id: "passenger", label: "Passenger side", required: true },
  { id: "interior", label: "Interior", required: true },
  { id: "odometer", label: "Odometer", required: true },
];
const OPTIONAL: Category[] = [
  { id: "wheels", label: "Wheels", required: false },
  { id: "dashboard", label: "Dashboard", required: false },
  { id: "vin", label: "VIN sticker", required: false },
  { id: "damage", label: "Damage (if any)", required: false },
];
const ALL = [...REQUIRED, ...OPTIONAL];

const ANALYZING_MESSAGES = [
  "Reviewing exterior condition…",
  "Checking body panel consistency…",
  "Reviewing wheel and tire condition…",
  "Reviewing interior wear patterns…",
  "Comparing against live market data…",
  "Detecting trim and package options…",
  "Calculating market adjustment…",
  "Finalizing updated valuation…",
];

const YELLOW_REASONS = [
  "Usable — a brighter angle may help.",
  "Acceptable — a wider shot would help.",
];
const RED_REASONS = [
  "Too dark to verify. Please retake in better lighting.",
  "Image looks blurry. Please retake.",
  "Vehicle isn't fully in frame. Please retake.",
];

/** Per-photo quality verdict — runs only AFTER a real file is selected. */
const simulateQuality = (): PhotoQualityResult => {
  const roll = Math.random();
  if (roll < 0.8) return { status: "green", message: "Photo added" };
  if (roll < 0.95)
    return { status: "yellow", message: YELLOW_REASONS[Math.floor(Math.random() * YELLOW_REASONS.length)] };
  return { status: "red", message: RED_REASONS[Math.floor(Math.random() * RED_REASONS.length)] };
};

const chromeFor: Record<PhotoQuality, { ring: string; chip: string }> = {
  green: { ring: "border-emerald-300", chip: "bg-emerald-500" },
  yellow: { ring: "border-amber-300", chip: "bg-amber-500" },
  red: { ring: "border-rose-300", chip: "bg-rose-500" },
};

const StepBoostUpload = ({ state, update, goTo }: StepContext) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewingTile, setReviewingTile] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showPhone, setShowPhone] = useState(false);

  const uploaded = state.boost.uploadedCategories;
  const quality = state.boost.qualityByCategory;
  const previews = state.boost.previewByCategory;
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Count REQUIRED actually-uploaded photos that aren't red.
  const requiredOk = useMemo(
    () =>
      REQUIRED.filter(
        (c) => uploaded.includes(c.id) && previews[c.id] && quality[c.id]?.status !== "red",
      ).length,
    [uploaded, previews, quality],
  );
  const hasReds = uploaded.some((id) => quality[id]?.status === "red");
  const enoughRequired = requiredOk >= REQUIRED.length;

  // Rotate analysis messages.
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % ANALYZING_MESSAGES.length), 1100);
    return () => clearInterval(t);
  }, [analyzing]);

  // Progress while analyzing.
  useEffect(() => {
    if (!analyzing) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const total = 5200;
    const id = setInterval(() => {
      setProgress(Math.min(0.99, (Date.now() - start) / total));
    }, 80);
    return () => clearInterval(id);
  }, [analyzing]);

  // Abandonment tracking.
  const analyzedRef = useRef(false);
  useEffect(() => {
    return () => {
      if (!analyzedRef.current && uploaded.length > 0) trackUploadAbandoned(uploaded.length);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { /* noop */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = (id: string) => fileInputs.current[id]?.click();

  const onFileSelected = (id: string, file: File | null) => {
    if (!file) return;
    const wasRetry = !!quality[id];
    if (wasRetry) trackUploadRetry(id);

    // Revoke prior preview for this category.
    const prior = previews[id];
    if (prior) {
      try { URL.revokeObjectURL(prior); } catch { /* noop */ }
    }
    const url = URL.createObjectURL(file);

    // Commit preview immediately, mark "reviewing" until verdict arrives.
    update({
      boost: {
        ...state.boost,
        uploadedCategories: uploaded.includes(id) ? uploaded : [...uploaded, id],
        previewByCategory: { ...previews, [id]: url },
        qualityByCategory: { ...quality, [id]: { status: "yellow", message: "Reviewing photo quality…" } },
      },
    });
    setReviewingTile(id);

    setTimeout(() => {
      const result = simulateQuality();
      trackImageQuality(result.status, id, result.message);
      update({
        boost: {
          ...state.boost,
          uploadedCategories: uploaded.includes(id) ? uploaded : [...uploaded, id],
          previewByCategory: { ...previews, [id]: url },
          qualityByCategory: { ...quality, [id]: result },
        },
      });
      setReviewingTile((cur) => (cur === id ? null : cur));
    }, 900 + Math.random() * 600);
  };

  const runAi = () => {
    trackCtaClicked("boost_upload", "Continue");
    trackAiAnalysisStarted();
    setAnalyzing(true);
    const startedAt = Date.now();

    const firm = state.valuation?.firm ?? 0;
    const greens = uploaded.filter((id) => quality[id]?.status === "green").length;
    const yellows = uploaded.filter((id) => quality[id]?.status === "yellow").length;
    const confidence = Math.min(0.98, 0.55 + greens * 0.05 + yellows * 0.02 + Math.random() * 0.05);

    let boostedFirm: number | null = null;
    let delta: number | null = null;
    let queueReason: string | null = null;

    if (confidence >= 0.82 && greens >= 4) {
      const bumpPct = 0.03 + Math.random() * 0.03;
      boostedFirm = Math.round(firm + firm * bumpPct);
      delta = boostedFirm - firm;
    } else if (confidence < 0.7 || uploaded.some((id) => quality[id]?.status === "red")) {
      queueReason = "low_ai_confidence";
    }

    setTimeout(() => {
      analyzedRef.current = true;
      update({
        boost: {
          ...state.boost,
          aiConfidence: confidence,
          boostedFirm,
          delta,
          analyzed: true,
        },
      });
      trackAiAnalysisCompleted(Date.now() - startedAt);
      trackAiBoostCompleted(uploaded.length);
      if (boostedFirm) {
        trackEnhancementGenerated(firm, boostedFirm);
        trackEnhancedOfferViewed(firm, boostedFirm);
      } else {
        trackEnhancementNotGenerated(queueReason ?? "no_enhancement_available");
      }
      if (queueReason) trackAppraiserQueueTriggered(queueReason, confidence);
      setAnalyzing(false);
      goTo("boost_result");
    }, 5400);
  };

  const onSkip = () => {
    trackCtaClicked("boost_upload", "Skip for now");
    update({ branch: "accept" });
    goTo("accepted");
  };

  const ctaLabel = hasReds
    ? "Please retake highlighted photos"
    : enoughRequired
      ? "Continue →"
      : `Add ${REQUIRED.length - requiredOk} more required photo${REQUIRED.length - requiredOk === 1 ? "" : "s"} →`;

  if (analyzing) {
    return <AnalysisStage statusIdx={statusIdx} progress={progress} photoCount={uploaded.length} />;
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-900">
            {requiredOk} of {REQUIRED.length} required photos added
          </span>
          <span className="text-xs text-slate-500">
            {hasReds ? "Action needed" : enoughRequired ? "Ready to continue" : "Keep going"}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className={`h-full ${hasReds ? "bg-amber-400" : "bg-[hsl(262_83%_58%)]"}`}
            initial={{ width: 0 }}
            animate={{ width: `${(requiredOk / REQUIRED.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* Desktop-to-phone handoff */}
      <button
        onClick={() => setShowPhone(true)}
        className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-[hsl(262_83%_58%/0.04)] to-white p-4 text-left transition-all hover:border-[hsl(262_83%_58%/0.4)] hover:shadow-md"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(262_83%_58%/0.12)] text-[hsl(262_60%_45%)]">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Prefer to take photos on your phone?</p>
          <p className="mt-0.5 text-xs text-slate-500">
            We'll text you a secure link or show a QR code to capture photos from your phone camera.
          </p>
        </div>
        <span className="hidden text-xs font-semibold text-[hsl(262_60%_45%)] sm:inline">Use my phone →</span>
      </button>

      {/* Required photos */}
      <section>
        <header className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Required photos
          </h3>
          <span className="text-[11px] text-slate-400">{requiredOk}/{REQUIRED.length}</span>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REQUIRED.map((c) => (
            <PhotoTile
              key={c.id}
              category={c}
              preview={previews[c.id]}
              quality={quality[c.id]}
              reviewing={reviewingTile === c.id}
              onClick={() => openPicker(c.id)}
              registerInput={(el) => { fileInputs.current[c.id] = el; }}
              onFile={(f) => onFileSelected(c.id, f)}
            />
          ))}
        </div>
      </section>

      {/* Optional photos */}
      <section>
        <header className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Optional photos
          </h3>
          <span className="text-[11px] text-slate-400">Helps finalize your offer</span>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {OPTIONAL.map((c) => (
            <PhotoTile
              key={c.id}
              category={c}
              preview={previews[c.id]}
              quality={quality[c.id]}
              reviewing={reviewingTile === c.id}
              onClick={() => openPicker(c.id)}
              registerInput={(el) => { fileInputs.current[c.id] = el; }}
              onFile={(f) => onFileSelected(c.id, f)}
            />
          ))}
        </div>
      </section>

      {/* Tips */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
        <p className="mb-1 font-semibold text-slate-800">Tips for better photos</p>
        <ul className="grid gap-0.5 sm:grid-cols-2">
          <li>· Take photos in good lighting</li>
          <li>· Keep the full vehicle in frame</li>
          <li>· Avoid blurry images</li>
          <li>· Include any damage if visible</li>
        </ul>
      </div>

      {/* Trust */}
      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Secure upload. Photos are used only to review your vehicle and finalize your offer.</span>
      </div>

      {/* CTAs */}
      <div className="space-y-2">
        <button
          onClick={runAi}
          disabled={!enoughRequired || hasReds}
          className={`w-full rounded-xl px-6 py-4 text-base font-semibold transition-all ${
            !enoughRequired || hasReds
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-gradient-to-b from-[hsl(262_83%_60%)] to-[hsl(262_83%_52%)] text-white shadow-[0_8px_24px_-10px_hsl(262_83%_58%/0.6)] hover:from-[hsl(262_83%_58%)] hover:to-[hsl(262_83%_48%)]"
          }`}
        >
          {ctaLabel}
        </button>
        <button
          onClick={onSkip}
          className="block w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          Skip for now
        </button>
        <p className="text-center text-[11px] text-slate-400">
          You can continue with your current offer, but photos may help finalize or improve it.
        </p>
      </div>

      <AnimatePresence>
        {showPhone && (
          <PhoneHandoffModal
            defaultPhone={state.contact.phone}
            onClose={() => setShowPhone(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── PhotoTile ────────────────────────────────────────────────────────
const PhotoTile = ({
  category,
  preview,
  quality,
  reviewing,
  onClick,
  registerInput,
  onFile,
}: {
  category: Category;
  preview?: string;
  quality?: PhotoQualityResult;
  reviewing: boolean;
  onClick: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
  onFile: (file: File | null) => void;
}) => {
  const hasFile = !!preview;
  const status = quality?.status;
  const showRetake = hasFile && status === "red";
  const showError = hasFile && status === "red";

  // Empty tile — dashed placeholder.
  if (!hasFile) {
    return (
      <div className="relative">
        <input
          ref={registerInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className="group flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-center transition-all hover:border-[hsl(262_83%_58%)] hover:bg-[hsl(262_83%_58%/0.04)] hover:shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-[hsl(262_83%_58%/0.12)] group-hover:text-[hsl(262_60%_45%)]">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold leading-tight text-slate-800">{category.label}</span>
          <span className="text-[10px] text-slate-400">
            {category.required ? "Tap to add photo" : "Optional · Tap to add"}
          </span>
        </motion.button>
      </div>
    );
  }

  // Tile with selected file.
  return (
    <div className="relative">
      <input
        ref={registerInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <motion.button
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`group relative aspect-square w-full overflow-hidden rounded-2xl border-2 ${
          showError ? "border-rose-300" : status === "green" ? "border-emerald-300" : "border-slate-200"
        } bg-slate-100 text-left shadow-sm transition-all hover:shadow-md`}
      >
        <img src={preview} alt={category.label} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2">
          <p className="text-[11px] font-semibold leading-tight text-white">{category.label}</p>
        </div>

        {reviewing ? (
          <div className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Checking…
          </div>
        ) : status && (
          <div
            className={`absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${chromeFor[status].chip} text-white shadow-sm`}
            title={quality?.message}
          >
            {status === "green" ? <Check className="h-3.5 w-3.5" />
              : status === "yellow" ? <Sparkles className="h-3 w-3" />
              : <AlertTriangle className="h-3.5 w-3.5" />}
          </div>
        )}

        {!reviewing && (
          <div className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <RefreshCw className="h-2.5 w-2.5" /> Replace
          </div>
        )}
      </motion.button>
      {showRetake && quality && (
        <p className="mt-1 px-0.5 text-[10px] font-medium text-rose-600">{quality.message}</p>
      )}
    </div>
  );
};

// ── PhoneHandoffModal ────────────────────────────────────────────────
const PhoneHandoffModal = ({
  defaultPhone,
  onClose,
}: { defaultPhone: string; onClose: () => void }) => {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [sent, setSent] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "https://example.com";

  const sendLink = () => {
    // Hook real SMS handoff here. For now, we mark as sent.
    if (!phone.replace(/\D/g, "")) return;
    setSent(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(262_83%_58%/0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(262_60%_45%)]">
          <Smartphone className="h-3 w-3" /> Use my phone
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
          Capture photos on your phone
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Scan the QR code or send yourself a secure link to upload photos from your phone camera.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <QRCodeSVG value={url} size={140} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <p className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <QrCode className="h-3 w-3" /> Scan to open photo capture on your phone
          </p>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Or text the link to your phone
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="h-11 flex-1 rounded-xl border border-[#E6EAF0] bg-white px-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[hsl(262_83%_58%)] focus:ring-4 focus:ring-[hsl(262_83%_58%/0.12)]"
            />
            <button
              onClick={sendLink}
              disabled={sent}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[hsl(262_83%_58%)] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[hsl(262_83%_52%)] disabled:bg-emerald-600"
            >
              {sent ? <><Check className="h-4 w-4" /> Sent</> : <><Send className="h-4 w-4" /> Send Link</>}
            </button>
          </div>
          {sent && (
            <p className="mt-1.5 text-[11px] font-medium text-emerald-700">
              Check your phone for the secure photo upload link.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Your upload link is private and expires after a short time.
        </p>
      </motion.div>
    </motion.div>
  );
};

// ── AnalysisStage ────────────────────────────────────────────────────
const AnalysisStage = ({
  statusIdx,
  progress,
  photoCount,
}: {
  statusIdx: number;
  progress: number;
  photoCount: number;
}) => (
  <motion.div
    key="analyzing"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[hsl(262_83%_58%/0.05)] via-white to-slate-50 p-8 sm:p-10"
  >
    <motion.div
      className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-[hsl(262_83%_58%/0.15)] to-transparent"
      initial={{ top: -64 }}
      animate={{ top: ["-15%", "115%"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    />
    <div className="relative">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_8px_30px_-8px_hsl(262_83%_58%/0.5)]">
        <Loader2 className="h-7 w-7 animate-spin text-[hsl(262_83%_58%)]" />
      </div>
      <h2 className="mt-5 text-center text-xl font-semibold text-slate-900">
        Reviewing your photos
      </h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={statusIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35 }}
          className="mt-2 text-center text-sm text-slate-500"
        >
          {ANALYZING_MESSAGES[statusIdx]}
        </motion.p>
      </AnimatePresence>
      <div className="mx-auto mt-6 max-w-sm">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Reviewing photos</span>
          <span className="font-medium text-slate-700">{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-[hsl(262_83%_58%)] to-emerald-500 transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-slate-400">
        {photoCount} photos reviewed · cross-referencing live market data
      </p>
    </div>
  </motion.div>
);

export default StepBoostUpload;
