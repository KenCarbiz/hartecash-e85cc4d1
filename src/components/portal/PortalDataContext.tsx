// Portal data context — replaces module-scope PORTAL_MOCK with a
// React context that fetches real submission data from
// get_submission_portal(token) and overlays it onto the PORTAL_MOCK
// shape. Pages keep their existing `MOCK.foo.bar` accessors unchanged
// — only the import line flips from `PORTAL_MOCK` to `usePortalData()`.
//
// Field provenance (live → fallback):
//   customer.name/email/phone        ← submissions.name/email/phone
//   customer.firstName/lastName/init ← derived from submissions.name
//   customer.dealer                  ← site_config.dealership_name (tenant)
//   customer.mailingAddress.zip/state← submissions.zip / submissions.state
//   customer.mailingAddress.{street,city,unit}  ← mock (no schema yet)
//   vehicle.year/make/model/vin/miles/exterior  ← submissions.*
//   vehicle.{trim,engine,body,drivetrain,ownership,interior}  ← mock
//                                      (not in get_submission_portal yet)
//   range.low/high                   ← submissions.estimated_offer_low/high
//   firmOffer                        ← submissions.offered_price
//   offerExpires                     ← offer_locked_at + price_guarantee_days
//   docs / activity / conversations / payment / pickupLocations / etc.
//                                    ← mock (Phase 2/3 — new tables needed)
//
// The shell (PortalPreview) wraps everything in <PortalDataProvider
// token={token}> and handles the loading + token-error states up front,
// so every consumer hook returns a fully-populated, never-null shape.
import {
  createContext, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useDocumentConfig } from "@/hooks/useDocumentConfig";
import { checkTokenStatus, type TokenStatus } from "@/lib/tokenStatus";
import { PORTAL_MOCK } from "./portalMock";

type PortalShape = typeof PORTAL_MOCK;

interface PortalSubmissionRow {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  mileage: string | null;
  exterior_color: string | null;
  zip: string | null;
  state: string | null;
  offered_price: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  offer_locked_at: string | null;
  loan_status: string | null;
  created_at: string | null;
  appointment_set: boolean | null;
  photos_uploaded: boolean | null;
  docs_uploaded: boolean | null;
  inspection_started_notified_at: string | null;
  check_ready_at: string | null;
  progress_status: string | null;
  dealership_id: string | null;
}

interface ProviderStatus {
  loading: boolean;
  error: string | null;
  tokenStatus: TokenStatus | "error" | null;
}

const PortalDataCtx = createContext<PortalShape | null>(null);
const PortalStatusCtx = createContext<ProviderStatus>({
  loading: true, error: null, tokenStatus: null,
});

/** Raw submission identity the real upload pipeline needs (storage paths,
 *  mark_docs_uploaded, notifications). Null on the token-less demo route. */
export interface PortalIdentity {
  token: string | null;
  submissionId: string | null;
  dealershipId: string | null;
  loanStatus: string | null;
}
const PortalIdentityCtx = createContext<PortalIdentity>({
  token: null, submissionId: null, dealershipId: null, loanStatus: null,
});


/** Split a full name into firstName / lastName / initials. */
const splitName = (full: string | null) => {
  const trimmed = (full || "").trim();
  if (!trimmed) return { firstName: "", lastName: "", initials: "" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  const initials = (
    (firstName[0] || "") + (lastName[0] || "")
  ).toUpperCase() || (firstName[0] || "").toUpperCase();
  return { firstName, lastName, initials };
};

/** Format mileage as comma-separated (mock uses "26,540"). */
const fmtMiles = (raw: string | null): string => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return Number(digits).toLocaleString();
};

/** Format an offer-expiry date as "May 17, 2025". */
const fmtExpiry = (
  lockedAt: string | null,
  guaranteeDays: number,
): string => {
  if (!lockedAt) return "";
  const base = new Date(lockedAt);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + (guaranteeDays || 8));
  return base.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
};

/** Map admin-managed progress_status + timestamp signals to the
 *  customer-facing transactionStage enum the portal renders. We prefer
 *  timestamps over progress_status where both exist (timestamps are
 *  customer-event accurate, progress_status is admin-managed and can
 *  lag). Priority order, most-advanced wins:
 *
 *    purchase_complete                       -> complete
 *    check_ready_at | check_request_submitted -> in_transit
 *    inspection_started_notified_at | inspection_completed-ish
 *                                             -> driver_assigned
 *    appointment_set | inspection_scheduled   -> scheduled
 *    otherwise                                -> pre_schedule
 */
