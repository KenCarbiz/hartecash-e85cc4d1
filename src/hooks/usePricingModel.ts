import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Architecture keys — mirrors what the onboarding picker passes in and
 * what the super-admin Pricing Model Manager writes to the DB.
 */
export type PricingArchitecture =
  | "single_store"
  | "single_store_secondary"
  | "multi_location"
  | "dealer_group"
  | "enterprise";

interface PricePair {
  /** Per-store monthly billing price. */
  monthly?: number;
  /**
   * Per-store, per-month-equivalent rate when billed annually prepaid.
   * This is what the Super-Admin Pricing Model page stores and edits.
   * Callers that need the full 12-month upfront amount multiply by 12.
   */
  annual?: number;
}
type ArchPricing = Partial<Record<PricingArchitecture, PricePair>>;

interface PricingModelRow {
  id: "global";
  annual_discount_pct: number;
  tier_overrides: Record<string, ArchPricing>;
  bundle_overrides: Record<string, ArchPricing>;
}

export interface PricingModelLookup {
  /** True while the row is loading on first render. */
  loading: boolean;
  /** Raw row — exposed for advanced consumers. Null until loaded. */
  row: PricingModelRow | null;
  /** The platform-wide default discount %. Defaults to 15 when missing. */
  annualDiscountPct: number;
  /**
   * Per-tier price override for the given architecture. Returns the
   * { monthly, annual } pair (annual = per-month-equivalent prepaid).
   * `null` if no override is configured — caller should fall back.
   */
  getTierOverride: (
    tierId: string,
    architecture: PricingArchitecture | string | undefined,
  ) => PricePair | null;
  /** Same as getTierOverride but for bundles. */
  getBundleOverride: (
    bundleId: string,
    architecture: PricingArchitecture | string | undefined,
  ) => PricePair | null;
}

/**
 * Loads the singleton `platform_pricing_model` row (the super-admin
 * pricing configuration) once and exposes typed lookup helpers. The
 * dealer-facing pricing picker calls this to apply admin-configured
 * prices on top of the catalog + static architecture overrides.
 *
 * Graceful: if the table/row doesn't exist (e.g. in an env that hasn't
 * run the migration yet), the hook returns an empty model and callers
 * fall back to the static pricing layer without blowing up.
 */
export function usePricingModel(): PricingModelLookup {
  const [row, setRow] = useState<PricingModelRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("platform_pricing_model" as never)
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setRow(null);
        setLoading(false);
        return;
      }
      const raw = data as unknown as PricingModelRow;
      setRow({
        id: "global",
        annual_discount_pct: Number(raw.annual_discount_pct ?? 15),
        tier_overrides: (raw.tier_overrides ?? {}) as Record<string, ArchPricing>,
        bundle_overrides: (raw.bundle_overrides ?? {}) as Record<string, ArchPricing>,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const annualDiscountPct = row?.annual_discount_pct ?? 15;

  const getTierOverride = (
    tierId: string,
    architecture: PricingArchitecture | string | undefined,
  ): PricePair | null => {
    if (!row || !architecture) return null;
    const entry = row.tier_overrides[tierId];
    if (!entry) return null;
    const arch = architecture as PricingArchitecture;
    const pair = entry[arch];
    if (!pair || (pair.monthly == null && pair.annual == null)) return null;
    return pair;
  };

  const getBundleOverride = (
    bundleId: string,
    architecture: PricingArchitecture | string | undefined,
  ): PricePair | null => {
    if (!row || !architecture) return null;
    const entry = row.bundle_overrides[bundleId];
    if (!entry) return null;
    const arch = architecture as PricingArchitecture;
    const pair = entry[arch];
    if (!pair || (pair.monthly == null && pair.annual == null)) return null;
    return pair;
  };

  return { loading, row, annualDiscountPct, getTierOverride, getBundleOverride };
}
