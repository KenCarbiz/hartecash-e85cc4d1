/**
 * Export My Data (Admin V2) — native-V2 framing over DataEgressPanel.
 * PageShell + the existing panel (header suppressed via `embedded`). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const DataEgressPanel = lazy(() => import("@/components/admin/DataEgressPanel"));

const ExportDataV2 = () => (
  <PageShell title="Export My Data" subtitle="Your data is yours — pull it down as CSV any time, no charge, no rate limit.">
    <Suspense fallback={<Loading />}>
      <DataEgressPanel embedded />
    </Suspense>
  </PageShell>
);

export default ExportDataV2;
