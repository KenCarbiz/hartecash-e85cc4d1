// WidgetLegalView — shows the dealer's Privacy Policy / Terms of Service
// INSIDE the slide-out panel (not a new tab). It loads the real /privacy
// and /terms routes in a nested same-origin iframe, so the legal copy
// stays single-sourced and renders in its own document (no router/Helmet
// conflicts with the widget). The customer returns via our Back button.

import { ArrowLeft } from "lucide-react";

export default function WidgetLegalView({
  type,
  onBack,
}: {
  type: "privacy" | "terms";
  onBack: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `${origin}/${type === "privacy" ? "privacy" : "terms"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 border-b border-zinc-100 bg-white px-5 py-3 text-sm font-semibold text-[hsl(var(--cta-offer))]"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <iframe
        src={src}
        title={type === "privacy" ? "Privacy Policy" : "Terms of Service"}
        className="w-full flex-1 border-0"
        style={{ minHeight: "75vh" }}
      />
    </div>
  );
}
