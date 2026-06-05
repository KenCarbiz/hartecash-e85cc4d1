// Premium value-tracking section — full rebuild per product-owner
// spec. Replaces the prior single-card promo (which had an inline
// SVG of a generic value curve) with a fully-coded landing-page
// section: left column has badge/headline/copy/trust points/CTA,
// right column has a live-looking vehicle tracker card with a real
// SVG chart, demo value block, status badge, and two notification
// sub-cards.
//
// Everything is HTML/CSS/React — no static images for the section.
// The vehicle thumbnail is a CSS placeholder (Lucide Car icon on a
// soft-gray rounded square) so the section loads fast and the
// vehicle text is editable / SEO-readable. The chart is hand-
// authored SVG with viewBox so it scales cleanly at any width.
//
// Style direction (from the product-owner brief):
//   * Navy text, blue accents, green positive value indicators
//   * Soft shadows, rounded-3xl (24px), white card on light-gray bg
//   * Single navy accent (--primary), single green accent
//     (Tailwind emerald-* tokens) — no per-tenant chrome bleed
//   * Premium automotive-SaaS / fintech feel, not promo banner
//
// Per-tenant: dealer-specific signals (name, theme) are NOT injected
// into this section — the demo card is intentionally generic
// ("2022 Ford Explorer XLT") so the SAME visual sells the value-
// tracking feature on every dealer's landing. Only the primary
// color CSS var bleeds through, which is how every other moto-
// section maintains brand cohesion.
import { useState } from "react";
import {
  ShieldCheck,
  Bell,
  TrendingUp,
  ArrowRight,
  ArrowUp,
} from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { mergeFlagships, resolveFlagship } from "@/data/oemFlagships";
import VehicleImage from "@/components/sell-form/VehicleImage";
import ValueTrackingModal from "@/components/moto-sections/ValueTrackingModal";

