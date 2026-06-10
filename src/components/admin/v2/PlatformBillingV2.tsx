/**
 * Platform & Billing (Admin V2) — native-V2 framing over
 * PlatformSubscriptions. PageShell + the existing component (its header
 * is suppressed via `embedded`; the current-plan snapshot, picker, and
 * billing controls are all preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const PlatformSubscriptions = lazy(() => import("@/components/admin/PlatformSubscriptions"));

const PlatformBillingV2 = () => (
  <PageShell title="Platform & Billing" subtitle="Manage your AutoCurb Platform subscription across AutoCurb.io, AutoLabels.io, AutoFrame.io, and AutoFilm.io.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <PlatformSubscriptions embedded />
    </Suspense>
  </PageShell>
);

export default PlatformBillingV2;
