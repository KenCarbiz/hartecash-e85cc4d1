/**
 * Website Embed (Admin V2) — native-V2 framing over EmbedToolkit.
 * PageShell + the existing component (its header is suppressed via
 * `embedded`; the strategy card, snippet cards, and previews are all
 * preserved). V2-only.
 */
import { lazy, Suspense } from "react";
import { PageShell } from "./theme";

const EmbedToolkit = lazy(() => import("@/components/admin/EmbedToolkit"));

const WebsiteEmbedV2 = () => (
  <PageShell title="Website Embed" subtitle="Embed Autocurb into the dealership website to convert existing traffic into trade-in leads — customers never leave the dealer site.">
    <Suspense fallback={<div className="py-10 text-center text-sm text-[#7A879C]">Loading…</div>}>
      <EmbedToolkit embedded />
    </Suspense>
  </PageShell>
);

export default WebsiteEmbedV2;