const scrollToForm = () => {
  const form = document.getElementById("sell-car-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

// Trust-point row content — kept declarative so future copy edits
// don't require touching the JSX. Icon + title + body.
const TRUST_POINTS = [
  {
    Icon: ShieldCheck,
    title: "Data you can trust",
    body: "Real market insights from thousands of transactions.",
  },
  {
    Icon: Bell,
    title: "Always in the know",
    body: "We'll notify you when your value changes.",
  },
  {
    Icon: TrendingUp,
    title: "Sell with confidence",
    body: "Get the best value at the right time.",
  },
];

// ── Chart geometry ──────────────────────────────────────────────
// viewBox is fixed so the chart scales proportionally at any width.
// Inner plot area: x ∈ [40, 560], y ∈ [40, 240].
// Y-axis maps $19K..$25K → 240..40 (200px tall, 6 dollar units).
//
// 22 hand-tuned data points re-traced from the product owner's
// reference screenshot. Key landmarks:
//   * Mar 1   start ~$19.5K
//   * ~Mar 22 small local peak ~$21.0K (touches the dashed $21K line)
//   * Mar 29  bottom of the V, ~$20.0K
//   * Apr 12  ~$21.3K (climbing back above pre-dip levels)
//   * Apr 26  ~$22.9K
//   * May 10  $25.0K final highlighted marker (touches the $25K line)
//
// Each consecutive pair varies by ~$0.1-0.5K so the line reads as
// real market noise. Path uses straight-line (L) segments — with
// this point density, quadratic-bezier smoothing flattened the
// bumps. stroke-linejoin="round" softens the angles enough they
// don't read as graphics-paper sharp.

// Y-axis ticks for the 520×260 chart (plot y: 12..185 → $25K..$19K).
const Y_TICKS = [
  { y: 12,    label: "$25K" },
  { y: 69.7,  label: "$23K" },
  { y: 127.3, label: "$21K" },
  { y: 185,   label: "$19K" },
];

// X-axis labels evenly spaced across the 35..485 plot.
const X_LABELS = [
  { x: 35,  label: "MAR 1" },
  { x: 125, label: "MAR 15" },
  { x: 215, label: "MAR 29" },
  { x: 305, label: "APR 12" },
  { x: 395, label: "APR 26" },
  { x: 485, label: "MAY 10" },
];

// Straight-segment trend line — small linear wobbles, dip at MAR 29,
// then a steady jagged climb to $25K. Reads like a real market chart.
const TREND_POINTS: [number, number][] = [
  [35,  164.8], // Mar 1 ~$19.70 (open-circle start)
  [50,  160.5],
  [65,  163.4],
  [82,  157.6],
  [98,  160.5],
  [115, 153.3],
  [130, 149.0],
  [145, 144.7], // Mar 15
  [160, 147.6],
  [178, 137.5],
  [195, 131.7],
  [210, 136.1],
  [225, 144.7], // descending
  [240, 154.8],
  [255, 160.5],
  [270, 163.4], // Mar 29 bottom of dip
  [285, 156.3], // recovery starts
  [300, 147.6],
  [315, 140.4],
  [330, 143.3],
  [345, 131.7],
  [360, 124.5],
  [375, 127.4],
  [390, 115.9],
  [405, 107.3],
  [420, 103.0],
  [435, 91.5],
  [450, 78.4],
  [465, 61.1],
  [478, 35.1],
  [485, 12],   // May 10 final marker at $25K
];
const CHART_LINE_PATH =
  "M" + TREND_POINTS.map(([x, y]) => `${x} ${y}`).join(" L ");
const CHART_FILL_PATH = `${CHART_LINE_PATH} L 485 210 L 35 210 Z`;
const FINAL_POINT = { x: 485, y: 12 };
const START_POINT = { x: 35, y: 164.8 };

// Popular fallback used when admin chooses "popular" mode and the
// dealership isn't tied to a single OEM brand.
const POPULAR_FLAGSHIP = {
  year: "2022", make: "Toyota", model: "RAV4", style: "XLE",
  specs: "4D SUV · 2.5L · 36,100 mi",
};

const ValueTrackerCard = () => {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const embed = useEmbedMode();
  const [showModal, setShowModal] = useState(false);

  let flagship;
  if (config.tracker_vehicle_mode === "custom" && config.tracker_vehicle_make && config.tracker_vehicle_model) {
    flagship = {
      year:  config.tracker_vehicle_year ? String(config.tracker_vehicle_year) : "2022",
      make:  config.tracker_vehicle_make,
      model: config.tracker_vehicle_model,
      style: config.tracker_vehicle_style || "",
      specs: config.tracker_vehicle_specs || "",
    };
  } else if (config.tracker_vehicle_mode === "popular") {
    flagship = POPULAR_FLAGSHIP;
  } else {
    flagship = resolveFlagship(
      tenant?.display_name,
      mergeFlagships(config.tracker_oem_flagships),
    );
  }

  return (
    <section
      id="value-tracking"
      aria-labelledby="value-tracking-heading"
      className="py-20 lg:py-28 px-5 border-t border-border/60 scroll-mt-24"
      style={{ background: "hsl(220 14% 98%)" }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Outer white card holding both columns. rounded-3xl == 24px
            corners + soft shadow per the brief. */}
        <div className="bg-white rounded-3xl shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* ── LEFT COLUMN ────────────────────────────────────────── */}
            <div>
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
                style={{ background: "hsl(220 100% 96%)" }}
              >
                <TrendingUp
                  className="w-3.5 h-3.5 text-primary"
                  strokeWidth={2.25}
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Value Tracking
                </span>
              </div>

              {/* Headline */}
              <h2
                id="value-tracking-heading"
                className="text-3xl lg:text-[44px] font-bold text-foreground leading-[1.15] tracking-tight mb-6"
              >
                We track your vehicle value in real time. You get every update.
              </h2>

              {/* Subheadline */}
              <p className="text-base lg:text-lg text-foreground/65 leading-relaxed mb-10 max-w-lg">
                Market conditions change constantly — and so does your
                vehicle's value. We monitor the market and notify you
                when your value changes or when it may be a good time to
                sell.
              </p>

              {/* Trust points — 3-col grid on sm+, stacks on mobile. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-2xl">
                {TRUST_POINTS.map(({ Icon, title, body }) => (
                  <div key={title}>
                    <Icon
                      className="w-5 h-5 text-primary mb-3"
                      strokeWidth={1.75}
                    />
                    <p className="text-sm font-semibold text-foreground mb-1.5">
                      {title}
                    </p>
                    <p className="text-[13px] text-foreground/65 leading-relaxed">
                      {body}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA — text-link style per spec (not a filled button).
                  Opens the ValueTrackingModal explainer; the modal's
                  own "Get Started" handles the scroll-to-form. */}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 text-base font-semibold text-primary underline-offset-4 hover:underline"
              >
                Learn how it works
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* ── RIGHT COLUMN — tracker card ─────────────────────────── */}
            <div className="bg-white rounded-3xl border border-border/60 shadow-[0_12px_40px_-16px_rgb(15_23_42_/_0.12)] p-6 lg:p-8">
              {/* Top row: thumbnail + title + tracking badge */}
              <div className="flex items-start gap-4 mb-8">
                {/* Vehicle thumbnail — dynamically resolves to the
                    dealership's OEM flagship via VehicleImage's
                    Black Book → Wikipedia → AI cascade. The image
                    sits in a soft-gray rounded square so the white
                    PNG bg disappears into the frame. */}
                <div
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: "hsl(220 14% 96%)" }}
                  aria-hidden
                >
                  <VehicleImage
                    year={flagship.year}
                    make={flagship.make}
                    model={flagship.model}
                    style={flagship.style}
                    selectedColor="Silver"
                    hideColorLabel
                    fill
                    transparent
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
                        {flagship.year} {flagship.make} {flagship.model} {flagship.style}
                      </h3>
                      <p className="text-[13px] text-foreground/60 mt-1">
                        {flagship.specs}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 shrink-0">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Tracking Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle row: value block (left) + chart (right) */}
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 lg:gap-8 mb-8">
                {/* Value block */}
                <div className="md:max-w-[180px]">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-foreground/55 font-semibold mb-2">
                    Current Estimated Value
                  </p>
                  <p className="text-[40px] lg:text-[44px] font-bold text-foreground leading-none tracking-tight mb-4 tabular-nums">
                    $23,450
                  </p>
                  <div className="inline-flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100">
                      <ArrowUp
                        className="w-3 h-3 text-emerald-600"
                        strokeWidth={2.5}
                      />
                    </span>
                    <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                      + $1,275 (5.7%)
                    </span>
                  </div>
                  <p className="text-xs text-foreground/60">in the last 30 days</p>
                </div>

                {/* Chart */}
                <div className="min-w-0">
                  <svg
                    viewBox="0 0 520 260"
                    className="w-full h-auto"
                    role="img"
                    aria-label="Vehicle value trend from $19K on March 1, rising steadily with a dip around March 29, then a strong recovery to $25K by May 10."
                  >
                    <defs>
                      <linearGradient id="value-tracker-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Dashed horizontal grid lines */}
                    {Y_TICKS.map(({ y }) => (
                      <line
                        key={y}
                        x1="35"
                        y1={y}
                        x2="485"
                        y2={y}
                        stroke="hsl(220 13% 91%)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Area fill under the line */}
                    <path d={CHART_FILL_PATH} fill="url(#value-tracker-fill)" />

                    {/* Trend line — navy */}
                    <path
                      d={CHART_LINE_PATH}
                      fill="none"
                      stroke="#1e3a8a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Highlight glow + marker on the final point */}
                    <circle
                      cx={FINAL_POINT.x}
                      cy={FINAL_POINT.y}
                      r="14"
                      fill="#86efac"
                      fillOpacity="0.45"
                    />
                    <circle
                      cx={FINAL_POINT.x}
                      cy={FINAL_POINT.y}
                      r="7"
                      fill="white"
                      stroke="#1e3a8a"
                      strokeWidth="3"
                    />
                    <circle
                      cx={FINAL_POINT.x}
                      cy={FINAL_POINT.y}
                      r="3"
                      fill="#1e3a8a"
                    />

                    {/* Open-circle marker on the starting point */}
                    <circle
                      cx={START_POINT.x}
                      cy={START_POINT.y}
                      r="4.5"
                      fill="white"
                      stroke="#1e3a8a"
                      strokeWidth="2"
                    />

                    {/* Y-axis labels (right side) */}
                    {Y_TICKS.map(({ y, label }) => (
                      <text
                        key={label}
                        x="515"
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fontWeight="500"
                        fill="hsl(220 13% 55%)"
                      >
                        {label}
                      </text>
                    ))}

                    {/* X-axis labels */}
                    {X_LABELS.map(({ x, label }, i) => (
                      <text
                        key={label}
                        x={x}
                        y="250"
                        textAnchor={
                          i === 0 ? "start" : i === X_LABELS.length - 1 ? "end" : "middle"
                        }
                        fontSize="10"
                        fontWeight="600"
                        fill="hsl(220 13% 55%)"
                        letterSpacing="0.04em"
                      >
                        {label}
                      </text>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Bottom row: two notification mini-cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Value updated — green accent */}
                <div className="rounded-2xl bg-emerald-50/60 p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <TrendingUp
                      className="w-4 h-4 text-emerald-600"
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">
                      Value updated
                    </p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5 tabular-nums">
                      +$275 in 14 days
                    </p>
                    <button
                      type="button"
                      onClick={scrollToForm}
                      className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      View your updated estimate
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Notify — navy accent */}
                <div
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: "hsl(220 100% 97%)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "hsl(220 100% 93%)" }}
                  >
                    <Bell className="w-4 h-4 text-primary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">
                      We'll notify you
                    </p>
                    <p className="text-sm font-semibold text-foreground/75 mt-0.5">
                      when your value changes
                    </p>
                    <p className="text-[11px] text-foreground/60 mt-1.5">
                      Never miss a selling opportunity.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ValueTrackingModal open={showModal} onOpenChange={setShowModal} />
    </section>
  );
};

export default ValueTrackerCard;
