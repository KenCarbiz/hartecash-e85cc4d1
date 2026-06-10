/**
 * System Settings (Admin V2) — native-V2 framing over
 * PlatformCatalogManager. PageShell + the existing component (its own
 * "Platform Catalog" header is suppressed via `embedded`; the product
 * and bundle toggle cards stay). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const PlatformCatalogManager = lazy(() => import("@/components/admin/PlatformCatalogManager"));

const SystemSettingsV2 = () => (
  <PageShell title="System Settings" subtitle="Control which apps and bundles are offered to new dealers — existing subscribers keep their access.">
    <Suspense fallback={<Loading />}>
      <PlatformCatalogManager embedded />
    </Suspense>
  </PageShell>
);

export default SystemSettingsV2;
