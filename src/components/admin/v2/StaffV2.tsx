/**
 * Staff & Permissions (Admin V2) — native-V2 framing over StaffManagement.
 * The component has no built-in page title, so it drops straight into a
 * V2 PageShell. Full logic preserved. V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const StaffManagement = lazy(() => import("@/components/admin/StaffManagement"));

const StaffV2 = () => (
  <PageShell title="Staff & Permissions" subtitle="Invite teammates, set roles, and control what each person can access.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <StaffManagement />
    </Suspense>
  </PageShell>
);

export default StaffV2;
