import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { OfferBumpLineItem, OfferBumpRow } from "@/types/offerBumps";

/**
 * Headline offer card for the customer file. Synthesized from a
 * three-agent review (design / architecture / brand identity).
 *
 * Brand-lens decision: the dealer admin never sees "AI Boost"
 * vocabulary. That phrasing belongs on the customer-facing receipt
 * where the customer feels they "won" something. Here the same
 * event is framed as a "condition adjustment from photo review" —
 * appraiser-native language that vAuto-trained users recognize as
 * defensible audit output, not a magic-box gimmick.
 *
 * Design-lens decision: slate type for the dollar delta, no
 * sparkles, no animated rings. The single celebratory mark is a
 * small emerald "Photos verified" pill on the right — it earns its
 * color by signaling customer engagement (they completed the
 * photo flow), not by hyping the AI feature.
 *
 * Architecture-lens decision: eager fetch of the most recent
 * offer_bumps row on mount. Single round-trip, ~500 bytes payload.
 * No denormalized flag on submissions — single source of truth
 * stays in the audit table. React Query key namespaced under
 * 'offer-bumps' for future invalidation.
 */

interface Props {
  submissionId: string;
  /** Pre-computed effective offer (offered_price ?? estimated_offer_high
   *  ?? bb_tradein_avg ?? bb_wholesale_avg) — passed in so the card
   *  can render instantly without waiting on the offer_bumps fetch.
   *  null/0 = no offer captured yet. */
  effectiveOffer: number | null;
}

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const CustomerFileOfferCard = ({ submissionId, effectiveOffer }: Props) => {
  const [bump, setBump] = useState<OfferBumpRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Most recent bump row for this submission — limit 1 since
      // the customer file only needs the latest. Older rows are
      // still in the audit trail for analytics if we ever want to
      // expose a history view.
      const { data, error } = await supabase
        .from("offer_bumps" as never)
        .select("id, submission_id, dealership_id, previous_offer, new_offer, bump_amount, line_items, source, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Pending migration → don't crash the customer file. Just
        // hide the boost-aware path; the headline number still
        // renders from effectiveOffer.
        const msg = error.message?.toLowerCase() || "";
        if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
          console.warn("[CustomerFileOfferCard] offer_bumps fetch failed:", error.message);
        }
        setLoading(false);
        return;
      }
      if (data) {
        // line_items comes back as Json from Supabase generated
        // types; runtime-validate at the boundary, then trust the
        // shape downstream. Falls through to [] on any malformed
        // payload so the card still renders.
        const rawItems = (data as unknown as { line_items?: unknown }).line_items;
        const items: OfferBumpLineItem[] = Array.isArray(rawItems)
          ? (rawItems as OfferBumpLineItem[]).filter(
              (i) => i && typeof i.label === "string" && typeof i.amount === "number",
            )
          : [];
        setBump({ ...(data as unknown as OfferBumpRow), line_items: items });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  // Empty state — no offer captured yet. Single-line ghost row,
  // no full hero footprint. Design-lens recommendation.
  if (!effectiveOffer || effectiveOffer <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3.5 py-2.5 mb-3 text-[12px] text-slate-500 italic">
        No offer captured yet.
      </div>
    );
  }

  const hasBump = !loading && bump && bump.bump_amount > 0;
  const previousOffer = hasBump ? bump.previous_offer : null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1">
            Current offer
          </p>
          <p className="text-[28px] font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
            {fmtMoney(effectiveOffer)}
          </p>
          {hasBump && (
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              Includes{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {fmtMoney(bump.bump_amount)}
              </span>{" "}
              condition adjustment from photo review.
            </p>
          )}
        </div>
        {hasBump && (
          // Single emerald accent on the page — earns its color by
          // signaling customer engagement (they completed the photo
          // flow), not AI cleverness. The number itself stays slate.
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-[0.12em] flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M5 1.5L8 5H6V8H4V5H2L5 1.5Z" />
            </svg>
            Photos verified
          </span>
        )}
      </div>

      {hasBump && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                Hide details <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                View details <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              {previousOffer != null && previousOffer > 0 && (
                <div className="flex items-center justify-between text-[11.5px] text-slate-500">
                  <span>Original offer</span>
                  <span className="tabular-nums">{fmtMoney(previousOffer)}</span>
                </div>
              )}
              {bump.line_items.length > 0 ? (
                bump.line_items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-[11.5px]">
                    <span className="text-slate-700 dark:text-slate-300 leading-snug min-w-0">
                      {item.label}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums flex-shrink-0">
                      +{fmtMoney(item.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  No line items recorded for this adjustment.
                </p>
              )}
              <div className="flex items-center justify-between text-[12px] font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <span>Final offer</span>
                <span className="tabular-nums">{fmtMoney(bump.new_offer)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerFileOfferCard;
