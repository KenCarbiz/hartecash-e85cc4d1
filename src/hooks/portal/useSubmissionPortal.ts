// useSubmissionPortal — root data hook for the customer portal.
//
// Reads the customer's submission via the `get_submission_portal` RPC
// + joins the dealer-side metadata (dealer_name, pickup_enabled,
// drop-off enabled) from `dealership_locations`. Returns the unified
// shape every portal page consumes.
//
// Demo / preview behavior:
//   * When `token === null` (the /portal-preview route) the hook
//     resolves to PORTAL_MOCK so the preview keeps working without
//     hitting Supabase.
//   * When `token !== null` the hook fires the real RPC. If the token
//     is invalid/expired, `status === "error"` and `error.message`
//     surfaces "Submission not found."
//
// Caching:
//   * staleTime 60s — submission row barely changes after offer is
//     issued. Refetch on window focus so a returning visitor sees
//     fresh state.
//   * Query key `["portal", token, "submission"]` — token-scoped so
//     a stale cached entry never leaks across customers.
//
// This is the first of ~11 hooks under src/hooks/portal/. Other
// hooks (useOffers, useActivityFeed, useDealerMessages, etc.) follow
// the same pattern: return { data, status, error, refetch } with
// MOCK behind the `if (!token)` branch.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_MOCK } from "@/components/portal/portalMock";
import { usePortalToken } from "@/contexts/PortalTokenContext";
import type { DataStatus } from "@/components/portal/PortalDataBoundary";

// ────────────────────────────────────────────────────────────────
// Shape returned to pages. Designed to match PORTAL_MOCK's top-level
// keys so existing page code can swap `MOCK` → `data` with minimal
// edits.
// ────────────────────────────────────────────────────────────────

export interface PortalCustomer {
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  dealer: string;
  email: string | null;
  phone: string | null;
}

export interface PortalVehicle {
  year: string | number;
  make: string;
  model: string;
  trim: string | null;
  miles: string;
  engine: string | null;
  body: string | null;
  drivetrain: string | null;
  exterior: string | null;
  interior: string | null;
  vin: string;
  ownership: string;
  payoff: number;
}

export interface PortalRange {
  low: number;
  high: number;
}

export interface PortalDealerCapabilities {
  pickupEnabled: boolean;
  dropoffEnabled: boolean;
  remoteInspection: boolean;
}

export type TransactionStage =
  | "pre_schedule"
  | "scheduled"
  | "driver_assigned"
  | "in_transit"
  | "complete";

export interface PortalSubmissionData {
  customer: PortalCustomer;
  dealerCapabilities: PortalDealerCapabilities;
  transactionStage: TransactionStage;
  vehicle: PortalVehicle;
  range: PortalRange;
  firmOffer: number | null;
  offerExpires: string | null; // formatted "MMMM d, yyyy"
  offerLockedAt: string | null; // ISO
  // Returned raw so pages can derive timestamps without re-querying.
  raw: {
    submissionId: string;
    token: string;
    dealershipId: string | null;
    state: string | null;
    progressStatus: string;
    photosUploaded: boolean;
    docsUploaded: boolean;
    appointmentSet: boolean;
    portalViewCount: number;
    createdAt: string;
    inspectionStartedNotifiedAt: string | null;
    checkReadyAt: string | null;
  };
}

interface RpcRow {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mileage: string | null;
  exterior_color: string | null;
  overall_condition: string | null;
  progress_status: string;
  offered_price: number | null;
  acv_value: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  created_at: string;
  loan_status: string | null;
  token: string;
  vin: string | null;
  zip: string | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  bb_tradein_avg: number | null;
  appointment_set: boolean;
  brake_lf: number | null; brake_rf: number | null;
  brake_lr: number | null; brake_rr: number | null;
  tire_lf: number | null;  tire_rf: number | null;
  tire_lr: number | null;  tire_rr: number | null;
  dealership_id: string | null;
  state: string | null;
  inspection_started_notified_at: string | null;
  check_ready_at: string | null;
  offer_locked_at: string | null;
  portal_view_count: number;
}

