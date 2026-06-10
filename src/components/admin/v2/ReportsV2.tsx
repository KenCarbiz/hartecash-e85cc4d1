/**
 * Reports (Admin V2) — native-V2 framing over the existing export tool.
 *
 * Wraps the full ReportsExport (report types, date filters, KPIs, CSV
 * export/copy) in the V2 PageShell, with its own header hidden via the
 * `embedded` prop so the page reads native-V2. All export logic is
 * preserved verbatim. V2-only; V1 untouched.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const ReportsExport = lazy(() => import("@/components/admin/ReportsExport"));

const ReportsV2 = () => (
  <PageShell title="Reports" subtitle="Generate filtered reports, preview the data, and export to CSV.">
    <Suspense fallback={<Loading label="Loading reports…" />}>
      <ReportsExport embedded />
    </Suspense>
  </PageShell>
);

export default ReportsV2;
