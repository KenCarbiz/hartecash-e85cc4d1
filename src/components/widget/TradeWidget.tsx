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
import { X } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useFormConfig } from "@/hooks/useFormConfig";
import { useTenant } from "@/contexts/TenantContext";
import { tenantLogoSrc } from "@/lib/tenantLogo";
import ResumeCard from "./ResumeCard";
import TradeInBanner from "./TradeInBanner";
import TradeWidgetFlow from "./TradeWidgetFlow";
import WidgetLegalView from "./WidgetLegalView";
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
        <button
          type="button"
          onClick={() => window.parent.postMessage({ type: "hartecash-close" }, "*")}
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

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

          {/* Dealer footer — tenant logo + in-panel legal links. */}
          <footer className="mt-auto border-t border-zinc-100 px-6 py-7 text-center">
            {logo ? (
              <img
                src={logo}
                alt={dealerName || "Dealer"}
                className="mx-auto h-8 w-auto max-w-[180px] object-contain opacity-90"
              />
            ) : (
              <span className="text-sm font-bold tracking-tight text-zinc-700">{dealerName}</span>
            )}
            <div className="mt-3 flex items-center justify-center gap-2.5 text-[12.5px] text-zinc-500">
              <button type="button" onClick={() => setLegal("privacy")} className="hover:text-zinc-800 hover:underline">
                Privacy Policy
              </button>
              <span className="text-zinc-300">·</span>
              <button type="button" onClick={() => setLegal("terms")} className="hover:text-zinc-800 hover:underline">
                Terms of Service
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              © {new Date().getFullYear()} {dealerName || "Dealer"} · Powered by AutoCurb
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
