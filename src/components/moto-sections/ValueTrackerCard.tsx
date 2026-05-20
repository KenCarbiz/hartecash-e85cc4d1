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
import { useTenant } from "@/contexts/TenantContext";
import VehicleImage from "@/components/sell-form/VehicleImage";

// Map of OEM brand → flagship vehicle to feature in the value
// tracker mockup. Keys are lowercased substrings searched inside
// tenant.display_name (e.g. "Harte Infiniti" → infiniti). The
// model is chosen as the brand's highest-volume / most recognizable
// nameplate so a customer landing on, say, a Ford dealer's site
// sees a Ford in the tracker card — not a generic Explorer.
const OEM_FLAGSHIPS: Record<string, { year: string; make: string; model: string; style: string; specs: string }> = {
  ford:        { year: "2022", make: "Ford",        model: "Explorer",  style: "XLT",      specs: "4D SUV · 2.3L EcoBoost · 38,450 mi" },
  chevrolet:   { year: "2022", make: "Chevrolet",   model: "Silverado", style: "LT",       specs: "Crew Cab · 5.3L V8 · 36,200 mi" },
  chevy:       { year: "2022", make: "Chevrolet",   model: "Silverado", style: "LT",       specs: "Crew Cab · 5.3L V8 · 36,200 mi" },
  gmc:         { year: "2022", make: "GMC",         model: "Sierra",    style: "SLT",      specs: "Crew Cab · 5.3L V8 · 34,100 mi" },
  buick:       { year: "2022", make: "Buick",       model: "Enclave",   style: "Premium",  specs: "4D SUV · 3.6L V6 · 32,800 mi" },
  cadillac:    { year: "2022", make: "Cadillac",    model: "Escalade",  style: "Premium",  specs: "4D SUV · 6.2L V8 · 28,900 mi" },
  ram:         { year: "2022", make: "Ram",         model: "1500",      style: "Big Horn", specs: "Crew Cab · 5.7L HEMI · 39,200 mi" },
  dodge:       { year: "2022", make: "Dodge",       model: "Charger",   style: "GT",       specs: "Sedan · 3.6L V6 · 31,400 mi" },
  jeep:        { year: "2022", make: "Jeep",        model: "Grand Cherokee", style: "Limited", specs: "4D SUV · 3.6L V6 · 34,700 mi" },
  chrysler:    { year: "2022", make: "Chrysler",    model: "Pacifica",  style: "Touring L", specs: "Minivan · 3.6L V6 · 33,500 mi" },
  toyota:      { year: "2022", make: "Toyota",      model: "RAV4",      style: "XLE",      specs: "4D SUV · 2.5L · 36,100 mi" },
  lexus:       { year: "2022", make: "Lexus",       model: "RX 350",    style: "Premium",  specs: "4D SUV · 3.5L V6 · 29,800 mi" },
  honda:       { year: "2022", make: "Honda",       model: "CR-V",      style: "EX-L",     specs: "4D SUV · 1.5L Turbo · 37,400 mi" },
  acura:       { year: "2022", make: "Acura",       model: "MDX",       style: "Technology", specs: "4D SUV · 3.5L V6 · 30,200 mi" },
  nissan:      { year: "2022", make: "Nissan",      model: "Rogue",     style: "SV",       specs: "4D SUV · 2.5L · 38,900 mi" },
  infiniti:    { year: "2022", make: "Infiniti",    model: "QX60",      style: "Luxe",     specs: "4D SUV · 3.5L V6 · 31,600 mi" },
  hyundai:     { year: "2022", make: "Hyundai",     model: "Tucson",    style: "SEL",      specs: "4D SUV · 2.5L · 35,800 mi" },
  kia:         { year: "2022", make: "Kia",         model: "Telluride", style: "EX",       specs: "4D SUV · 3.8L V6 · 32,400 mi" },
  genesis:     { year: "2022", make: "Genesis",     model: "GV80",      style: "3.5T",     specs: "4D SUV · 3.5L Twin-Turbo · 28,100 mi" },
  subaru:      { year: "2022", make: "Subaru",      model: "Outback",   style: "Premium",  specs: "Wagon · 2.5L · 36,700 mi" },
  mazda:       { year: "2022", make: "Mazda",       model: "CX-5",      style: "Touring",  specs: "4D SUV · 2.5L · 34,500 mi" },
  volkswagen:  { year: "2022", make: "Volkswagen",  model: "Atlas",     style: "SE",       specs: "4D SUV · 3.6L V6 · 35,200 mi" },
  vw:          { year: "2022", make: "Volkswagen",  model: "Atlas",     style: "SE",       specs: "4D SUV · 3.6L V6 · 35,200 mi" },
  audi:        { year: "2022", make: "Audi",        model: "Q5",        style: "Premium",  specs: "4D SUV · 2.0L Turbo · 29,400 mi" },
  bmw:         { year: "2022", make: "BMW",         model: "X5",        style: "xDrive40i", specs: "4D SUV · 3.0L Turbo · 30,900 mi" },
  mercedes:    { year: "2022", make: "Mercedes-Benz", model: "GLE 350", style: "4MATIC",   specs: "4D SUV · 2.0L Turbo · 28,700 mi" },
  porsche:     { year: "2022", make: "Porsche",     model: "Macan",     style: "Base",     specs: "4D SUV · 2.0L Turbo · 26,500 mi" },
  volvo:       { year: "2022", make: "Volvo",       model: "XC60",      style: "Momentum", specs: "4D SUV · 2.0L Turbo · 30,300 mi" },
  mini:        { year: "2022", make: "MINI",        model: "Cooper",    style: "S",        specs: "Hatchback · 2.0L Turbo · 27,800 mi" },
  mitsubishi:  { year: "2022", make: "Mitsubishi",  model: "Outlander", style: "SEL",      specs: "4D SUV · 2.5L · 33,900 mi" },
  tesla:       { year: "2022", make: "Tesla",       model: "Model Y",   style: "Long Range", specs: "4D SUV · Dual Motor · 28,400 mi" },
  lincoln:     { year: "2022", make: "Lincoln",     model: "Nautilus",  style: "Reserve",  specs: "4D SUV · 2.0L Turbo · 29,600 mi" },
};

