/**
 * Marketing (Admin V2) — native-V2 framing over MarketingHub.
 * V2 PageShell + the existing hub (header suppressed via `embedded`),
 * so promotions / referrals / testimonials are all preserved. V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell, Loading } from "./theme";

const MarketingHub = lazy(() => import("@/components/admin/MarketingHub"));

const MarketingV2 = ({ initialTab = "promotions" }: { initialTab?: "promotions" | "referrals" | "testimonials" }) => (
  <PageShell title="Marketing" subtitle="Promotions, referrals, and testimonials — your customer-acquisition content.">
    <Suspense fallback={<Loading />}>
      <MarketingHub initialTab={initialTab} embedded />
    </Suspense>
  </PageShell>
);

export default MarketingV2;
