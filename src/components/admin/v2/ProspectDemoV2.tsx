/**
 * Prospect Demo (Admin V2) — native-V2 framing over ProspectDemo.
 * No built-in page title, so it drops straight into a V2 PageShell.
 * Full logic preserved. V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const ProspectDemo = lazy(() => import("@/components/admin/ProspectDemo"));

const ProspectDemoV2 = () => (
  <PageShell title="Prospect Demo" subtitle="Spin up a branded demo environment to show a prospective dealer.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <ProspectDemo />
    </Suspense>
  </PageShell>
);

export default ProspectDemoV2;
