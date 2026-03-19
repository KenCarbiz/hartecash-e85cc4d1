import type { FormData, BBVehicle } from "@/components/sell-form/types";

export interface OfferEstimate {
  low: number;
  high: number;
  baseValue: number;
  totalDeductions: number;
}

/**
 * Calculate an instant offer range from Black Book trade-in average
 * adjusted for customer-reported condition issues.
 *
 * Formula:
 *   base = BB trade-in avg × condition multiplier
 *   deductions = sum of issue-based dollar amounts
 *   high = base − deductions
 *   low  = high × 0.90  (10% cushion for in-person inspection)
 */
export function calculateOffer(
  bbVehicle: BBVehicle | null,
  formData: FormData,
  selectedAddDeducts: string[]
): OfferEstimate | null {
  if (!bbVehicle) return null;

  const tradeinAvg = bbVehicle.tradein?.avg || 0;
  if (tradeinAvg <= 0) return null;

  // 1. Condition multiplier
  const conditionMultipliers: Record<string, number> = {
    excellent: 1.05,
    good: 1.0,
    fair: 0.90,
    rough: 0.78,
  };
  const condMult = conditionMultipliers[formData.overallCondition] ?? 1.0;

  let base = tradeinAvg * condMult;

  // 2. Apply selected add/deduct adjustments from BB equipment list
  for (const ad of bbVehicle.add_deduct_list) {
    if (selectedAddDeducts.includes(ad.uoc)) {
      // Use the avg adjustment value (can be positive or negative)
      base += ad.avg || 0;
    }
  }

  // 3. Condition-based deductions
  let deductions = 0;

  // Accidents
  if (formData.accidents === "1") deductions += 800;
  else if (formData.accidents === "2") deductions += 1800;
  else if (formData.accidents === "3+") deductions += 3000;

  // Exterior damage (per item, excluding "none")
  const extDamageItems = formData.exteriorDamage.filter((d) => d !== "none");
  deductions += extDamageItems.length * 300;

  // Interior damage
  const intDamageItems = formData.interiorDamage.filter((d) => d !== "none");
  deductions += intDamageItems.length * 200;

  // Windshield damage
  if (formData.windshieldDamage === "cracked") deductions += 400;
  else if (formData.windshieldDamage === "chipped") deductions += 150;

  // Engine issues
  const engineItems = formData.engineIssues.filter((d) => d !== "none");
  deductions += engineItems.length * 500;

  // Mechanical issues
  const mechItems = formData.mechanicalIssues.filter((d) => d !== "none");
  deductions += mechItems.length * 350;

  // Tech issues
  const techItems = formData.techIssues.filter((d) => d !== "none");
  deductions += techItems.length * 150;

  // Not drivable
  if (formData.drivable === "no") deductions += 1500;

  // Smoked in
  if (formData.smokedIn === "yes") deductions += 500;

  // Tires
  if (formData.tiresReplaced === "no") deductions += 400;

  // Keys (less than 2)
  if (formData.numKeys === "1") deductions += 200;
  else if (formData.numKeys === "0") deductions += 400;

  const high = Math.max(Math.round(base - deductions), 500);
  const low = Math.max(Math.round(high * 0.90), 500);

  return {
    low,
    high,
    baseValue: Math.round(tradeinAvg),
    totalDeductions: Math.round(deductions),
  };
}
