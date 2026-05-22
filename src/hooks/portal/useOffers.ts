// useOffers — current firm offer + bump history for OffersPage.
//
// Composes useSubmissionPortal (for the current offer + expiry +
// dealer + vehicle) with a token-scoped read of `offer_bumps`
// (for the history timeline). Returns a shape that mirrors what
// the page already consumes from PORTAL_MOCK so the swap is
// mechanical.
//
// offer_bumps is dealer-side written (when an inspector adjusts the
// offer or an approval re-prices), keyed by submission_id +
// dealership_id. Each row carries previous_offer + new_offer +
// bump_amount + line_items (json explaining the adjustment). The
// page uses the rows to draw the "offer evolved" timeline and to
// label the BREAKDOWN deltas with real values.
//
// Caching: staleTime 30s + refetch on focus. Offers shift more often
// than the submission row (a dealer can re-price multiple times in a
// day) so the window is shorter than useSubmissionPortal's 60s.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_MOCK } from "@/components/portal/portalMock";
import { usePortalToken } from "@/contexts/PortalTokenContext";
import {
  useSubmissionPortal,
  type PortalSubmissionData,
} from "./useSubmissionPortal";
import type { DataStatus } from "@/components/portal/PortalDataBoundary";

export interface OfferBumpRow {
  id: string;
  previousOffer: number;
  newOffer: number;
  bumpAmount: number;
  source: string;
  createdAt: string;
  lineItems: unknown;
}

export interface OffersData {
  /** Current firm offer (null until issued). */
  firmOffer: number | null;
  /** Estimated value range. */
  range: { low: number; high: number };
  /** Formatted offer expiry (e.g., "May 17, 2025"). */
  offerExpires: string | null;
  /** ISO timestamp the offer was locked, or null. */
  offerLockedAt: string | null;
  /** Dealer the offer is from. */
  dealer: string;
  /** Vehicle YMM string for the page header. */
  vehicleLabel: string;
  /** All offer adjustments, newest first. Empty array when no bumps. */
  history: OfferBumpRow[];
}

interface RawBump {
  id: string;
  previous_offer: number;
  new_offer: number;
  bump_amount: number;
  source: string;
  created_at: string;
  line_items: unknown;
}

const STALE_30S = 30_000;

function mockOffers(): OffersData {
  const m = PORTAL_MOCK;
  return {
    firmOffer: m.firmOffer,
    range: { ...m.range },
    offerExpires: m.offerExpires,
    offerLockedAt: null,
    dealer: m.customer.dealer,
    vehicleLabel: `${m.vehicle.year} ${m.vehicle.make} ${m.vehicle.model} ${m.vehicle.trim ?? ""}`.trim(),
    // No mock bumps today — the page renders a static BREAKDOWN
    // constant for the demo. Real bumps populate the timeline once
    // wired.
    history: [],
  };
}

function buildOffers(
  submission: PortalSubmissionData,
  rawBumps: RawBump[],
): OffersData {
  return {
    firmOffer: submission.firmOffer,
    range: submission.range,
    offerExpires: submission.offerExpires,
    offerLockedAt: submission.offerLockedAt,
    dealer: submission.customer.dealer,
    vehicleLabel:
      `${submission.vehicle.year} ${submission.vehicle.make} ${submission.vehicle.model}${
        submission.vehicle.trim ? ` ${submission.vehicle.trim}` : ""
      }`.trim(),
    history: rawBumps.map((b) => ({
      id: b.id,
      previousOffer: Number(b.previous_offer ?? 0),
      newOffer: Number(b.new_offer ?? 0),
      bumpAmount: Number(b.bump_amount ?? 0),
      source: b.source,
      createdAt: b.created_at,
      lineItems: b.line_items,
    })),
  };
}

interface UseOffersResult {
  data: OffersData | null;
  status: DataStatus;
  error: Error | null;
  isDemo: boolean;
  refetch: () => void;
}

export function useOffers(): UseOffersResult {
  const { token, isDemo } = usePortalToken();
  const submission = useSubmissionPortal();

  // We need the submission_id to filter offer_bumps. Until the
  // submission query has resolved, the bumps query is disabled.
  const submissionId = submission.data?.raw.submissionId ?? null;
  const enabled = !isDemo && !!submissionId;

  const bumpsQuery = useQuery({
    queryKey: ["portal", token ?? "demo", "offers", "bumps", submissionId],
    enabled,
    staleTime: STALE_30S,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<RawBump[]> => {
      if (!submissionId) return [];
      const { data, error } = await supabase
        .from("offer_bumps")
        .select("id, previous_offer, new_offer, bump_amount, source, created_at, line_items")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as RawBump[] | null) ?? [];
    },
  });

  // Roll up status — the submission query is the gate; the bumps
  // query is supplementary. If the submission errors, surface that.
  // If the submission is loading, the page is loading. If the bumps
  // query is loading on first paint but the submission resolved,
  // we still show the page (history shows up when ready).
  let status: DataStatus;
  let error: Error | null = null;
  let data: OffersData | null = null;

  if (isDemo) {
    status = "ready";
    data = mockOffers();
  } else if (submission.status === "loading") {
    status = "loading";
  } else if (submission.status === "error") {
    status = "error";
    error = submission.error;
  } else if (submission.data) {
    status = "ready";
    data = buildOffers(submission.data, bumpsQuery.data ?? []);
  } else {
    status = "loading";
  }

  return {
    data,
    status,
    error,
    isDemo,
    refetch: () => {
      submission.refetch();
      void bumpsQuery.refetch();
    },
  };
}
