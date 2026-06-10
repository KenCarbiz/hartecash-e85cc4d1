/**
 * Group Management (Admin V2) — native-V2 framing over GroupManagement.
 * PageShell + the existing component (header suppressed via `embedded`,
 * Refresh + all controls preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const GroupManagement = lazy(() => import("@/components/admin/GroupManagement"));

const GroupManagementV2 = () => (
  <PageShell title="Group Management" subtitle="Dealer groups, master MSAs, per-rooftop activations and pilot windows.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <GroupManagement embedded />
    </Suspense>
  </PageShell>
);

export default GroupManagementV2;
