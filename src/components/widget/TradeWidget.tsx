// TradeWidget — the watered-down MotoAcquire-style trade/sell body.
//
// Presentational container rendered by EmbedLanding when the embed is
// opened with ?template=widget. EmbedLanding owns the iframe plumbing
// (resize / ready / state-change postMessage + sessionStorage embed
// attribution); this component owns the branded slide-out chrome
// (dealer logo header + close ×) and the lean flow.
//
// Slide-out geometry (right-side panel, ~1/3 width, dim backdrop that
// preserves page context) is provided by the parent /public/embed.js
// drawer — this renders the panel CONTENTS.

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useFormConfig } from "@/hooks/useFormConfig";
import { useTenant } from "@/contexts/TenantContext";
import { tenantLogoSrc } from "@/lib/tenantLogo";
import ResumeCard from "./ResumeCard";
import TradeInBanner from "./TradeInBanner";
import TradeWidgetFlow from "./TradeWidgetFlow";
import WidgetLegalView from "./WidgetLegalView";
import ValueTrackingModal from "@/components/moto-sections/ValueTrackingModal";
import { useFirmOffer } from "./useTradeWidget";
import type { VdpContext, WidgetIntent } from "./widgetTypes";

type LegalView = "privacy" | "terms" | null;

export default function TradeWidget({
  intent,
  vdp,
  resumeToken,
  zip,
}: {
  intent: WidgetIntent;
  vdp: VdpContext | null;
  resumeToken: string;
  zip: string;
}) {
  const { config } = useSiteConfig();
  const { formConfig } = useFormConfig();
  const { tenant } = useTenant();
  const { offer } = useFirmOffer(resumeToken);

  // Returning customers see a resume card first; "Start a new appraisal"
  // drops them into the fresh flow.
  const [startFresh, setStartFresh] = useState(false);
  const returning = !startFresh && !!offer && offer.amount > 0;

  // Privacy / Terms render in-panel (not a new tab).
  const [legal, setLegal] = useState<LegalView>(null);

  // Hamburger nav menu (blurred overlay over the panel).
  const [menuOpen, setMenuOpen] = useState(false);

  // Value Tracker explainer popup (blurred backdrop + our car illustration).
  const [showTracker, setShowTracker] = useState(false);

  // Menu navigation: drop out of any legal view, close the menu, and return
  // the flow to its home/entry screen (so How it Works / FAQ are mounted),
  // then smooth-scroll to the target. "top" returns to the top of the
  // slide-out (the valuation form); other ids snap to their section anchor.
  const navTo = (id: string) => {
    setLegal(null);
    setMenuOpen(false);
    // Reset the flow to home so the section anchors exist before we scroll.
    window.dispatchEvent(new CustomEvent("hartecash-widget-home"));
    window.setTimeout(() => {
      if (id === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 130);
  };

  const dealerName = (config.dealership_name || "").trim();
  const logo = tenantLogoSrc(config);
  // Locked-in window — dealer-configured, defaults to 8 days.
  const guaranteeDays = Number((config as { price_guarantee_days?: number }).price_guarantee_days) || 8;

  // Everything below honors the dealer's admin settings — same flags the
  // main landing flow reads — so the widget stays "customizable like the
  // others": the SMS-code gate, info-before/after-offer order, and the
  // AI photo boost are all dealer toggles, not widget-specific behavior.
  const requireVerify = formConfig.require_phone_verification !== false;
  const aiPhotosEnabled = formConfig.step_ai_photos !== false;
  // NOTE: formConfig.offer_before_details (collect contact before/after the
  // offer) is a recognized dealer toggle — honoring it needs a
  // compute-before-persist split; tracked as the next refinement.

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Branded panel header — sticky, like the MotoAcquire slide-out. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
        {logo ? (
          <img src={logo} alt={dealerName || "Dealer"} className="h-11 w-auto max-w-[220px] object-contain" />
        ) : (
          <span className="text-base font-bold tracking-tight text-zinc-900">
            {dealerName || "Value My Trade"}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => window.parent.postMessage({ type: "hartecash-close" }, "*")}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Hamburger nav — full-panel overlay with a blurred backdrop. */}
      {menuOpen && (
        <WidgetNavMenu
          logo={logo}
          dealerName={dealerName}
          onClose={() => setMenuOpen(false)}
          onNavigate={navTo}
          onOpenTracker={() => {
            setMenuOpen(false);
            setShowTracker(true);
          }}
        />
      )}

      {/* Value Tracker explainer — blurred backdrop + our car-on-a-rising-
          value-curve illustration, with the dealer's CTA color. */}
      <ValueTrackingModal open={showTracker} onOpenChange={setShowTracker} />

      {legal ? (
        <WidgetLegalView type={legal} onBack={() => setLegal(null)} />
      ) : (
        <>
          <div>
            {returning && offer ? (
              <>
                {/* Returning hero keeps the "apply toward this car" banner. */}
                {vdp && <TradeInBanner vdp={vdp} offer={offer} zip={zip} />}
                <ResumeCard
                  offer={offer}
                  vdp={vdp}
                  intent={intent}
                  guaranteeDays={guaranteeDays}
                  onStartNew={() => setStartFresh(true)}
                />
              </>
            ) : (
              <TradeWidgetFlow
                initialIntent={intent}
                dealershipId={tenant.dealership_id}
                dealershipName={config.dealership_name}
                vdp={vdp}
                requireVerify={requireVerify}
                aiPhotosEnabled={aiPhotosEnabled}
                defaultZip={zip}
              />
            )}
          </div>

          {/* Dealer footer — tenant logo, AutoCurb copyright, in-panel
              legal links (mirrors the MotoAcquire slide-out footer). */}
          <footer className="mt-auto border-t border-zinc-100 px-6 py-8 text-center">
            {logo ? (
              <img
                src={logo}
                alt={dealerName || "Dealer"}
                className="mx-auto h-9 w-auto max-w-[200px] object-contain"
              />
            ) : (
              <span className="text-base font-bold tracking-tight text-zinc-800">{dealerName}</span>
            )}
            <p className="mt-3 text-[12px] font-medium text-zinc-500">
              Copyright · {new Date().getFullYear()} AutoCurb
            </p>
            <div className="mt-2 flex items-center justify-center gap-2.5 text-[12.5px] text-zinc-500">
              <button type="button" onClick={() => setLegal("privacy")} className="hover:text-zinc-800 hover:underline">
                Privacy Policy
              </button>
              <span className="text-zinc-300">·</span>
              <button type="button" onClick={() => setLegal("terms")} className="hover:text-zinc-800 hover:underline">
                Terms of Service
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

/** Full-panel slide-out nav. Opens from the header hamburger, dims +
 *  blurs the panel behind it, and links to the widget's key sections
 *  (which live on the entry screen). Each link scrolls to its section
 *  and dismisses the menu; the CTA jumps to the valuation form. */
function WidgetNavMenu({
  logo,
  dealerName,
  onClose,
  onNavigate,
  onOpenTracker,
}: {
  logo: string | null;
  dealerName: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onOpenTracker: () => void;
}) {
  // `action: "tracker"` opens the Value Tracker popup; the rest scroll
  // to their section anchor.
  const items: { label: string; target?: string; action?: "tracker" }[] = [
    { label: "Home", target: "top" },
    { label: "Vehicle Valuation", target: "top" },
    { label: "Value Tracker", action: "tracker" },
    { label: "How it Works", target: "widget-how-it-works" },
    { label: "FAQ", target: "widget-faq" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white/80 backdrop-blur-md">
      {/* Mirror the panel header — logo left, × closes the menu. */}
      <div className="flex items-center justify-between px-5 py-4">
        {logo ? (
          <img src={logo} alt={dealerName || "Dealer"} className="h-11 w-auto max-w-[220px] object-contain" />
        ) : (
          <span className="text-base font-bold tracking-tight text-zinc-900">
            {dealerName || "Value My Trade"}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex flex-col items-center gap-7 px-8 pt-8">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => (it.action === "tracker" ? onOpenTracker() : onNavigate(it.target!))}
            className="text-[19px] font-semibold text-zinc-800 transition-colors hover:text-[hsl(var(--cta-offer))]"
          >
            {it.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onNavigate("top")}
          className="mt-4 w-full rounded-full bg-[hsl(var(--cta-offer))] py-3.5 text-sm font-semibold text-[color:var(--cta-offer-text)] shadow-sm transition-all hover:brightness-110"
        >
          Get My Offer
        </button>
      </nav>
    </div>
  );
}
