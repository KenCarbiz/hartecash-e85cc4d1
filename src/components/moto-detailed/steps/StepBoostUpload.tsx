import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Sparkles, Loader2 } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import {
  trackAiBoostCompleted,
  trackCtaClicked,
  trackEnhancedOfferViewed,
  trackUploadAbandoned,
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

/**
 * Guided AI-photo capture flow. Tap-to-mark-uploaded chips simulate
 * upload completion (production wiring uses the existing photo-upload
 * APIs). When enough categories are covered the customer triggers
 * the AI appraisal — a calm spinner + analyzing copy → result.
 */
const StepBoostUpload = ({ state, update, goTo }: StepContext) => {
  const [analyzing, setAnalyzing] = useState(false);
  const uploaded = state.boost.uploadedCategories;
  const enough = uploaded.length >= REQUIRED_MIN;

  // Fire upload_abandoned on unmount if customer leaves before
  // running AI and didn't finalize.
  useEffect(() => {
    return () => {
      if (!state.boost.boostedFirm && uploaded.length > 0 && !analyzing) {
        trackUploadAbandoned(uploaded.length);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploaded.length, analyzing]);

  const toggle = (id: string) => {
    const next = uploaded.includes(id)
      ? uploaded.filter((c) => c !== id)
      : [...uploaded, id];
    update({ boost: { ...state.boost, uploadedCategories: next } });
  };

  const runAi = () => {
    trackCtaClicked("boost_upload", "Run AI Appraisal");
    setAnalyzing(true);
    // Simulated AI enhancement — production wires to the existing
    // appraisal engine. Numbers are bounded (3–6%) to feel credible.
    const firm = state.valuation?.firm ?? 0;
    const bumpPct = 0.03 + Math.random() * 0.03;
    const boostedFirm = Math.round(firm + firm * bumpPct);
    const delta = boostedFirm - firm;
    const confidence = Math.min(0.99, 0.65 + uploaded.length * 0.035);

    setTimeout(() => {
      update({
        boost: {
          ...state.boost,
          boostedFirm,
          delta,
          aiConfidence: confidence,
        },
      });
      trackAiBoostCompleted(uploaded.length);
      trackEnhancedOfferViewed(firm, boostedFirm);
      setAnalyzing(false);
      goTo("boost_result");
    }, 2400);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {analyzing ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-[hsl(262_83%_58%)]/5 via-white to-amber-50/40 p-10 text-center"
          >
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_4px_24px_-6px_hsl(262_83%_58%/0.4)]">
              <Loader2 className="h-7 w-7 animate-spin text-[hsl(262_83%_58%)]" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-zinc-900">Analyzing your vehicle…</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Our AI is reviewing photos, condition signals, and live market data.
            </p>
            <div className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-zinc-600">
              <AnalyzeLine label="Matching condition signals" delay={0.1} />
              <AnalyzeLine label="Comparing live market comps" delay={0.6} />
              <AnalyzeLine label="Calculating enhanced offer" delay={1.2} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 text-sm text-zinc-600">
              <span className="font-medium text-zinc-900">
                {uploaded.length} of {REQUIRED_MIN}+
              </span>{" "}
              photos added. Tap a tile to capture or attach.
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => {
                const done = uploaded.includes(c.id);
                return (
                  <motion.button
                    key={c.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggle(c.id)}
                    className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-sm transition-all ${
                      done
                        ? "border-emerald-300 bg-emerald-50/70 text-emerald-800"
                        : "border-dashed border-zinc-300 bg-white text-zinc-600 hover:border-[hsl(262_83%_58%)] hover:text-zinc-900"
                    }`}
                  >
                    {done ? (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <Camera className="h-6 w-6 text-zinc-400" />
                    )}
                    <span className="text-xs font-medium leading-tight">{c.label}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 text-xs text-zinc-500">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-[hsl(262_83%_58%)]" />
              <span>
                More photos = higher AI confidence. We recommend at least 6 angles for the best boost.
              </span>
            </div>

            <PrimaryCTA onClick={runAi} disabled={!enough}>
              {enough ? "Run AI Appraisal" : `Add ${REQUIRED_MIN - uploaded.length} more`}
            </PrimaryCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AnalyzeLine = ({ label, delay }: { label: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex items-center gap-2"
  >
    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(262_83%_58%)]" />
    {label}
  </motion.div>
);

export default StepBoostUpload;
