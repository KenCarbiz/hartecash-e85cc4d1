import { ExternalLink, X, Car, ChevronRight, Award } from "lucide-react";

/**
 * AssetOverlays — visual mockups of each Autocurb embed asset that
 * sit on top of a dealer-website screenshot inside the Live Preview
 * tab. Each component is positioned absolutely inside its container
 * so the LivePreview viewer can place them at the right anchor on
 * each page-type (homepage / listing / VDP).
 *
 * Every overlay reads the dealer's customization (colors, copy) from
 * props so toggling between the EmbedToolkit's customize tabs and
 * this preview tab shows the dealer their actual settings.
 *
 * Position props were added so AI-driven placement (analyze-prospect-
 * site picks) and manual rep overrides (drag handles) can move the
 * overlay around without forking the component. Overlays that don't
 * have meaningful position choice (modal, ghost banners) ignore it.
 */

// Position vocabularies per overlay. Kept as string literals (not
// enums) so they round-trip cleanly through Claude's JSON output and
// localStorage / shareable demo URLs.
export type WidgetPosition = "right" | "left";
export type StickyPosition = "bottom" | "top";
export type ButtonPosition = "top-right" | "top-left" | "top-center";
export type PptPosition = "bottom-left" | "bottom-right" | "top-right";
export type BannerPosition = "top" | "mid" | "bottom";

interface CommonProps {
  buttonColor: string;     // e.g. "hsl(220 90% 25%)"  (from config.primary_color)
  buttonText: string;      // e.g. "Get Your Trade-In Value"
  dealerName?: string;     // e.g. "Harte Infiniti"
}

