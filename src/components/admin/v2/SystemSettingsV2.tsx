/**
 * System Settings (Admin V2) — native-V2 framing over
 * PlatformCatalogManager. PageShell + the existing component (its own
 * "Platform Catalog" header is suppressed via `embedded`; the product
 * and bundle toggle cards stay). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const PlatformCatalogManager = lazy(() => import("@/components/admin/PlatformCatalogManager"));

const SystemSettingsV2 = () => (
  <PageShell title="System Settings" subtitle="Control which apps and bundles are offered to new dealers — existing subscribers keep their access.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <PlatformCatalogManager embedded />
    </Suspense>
  </PageShell>
);

export default SystemSettingsV2;
