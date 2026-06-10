/**
 * Rooftop Websites (Admin V2) — native-V2 framing over RooftopWebsites.
 * PageShell + the existing component (its header is suppressed via
 * `embedded`; all rooftop/group cards and controls are preserved).
 * V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const RooftopWebsites = lazy(() => import("@/components/admin/RooftopWebsites"));

const RooftopWebsitesV2 = () => (
  <PageShell title="Rooftop Websites" subtitle="Give each rooftop its own URL and landing page — all rooftops share this admin, leads, and staff.">
    <Suspense fallback={<Loading />}>
      <RooftopWebsites embedded />
    </Suspense>
  </PageShell>
);

export default RooftopWebsitesV2;
