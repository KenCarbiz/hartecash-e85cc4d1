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
 * the customer file stays usable while infra catches up. Returns
 * a `status` discriminator so callers can distinguish:
 *   - "missing"     — offer_bumps table doesn't exist yet
 *                     (apply migration 20260506180000_offer_bumps_audit.sql)
 *   - "denied"      — RLS blocked the read (the dealer's session
 *                     isn't in dealership_users for this rooftop)
 *   - "no_row"      — table exists but no boost has happened for
 *                     this submission yet (the most common state)
 *   - "ok"          — bump found and parsed
 *   - "loading"     — still fetching
 * The customer file uses this to render the right empty state and
 * to surface a diagnostic note to the dealer when something is
 * obviously misconfigured.
 *
 * Console logs every state change so a dealer reporting "the offer
 * isn't showing" can be told to open devtools and read off the
 * status — saves a lot of guessing.
 */

export type OfferBumpStatus = "loading" | "ok" | "no_row" | "missing" | "denied" | "error";

export function useLatestOfferBump(submissionId: string | null | undefined) {
  const [bump, setBump] = useState<OfferBumpRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OfferBumpStatus>("loading");

  useEffect(() => {
    if (!submissionId) {
      setBump(null);
      setLoading(false);
      setStatus("no_row");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus("loading");
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
        let next: OfferBumpStatus = "error";
        if (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("relation")) {
          next = "missing";
        } else if (msg.includes("permission") || msg.includes("rls") || msg.includes("policy")) {
          next = "denied";
        }
        // Log every error path so we can diagnose missing data
        // from a console paste instead of a flight back and forth.
        console.warn(`[useLatestOfferBump] submission=${submissionId} status=${next}: ${error.message}`);
        setBump(null);
        setStatus(next);
        setLoading(false);
        return;
      }
      if (data) {
        const rawItems = (data as unknown as { line_items?: unknown }).line_items;
        const items: OfferBumpLineItem[] = Array.isArray(rawItems)
          ? (rawItems as OfferBumpLineItem[]).filter(
              (i) => i && typeof i.label === "string" && typeof i.amount === "number",
            )
          : [];
        const row = { ...(data as unknown as OfferBumpRow), line_items: items };
        console.info(
          `[useLatestOfferBump] submission=${submissionId} status=ok bump=$${row.bump_amount} new=$${row.new_offer} items=${items.length}`,
        );
        setBump(row);
        setStatus("ok");
      } else {
        console.info(`[useLatestOfferBump] submission=${submissionId} status=no_row (no boost applied yet)`);
        setBump(null);
        setStatus("no_row");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  return { bump, loading, status };
}