interface DealerRow {
  dealership_id: string;
  // dealership_locations exposes a few possible name fields. The
  // canonical display name in the existing schema is
  // `dealership_name`; `name` is the rooftop/location label (often
  // the same). Prefer `dealership_name` and fall back to `name`.
  dealership_name: string | null;
  name: string | null;
}

// ────────────────────────────────────────────────────────────────
// Transformations
// ────────────────────────────────────────────────────────────────

const PRICE_GUARANTEE_DAYS = 8;

function initials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "??";
}

function formatExpiry(lockedAtIso: string | null): string | null {
  if (!lockedAtIso) return null;
  const d = new Date(lockedAtIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + PRICE_GUARANTEE_DAYS);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function deriveOwnership(loanStatus: string | null, payoff: number): string {
  if (loanStatus === "paid_off" || loanStatus === "owned") return "Owned outright";
  if (loanStatus === "leased") return "Leased";
  if (loanStatus === "financed" || payoff > 0) return "Has loan payoff";
  return "Owned outright";
}

// Progress-status → portal transaction stage. Mirrors the mapping
// CustomerPortalLegacy uses so the new portal renders the same stage
// the legacy one would.
const STAGE_MAPPING: Record<string, TransactionStage> = {
  new: "pre_schedule",
  contacted: "pre_schedule",
  offer_made: "pre_schedule",
  offer_accepted: "scheduled",
  price_agreed: "scheduled",
  inspection_scheduled: "scheduled",
  inspection_completed: "driver_assigned",
  title_verified: "driver_assigned",
  ownership_verified: "driver_assigned",
  appraisal_completed: "driver_assigned",
  manager_approval: "driver_assigned",
  deal_finalized: "in_transit",
  title_ownership_verified: "in_transit",
  check_request_submitted: "in_transit",
  purchase_complete: "complete",
};

function mapStage(progressStatus: string): TransactionStage {
  return STAGE_MAPPING[progressStatus] ?? "pre_schedule";
}

function rowToPortal(row: RpcRow, dealer: DealerRow | null): PortalSubmissionData {
  const fullName = row.name ?? "";
  const [first = "", ...rest] = fullName.split(/\s+/);
  const last = rest.join(" ");
  const mileNum = Number(row.mileage ?? 0);
  // Resolve the customer-facing dealer name. submissions.dealership_id
  // points at a row in dealership_locations whose canonical display
  // field is dealership_name (fall back to `name` if the dealer hasn't
  // configured a separate display name — they're frequently the same).
  const dealerLabel =
    dealer?.dealership_name?.trim() ||
    dealer?.name?.trim() ||
    "Our Dealership";
  return {
    customer: {
      name: fullName || "Customer",
      firstName: first || "Customer",
      lastName: last,
      initials: initials(row.name),
      dealer: dealerLabel,
      email: row.email,
      phone: row.phone,
    },
    dealerCapabilities: {
      // No pickup_enabled/dropoff_enabled flag exists on
      // dealership_locations today — defaults to true. When the
      // dealer-side capability config ships those columns this is
      // where to wire them.
      pickupEnabled: true,
      dropoffEnabled: true,
      remoteInspection: true,
    },
    transactionStage: mapStage(row.progress_status),
    vehicle: {
      year: row.vehicle_year ?? "",
      make: row.vehicle_make ?? "",
      model: row.vehicle_model ?? "",
      // trim / engine / body / drivetrain / interior aren't on
      // submissions yet (Phase 1.5 schema follow-up). Pages should
      // hide these gracefully when null.
      trim: null,
      miles: Number.isNaN(mileNum)
        ? row.mileage ?? "0"
        : mileNum.toLocaleString("en-US"),
      engine: null,
      body: null,
      drivetrain: null,
      exterior: row.exterior_color,
      interior: null,
      vin: row.vin ?? "",
      ownership: deriveOwnership(row.loan_status, 0),
      payoff: 0,
    },
    range: {
      low: row.estimated_offer_low ?? 0,
      high: row.estimated_offer_high ?? 0,
    },
    firmOffer: row.offered_price,
    offerExpires: formatExpiry(row.offer_locked_at),
    offerLockedAt: row.offer_locked_at,
    raw: {
      submissionId: row.id,
      token: row.token,
      dealershipId: row.dealership_id,
      state: row.state,
      progressStatus: row.progress_status,
      photosUploaded: row.photos_uploaded,
      docsUploaded: row.docs_uploaded,
      appointmentSet: row.appointment_set,
      portalViewCount: row.portal_view_count,
      createdAt: row.created_at,
      inspectionStartedNotifiedAt: row.inspection_started_notified_at,
      checkReadyAt: row.check_ready_at,
    },
  };
}

// The mock branch — returns a PortalSubmissionData shape built from
// PORTAL_MOCK so /portal-preview keeps working without DB access.
function mockPortal(): PortalSubmissionData {
  const m = PORTAL_MOCK;
  return {
    customer: {
      name: m.customer.name,
      firstName: m.customer.firstName,
      lastName: m.customer.lastName,
      initials: m.customer.initials,
      dealer: m.customer.dealer,
      email: m.customer.email,
      phone: m.customer.phone,
    },
    dealerCapabilities: { ...m.dealerCapabilities },
    transactionStage: m.transactionStage,
    vehicle: {
      year: m.vehicle.year,
      make: m.vehicle.make,
      model: m.vehicle.model,
      trim: m.vehicle.trim,
      miles: m.vehicle.miles,
      engine: m.vehicle.engine,
      body: m.vehicle.body,
      drivetrain: m.vehicle.drivetrain,
      exterior: m.vehicle.exterior,
      interior: m.vehicle.interior,
      vin: m.vehicle.vin,
      ownership: m.vehicle.ownership,
      payoff: m.vehicle.payoff,
    },
    range: { ...m.range },
    firmOffer: m.firmOffer,
    offerExpires: m.offerExpires,
    offerLockedAt: null,
    raw: {
      submissionId: "demo-submission-id",
      token: "demo",
      dealershipId: null,
      state: null,
      progressStatus: "offer_accepted",
      photosUploaded: true,
      docsUploaded: true,
      appointmentSet: true,
      portalViewCount: 1,
      createdAt: new Date().toISOString(),
      inspectionStartedNotifiedAt: null,
      checkReadyAt: null,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// The hook
// ────────────────────────────────────────────────────────────────

interface UseSubmissionPortalResult {
  data: PortalSubmissionData | null;
  status: DataStatus;
  error: Error | null;
  isDemo: boolean;
  refetch: () => void;
}

const STALE_60S = 60_000;

export function useSubmissionPortal(): UseSubmissionPortalResult {
  const { token, isDemo } = usePortalToken();

  const query = useQuery({
    queryKey: ["portal", token ?? "demo", "submission"],
    staleTime: STALE_60S,
    refetchOnWindowFocus: !isDemo,
    queryFn: async (): Promise<PortalSubmissionData> => {
      if (!token) return mockPortal();

      // Pull the submission row.
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("get_submission_portal", { _token: token });
      if (rpcErr) throw new Error(rpcErr.message);
      const row = (rpcData as RpcRow[] | null)?.[0];
      if (!row) {
        throw new Error("Submission not found. The link may be invalid or expired.");
      }

      // Optional dealer-side metadata. Failure here doesn't fail the
      // whole portal — we just fall back to "Our Dealership" so the
      // page still renders.
      let dealer: DealerRow | null = null;
      if (row.dealership_id) {
        const { data: dealerRow } = await supabase
          .from("dealership_locations")
          .select("dealership_id, dealership_name, name")
          .eq("dealership_id", row.dealership_id)
          .maybeSingle();
        dealer = (dealerRow as DealerRow | null) ?? null;
      }

      return rowToPortal(row, dealer);
    },
  });

  // Derive the unified status. "Empty" doesn't apply here — the hook
  // either has the submission or errors with "not found".
  let status: DataStatus;
  if (query.isPending) status = "loading";
  else if (query.isError) status = "error";
  else status = "ready";

  return {
    data: query.data ?? null,
    status,
    error: query.error as Error | null,
    isDemo,
    refetch: () => { void query.refetch(); },
  };
}
