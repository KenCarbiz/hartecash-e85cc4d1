import type { JourneyVehicle, JourneyValuation } from "./types";

/**
 * BlackBook valuation adapter.
 *
 * Single seam between the journey and the actual valuation source.
 * Today this returns a believable stub so the UI shows momentum
 * immediately; swap `defaultBlackBookAdapter` for a real call to
 * the `bb-lookup` edge function when ready — no step component
 * needs to change.
 *
 * Wiring sketch (when going live):
 *
 *   const { data } = await supabase.functions.invoke("bb-lookup", {
 *     body: { year, make, model, vin, plate, state },
 *   });
 *   return mapBlackBookResponse(data);
 */

export interface ValuationLookupInput {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  plate?: string;
  state?: string;
}

export type ValuationAdapter = (
  input: ValuationLookupInput,
) => Promise<JourneyValuation>;

/** Stub — replace with bb-lookup edge function call. */
export const defaultBlackBookAdapter: ValuationAdapter = async (input) => {
  await new Promise((r) => setTimeout(r, 900));
  const yr = parseInt(input.year || "2020", 10);
  const base = 18000 + (yr - 2015) * 600;
  return {
    low: Math.round(base * 0.92),
    high: Math.round(base * 1.08),
    confidence: "medium",
    marketStrength: "balanced",
    trend: [0.45, 0.5, 0.48, 0.55, 0.6, 0.58, 0.65, 0.7],
  };
};

export const buildVehicleFromInput = (input: ValuationLookupInput): JourneyVehicle => ({
  year: input.year ?? "",
  make: input.make ?? "",
  model: input.model ?? "",
  trim: input.trim,
  vin: input.vin,
  plate: input.plate,
  plateState: input.state,
});
