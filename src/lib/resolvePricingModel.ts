import { supabase } from "@/integrations/supabase/client";
import type { OfferSettings, OfferRule } from "@/lib/offerCalculator";
import { DEFAULT_LOW_MILEAGE_BONUS, DEFAULT_HIGH_MILEAGE_PENALTY, DEFAULT_COLOR_DESIRABILITY, DEFAULT_SEASONAL_ADJUSTMENT, DEFAULT_DEDUCTION_MODES } from "@/lib/offerCalculator";

/**
 * Resolves the effective pricing settings by checking active pricing models first,
 * then falling back to the default offer_settings table.
 *
 * Resolution order:
 * 1. Scheduled models — is_active, today is within schedule_start/schedule_end, highest priority
 * 2. Default model — is_active, is_default = true
 * 3. Fallback — offer_settings table (legacy)
 */
export async function resolveEffectiveSettings(
  dealershipId = "default"
): Promise<{ settings: OfferSettings | null; rules: OfferRule[]; source: string }> {
  // Fetch pricing models + rules + fallback settings in parallel
  const [modelsRes, rulesRes, fallbackRes] = await Promise.all([
    supabase
      .from("pricing_models" as any)
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true)
      .order("priority", { ascending: false }),
    supabase
      .from("offer_rules" as any)
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true),
    supabase
      .from("offer_settings" as any)
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle(),
  ]);

  const rules: OfferRule[] = (rulesRes.data as unknown as OfferRule[]) || [];
  const models = (modelsRes.data as any[]) || [];

  if (models.length > 0) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Check for a scheduled model active today (highest priority first)
    const scheduled = models.find(
      (m) =>
        m.schedule_start &&
        m.schedule_end &&
        today >= m.schedule_start &&
        today <= m.schedule_end
    );

    if (scheduled) {
      return { settings: modelToSettings(scheduled), rules, source: `model:${scheduled.name}` };
    }

    // 2. Check for the default model
    const defaultModel = models.find((m) => m.is_default);
    if (defaultModel) {
      return { settings: modelToSettings(defaultModel), rules, source: `model:${defaultModel.name}` };
    }

    // 3. Use highest-priority active model
    return { settings: modelToSettings(models[0]), rules, source: `model:${models[0].name}` };
  }

  // 4. Fallback to offer_settings table
  const fallback = fallbackRes.data
    ? (fallbackRes.data as unknown as OfferSettings)
    : null;

  return { settings: fallback, rules, source: "offer_settings" };
}

/** Map a pricing_models row to the OfferSettings shape used by the calculator */
function modelToSettings(model: any): OfferSettings {
  return {
    bb_value_basis: model.bb_value_basis || "tradein_avg",
    global_adjustment_pct: model.global_adjustment_pct || 0,
    deductions_config: model.deductions_config || {},
    deduction_amounts: model.deduction_amounts || {},
    condition_multipliers: model.condition_multipliers || {},
    condition_basis_map: model.condition_basis_map || {
      excellent: "retail_xclean",
      very_good: "tradein_clean",
      good: "tradein_avg",
      fair: "wholesale_rough",
    },
    condition_equipment_map: model.condition_equipment_map || {
      excellent: true,
      very_good: true,
      good: true,
      fair: true,
    },
    recon_cost: model.recon_cost || 0,
    offer_floor: model.offer_floor || 500,
    offer_ceiling: model.offer_ceiling ?? null,
    age_tiers: model.age_tiers || [],
    mileage_tiers: model.mileage_tiers || [],
    regional_adjustment_pct: model.regional_adjustment_pct || 0,
    low_mileage_bonus: model.low_mileage_bonus || DEFAULT_LOW_MILEAGE_BONUS,
    high_mileage_penalty: model.high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY,
    color_desirability: model.color_desirability || DEFAULT_COLOR_DESIRABILITY,
    seasonal_adjustment: model.seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT,
    deduction_modes: model.deduction_modes || DEFAULT_DEDUCTION_MODES,
  };
}
