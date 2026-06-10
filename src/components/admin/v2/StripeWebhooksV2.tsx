/**
 * Stripe Webhooks (Admin V2) — native-V2 framing over
 * StripeWebhookReprocessor. PageShell + the existing component (title
 * suppressed via `embedded`; the filter toolbar + replay controls stay).
 * V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const StripeWebhookReprocessor = lazy(() => import("@/components/admin/StripeWebhookReprocessor"));

const StripeWebhooksV2 = () => (
  <PageShell title="Stripe Webhooks" subtitle="Recent webhook deliveries — replay any row whose handler didn't finish.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <StripeWebhookReprocessor embedded />
    </Suspense>
  </PageShell>
);

export default StripeWebhooksV2;
