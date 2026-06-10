/**
 * Integrations (Admin V2) — native-V2 framing over IntegrationsHub.
 * V2 PageShell + the existing hub (header suppressed via `embedded`):
 * Status / API / vAuto / White Label tabs preserved. V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const IntegrationsHub = lazy(() => import("@/components/admin/IntegrationsHub"));

const IntegrationsV2 = ({ initialTab = "status" }: { initialTab?: "status" | "api" | "vauto" | "white-label" }) => (
  <PageShell title="Integrations" subtitle="Status, keys, and per-integration configuration in one place.">
    <Suspense fallback={<Loading />}>
      <IntegrationsHub initialTab={initialTab} embedded />
    </Suspense>
  </PageShell>
);

export default IntegrationsV2;
