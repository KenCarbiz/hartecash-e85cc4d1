import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ObjectionCategory =
  | "price" | "trust" | "process" | "competitor" | "logistics" | "timing";

export interface ProofPoint {
  label: string;
  description: string;
}

export interface ObjectionFiresOn {
  decline_reasons?: string[];
  competitors?: string[];
}

export interface ObjectionCard {
  id: string;
  dealership_id: string;
  objection_key: string;
  category: ObjectionCategory;
  label: string;
  customer_signals: string[];
  customer_concern: string;
  dealer_reframe: string;
  proof_points: ProofPoint[];
  escalation_path: string | null;
  voice_ai_snippet: string | null;
  fires_on: ObjectionFiresOn;
  sort_order: number;
  is_active: boolean;
}

/**
 * useObjectionPlaybook — fetches the dealer's objection-handling
 * cards (with the network defaults appended for any objection_key
 * the dealer hasn't customized yet).
 *
 * Also exposes `findCardForLead({ declined_reason, competitor })` —
 * the helper the customer-file overlay uses to surface the right
 * card based on the lead's state, without making the slide-out
 * re-derive the matching logic.
 */
export const useObjectionPlaybook = (dealershipId: string = "default") => {
  const [cards, setCards] = useState<ObjectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Pull the dealer's overrides first; fall back to default.
      const tenantQ = supabase
        .from("objection_playbook" as never)
        .select("*")
        .eq("dealership_id", dealershipId)
        .eq("is_active", true)
        .order("sort_order");

      const defaultQ = supabase
        .from("objection_playbook" as never)
        .select("*")
        .eq("dealership_id", "default")
        .eq("is_active", true)
        .order("sort_order");

      const [t, d] = await Promise.all([tenantQ, defaultQ]);
      if (cancelled) return;

      if (t.error || d.error) {
        const msg = (t.error?.message || d.error?.message || "").toLowerCase();
        if (msg.includes("does not exist") || msg.includes("schema cache")) {
          setMissing(true);
          setLoading(false);
          return;
        }
      }

      // Tenant overrides win on objection_key collisions; defaults fill gaps.
      const byKey = new Map<string, ObjectionCard>();
      const defaults = (d.data as unknown as ObjectionCard[]) || [];
      const tenant   = (t.data as unknown as ObjectionCard[]) || [];
      for (const c of defaults) byKey.set(c.objection_key, c);
      for (const c of tenant)   byKey.set(c.objection_key, c);
      const merged = Array.from(byKey.values()).sort((a, b) => a.sort_order - b.sort_order);
      setCards(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealershipId]);

  /** Find the most relevant card for a lead's state. Returns null
   *  if nothing matches. Order:
   *  1. Exact decline_reason match (most specific)
   *  2. Competitor match (looser — substring on competitor_mentioned)
   *  3. Null
   */
  const findCardForLead = (signals: {
    declined_reason?: string | null;
    competitor?: string | null;
  }): ObjectionCard | null => {
    const reason = (signals.declined_reason || "").toLowerCase().trim();
    const comp   = (signals.competitor || "").toLowerCase().trim();

    if (reason) {
      const byReason = cards.find((c) =>
        (c.fires_on.decline_reasons || []).some((r) => r.toLowerCase() === reason),
      );
      if (byReason) return byReason;
    }
    if (comp) {
      const byCompetitor = cards.find((c) =>
        (c.fires_on.competitors || []).some((cm) => comp.includes(cm.toLowerCase())),
      );
      if (byCompetitor) return byCompetitor;
    }
    return null;
  };

  return { cards, loading, missing, findCardForLead };
};
