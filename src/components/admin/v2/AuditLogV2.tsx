/**
 * Audit Log (Admin V2) — native-V2 framing over UnifiedAuditLog.
 * PageShell + the existing component (its title block is suppressed via
 * `embedded`; the Export/Refresh toolbar, kind filters, and table are
 * preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const UnifiedAuditLog = lazy(() => import("@/components/admin/UnifiedAuditLog"));

const AuditLogV2 = () => (
  <PageShell title="Audit Log" subtitle="Last 30 days across view-as sessions, rooftop ops, data exports, and Stripe events.">
    <Suspense fallback={<Loading />}>
      <UnifiedAuditLog embedded />
    </Suspense>
  </PageShell>
);

export default AuditLogV2;
