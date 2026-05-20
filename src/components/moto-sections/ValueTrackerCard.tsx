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
import {
  ShieldCheck,
  Bell,
  TrendingUp,
  ArrowRight,
  ArrowUp,
} from "lucide-react";
import vehicleImage from "@/assets/value-tracker-vehicle.png";

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
// 22 hand-tuned data points reproduce the reference screenshot's
// jagged-yet-readable trend: bumpy climb from Mar 1 to a small local
// peak near Mar 22, V-shape dip to ~$20.2K right around Mar 29, then
// a bumpy recovery to the all-time high at May 10. Each consecutive
// pair varies by ~$0.1-0.5K so the line reads as real market noise
// instead of a smoothed marketing curve.
//
// Path is built with straight-line segments (L commands) instead of
// quadratic curves — with this point density, bezier smoothing was
// flattening the bumps the reference shows. Stroke-linejoin "round"
// softens the angles enough that they don't read as graphics-paper
// sharp.
const yFor = (k: number) => 240 - ((k - 19) * 200) / 6;

const POINTS: { x: number; k: number }[] = [
  { x: 40,  k: 19.70 },  // Mar 1 — start
  { x: 65,  k: 19.85 },
  { x: 90,  k: 19.75 },  // small early dip
  { x: 115, k: 20.05 },
  { x: 140, k: 20.30 },  // Mar 15
  { x: 165, k: 20.45 },
  { x: 190, k: 20.30 },  // small wobble down
  { x: 215, k: 20.75 },
  { x: 240, k: 20.55 },  // descent into the dip starts
  { x: 265, k: 20.20 },  // Mar 29 — bottom of the V
  { x: 290, k: 20.55 },  // recovery begins
  { x: 315, k: 20.85 },
  { x: 340, k: 21.10 },
  { x: 365, k: 21.00 },  // small wobble during recovery
  { x: 390, k: 21.40 },
  { x: 415, k: 21.65 },  // ~Apr 19
  { x: 440, k: 22.00 },
  { x: 465, k: 22.25 },
  { x: 490, k: 22.75 },
  { x: 515, k: 23.35 },
  { x: 540, k: 24.10 },
  { x: 560, k: 25.00 },  // May 10 — final highlighted marker
];

function buildChartPath() {
  let d = `M ${POINTS[0].x} ${yFor(POINTS[0].k).toFixed(1)}`;
  for (let i = 1; i < POINTS.length; i++) {
    d += ` L ${POINTS[i].x} ${yFor(POINTS[i].k).toFixed(1)}`;
  }
  return d;
}

const CHART_LINE_PATH = buildChartPath();
const CHART_FILL_PATH = `${CHART_LINE_PATH} L 560 240 L 40 240 Z`;

// Y-axis ticks (labels on the right edge of the chart area).
const Y_TICKS = [
  { k: 25, label: "$25K" },
  { k: 23, label: "$23K" },
  { k: 21, label: "$21K" },
  { k: 19, label: "$19K" },
];

// X-axis label positions (6 labels evenly spaced).
const X_LABELS = [
  { x: 40, label: "MAR 1" },
  { x: 144, label: "MAR 15" },
  { x: 248, label: "MAR 29" },
  { x: 352, label: "APR 12" },
  { x: 456, label: "APR 26" },
  { x: 560, label: "MAY 10" },
];

const ValueTrackerCard = () => {
  const finalPoint = POINTS[POINTS.length - 1];
  const finalY = yFor(finalPoint.k);

  return (
    <section
      aria-labelledby="value-tracking-heading"
      className="py-20 lg:py-28 px-5 border-t border-border/60"
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

              {/* CTA — text-link style per spec (not a filled button). */}
              <button
                type="button"
                onClick={scrollToForm}
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
                {/* Vehicle thumbnail placeholder — Lucide Car on soft-gray
                    rounded square. Editable later with a real image
                    via background-image if a per-tenant or
                    vehicle-specific shot is wanted. */}
                <div
                  className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: "hsl(220 14% 96%)" }}
                  aria-hidden
                >
                  <img
                    src={vehicleImage}
                    alt=""
                    loading="lazy"
                    width={1024}
                    height={1024}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-lg lg:text-xl font-bold text-foreground tracking-tight truncate">
                        2022 Ford Explorer XLT
                      </h3>
                      <p className="text-[13px] text-foreground/60 mt-1">
                        4D SUV · 2.3L EcoBoost · 38,450 mi
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
                    viewBox="0 0 600 280"
                    className="w-full h-auto"
                    role="img"
                    aria-label="Vehicle value trend from $19.7K on March 1, climbing with daily fluctuations to a small peak near March 22, dipping to $20.2K on March 29, then recovering with continued bumps to $25K by May 10."
                  >
                    {/* Dashed horizontal grid lines */}
                    {Y_TICKS.map(({ k }) => (
                      <line
                        key={k}
                        x1="40"
                        y1={yFor(k)}
                        x2="560"
                        y2={yFor(k)}
                        stroke="hsl(220 13% 91%)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Area fill under the line */}
                    <path
                      d={CHART_FILL_PATH}
                      fill="hsl(var(--primary))"
                      fillOpacity="0.06"
                    />

                    {/* Trend line */}
                    <path
                      d={CHART_LINE_PATH}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Highlight ring + marker on the final data point */}
                    <circle
                      cx={finalPoint.x}
                      cy={finalY}
                      r="14"
                      fill="hsl(var(--primary))"
                      fillOpacity="0.12"
                    />
                    <circle
                      cx={finalPoint.x}
                      cy={finalY}
                      r="7"
                      fill="white"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                    />

                    {/* Y-axis labels (right side) */}
                    {Y_TICKS.map(({ k, label }) => (
                      <text
                        key={k}
                        x="595"
                        y={yFor(k) + 4}
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
                        y="270"
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
    </section>
  );
};

export default ValueTrackerCard;
