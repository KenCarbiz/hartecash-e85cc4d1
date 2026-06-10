/**
 * Prospect Demo (Admin V2) — native-V2 framing over ProspectDemo.
 * No built-in page title, so it drops straight into a V2 PageShell.
 * Full logic preserved. V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const ProspectDemo = lazy(() => import("@/components/admin/ProspectDemo"));

const ProspectDemoV2 = () => (
  <PageShell title="Prospect Demo" subtitle="Spin up a branded demo environment to show a prospective dealer.">
    <Suspense fallback={<Loading />}>
      <ProspectDemo />
    </Suspense>
  </PageShell>
);

export default ProspectDemoV2;
