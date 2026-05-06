import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, X } from "lucide-react";
import LandingTemplateRouter from "@/components/landing/LandingTemplateRouter";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { getTaxRateFromZip, calcTradeInValue } from "@/lib/salesTax";
import { supabase } from "@/integrations/supabase/client";

/**
 * Embedded customer-flow page mounted at /embed/:dealershipId.
 *
 * What it is:
 *   - Same template the dealer picked for their main landing
 *     (Clarity / Velocity / Heritage / etc.) — read from
 *     site_config.landing_template via useSiteConfig.
 *   - NO SiteHeader, NO SiteFooter — just the template body and
 *     a tiny inline close-button when running in overlay mode.
 *   - Auto-resizes the parent iframe via postMessage on every
 *     content height change (same pattern TradeIframe uses).
 *
 * URL parameters honored:
 *   ?t=<submission_token>     — resume an in-progress submission
 *   ?mode=inline|overlay      — chrome behavior (default inline)
 *   ?template=<key>           — override the dealer's default
 *                               template just for this embed
 *                               (e.g. force Clarity on inventory pages
 *                               while the main site uses Velocity)
 *   ?vehicle_label=...        — name of the vehicle the customer is
 *                               viewing on the dealership inventory
 *                               page ("2024 Honda CR-V")
 *   ?vehicle_msrp=<number>    — sticker price of the inventory
 *                               vehicle, used by the inventory-aware
 *                               banner to show tax savings
 *   ?store=<location_id>      — pre-assign leads to a store
 *   ?ref=<code>               — referral tracking
 *   ?rep=<code>               — sales rep tracking
 *
 * Cross-frame messaging contract (postMessage to window.parent):
 *   { type: "hartecash-resize",  height: number }   on every height change
 *   { type: "hartecash-ready" }                     once on mount
 *   { type: "hartecash-close" }                     when customer taps the close X
 *   { type: "hartecash-state-change", token, status, offer } whenever submission
 *                                                   state changes (so the parent
 *                                                   embed.js can persist token +
 *                                                   adapt the floating button copy)
 */
const EmbedLanding = () => {
  const { dealershipId } = useParams<{ dealershipId: string }>();
  const [searchParams] = useSearchParams();
  const { config } = useSiteConfig();

  const mode = searchParams.get("mode") || "inline";
  const isOverlay = mode === "overlay";

  // Inventory-aware context. Both label + msrp must be present —
  // the parent embed.js scrapes them from the inventory page (see
  // schema.org JSON-LD + OG meta in /public/embed.js).
  const vehicleLabel = searchParams.get("vehicle_label") || "";
  const vehicleMsrp = Number(searchParams.get("vehicle_msrp")) || 0;

  // Template override. Useful for dealers who run Velocity on the
  // main landing but want the quieter Clarity flow on inventory
  // detail pages where the customer is mid-shop.
  const templateOverride = searchParams.get("template");

  // Auto-resize — parent iframe listens for hartecash-resize and
  // adjusts its height. Same contract TradeIframe.tsx uses, so any
  // dealer site that already has the resize listener works
  // without changes.
  useEffect(() => {
    let lastHeight = 0;
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      if (Math.abs(height - lastHeight) < 4) return;
      lastHeight = height;
      window.parent.postMessage({ type: "hartecash-resize", height }, "*");
    };
    sendHeight();
    window.parent.postMessage({ type: "hartecash-ready", dealershipId }, "*");
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    const interval = setInterval(sendHeight, 500);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [dealershipId]);

  // Apply the optional template override by setting it on a
  // sessionStorage key the LandingTemplateRouter checks. This is
  // an isolation-friendly way to override per-embed without
  // mutating site_config (which would change every browser).
  useEffect(() => {
    if (!templateOverride) return;
    try {
      sessionStorage.setItem("__landing_template_override", templateOverride);
    } catch {
      /* Safari private mode — fail open, dealer's chosen template wins. */
    }
  }, [templateOverride]);

  // Stash inventory + embed-source context in sessionStorage so
  // SellFlowSimple (a deeply-nested child) can include them on the
  // submission insert without prop-drilling through five layers.
  // Cleared automatically when the tab closes.
  useEffect(() => {
    try {
      sessionStorage.setItem("__embed_lead_source", "inventory_embed");
      if (vehicleLabel) sessionStorage.setItem("__embed_vehicle_label", vehicleLabel);
      else sessionStorage.removeItem("__embed_vehicle_label");
      if (vehicleMsrp > 0) sessionStorage.setItem("__embed_vehicle_msrp", String(vehicleMsrp));
      else sessionStorage.removeItem("__embed_vehicle_msrp");
    } catch {
      /* private mode — submission falls back to default lead_source */
    }
  }, [vehicleLabel, vehicleMsrp]);

  // Returning-customer recognition. When the parent embed.js
  // handed us a resume token (?t=...) — typically because the
  // customer already started or completed a submission on a prior
  // visit — fetch their current status + offer and broadcast it
  // back to the parent via hartecash-state-change. The parent
  // floating button uses this to swap copy from "Get your trade-in
  // value" to "Apply your $X toward this vehicle" (on a VDP) or
  // "Increase your $X trade offer" (off a VDP).
  const submissionToken = searchParams.get("t") || "";
  useEffect(() => {
    if (!submissionToken) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select(
          "progress_status, offered_price, estimated_offer_high, bb_tradein_avg, bb_wholesale_avg, offer_made_at, created_at",
        )
        .eq("token", submissionToken)
        .maybeSingle();
      if (cancelled || !data) return;
      const offer =
        Number(data.offered_price) ||
        Number(data.estimated_offer_high) ||
        Number(data.bb_tradein_avg) ||
        Number(data.bb_wholesale_avg) ||
        0;
      const status =
        data.progress_status === "deal_accepted" || data.progress_status === "scheduled"
          ? "deal_accepted"
          : offer > 0
          ? "offer_made"
          : "in_progress";
      // Server-authoritative anchor — falls back to created_at on
      // older rows that pre-date the offer_made_at column. Sent as
      // millis-since-epoch so the loader doesn't have to parse ISO.
      const anchor = (data as { offer_made_at?: string | null; created_at?: string | null }).offer_made_at
        || (status === "offer_made" ? data.created_at : null);
      window.parent.postMessage(
        {
          type: "hartecash-state-change",
          token: submissionToken,
          status,
          offer,
          offer_made_at: anchor ? new Date(anchor).getTime() : null,
        },
        "*",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionToken]);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Inventory-aware banner ──
            Only renders when the parent embed.js detected vehicle
            context on the dealership inventory page. Frames the
            embed as "apply your trade toward this car" with the
            tax-credit savings calculated against the customer's
            cash offer, not the base value. The big number = trade
            value (cashOffer × (1 + tax_rate)), not the cash
            offer, because that's what's actually applied to the
            replacement purchase. */}
      {vehicleLabel && vehicleMsrp > 0 && (
        <InventoryAwareBanner vehicleLabel={vehicleLabel} vehicleMsrp={vehicleMsrp} />
      )}

      {/* Overlay-mode close button — sits top-right above the
          template chrome. The parent embed.js script listens for
          hartecash-close and dismisses the overlay iframe. */}
      {isOverlay && (
        <button
          type="button"
          onClick={() => window.parent.postMessage({ type: "hartecash-close" }, "*")}
          aria-label="Close"
          className="fixed top-4 right-4 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 backdrop-blur border border-zinc-200 shadow-md hover:bg-zinc-50 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-700" aria-hidden="true" />
        </button>
      )}

      {/* The actual flow — template router picks the right
          landing template based on config.landing_template (or
          the templateOverride we stashed in sessionStorage). */}
      <LandingTemplateRouter />
    </div>
  );
};

