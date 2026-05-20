// "Track your vehicle value for free" promo card — MotoAcquire's
// signature secondary conversion, ported. Left column has the pitch
// + Learn More CTA; right column has a soft value-curve illustration
// going from "Current Value $" up to "Consider Selling $$".
//
// CTA scrolls to the form (the SellFlow's contact step is where the
// "Track my value monthly" toggle lives — default on, see
// MotoTrackValueBlock + MotoStepContact). Customer enters the form,
// hits the toggle (already on), and finishes contact → they're
// auto-subscribed to monthly value updates via watched_vehicles.
//
// Visual: hairline border, no shadow, soft-gray bg accent at right,
// single muted accent green for the curve to differentiate from the
// navy primary CTAs everywhere else.
import { ArrowRight } from "lucide-react";

const scrollToForm = () => {
  const form = document.getElementById("sell-car-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const ValueCurve = () => (
  <svg
    viewBox="0 0 360 180"
    className="w-full max-w-md"
    aria-hidden
    role="img"
  >
    {/* Soft-gray plate behind the curve */}
    <rect
      x="0"
      y="0"
      width="360"
      height="180"
      rx="12"
      fill="hsl(220 14% 96%)"
    />
    {/* Curve from low (left) to high (right) */}
    <path
      d="M 24 150 C 96 150 132 100 200 88 C 260 76 308 38 340 32"
      fill="none"
      stroke="#22c55e"
      strokeWidth="5"
      strokeLinecap="round"
    />
    {/* Current Value pill (lower-left marker) */}
    <g transform="translate(160 80)">
      <circle cx="0" cy="0" r="6" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
    </g>
    <g transform="translate(110 30)">
      <rect width="100" height="26" rx="13" fill="hsl(220 13% 70%)" />
      <text
        x="50"
        y="17"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#fff"
      >
        Current Value
      </text>
    </g>
    <text
      x="160"
      y="115"
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      fill="#94a3b8"
    >
      $
    </text>
    {/* Consider Selling pill (upper-right marker) */}
    <g transform="translate(290 28)">
      <circle cx="0" cy="0" r="6" fill="#fff" stroke="#22c55e" strokeWidth="2.5" />
    </g>
    <g transform="translate(248 -4)">
      <rect width="120" height="26" rx="13" fill="hsl(222 47% 18%)" />
      <text
        x="60"
        y="17"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#fff"
      >
        Consider Selling
      </text>
    </g>
    <text
      x="290"
      y="62"
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      fill="hsl(222 47% 18%)"
    >
      $$
    </text>
  </svg>
);

const ValueTrackerCard = () => (
  <section
    aria-labelledby="tracker-heading"
    className="py-20 lg:py-24 px-5 bg-background border-t border-border/60"
  >
    <div className="max-w-5xl mx-auto rounded-2xl border border-border/60 bg-card p-8 lg:p-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2
            id="tracker-heading"
            className="text-3xl font-semibold tracking-tight text-foreground mb-4"
          >
            Track your vehicle value for free
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-6 max-w-md">
            Understand and track your vehicle's value over time — completely
            free. Know when it's the right moment to sell for top dollar.
          </p>
          <button
            type="button"
            onClick={scrollToForm}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Learn more
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ValueCurve />
        </div>
      </div>
    </div>
  </section>
);

export default ValueTrackerCard;
