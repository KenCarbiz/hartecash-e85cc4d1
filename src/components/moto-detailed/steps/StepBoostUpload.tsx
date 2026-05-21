import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Check, Sparkles, Loader2, AlertTriangle, RefreshCw,
  ShieldCheck, ScanLine,
} from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
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

const CATEGORIES: { id: string; label: string }[] = [
  { id: "front", label: "Front exterior" },
  { id: "rear", label: "Rear exterior" },
  { id: "driver", label: "Driver side" },
  { id: "passenger", label: "Passenger side" },
  { id: "wheels", label: "Wheels" },
  { id: "interior", label: "Interior" },
  { id: "dashboard", label: "Dashboard" },
  { id: "odometer", label: "Odometer" },
  { id: "vin", label: "VIN sticker" },
  { id: "damage", label: "Damage (optional)" },
];

const REQUIRED_MIN = 6;

const ANALYZING_MESSAGES = [
  "Analyzing exterior condition…",
  "Verifying body panel consistency…",
  "Checking wheel and tire condition…",
  "Reviewing interior wear patterns…",
  "Comparing against live market data…",
  "Detecting trim and package options…",
  "Calculating confidence score…",
  "Finalizing enhanced valuation…",
];

const YELLOW_REASONS = [
  "Good photo — a brighter angle may improve accuracy.",
  "Usable, but clearer lighting could help.",
  "Acceptable framing — a wider shot would refine the analysis.",
];

const RED_REASONS = [
  "Too dark to verify details. Please retake in better lighting.",
  "Image looks blurry. A steadier shot helps our AI.",
  "Vehicle isn't fully in frame. Please retake.",
];

/**
 * Simulated per-photo AI quality check. Production replaces this with
 * a backend call (Vision API) — interface kept small so swap is local.
 * Bias toward GREEN so the experience feels rewarding, not punitive.
 */
const simulateQuality = (categoryId: string): PhotoQualityResult => {
  const roll = Math.random();
  // ~75% green, ~20% yellow, ~5% red
  if (roll < 0.75) {
    return { status: "green", message: "AI verified" };
  }
  if (roll < 0.95) {
    return {
      status: "yellow",
      message: YELLOW_REASONS[Math.floor(Math.random() * YELLOW_REASONS.length)],
    };
  }
  return {
    status: "red",
    message: RED_REASONS[Math.floor(Math.random() * RED_REASONS.length)],
  };
};

const qualityChrome: Record<PhotoQuality, { ring: string; bg: string; chip: string; chipText: string }> = {
  green: {
    ring: "border-emerald-300",
    bg: "bg-emerald-50/70",
    chip: "bg-emerald-500",
    chipText: "text-emerald-800",
  },
  yellow: {
    ring: "border-amber-300",
    bg: "bg-amber-50/70",
    chip: "bg-amber-500",
    chipText: "text-amber-800",
  },
  red: {
    ring: "border-rose-300",
    bg: "bg-rose-50/70",
    chip: "bg-rose-500",
    chipText: "text-rose-800",
  },
};

/**
 * Cinematic upload + AI analysis. Each tap simulates an upload that
 * runs through per-photo quality AI; tiles update with green/yellow/
 * red verdicts in real time. Red photos must be retaken; yellow are
 * accepted with a soft nudge. Once 6+ usable photos exist the
 * customer triggers the full AI analysis — a longer cinematic state
 * with rotating status messages, a scanning overlay, and a building
 * confidence bar.
 *
 * Internal-only: when AI can't confidently enhance the valuation, we
 * silently queue an appraiser review (analytics event) and let the
 * result step show a neutral "AI verified your offer" message —
 * customers never see escalation language.
 */