/**
 * Inventory-aware banner — shown when the embed is loaded on a
 * dealership inventory detail page. Shows the customer's trade
 * value (with state tax credit) and the savings against the
 * vehicle they're viewing.
 *
 * Reads the resume token from URL — if the customer already has
 * an offer, the banner uses their actual offered_price; otherwise
 * it falls back to a generic placeholder until they complete the
 * flow and we know their offer.
 *
 * The customer's ZIP drives the state-specific tax rate. CT
 * 6.35% default when ZIP isn't on file yet.
 */
function InventoryAwareBanner({
  vehicleLabel,
  vehicleMsrp,
}: {
  vehicleLabel: string;
  vehicleMsrp: number;
}) {
  const [searchParams] = useSearchParams();
  const { config } = useSiteConfig();
  const submissionToken = searchParams.get("t") || "";

  // Pull the customer's existing offer from URL params if the
  // parent embed.js already passed it. Otherwise the banner shows
  // a "get a trade value" prompt.
  const existingOffer = Number(searchParams.get("offer")) || 0;
  const customerZip = searchParams.get("zip") || "";

  const taxInfo = useMemo(() => {
    const result = getTaxRateFromZip(customerZip);
    const rate = result.state ? result.rate : 0.0635;
    return { state: result.state, rate };
  }, [customerZip]);

  if (existingOffer <= 0) {
    // No offer yet — soft prompt to get one. Sits above the
    // template hero; tap-through to the regular flow which will
    // start from VIN/plate entry.
    return (
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="bg-zinc-900 text-white"
      >
        <div className="max-w-[840px] mx-auto px-5 md:px-8 py-3 flex items-center justify-between gap-4 text-sm">
          <p className="leading-tight">
            <span className="font-semibold">Looking at the {vehicleLabel}?</span>{" "}
            <span className="text-white/70">Get your trade value first — applied directly to this vehicle.</span>
          </p>
        </div>
      </motion.section>
    );
  }

  // Customer has an offer — compute the trade-in value (with tax
  // credit) so we apply the value that's ACTUALLY usable against
  // the inventory vehicle, not the cash equivalent.
  const tradeValue = calcTradeInValue(existingOffer, taxInfo.rate);
  const taxSavings = existingOffer * taxInfo.rate;
  const effectivePrice = Math.max(0, vehicleMsrp - tradeValue);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white"
    >
      <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 items-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-1 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" aria-hidden="true" />
            Apply your trade
          </p>
          <p className="text-base font-semibold leading-tight">
            Toward this {vehicleLabel}
          </p>
        </div>
        <div className="md:text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 mb-0.5">
            Your trade value
          </p>
          <p className="text-xl md:text-2xl font-bold tabular-nums leading-tight">
            ${tradeValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-white/70">
            includes ${taxSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
            tax credit{taxInfo.state ? ` (${taxInfo.state})` : ""}
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 mb-0.5">
            Effective price
          </p>
          <p className="text-xl md:text-2xl font-bold tabular-nums leading-tight">
            ${effectivePrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-white/70">
            ${vehicleMsrp.toLocaleString()} − ${tradeValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
            trade
          </p>
        </div>
      </div>
    </motion.section>
  );
}

export default EmbedLanding;
