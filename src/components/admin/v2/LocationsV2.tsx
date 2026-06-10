/**
 * Locations (Admin V2) — native-V2 framing over LocationManagement.
 * PageShell + the existing component (its title block is suppressed via
 * `embedded`; the Save All button, location cards, and editors are all
 * preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const LocationManagement = lazy(() => import("@/components/admin/LocationManagement"));

const LocationsV2 = () => (
  <PageShell title="Locations" subtitle="Configure store locations, coverage areas, and branding.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <LocationManagement embedded />
    </Suspense>
  </PageShell>
);

export default LocationsV2;