type TransactionStage = PortalShape["transactionStage"];
const INSPECTION_DONE = new Set([
  "inspection_completed",
  "title_verified",
  "ownership_verified",
  "appraisal_completed",
  "manager_approval",
  "deal_finalized",
  "title_ownership_verified",
]);
const deriveStage = (row: PortalSubmissionRow): TransactionStage => {
  const status = row.progress_status || "";
  if (status === "purchase_complete") return "complete";
  if (row.check_ready_at || status === "check_request_submitted") return "in_transit";
  if (row.inspection_started_notified_at || INSPECTION_DONE.has(status)) return "driver_assigned";
  if (row.appointment_set || status === "inspection_scheduled") return "scheduled";
  return "pre_schedule";
};

/** Format a timestamp into the activity feed's "May 11 • 9:14 AM" style. */
const fmtActivityTime = (iso: string | null): string => {
  if (!iso) return "Pending";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Pending";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} • ${time}`;
};

/** Short relative-time string for the dashboard's "Last update" pill. */
const fmtRelative = (iso: string | null): string => {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec || 1}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
};

/** Build the activity feed from real submission timestamps + state.
 *  Falls back to the mock array when nothing is set (demo route). */
const buildActivity = (
  row: PortalSubmissionRow,
  vehicleStr: string,
  dealer: string,
  range: { low: number; high: number },
  firmOffer: number,
): PortalShape["activity"] => {
  const out: PortalShape["activity"] = [];
  let id = 0;
  const push = (
    type: "submission" | "offer" | "messages" | "documents" | "pickup" | "payments",
    title: string,
    iso: string | null,
    desc: string,
  ) => out.push({ id: ++id, type, title, time: fmtActivityTime(iso), desc });

  if (row.created_at) {
    push("submission", "Vehicle submitted", row.created_at,
      vehicleStr ? `You submitted your ${vehicleStr}.` : "You submitted your vehicle.");
    if (range.low > 0 && range.high > 0) {
      push("offer", "Offer generated", row.created_at,
        `Initial range $${range.low.toLocaleString()} – $${range.high.toLocaleString()}.`);
    }
  }
  if (row.docs_uploaded) {
    push("documents", "Documents uploaded", null, "Registration, title, and ID on file.");
  }
  if (row.photos_uploaded) {
    push("documents", "Photos uploaded", null, "Vehicle photos received for review.");
  }
  if (row.offer_locked_at && firmOffer > 0) {
    push("offer", "Firm offer issued", row.offer_locked_at,
      `${dealer} offered $${firmOffer.toLocaleString()}.`);
  }
  if (row.appointment_set) {
    push("pickup", "Pickup scheduled", null, "Your pickup appointment is on the books.");
  } else if (firmOffer > 0) {
    push("pickup", "Pickup not scheduled", null,
      "Schedule pickup after accepting your offer.");
  }
  if (row.inspection_started_notified_at) {
    push("documents", "Inspector arrived",
      row.inspection_started_notified_at,
      "Your acquisition specialist started the inspection.");
  }
  if (row.check_ready_at) {
    push("payments", "Payment ready", row.check_ready_at,
      `Payout prepared by ${dealer}. Confirm pickup to release funds.`);
  } else if (firmOffer > 0) {
    push("payments", "Payment pending", null,
      "Payout released after pickup is confirmed.");
  }

  return out;
};

/** Per-document file presence + upload date, keyed by doc_id. */
type DocFiles = Record<string, { uploaded: boolean; uploadedAt: string | null; label: string }>;

/** Format a doc-uploaded date as the activity feed's short "May 12" style. */
const fmtDocDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Build the per-doc status array the portal renders. Order follows
 *  the dealer's customerAllDocs catalog (sort_order). */
const buildDocsList = (files: DocFiles): PortalShape["docs"] => {
  return Object.values(files).map((f) => ({
    name: f.label,
    status: f.uploaded ? ("Under Review" as const) : ("Needed" as const),
    date: fmtDocDate(f.uploadedAt),
  }));
};

