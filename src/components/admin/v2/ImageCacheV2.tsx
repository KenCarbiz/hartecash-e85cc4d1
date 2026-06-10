/**
 * Image Cache (Admin V2) — native-V2 framing over VehicleImageInventory.
 * PageShell + the existing component (its title/icon are suppressed via
 * `embedded`; the cached count, search, Refresh, and Clear All controls
 * are preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const VehicleImageInventory = lazy(() => import("@/components/admin/VehicleImageInventory"));

const ImageCacheV2 = () => (
  <PageShell title="Image Cache" subtitle="Vehicle images cached for faster portal loads — search, refresh, or clear the cache.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <VehicleImageInventory embedded />
    </Suspense>
  </PageShell>
);

export default ImageCacheV2;
