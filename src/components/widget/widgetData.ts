// Data layer for the embeddable trade/sell widget. Thin adapters over
// the SAME backend the moto flow uses, so the widget produces identical
// leads + offers without re-implementing any pricing logic:
//
//   • bb-lookup            VIN / plate → BBVehicle
//   • calculateAndPersistOffer  estimate + firm offer + submissions row
//   • send/verify-customer-otp  SMS verification (kept per decision)
//
// The widget's local form state (TradeWidgetFlow) is mapped onto the
// canonical MotoFlowState here so calculateAndPersistOffer just works.

import { supabase } from "@/integrations/supabase/client";
import {
  calculateAndPersistOffer,
  motoStateToFormData,
  type MotoOfferResult,
} from "@/components/moto/motoSubmission";
import { calculateOffer, type OfferSettings } from "@/lib/offerCalculator";
import { emptyMotoFlowState, type Condition, type MotoFlowState } from "@/components/moto/types";
import type { BBVehicle } from "@/components/sell-form/types";
import type { WidgetCondition, WidgetIntent } from "./widgetTypes";

/** Fields the widget collects, mirrored from TradeWidgetFlow. */
export interface WidgetFlowData {
  entryMode: "vin" | "plate";
  vehicleId: string;
  state: string;
  condition: WidgetCondition | null;
  intent: WidgetIntent;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  miles: string;
  zip: string;
  trackValue: boolean;
}

/** Decode a VIN or plate to a Black Book vehicle (null on no match). */
export async function decodeVehicle(
  data: Pick<WidgetFlowData, "entryMode" | "vehicleId" | "state">,
  dealershipId: string,
): Promise<{ vehicle: BBVehicle | null; error: string | null }> {
  const id = data.vehicleId.trim();
  const body =
    data.entryMode === "vin"
      ? { lookup_type: "vin", vin: id.toUpperCase(), dealership_id: dealershipId }
      : { lookup_type: "plate", plate: id.toUpperCase(), state: data.state, dealership_id: dealershipId };
  try {
    const { data: res, error } = await supabase.functions.invoke("bb-lookup", { body });
    if (error || !res?.vehicles?.length) {
      return { vehicle: null, error: error?.message || "We couldn't find that vehicle." };
    }
    return { vehicle: res.vehicles[0] as BBVehicle, error: null };
  } catch (e) {
    return { vehicle: null, error: (e as Error).message || "Lookup failed." };
  }
}

const CONDITION_MAP: Record<WidgetCondition, Condition> = {
  fair: "fair",
  good: "good",
  very_good: "very_good",
  excellent: "excellent",
};

/** Map the widget's local form state onto the canonical MotoFlowState. */
export function buildMotoState(data: WidgetFlowData, bb: BBVehicle | null): MotoFlowState {
  return {
    ...emptyMotoFlowState,
    lookupMode: data.entryMode,
    vin: bb?.vin || (data.entryMode === "vin" ? data.vehicleId.toUpperCase() : ""),
    plate: data.entryMode === "plate" ? data.vehicleId.toUpperCase() : "",
    plateState: data.state,
    ymm: {
      year: bb?.year || "",
      make: bb?.make || "",
      model: bb?.model || "",
      trim: (bb as { trim?: string } | null)?.trim || "",
    },
    bbVehicle: bb,
    mileage: data.miles.replace(/\D/g, ""),
    condition: data.condition ? CONDITION_MAP[data.condition] : "good",
    intent: data.intent,
    contact: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      phone: data.phone,
      phoneVerified: false,
      zip: data.zip,
    },
    trackValue: data.trackValue,
  };
}

export interface WidgetEstimate {
  low: number | null;
  high: number | null;
  firm: number | null;
}

/**
 * Compute the estimate range + firm number WITHOUT persisting — used for
 * the range screen so the customer can freely edit mileage / re-run
 * without creating duplicate submissions. Runs the same waterfall
 * (`calculateOffer` + the dealer's `offer_settings`) as the persist path;
 * the row is written once, later, by `persistWidgetOffer`.
 */
export async function computeWidgetEstimate(
  data: WidgetFlowData,
  bb: BBVehicle | null,
  dealershipId: string,
): Promise<WidgetEstimate> {
  const fd = motoStateToFormData(buildMotoState(data, bb));
  let settings: OfferSettings | null = null;
  let autoFirmPct: number | null = null;
  try {
    const { data: s } = await supabase
      .from("offer_settings")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (s) {
      settings = s as unknown as OfferSettings;
      autoFirmPct = (s as { auto_firm_offer_pct?: number | null }).auto_firm_offer_pct ?? null;
    }
  } catch (e) {
    console.warn("[widget] offer_settings load failed (defaults):", e);
  }
  const est = calculateOffer(bb, fd, [], settings);
  const firm =
    autoFirmPct != null && est?.high ? Math.round(est.high * autoFirmPct) : est?.low ?? null;
  return { low: est?.low ?? null, high: est?.high ?? null, firm };
}

/**
 * Compute + persist the offer (inserts the submissions row, same as the
 * moto flow), then stamp embed attribution from the sessionStorage keys
 * EmbedLanding set, so the lead is tagged inventory_embed and carries the
 * VDP vehicle the customer was viewing.
 */
export async function persistWidgetOffer(
  data: WidgetFlowData,
  bb: BBVehicle | null,
  dealershipId: string,
): Promise<MotoOfferResult> {
  const result = await calculateAndPersistOffer(buildMotoState(data, bb), dealershipId);

  try {
    const source = sessionStorage.getItem("__embed_lead_source");
    const label = sessionStorage.getItem("__embed_vehicle_label");
    const msrp = sessionStorage.getItem("__embed_vehicle_msrp");
    if (source || label || msrp) {
      const patch: Record<string, unknown> = {};
      if (source) patch.embed_source = source;
      if (label) patch.embed_vehicle_label = label;
      if (msrp) patch.embed_vehicle_msrp = Number(msrp) || null;
      // Best-effort — ignore if these columns aren't present.
      await supabase.from("submissions").update(patch as never).eq("token", result.submissionToken);
    }
  } catch (e) {
    console.warn("[widget] embed attribution stamp failed:", e);
  }

  return result;
}

/** Send an SMS OTP. Returns the challenge id, or an error reason. */
export async function sendWidgetOtp(
  phone: string,
  dealershipName: string | undefined,
): Promise<{ challengeId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-customer-otp", {
      body: { phone: phone.replace(/\D/g, ""), dealership_name: dealershipName },
    });
    if (error || data?.error || !data?.challenge_id) {
      return { challengeId: null, error: data?.error || error?.message || "send_failed" };
    }
    return { challengeId: data.challenge_id as string, error: null };
  } catch (e) {
    return { challengeId: null, error: (e as Error).message || "network" };
  }
}

/** Verify an SMS OTP code against a challenge. */
export async function verifyWidgetOtp(
  challengeId: string,
  code: string,
): Promise<{ ok: boolean; error: string | null; attemptsRemaining?: number }> {
  try {
    const { data, error } = await supabase.functions.invoke("verify-customer-otp", {
      body: { challenge_id: challengeId, code },
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        error: data?.error || error?.message || "verify_failed",
        attemptsRemaining: data?.attempts_remaining,
      };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "network" };
  }
}