const DEFAULT_FLAGSHIP = OEM_FLAGSHIPS.ford;

function resolveFlagship(displayName: string | undefined) {
  if (!displayName) return DEFAULT_FLAGSHIP;
  const name = displayName.toLowerCase();
  // Sort keys longest-first so "chevrolet" wins over "chevy" if both
  // appear, and "mercedes-benz" wouldn't be mis-shadowed by a shorter
  // partial match.
  const keys = Object.keys(OEM_FLAGSHIPS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (name.includes(key)) return OEM_FLAGSHIPS[key];
  }
  return DEFAULT_FLAGSHIP;
}

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
// Data points were hand-tuned for the rise → dip → recovery shape
// the product owner provided in the reference screenshot: low start,
// climb through Mar 15 to a small local peak (~$21.3K) around Mar
// 22, a visible V-shaped dip to ~$20.5K at Mar 29, then a strong
// steady recovery to the all-time high at May 10. Quadratic-bezier
// control points add organic curvature between data nodes without
// being volatile.
const yFor = (k: number) => 240 - ((k - 19) * 200) / 6;

const POINTS: { x: number; k: number }[] = [
  { x: 40, k: 19.7 },   // Mar 1 — low start
  { x: 92, k: 20.3 },   // climbing
  { x: 144, k: 21.0 },  // Mar 15
  { x: 196, k: 21.3 },  // local peak before the dip
  { x: 248, k: 20.5 },  // Mar 29 — the DIP
  { x: 300, k: 20.8 },  // recovery begins
  { x: 352, k: 21.8 },  // Apr 12 — back above pre-dip levels
  { x: 404, k: 22.5 },
  { x: 456, k: 23.4 },  // Apr 26
  { x: 508, k: 24.2 },
  { x: 560, k: 25.0 },  // May 10 — final highlighted marker
];

// Smooth path via quadratic curves between data points. Each segment
// uses the midpoint of (prev, curr) as the curve target with the
// prev point as the control — keeps the line organic without
// veering off the data values.
function buildChartPath() {
  let d = `M ${POINTS[0].x} ${yFor(POINTS[0].k).toFixed(1)}`;
  for (let i = 1; i < POINTS.length; i++) {
    const prev = POINTS[i - 1];
    const cur = POINTS[i];
    const mx = (prev.x + cur.x) / 2;
    const my = (yFor(prev.k) + yFor(cur.k)) / 2;
    d += ` Q ${prev.x} ${yFor(prev.k).toFixed(1)} ${mx} ${my.toFixed(1)}`;
  }
  // Close to the final data point with a straight last segment so
  // the highlighted marker lands precisely on the data value.
  d += ` L ${POINTS[POINTS.length - 1].x} ${yFor(POINTS[POINTS.length - 1].k).toFixed(1)}`;
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
  const { tenant } = useTenant();
  const flagship = resolveFlagship(tenant?.display_name);
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
                    viewBox="0 0 600 280"
                    className="w-full h-auto"
                    role="img"
                    aria-label="Vehicle value trend from $19.7K on March 1, dipping to $20.5K on March 29, then recovering steadily to $25K by May 10."
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
