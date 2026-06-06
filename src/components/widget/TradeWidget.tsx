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
import { LogIn, Menu, X } from "lucide-react";
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
  const { config, loading: siteLoading } = useSiteConfig();
  const { formConfig, loading: formLoading } = useFormConfig();
  const { tenant } = useTenant();
  const { offer } = useFirmOffer(resumeToken);

  // Wait for tenant config + theme to resolve before painting the body —
  // otherwise the first frame uses index.css defaults (yellow --cta-offer,
  // purple tabs) and only "snaps" to the dealer's saved brand once the
  // queries land. Header logo can render eagerly since it reads from the
  // tenant logo helper (cached / blank-tolerant).
  const themeReady = !siteLoading && !formLoading;

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

  // Dealer toggle: returning customers can sign in to re-open their offer.
  const signInEnabled = formConfig.widget_customer_signin === true;
  const openSignIn = () => {
    setMenuOpen(false);
    // The widget runs on the AutoCurb origin, so /my-submission resolves to
    // the customer lookup → portal. New tab keeps the dealer page intact.
    try {
      window.open(`${window.location.origin}/my-submission`, "_blank", "noopener,noreferrer");
    } catch {
      /* popup blocked — nothing to recover */
    }
  };

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
      {/* Branded panel header — slim sticky bar, like the MotoAcquire slide-out. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-2">
        {logo ? (
          <img src={logo} alt={dealerName || "Dealer"} className="h-8 w-auto max-w-[200px] object-contain" />
        ) : (
          <span className="text-[15px] font-bold tracking-tight text-zinc-900">
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
          showSignIn={signInEnabled}
          onSignIn={openSignIn}
        />
      )}

      {/* Value Tracker explainer — blurred backdrop + our car-on-a-rising-
          value-curve illustration, with the dealer's CTA color. */}
      <ValueTrackingModal open={showTracker} onOpenChange={setShowTracker} />

      {legal ? (
        <WidgetLegalView type={legal} onBack={() => setLegal(null)} />
      ) : !themeReady ? (
        // Neutral skeleton while tenant config + theme load — prevents the
        // default yellow/purple flash before the dealer's brand resolves.
        <div className="flex-1 px-6 py-10">
          <div className="mx-auto w-full max-w-[440px] space-y-4">
            <div className="h-8 w-3/4 rounded bg-zinc-100" />
            <div className="h-4 w-full rounded bg-zinc-100" />
            <div className="h-4 w-5/6 rounded bg-zinc-100" />
            <div className="mt-6 h-44 rounded-2xl bg-zinc-50" />
            <div className="h-10 rounded-full bg-zinc-100" />
          </div>
        </div>
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
  showSignIn,
  onSignIn,
}: {
  logo: string | null;
  dealerName: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onOpenTracker: () => void;
  showSignIn: boolean;
  onSignIn: () => void;
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
    <div className="fixed inset-0 z-50">
      {/* Blurred backdrop — everything behind the menu is dimmed + blurred.
          Click anywhere outside the card to close. */}
      <div
        className="absolute inset-0 bg-zinc-900/20 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Menu card — slides down from the top of the slide-out, rounded
          bottom corners, soft shadow (the MotoAcquire pattern). */}
      <div className="absolute inset-x-0 top-0 rounded-b-2xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] animate-in slide-in-from-top duration-300">
        {/* Header — logo left, × closes the menu. */}
        <div className="flex items-center justify-between px-5 py-3">
          {logo ? (
            <img src={logo} alt={dealerName || "Dealer"} className="h-8 w-auto max-w-[200px] object-contain" />
          ) : (
            <span className="text-[15px] font-bold tracking-tight text-zinc-900">
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

        <nav className="flex flex-col items-stretch px-5 pb-5 pt-2">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => (it.action === "tracker" ? onOpenTracker() : onNavigate(it.target!))}
              className="rounded-lg py-3 text-center text-[17px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 hover:text-[hsl(var(--cta-offer))]"
            >
              {it.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onNavigate("top")}
            className="mt-3 w-full rounded-full bg-[hsl(var(--cta-offer))] py-3.5 text-sm font-semibold text-[color:var(--cta-offer-text)] shadow-sm transition-all hover:brightness-110"
          >
            Get My Offer
          </button>

          {/* Returning-customer sign-in — only when the dealer enables it.
              Opens the customer lookup/portal so they can re-open their offer. */}
          {showSignIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="mt-3 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-600 transition-colors hover:text-[hsl(var(--cta-offer))]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in to your offer
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
