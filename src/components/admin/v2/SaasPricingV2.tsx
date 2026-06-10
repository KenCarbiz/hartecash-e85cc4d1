/**
 * SaaS Pricing (Admin V2) — native-V2 framing over PlatformPricingManager.
 * PageShell + the existing component (its title/description are
 * suppressed via `embedded`; the "Live" status banner, pricing blocks,
 * discount sliders, and sticky save bar are all preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const PlatformPricingManager = lazy(() => import("@/components/admin/PlatformPricingManager"));

const SaasPricingV2 = () => (
  <PageShell title="SaaS Pricing" subtitle="Every architecture on one page — edit monthly prices and annual discounts; changes push live to the onboarding and billing pickers.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <PlatformPricingManager embedded />
    </Suspense>
  </PageShell>
);

export default SaasPricingV2;