/** Overlay real submission + tenant fields onto the mock shape. */
const buildPortalShape = (
  row: PortalSubmissionRow | null,
  dealershipName: string,
  guaranteeDays: number,
  pickupOffered: boolean,
  docFiles: DocFiles | null,
): PortalShape => {
  // Deep-clone the mock so per-render mutations never leak between renders.
  const base: PortalShape = JSON.parse(JSON.stringify(PORTAL_MOCK));

  // ── Tenant capabilities from site_config. The customer should never
  // see a pickup option for a dealer that doesn't offer pickup.
  base.dealerCapabilities.pickupEnabled = pickupOffered;

  // ── Tenant — dealer name always reflects the actual dealership the
  // customer is talking to, even when no submission row is loaded.
  const dealer = (dealershipName || "").trim() || base.customer.dealer;
  base.customer.dealer = dealer;

  // The primary dealer conversation (Messages tab) must show the real
  // dealership, not the mock "Liberty Automotive" brand. Re-derive its
  // name + avatar initials from the tenant dealer name.
  const dealerInitials =
    dealer
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase() || base.conversations[0]?.initials || "DL";
  base.conversations = base.conversations.map((c) =>
    c.id === "liberty" ? { ...c, name: dealer, initials: dealerInitials } : c,
  );

  if (!row) return base;

  // ── Customer identity from the submission row.
  const { firstName, lastName, initials } = splitName(row.name);
  base.customer.name = (row.name || "").trim() || base.customer.name;
  base.customer.firstName = firstName || base.customer.firstName;
  base.customer.lastName = lastName || base.customer.lastName;
  base.customer.initials = initials || base.customer.initials;
  base.customer.email = (row.email || "").trim() || base.customer.email;
  base.customer.phone = (row.phone || "").trim() || base.customer.phone;

  // Mailing address — only zip / state are on submissions today. Keep
  // the mock street/city/unit until we add address columns.
  if (row.zip) base.customer.mailingAddress.zip = row.zip;
  if (row.state) base.customer.mailingAddress.state = row.state;

  // ── Vehicle.
  if (row.vehicle_year) base.vehicle.year = Number(row.vehicle_year) || base.vehicle.year;
  if (row.vehicle_make) base.vehicle.make = row.vehicle_make;
  if (row.vehicle_model) base.vehicle.model = row.vehicle_model;
  if (row.vin) base.vehicle.vin = row.vin;
  if (row.mileage) base.vehicle.miles = fmtMiles(row.mileage);
  if (row.exterior_color) base.vehicle.exterior = row.exterior_color;
  // Ownership flag — submissions.loan_status maps to display copy.
  if (row.loan_status) {
    base.vehicle.ownership = row.loan_status === "owned"
      ? "Owned outright"
      : row.loan_status === "has_loan"
        ? "Financed"
        : row.loan_status === "lease"
          ? "Leased"
          : base.vehicle.ownership;
  }

  // ── Offer range + firm offer.
  if (row.estimated_offer_low != null) base.range.low = row.estimated_offer_low;
  if (row.estimated_offer_high != null) base.range.high = row.estimated_offer_high;
  if (row.offered_price != null) {
    base.firmOffer = row.offered_price;
    base.payment.offer = row.offered_price;
    base.payment.netPayout = Math.max(0, row.offered_price - base.payment.payoff - base.payment.fees);
  }

  // ── Offer expiry.
  const expiry = fmtExpiry(row.offer_locked_at, guaranteeDays);
  if (expiry) base.offerExpires = expiry;

  // ── Transaction stage — gates address editability + Pickup UI.
  base.transactionStage = deriveStage(row);

  // ── Per-document status, sourced from the dealer's configured doc
  // catalog + a storage-bucket scan. Falls back to the mock list when
  // we haven't fetched yet (initial render) or no docs are configured.
  if (docFiles && Object.keys(docFiles).length > 0) {
    base.docs = buildDocsList(docFiles);
  }

  // ── Activity feed — derived entirely from real timestamps. Replace
  // the mock array when we have at least a submission timestamp;
  // otherwise (demo route, half-provisioned tenant) keep the mock.
  if (row.created_at) {
    const vehicleStr = [base.vehicle.year, base.vehicle.make, base.vehicle.model]
      .filter(Boolean).join(" ").trim();
    base.activity = buildActivity(
      row, vehicleStr, dealer, base.range, base.firmOffer,
    );
  }

  // ── "Last update" pill — pick the most recent timestamp we have.
  const candidates = [
    row.check_ready_at,
    row.inspection_started_notified_at,
    row.offer_locked_at,
    row.created_at,
  ].filter((s): s is string => !!s);
  if (candidates.length > 0) {
    const newest = candidates
      .map((s) => new Date(s).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    if (newest > 0) base.lastUpdate = fmtRelative(new Date(newest).toISOString());
  }

  return base;
};

interface Props {
  token: string | undefined;
  children: ReactNode;
}

export const PortalDataProvider = ({ token, children }: Props) => {
  const { config } = useSiteConfig();
  const [row, setRow] = useState<PortalSubmissionRow | null>(null);
  const [docFiles, setDocFiles] = useState<DocFiles | null>(null);
  const [status, setStatus] = useState<ProviderStatus>({
    // No token = demo route (/portal-preview). Render the mock shape
    // immediately, no loading state, no error.
    loading: !!token, error: null, tokenStatus: null,
  });

  // Dealer-configured customer-doc catalog. The hook gates on
  // dealership_id + loan_status from the submission row.
  const { customerAllDocs } = useDocumentConfig(
    row?.dealership_id || "default",
    row?.loan_status,
  );

  useEffect(() => {
    if (!token) {
      // Demo route — skip the fetch, hand back the pure mock shape.
      setRow(null);
      setStatus({ loading: false, error: null, tokenStatus: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_submission_portal", { _token: token });
      if (cancelled) return;
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        const ts = error ? "error" : await checkTokenStatus(token);
        if (cancelled) return;
        setStatus({ loading: false, error: error?.message || "not found", tokenStatus: ts });
        return;
      }
      const first = Array.isArray(data) ? data[0] : data;
      setRow(first as unknown as PortalSubmissionRow);
      setStatus({ loading: false, error: null, tokenStatus: "valid" });
      // Fire-and-forget engagement tracking — same pattern as the
      // legacy portal (CustomerPortalLegacy).
      (supabase as unknown as { rpc: (n: string, a: object) => Promise<unknown> })
        .rpc("increment_portal_view", { _token: token })
        .then(() => {}, () => {});
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Document status scan. Lists the customer-documents and
  // submission-photos buckets for this token and reports whether
  // each configured doc has a file uploaded yet. Mirrors the logic
  // in EssentialUploads so the portal docs panel reflects reality.
  //
  // Depend on a stable string key (joined doc_ids) rather than the
  // customerAllDocs array reference -- useDocumentConfig recomputes
  // its filter() on every render, returning a new array identity
  // each time. Using the array as a dep caused the effect to fire
  // every render, repeatedly calling setDocFiles and producing the
  // visible "docs list jumping by one line over and over" loop.
  const docCatalogKey = customerAllDocs.map((d) => d.doc_id).join(",");
  useEffect(() => {
    if (!token || !row || customerAllDocs.length === 0) {
      setDocFiles(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const out: DocFiles = {};
      await Promise.all(customerAllDocs.map(async (d) => {
        const isOdo = d.doc_id === "odometer";
        const bucket = isOdo ? "submission-photos" : "customer-documents";
        const prefix = isOdo ? token : `${token}/${d.doc_id}`;
        const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 5 });
        const match = (data || []).find((f) => {
          if (f.name === ".emptyFolderPlaceholder") return false;
          if (isOdo) return f.name.startsWith(`${d.doc_id}-`);
          return true;
        });
        out[d.doc_id] = {
          uploaded: !!match,
          uploadedAt: match?.updated_at || match?.created_at || null,
          label: d.label,
        };
      }));
      if (!cancelled) setDocFiles(out);
    })();
    return () => { cancelled = true; };
  }, [token, row?.id, docCatalogKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const shape = useMemo(
    () => buildPortalShape(
      row,
      config.dealership_name,
      config.price_guarantee_days,
      config.pickup_offered,
      docFiles,
    ),
    [row, config.dealership_name, config.price_guarantee_days, config.pickup_offered, docFiles],
  );

  const identity = useMemo<PortalIdentity>(
    () => ({
      token: token ?? null,
      submissionId: row?.id ?? null,
      dealershipId: row?.dealership_id ?? null,
      loanStatus: row?.loan_status ?? null,
    }),
    [token, row?.id, row?.dealership_id, row?.loan_status],
  );

  return (
    <PortalStatusCtx.Provider value={status}>
      <PortalIdentityCtx.Provider value={identity}>
        <PortalDataCtx.Provider value={shape}>
          {children}
        </PortalDataCtx.Provider>
      </PortalIdentityCtx.Provider>
    </PortalStatusCtx.Provider>
  );
};

export const usePortalData = (): PortalShape => {
  const ctx = useContext(PortalDataCtx);
  if (!ctx) {
    throw new Error("usePortalData must be used inside <PortalDataProvider>");
  }
  return ctx;
};

export const usePortalDataStatus = (): ProviderStatus =>
  useContext(PortalStatusCtx);

export const usePortalIdentity = (): PortalIdentity =>
  useContext(PortalIdentityCtx);