// ── 1. iframe modal — opens centered, dealer's top + bottom bars stay visible ──
// No position prop — modals are inherently centered z-overlays.
export const IframeModalOverlay = ({
  buttonColor,
  buttonText,
  dealerName,
}: CommonProps) => (
  <div
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    aria-hidden="true"
  >
    {/* Dim backdrop simulating the modal's z-overlay */}
    <div className="absolute inset-x-0 top-[64px] bottom-[64px] bg-black/40" />
    {/* The iframe modal itself */}
    <div
      className="relative w-[78%] max-w-[920px] h-[68%] bg-white rounded-2xl shadow-2xl overflow-hidden border-2"
      style={{ borderColor: buttonColor }}
    >
      {/* Iframe header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 text-white"
        style={{ backgroundColor: buttonColor }}
      >
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4" />
          <span className="text-sm font-bold">{dealerName ? `${dealerName} — ` : ""}Trade-In Value</span>
        </div>
        <X className="w-4 h-4 opacity-80" />
      </div>
      {/* Body — mock form preview */}
      <div className="p-6 space-y-4">
        <div className="h-3 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="h-10 bg-slate-100 rounded border border-slate-200" />
          <div className="h-10 bg-slate-100 rounded border border-slate-200" />
        </div>
        <div className="h-10 bg-slate-100 rounded border border-slate-200" />
        <div className="h-10 bg-slate-100 rounded border border-slate-200" />
        <button
          className="w-full mt-2 py-3 rounded-lg text-white text-sm font-bold"
          style={{ backgroundColor: buttonColor }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  </div>
);

// ── 2. Floating widget tab — picks left or right edge ──
export const RightWidgetOverlay = ({
  buttonColor,
  buttonText,
  position = "right",
}: CommonProps & { position?: WidgetPosition }) => {
  const sideClass =
    position === "left"
      ? "left-0 rounded-r-xl pr-4 pl-3"
      : "right-0 rounded-l-xl pl-4 pr-3";
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 ${position === "left" ? "left-0" : "right-0"} pointer-events-none`}
      aria-hidden="true"
    >
      <div
        className={`text-white shadow-xl flex items-center gap-2 py-3 ${sideClass}`}
        style={{ backgroundColor: buttonColor, writingMode: "horizontal-tb" }}
      >
        <Car className="w-4 h-4" />
        <span className="text-sm font-bold whitespace-nowrap">{buttonText}</span>
        <ChevronRight
          className={`w-4 h-4 opacity-70 ${position === "left" ? "" : "rotate-180"}`}
        />
      </div>
    </div>
  );
};

// ── 3. VDP ghost image — semi-transparent car silhouette + CTA on a vehicle detail page ──
// Picks where on the VDP to anchor: under the photo gallery (mid, default), or just above the fold (top), or near the CTA region (bottom).
export const VdpGhostOverlay = ({
  buttonColor,
  bannerHeadline = "Have a Trade-In?",
  bannerText = "What's your current car worth? Get your trade-in value instantly.",
  bannerCtaText = "Get Trade Value",
  position = "mid",
}: CommonProps & {
  bannerHeadline?: string;
  bannerText?: string;
  bannerCtaText?: string;
  position?: BannerPosition;
}) => {
  const topPct = position === "top" ? "12%" : position === "bottom" ? "78%" : "55%";
  return (
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{ top: topPct }}
      aria-hidden="true"
    >
      <div
        className="mx-auto max-w-[820px] bg-white/95 backdrop-blur rounded-xl shadow-2xl border-2 px-5 py-4 flex items-center gap-4"
        style={{ borderColor: buttonColor }}
      >
        <div className="shrink-0 opacity-25">
          <Car className="w-16 h-16" style={{ color: buttonColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-base font-extrabold leading-tight"
            style={{ color: buttonColor }}
          >
            {bannerHeadline}
          </div>
          <div className="text-xs text-slate-600 mt-0.5 leading-snug">{bannerText}</div>
        </div>
        <button
          className="shrink-0 px-4 py-2.5 rounded-lg text-white text-sm font-bold flex items-center gap-1.5"
          style={{ backgroundColor: buttonColor }}
        >
          {bannerCtaText}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── 4. Listing-page ghost banner — sits in the inventory area ──
// "top" sits above the filter row, "mid" between filters and grid (default), "bottom" sits below the first row of cards.
export const ListingGhostOverlay = ({
  buttonColor,
  bannerHeadline = "Have a Trade-In?",
  bannerCtaText = "Get Trade Value",
  position = "mid",
}: CommonProps & {
  bannerHeadline?: string;
  bannerCtaText?: string;
  position?: BannerPosition;
}) => {
  const topPct = position === "top" ? "12%" : position === "bottom" ? "65%" : "32%";
  return (
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{ top: topPct }}
      aria-hidden="true"
    >
      <div
        className="mx-4 rounded-lg shadow-lg flex items-center justify-between px-5 py-3 text-white"
        style={{ backgroundColor: buttonColor }}
      >
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5" />
          <div>
            <div className="text-sm font-extrabold">{bannerHeadline}</div>
            <div className="text-[11px] opacity-85">Boost your purchase power — see your trade value first.</div>
          </div>
        </div>
        <button className="bg-white text-slate-900 px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5">
          {bannerCtaText} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── 5. Homepage hero banner — full-width band positioned vertically ──
// "top" lands above the hero copy, "mid" sits over the hero (default current placement), "bottom" anchors just above the inventory teaser.
export const HomepageBannerOverlay = ({
  buttonColor,
  buttonText,
  position = "top",
}: CommonProps & { position?: BannerPosition }) => {
  const topPct = position === "mid" ? "44%" : position === "bottom" ? "72%" : "18%";
  return (
    <div
      className="absolute inset-x-0 pointer-events-none"
      style={{ top: topPct }}
      aria-hidden="true"
    >
      <div
        className="mx-auto max-w-[1100px] mx-4 rounded-xl shadow-2xl px-6 py-5 text-white flex items-center justify-between gap-4"
        style={{ backgroundColor: buttonColor }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] opacity-80 font-bold">
            Sell or trade — instant offer
          </div>
          <div className="text-2xl font-extrabold leading-tight mt-0.5">
            What's your car worth?
          </div>
        </div>
        <button className="bg-white text-slate-900 px-5 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shrink-0">
          {buttonText} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ── 6. Sticky bar — bottom (default) or top of the viewport ──
export const StickyBarOverlay = ({
  buttonColor,
  stickyText = "Get your trade-in value",
  stickyCtaText = "See Value",
  position = "bottom",
}: CommonProps & {
  stickyText?: string;
  stickyCtaText?: string;
  position?: StickyPosition;
}) => (
  <div
    className={`absolute inset-x-0 ${position === "top" ? "top-0" : "bottom-0"} pointer-events-none`}
    aria-hidden="true"
  >
    <div
      className="px-5 py-3 text-white flex items-center justify-between shadow-2xl"
      style={{ backgroundColor: buttonColor }}
    >
      <div className="flex items-center gap-2.5">
        <Car className="w-5 h-5" />
        <span className="text-sm font-bold">{stickyText}</span>
      </div>
      <button className="bg-white text-slate-900 px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5">
        {stickyCtaText} <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  </div>
);

// ── 7. Basic button CTA — small button anchored to one of three top zones ──
export const ButtonCtaOverlay = ({
  buttonColor,
  buttonText,
  position = "top-right",
}: CommonProps & { position?: ButtonPosition }) => {
  const anchor =
    position === "top-left"
      ? { top: "2%", left: "5%" }
      : position === "top-center"
      ? { top: "2%", left: "50%", transform: "translateX(-50%)" }
      : { top: "2%", right: "5%" };
  return (
    <div
      className="absolute pointer-events-none"
      style={anchor}
      aria-hidden="true"
    >
      <button
        className="px-4 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg flex items-center gap-2"
        style={{ backgroundColor: buttonColor }}
      >
        <Car className="w-4 h-4" />
        {buttonText}
      </button>
    </div>
  );
};

// ── 8. Push/Pull/Tow guarantee badge — picks a corner ──
export const PptOverlay = ({
  buttonColor,
  pptButtonText = "Get Your $3,000 Trade Certificate",
  position = "bottom-left",
}: CommonProps & {
  pptButtonText?: string;
  position?: PptPosition;
}) => {
  const anchor =
    position === "bottom-right"
      ? { bottom: "10%", right: "3%" }
      : position === "top-right"
      ? { top: "12%", right: "3%" }
      : { bottom: "10%", left: "3%" };
  return (
    <div
      className="absolute pointer-events-none"
      style={anchor}
      aria-hidden="true"
    >
      <div
        className="rounded-full shadow-2xl px-5 py-3 text-white flex items-center gap-2"
        style={{ backgroundColor: buttonColor }}
      >
        <Award className="w-5 h-5" />
        <span className="text-sm font-extrabold">{pptButtonText}</span>
      </div>
    </div>
  );
};
