import { supabase } from "@/integrations/supabase/client";
import { calculateOffer, type OfferEstimate, type OfferSettings } from "@/lib/offerCalculator";
import { buildSubmissionBBPayload } from "@/lib/submissionOffer";
import { initialFormData, type FormData as SellFormData } from "@/components/sell-form/types";
import { logConsent } from "@/lib/consent";
import { resolveOfferMode, type OfferMode } from "@/lib/offerTerms";
import type { MotoFlowState } from "./types";

/**
 * Map the lean MotoFlowState onto the legacy SellFormData shape that
 * the existing offer engine + submissions table understand. Keeps the
 * new flow drop-in compatible with the back-office pipeline.
 */
export function motoStateToFormData(state: MotoFlowState): SellFormData {
  return {
    ...initialFormData,
    plate: state.plate,
    state: state.plateState,
    vin: state.vin,
    mileage: (state.mileage || "").replace(/\D/g, ""),
    bbUvc: state.bbVehicle?.uvc || "",
    bbSelectedAddDeducts: [],
    exteriorColor: state.color,
    overallCondition: state.condition || "good",
    name: `${state.contact.firstName} ${state.contact.lastName}`.trim(),
    phone: state.contact.phone,
    email: state.contact.email,
    zip: state.contact.zip,
    loanStatus: state.ownership || "",
    nextStep: state.intent === "trade" ? "trade" : "sell",
    manualYear: state.lookupMode === "ymm" ? state.ymm.year : "",
    manualMake: state.lookupMode === "ymm" ? state.ymm.make : "",
    manualModel: state.lookupMode === "ymm" ? state.ymm.model : "",
  };
}

export interface MotoOfferResult {
  estimate: OfferEstimate | null;
  firm: number | null;
  /** "firm" only when the dealer opted in AND a firm % is configured. */
  mode: OfferMode;
  /** Token used to address the submission record from later steps. */
  submissionToken: string;
  submissionId: string | null;
}

/**
 * Load the dealer's pricing_reveal_mode for this rooftop. Soft-fails
 * to 'contact_first' if offer_settings is unavailable.
 */
export async function loadPricingRevealMode(
  dealershipId: string,
): Promise<"price_first" | "range_then_price" | "contact_first"> {
  try {
    const { data } = await supabase
      .from("offer_settings")
      .select("pricing_reveal_mode")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    const mode = (data as { pricing_reveal_mode?: string } | null)?.pricing_reveal_mode;
    if (mode === "price_first" || mode === "range_then_price" || mode === "contact_first") {
      return mode;
    }
  } catch (e) {
    console.warn("[moto] loadPricingRevealMode failed:", e);
  }
  return "contact_first";
}

/**
 * Run the offer math and persist a submissions row. Resolves with the
 * raw estimate, the firm offer (if the dealer enabled auto-firm), and
 * the token we'll need for scheduling / photo upload.
 */
export async function calculateAndPersistOffer(
  state: MotoFlowState,
  dealershipId: string,
  dealershipName?: string,
): Promise<MotoOfferResult> {
  const fd = motoStateToFormData(state);
  const bb = state.bbVehicle;

  let settings: OfferSettings | null = null;
  let autoFirmPct: number | null = null;
  let mode: OfferMode = "estimate";
  try {
    const { data } = await supabase
      .from("offer_settings")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (data) {
      settings = data as unknown as OfferSettings;
      autoFirmPct = (data as { auto_firm_offer_pct?: number | null }).auto_firm_offer_pct ?? null;
      mode = resolveOfferMode(
        data as { firm_offer_enabled?: boolean | null; auto_firm_offer_pct?: number | null },
      );
    }
  } catch (e) {
    console.warn("offer_settings load failed (fallback to defaults):", e);
  }

  const estimate = calculateOffer(bb, fd, [], settings);
  const firm =
    autoFirmPct != null && estimate?.high
      ? Math.round(estimate.high * autoFirmPct)
      : estimate?.low ?? null;

  const token = crypto.randomUUID();
  const bbPayload = buildSubmissionBBPayload(bb);

  const baseRow: Record<string, unknown> = {
    token,
    plate: fd.plate || null,
    state: fd.state || null,
    vin: bb?.vin || null,
    mileage: fd.mileage || null,
    vehicle_year: bb?.year || null,
    vehicle_make: bb?.make || null,
    vehicle_model: bb?.model || null,
    overall_condition: fd.overallCondition,
    loan_status: fd.loanStatus || null,
    name: fd.name || null,
    email: fd.email || null,
    phone: fd.phone.replace(/\D/g, "") || null,
    next_step: fd.nextStep,
    lead_source: "moto_sell_flow",
    dealership_id: dealershipId,
    ...bbPayload,
  };
  const optionalRow: Record<string, unknown> = {
    estimated_offer_low: estimate?.low ?? null,
    estimated_offer_high: estimate?.high ?? null,
    offered_price: firm,
  };

  let submissionId: string | null = null;
  try {
    let res = await supabase
      .from("submissions")
      .insert({ ...baseRow, ...optionalRow } as never)
      .select("id")
      .maybeSingle();
    if (res.error) {
      const msg = (res.error.message || "").toLowerCase();
      const looksMissing =
        res.error.code === "PGRST204" ||
        msg.includes("schema cache") ||
        (msg.includes("column") && msg.includes("does not exist"));
      if (looksMissing) {
        console.warn("[moto] retrying insert without optional columns:", res.error.message);
        res = await supabase
          .from("submissions")
          .insert(baseRow as never)
          .select("id")
          .maybeSingle();
      }
    }
    if (res.error) throw res.error;
    submissionId = (res.data as { id?: string } | null)?.id ?? null;
  } catch (e) {
    console.error("[moto] submission insert failed:", e);
    throw e;
  }

  // Record TCPA (and, when a loan is reported, payoff-authorization) consent
  // tied to this submission token, so the dealership has provable, versioned
  // proof of opt-in for every lead this flow produces. Only logged once the
  // customer has actually provided contact info (phone or email) — i.e. the
  // moment they submit the form with the consent disclosure shown. The
  // offer-before-details path persists the row before contact exists; that
  // call is intentionally skipped here and consent is logged when contact is
  // submitted later. Fire-and-forget.
  const consentPhone = fd.phone.replace(/\D/g, "");
  if (consentPhone || fd.email) {
    void logConsent({
      customerName: fd.name || undefined,
      customerPhone: consentPhone || undefined,
      customerEmail: fd.email || undefined,
      formSource: fd.nextStep === "trade" ? "moto_trade_flow" : "moto_sell_flow",
      submissionToken: token,
      dealershipName,
      loanStatus: fd.loanStatus || null,
    });
  }

  return { estimate, firm, mode, submissionToken: token, submissionId };
}
