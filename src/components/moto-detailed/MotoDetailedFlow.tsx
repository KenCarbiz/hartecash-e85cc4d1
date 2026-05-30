import { useState } from "react";
import MotoShell from "@/components/moto/MotoShell";
import MotoStepVehicleSearch from "@/components/moto/steps/MotoStepVehicleSearch";
import JourneyEngine from "./JourneyEngine";
import { buildPresetConfig, type JourneyPresetId } from "./presets";
import type {
  JourneyConfig,
  JourneyState,
  JourneyValuation,
  JourneyVehicle,
  OfferDisplayMode,
} from "./types";
import { emptyMotoFlowState, type MotoFlowState } from "@/components/moto/types";
import type { BBVehicle } from "@/components/sell-form/types";

/**
 * Public entry for Moto Detailed.
 *
 * Two-phase architecture (per product-owner direction — the first
 * screen must be visually identical to Instant Offer / Moto):
 *
 *   PHASE 1 — Shared acquisition landing.
 *     Renders the exact same `MotoStepVehicleSearch` screen the
 *     classic Moto flow uses, inside the same `MotoShell` chrome.
 *     Customer sees vehicle image on the right, VIN/plate tabs on
 *     the left, yellow CTA. No rail, no summary, no divergence.
 *
 *   PHASE 2 — Guided detailed journey.
 *     Once the vehicle resolves (BlackBook or NHTSA fallback), we
 *     seed JourneyEngine with the vehicle + a valuation range and
 *     hand off to the configurable rail/summary layout. The engine's
 *     own `vehicle` step is skipped via its `shouldRender` guard.
 *
 * This preserves single-source acquisition UX while still letting
 * Detailed expand into a premium guided experience post-engagement.
 */
interface Props {
  preset?: JourneyPresetId;
  offerDisplayMode?: OfferDisplayMode;
  config?: JourneyConfig;
}

// ── BB → JourneyValuation/Vehicle mapping ─────────────────────────
const pickRange = (bb: BBVehicle): { low: number; high: number; firm?: number } => {
  // Prefer trade-in band (closest to what a dealer would offer);
  // fall back to wholesale; then NHTSA-stub heuristic.
  const ti = bb.tradein || ({} as BBVehicle["tradein"]);
  const ws = bb.wholesale || ({} as BBVehicle["wholesale"]);
  const tiClean = ti.clean || 0;
  const tiAvg = ti.avg || 0;
  const tiRough = ti.rough || 0;
  if (tiAvg > 0) {
    return {
      low: Math.round(tiRough || tiAvg * 0.9),
      high: Math.round(tiClean || tiAvg * 1.1),
      firm: Math.round(tiAvg),
    };
  }
  if (ws.avg > 0) {
    return {
      low: Math.round(ws.rough || ws.avg * 0.9),
      high: Math.round(ws.clean || ws.avg * 1.1),
      firm: Math.round(ws.avg),
    };
  }
  // NHTSA / YMM fallback — no BB numbers yet. Heuristic so the
  // detailed journey still shows momentum; the firm offer recalcs
  // server-side once condition + photos land.
  const yr = parseInt(bb.year || "2020", 10);
  const base = 18000 + (Math.max(yr, 2010) - 2015) * 600;
  return { low: Math.round(base * 0.9), high: Math.round(base * 1.1) };
};

const seedFromMotoPatch = (patch: Partial<MotoFlowState>): Partial<JourneyState> | null => {
  const bb = patch.bbVehicle;
  if (!bb) return null;
  const vehicle: JourneyVehicle = {
    year: bb.year || "",
    make: bb.make || "",
    model: bb.model || "",
    trim: bb.series || undefined,
    vin: bb.vin || patch.vin || undefined,
    plate: patch.plate || undefined,
    plateState: patch.plateState || undefined,
    // Carry the BB UVC so the summary image card can request the
    // exact-vehicle Black Book photo (not a generic Wikipedia/AI shot).
    uvc: bb.uvc || undefined,
  };
  const range = pickRange(bb);
  const valuation: JourneyValuation = {
    low: range.low,
    high: range.high,
    firm: range.firm,
    confidence: range.firm ? "medium" : "low",
    marketStrength: "balanced",
    trend: [0.45, 0.5, 0.48, 0.55, 0.6, 0.58, 0.65, 0.7],
  };
  return { vehicle, valuation };
};

const MotoDetailedFlow = ({
  preset,
  offerDisplayMode = "after_contact_info",
  config,
}: Props) => {
  const [seed, setSeed] = useState<Partial<JourneyState> | null>(null);
  // Controlled state for the shared landing search step.
  const [searchState, setSearchState] = useState<MotoFlowState>(emptyMotoFlowState);

  const handleResolved = (patch: Partial<MotoFlowState>) => {
    setSearchState((prev) => ({ ...prev, ...patch }));
    const next = seedFromMotoPatch(patch);
    if (next) setSeed(next);
  };

  // ── Phase 1: shared acquisition landing (identical to Instant Offer)
  if (!seed) {
    return (
      <MotoShell>
        <MotoStepVehicleSearch state={searchState} onResolved={handleResolved} />
      </MotoShell>
    );
  }

  // ── Phase 2: guided detailed journey
  const resolved =
    config ??
    buildPresetConfig(
      preset ?? (offerDisplayMode === "before_contact_info" ? "instant_offer" : "moto_detailed"),
    );
  return <JourneyEngine config={resolved} initialState={seed} />;
};

export default MotoDetailedFlow;
