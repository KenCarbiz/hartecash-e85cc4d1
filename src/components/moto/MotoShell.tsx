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
      <main className="mx-auto max-w-screen-sm px-4 pb-12 pt-6">{children}</main>
      {!embed && <MotoDisclosureBar />}
    </div>
  );
};

export default MotoShell;