const StepBoostUpload = ({ state, update, goTo }: StepContext) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingTile, setAnalyzingTile] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const uploaded = state.boost.uploadedCategories;
  const quality = state.boost.qualityByCategory;

  const usableCount = useMemo(
    () => uploaded.filter((id) => quality[id]?.status !== "red").length,
    [uploaded, quality],
  );
  const enough = usableCount >= REQUIRED_MIN;
  const hasReds = uploaded.some((id) => quality[id]?.status === "red");

  // Rotate analysis messages while analyzing.
  useEffect(() => {
    if (!analyzing) return;
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % ANALYZING_MESSAGES.length), 1100);
    return () => clearInterval(t);
  }, [analyzing]);

  // Animate progress while analyzing.
  useEffect(() => {
    if (!analyzing) {
      setProgress(0);
      return;
    }
    const start = Date.now();
    const total = 5200;
    const id = setInterval(() => {
      const p = Math.min(0.99, (Date.now() - start) / total);
      setProgress(p);
    }, 80);
    return () => clearInterval(id);
  }, [analyzing]);

  // Track abandonment if customer leaves mid-upload.
  const analyzedRef = useRef(false);
  useEffect(() => {
    return () => {
      if (!analyzedRef.current && uploaded.length > 0) {
        trackUploadAbandoned(uploaded.length);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOrReplace = (id: string) => {
    // Show analyzing state on this tile.
    setAnalyzingTile(id);
    const wasRetry = !!quality[id];
    if (wasRetry) trackUploadRetry(id);

    setTimeout(() => {
      const result = simulateQuality(id);
      trackImageQuality(result.status, id, result.message);

      const nextUploaded = uploaded.includes(id) ? uploaded : [...uploaded, id];
      const nextQuality = { ...quality, [id]: result };
      update({
        boost: {
          ...state.boost,
          uploadedCategories: nextUploaded,
          qualityByCategory: nextQuality,
        },
      });
      setAnalyzingTile(null);
    }, 900 + Math.random() * 600);
  };

  const runAi = () => {
    trackCtaClicked("boost_upload", "Run AI Appraisal");
    trackAiAnalysisStarted();
    setAnalyzing(true);
    const startedAt = Date.now();

    const firm = state.valuation?.firm ?? 0;
    // Confidence builds from photo count + green/yellow mix.
    const greens = uploaded.filter((id) => quality[id]?.status === "green").length;
    const yellows = uploaded.filter((id) => quality[id]?.status === "yellow").length;
    const confidence = Math.min(
      0.98,
      0.55 + greens * 0.05 + yellows * 0.02 + Math.random() * 0.05,
    );

    // Decision: enhance, hold-firm, or silently queue for review.
    // - High confidence + greens ≥ 4 → enhance (3–6%)
    // - Medium confidence → hold firm at original (no enhancement copy)
    // - Low confidence or any red → silently flag for appraiser review
    let boostedFirm: number | null = null;
    let delta: number | null = null;
    let queueReason: string | null = null;

    if (confidence >= 0.82 && greens >= 4) {
      const bumpPct = 0.03 + Math.random() * 0.03;
      boostedFirm = Math.round(firm + firm * bumpPct);
      delta = boostedFirm - firm;
    } else if (confidence < 0.7 || uploaded.some((id) => quality[id]?.status === "red")) {
      queueReason = "low_ai_confidence";
    } else {
      // No enhancement, but no escalation either — AI verified original.
    }

    setTimeout(() => {
      const durationMs = Date.now() - startedAt;
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
      trackAiAnalysisCompleted(durationMs);
      trackAiBoostCompleted(uploaded.length);

      if (boostedFirm) {
        trackEnhancementGenerated(firm, boostedFirm);
        trackEnhancedOfferViewed(firm, boostedFirm);
      } else {
        trackEnhancementNotGenerated(queueReason ?? "no_enhancement_available");
      }
      // Silent internal queueing — never surfaced to customer.
      if (queueReason) {
        trackAppraiserQueueTriggered(queueReason, confidence);
      }

      setAnalyzing(false);
      goTo("boost_result");
    }, 5400);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {analyzing ? (
          <AnalysisStage statusIdx={statusIdx} progress={progress} photoCount={usableCount} />
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <LiveProgressBar usable={usableCount} required={REQUIRED_MIN} hasReds={hasReds} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => {
                const q = quality[c.id];
                const isAnalyzing = analyzingTile === c.id;
                return (
                  <PhotoTile
                    key={c.id}
                    label={c.label}
                    quality={q}
                    analyzing={isAnalyzing}
                    onClick={() => addOrReplace(c.id)}
                  />
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 text-xs text-zinc-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              <span>
                Encrypted upload. Each photo is reviewed by our AI for clarity and angle — you'll
                see a green check when it passes.
              </span>
            </div>

            <PrimaryCTA onClick={runAi} disabled={!enough || hasReds}>
              {hasReds
                ? "Please retake highlighted photos"
                : enough
                  ? "Run AI Analysis"
                  : `Add ${REQUIRED_MIN - usableCount} more verified photos`}
            </PrimaryCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────

const PhotoTile = ({
  label,
  quality,
  analyzing,
  onClick,
}: {
  label: string;
  quality?: PhotoQualityResult;
  analyzing: boolean;
  onClick: () => void;
}) => {
  if (analyzing) {
    return (
      <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[hsl(262_83%_58%)]/40 bg-gradient-to-br from-[hsl(262_83%_58%)]/5 to-white p-3 text-center">
        <motion.div
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(262_83%_58%)] to-transparent"
          initial={{ top: 0 }}
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <ScanLine className="h-6 w-6 animate-pulse text-[hsl(262_83%_58%)]" />
        <span className="text-[11px] font-medium text-zinc-700">Analyzing…</span>
      </div>
    );
  }

  if (!quality) {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white p-3 text-center text-sm text-zinc-600 transition-all hover:border-[hsl(262_83%_58%)] hover:text-zinc-900"
      >
        <Camera className="h-6 w-6 text-zinc-400" />
        <span className="text-xs font-medium leading-tight">{label}</span>
      </motion.button>
    );
  }

  const chrome = qualityChrome[quality.status];
  const Icon = quality.status === "green" ? Check : quality.status === "yellow" ? Sparkles : AlertTriangle;
  const showRetake = quality.status !== "green";

  return (
    <motion.button
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border ${chrome.ring} ${chrome.bg} p-3 text-center ${chrome.chipText}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${chrome.chip} text-white`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
      <span className="px-1 text-[10px] leading-tight opacity-90">{quality.message}</span>
      {showRetake && (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium">
          <RefreshCw className="h-2.5 w-2.5" /> Retake
        </span>
      )}
    </motion.button>
  );
};

const LiveProgressBar = ({
  usable,
  required,
  hasReds,
}: {
  usable: number;
  required: number;
  hasReds: boolean;
}) => {
  const pct = Math.min(100, (usable / required) * 100);
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-900">
          {usable} of {required}+ verified
        </span>
        <span className="text-xs text-zinc-500">
          {hasReds ? "Action needed" : usable >= required ? "Ready to analyze" : "Keep going"}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className={`h-full ${hasReds ? "bg-amber-400" : "bg-[hsl(262_83%_58%)]"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
};

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
    className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-[hsl(262_83%_58%)]/5 via-white to-amber-50/30 p-8 sm:p-10"
  >
    {/* Scanning beam */}
    <motion.div
      className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-[hsl(262_83%_58%)]/15 to-transparent"
      initial={{ top: -64 }}
      animate={{ top: ["-15%", "115%"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    />

    <div className="relative">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_8px_30px_-8px_hsl(262_83%_58%/0.5)]">
        <Loader2 className="h-7 w-7 animate-spin text-[hsl(262_83%_58%)]" />
      </div>
      <h2 className="mt-5 text-center text-xl font-semibold text-zinc-900">
        AI is analyzing your vehicle
      </h2>

      <AnimatePresence mode="wait">
        <motion.p
          key={statusIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35 }}
          className="mt-2 text-center text-sm text-zinc-500"
        >
          {ANALYZING_MESSAGES[statusIdx]}
        </motion.p>
      </AnimatePresence>

      {/* Pulsing valuation bars (premium ghost-loader) */}
      <div className="mx-auto mt-6 grid max-w-sm grid-cols-5 items-end gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="rounded-md bg-gradient-to-t from-[hsl(262_83%_58%)]/40 to-[hsl(262_83%_58%)]/10"
            initial={{ height: 12 }}
            animate={{ height: [12, 36 + i * 6, 18] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.12,
            }}
          />
        ))}
      </div>

      {/* Confidence build */}
      <div className="mx-auto mt-6 max-w-sm">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[hsl(262_83%_58%)]" /> Confidence
          </span>
          <span className="font-medium text-zinc-700">{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-gradient-to-r from-[hsl(262_83%_58%)] to-emerald-500 transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-400">
        {photoCount} photos analyzed · cross-referencing live market data
      </p>
    </div>
  </motion.div>
);

export default StepBoostUpload;
