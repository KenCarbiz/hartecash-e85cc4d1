import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OfferBumpLineItem, OfferBumpRow } from "@/types/offerBumps";

/**
 * Fetch the most recent offer_bumps row for a submission. Used by
 * the customer file in two places:
 *
 *   - V2Identity (blue header strip): renders the "Photos verified
 *     +$X" pill alongside the dollar amount so the dealer sees at
 *     a glance that the customer engaged with the photo flow and
 *     earned the bump.
 *
 *   - ContextRail Offer Breakdown card: populates the line items
 *     so the appraiser can see WHY the offer moved — defensible
 *     audit output, not a magic-box gimmick.
 *
 * Soft-fails to null on any error (pending migration, network) so
 * the customer file stays usable while infra catches up. Logs only
 * unexpected errors — schema-cache misses are silent.
 */
export function useLatestOfferBump(submissionId: string | null | undefined) {
  const [bump, setBump] = useState<OfferBumpRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!submissionId) {
      setBump(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("offer_bumps" as never)
        .select("id, submission_id, dealership_id, previous_offer, new_offer, bump_amount, line_items, source, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
          console.warn("[useLatestOfferBump] fetch failed:", error.message);
        }
        setBump(null);
        setLoading(false);
        return;
      }
      if (data) {
        // line_items comes back as Json; runtime-validate at the
        // boundary so downstream consumers can trust the shape.
        const rawItems = (data as unknown as { line_items?: unknown }).line_items;
        const items: OfferBumpLineItem[] = Array.isArray(rawItems)
          ? (rawItems as OfferBumpLineItem[]).filter(
              (i) => i && typeof i.label === "string" && typeof i.amount === "number",
            )
          : [];
        setBump({ ...(data as unknown as OfferBumpRow), line_items: items });
      } else {
        setBump(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  return { bump, loading };
}
