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
 */

interface CommonProps {
  buttonColor: string;     // e.g. "hsl(220 90% 25%)"  (from config.primary_color)
  buttonText: string;      // e.g. "Get Your Trade-In Value"
  dealerName?: string;     // e.g. "Harte Infiniti"
}

// ── 1. iframe modal — opens centered, dealer's top + bottom bars stay visible ──
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

// ── 2. Right-side floating widget tab ──
export const RightWidgetOverlay = ({
  buttonColor,
  buttonText,
}: CommonProps) => (
  <div
    className="absolute top-1/2 -translate-y-1/2 right-0 pointer-events-none"
    aria-hidden="true"
  >
    <div
      className="text-white shadow-xl flex items-center gap-2 pl-4 pr-3 py-3 rounded-l-xl"
      style={{ backgroundColor: buttonColor, writingMode: "horizontal-tb" }}
    >
      <Car className="w-4 h-4" />
      <span className="text-sm font-bold whitespace-nowrap">{buttonText}</span>
      <ChevronRight className="w-4 h-4 opacity-70 rotate-180" />
    </div>
  </div>
);

// ── 3. VDP ghost image — semi-transparent car silhouette + CTA on a vehicle detail page ──
export const VdpGhostOverlay = ({
  buttonColor,
  bannerHeadline = "Have a Trade-In?",
  bannerText = "What's your current car worth? Get your trade-in value instantly.",
  bannerCtaText = "Get Trade Value",
}: CommonProps & {
  bannerHeadline?: string;
  bannerText?: string;
  bannerCtaText?: string;
}) => (
  <div
    className="absolute inset-x-0 pointer-events-none"
    style={{ top: "55%" }}
    aria-hidden="true"
  >
    <div
      className="mx-auto max-w-[820px] bg-white/95 backdrop-blur rounded-xl shadow-2xl border-2 px-5 py-4 flex items-center gap-4"
      style={{ borderColor: buttonColor }}
    >
      {/* Ghost car silhouette */}
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

// ── 4. Listing-page ghost banner — sits between the filters and the grid ──
export const ListingGhostOverlay = ({
  buttonColor,
  bannerHeadline = "Have a Trade-In?",
  bannerCtaText = "Get Trade Value",
}: CommonProps & {
  bannerHeadline?: string;
  bannerCtaText?: string;
}) => (
  <div
    className="absolute inset-x-0 pointer-events-none"
    style={{ top: "32%" }}
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

// ── 5. Homepage hero banner — full-width band high on the page ──
export const HomepageBannerOverlay = ({
  buttonColor,
  buttonText,
}: CommonProps) => (
  <div
    className="absolute inset-x-0 pointer-events-none"
    style={{ top: "18%" }}
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

// ── 6. Sticky bottom bar ──
export const StickyBarOverlay = ({
  buttonColor,
  stickyText = "Get your trade-in value",
  stickyCtaText = "See Value",
}: CommonProps & {
  stickyText?: string;
  stickyCtaText?: string;
}) => (
  <div
    className="absolute inset-x-0 bottom-0 pointer-events-none"
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

// ── 7. Basic button CTA (small, anchored top-right of nav area) ──
export const ButtonCtaOverlay = ({
  buttonColor,
  buttonText,
}: CommonProps) => (
  <div
    className="absolute pointer-events-none"
    style={{ top: "2%", right: "5%" }}
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

// ── 8. Push/Pull/Tow guarantee badge (when enabled) ──
export const PptOverlay = ({
  buttonColor,
  pptButtonText = "Get Your $3,000 Trade Certificate",
}: CommonProps & {
  pptButtonText?: string;
}) => (
  <div
    className="absolute pointer-events-none"
    style={{ bottom: "10%", left: "3%" }}
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

