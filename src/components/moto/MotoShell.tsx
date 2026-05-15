import type { ReactNode } from "react";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import MotoTopBar from "./MotoTopBar";
import MotoDisclosureBar from "./MotoDisclosureBar";

/**
 * The standalone microsite wrapper. Renders top bar + disclosure bar
 * on the dealer's own /sell page; when iframed (?embed=true) it
 * strips both so the host page's chrome wraps the flow seamlessly.
 */
const MotoShell = ({ children }: { children: ReactNode }) => {
  const embed = useEmbedMode();
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {!embed && <MotoTopBar />}
      {/* Bottom padding reserves room for the fixed MotoStickyFooter
          (~96px button + safe-area) so the sticky CTA never sits on
          top of the disclosure bar or the Track-Value card. */}
      <main className="mx-auto max-w-screen-sm px-4 pb-[120px] pt-6">{children}</main>
      {!embed && <MotoDisclosureBar />}
    </div>
  );
};

export default MotoShell;
