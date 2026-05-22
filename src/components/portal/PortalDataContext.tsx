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

/** Overlay real submission + tenant fields onto the mock shape. */
const buildPortalShape = (
  row: PortalSubmissionRow | null,
  dealershipName: string,
  guaranteeDays: number,
): PortalShape => {
  // Deep-clone the mock so per-render mutations never leak between renders.
  const base: PortalShape = JSON.parse(JSON.stringify(PORTAL_MOCK));

  // ── Tenant — dealer name always reflects the actual dealership the
  // customer is talking to, even when no submission row is loaded.
  const dealer = (dealershipName || "").trim() || base.customer.dealer;
  base.customer.dealer = dealer;

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

  return base;
};

interface Props {
  token: string | undefined;
  children: ReactNode;
}

export const PortalDataProvider = ({ token, children }: Props) => {
  const { config } = useSiteConfig();
  const [row, setRow] = useState<PortalSubmissionRow | null>(null);
  const [status, setStatus] = useState<ProviderStatus>({
    // No token = demo route (/portal-preview). Render the mock shape
    // immediately, no loading state, no error.
    loading: !!token, error: null, tokenStatus: null,
  });

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

  const shape = useMemo(
    () => buildPortalShape(row, config.dealership_name, config.price_guarantee_days),
    [row, config.dealership_name, config.price_guarantee_days],
  );

  return (
    <PortalStatusCtx.Provider value={status}>
      <PortalDataCtx.Provider value={shape}>
        {children}
      </PortalDataCtx.Provider>
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
