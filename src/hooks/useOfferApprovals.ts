import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OfferApprovalStatus =
  | "pending" | "approved" | "denied" | "auto_approved" | "withdrawn";
export type OfferApprovalReason =
  | "customer_pushback" | "competitor_match" | "market_movement" | "goodwill" | "other";

export interface OfferApprovalRequest {
  id: string;
  submission_id: string;
  dealership_id: string;
  current_offer: number | null;
  requested_offer: number;
  acv_value_at_request: number | null;
  delta: number;
  acv_breach: number;
  reason: OfferApprovalReason;
  reason_notes: string | null;
  requested_by: string | null;
  requested_by_role: string | null;
  requested_at: string;
  status: OfferApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  applied_at: string | null;
}

/**
 * Pending offer-approval requests for the current dealership.
 * Used by the Manager Dispatch tab to show what's waiting on a
 * decision and by the customer-file slide-out to render an inline
 * "needs approval" pill when a request is open on this submission.
 *
 * Soft-falls-back to empty when the migration hasn't applied so
 * the UI stays usable while infra catches up.
 */
export const useOfferApprovals = (
  dealershipId: string | null | undefined,
  filter?: { submissionId?: string; status?: OfferApprovalStatus | "open" },
) => {
  const [requests, setRequests] = useState<OfferApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const refetch = async () => {
    if (!dealershipId) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("offer_approval_requests" as never)
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("requested_at", { ascending: false });
    if (filter?.submissionId) q = q.eq("submission_id", filter.submissionId);
    if (filter?.status === "open") q = q.eq("status", "pending");
    else if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        setMissing(true);
        setLoading(false);
        return;
      }
    }
    setRequests((data as unknown as OfferApprovalRequest[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await refetch(); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealershipId, filter?.submissionId, filter?.status]);

  const requestIncrease = async (args: {
    submissionId: string;
    requestedOffer: number;
    reason?: OfferApprovalReason;
    reasonNotes?: string;
    requestedByRole?: string;
  }) => {
    const { data, error } = await supabase.rpc(
      "request_offer_increase",
      {
        _submission_id: args.submissionId,
        _requested_offer: args.requestedOffer,
        _reason: args.reason || "other",
        _reason_notes: args.reasonNotes || null,
        _requested_by_role: args.requestedByRole || null,
      } as never,
    );
    if (error) throw error;
    await refetch();
    return data as { ok: boolean; request_id: string; status: OfferApprovalStatus; auto_approved: boolean };
  };

  const decideRequest = async (
    requestId: string,
    decision: "approved" | "denied",
    notes?: string,
  ) => {
    const { data, error } = await supabase.rpc(
      "decide_offer_request",
      { _request_id: requestId, _decision: decision, _decision_notes: notes || null } as never,
    );
    if (error) throw error;
    await refetch();
    return data as { ok: boolean; request_id: string; status: string; applied: boolean };
  };

  return { requests, loading, missing, refetch, requestIncrease, decideRequest };
};
