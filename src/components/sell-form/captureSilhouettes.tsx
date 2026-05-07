/**
 * Per-shot SVG silhouette overlays for the boost-page custom
 * camera. Each silhouette communicates "the front of a car / the
 * side / the dashboard / a wheel" at a glance — diagrammatic, not
 * photo-realistic, mirroring the passport-photo and check-deposit
 * overlay convention. Stroke is color-stateful so the overlay
 * itself becomes a feedback signal:
 *
 *   neutral  → white  (idle, plenty of light, customer aligning)
 *   ok       → emerald (brightness sampler is happy + ready to capture)
 *   warn     → amber  (brightness sampler tripped — too dark to score)
 *
 * Lives in its own file so the state-machine + render code in
 * CaptureWithOverlay stays focused on stream lifecycle and event
 * orchestration. Future per-vehicle-class silhouettes (truck bed,
 * SUV liftgate, etc.) get added here without touching the modal.
 */

export type SilhouetteState = "neutral" | "ok" | "warn";

const STROKE_BY_STATE: Record<SilhouetteState, string> = {
  neutral: "#ffffff",
  ok:      "#34d399", // tailwind emerald-400 — matches the receipt accent
  warn:    "#fbbf24", // tailwind amber-400 — matches the brightness banner
};

interface ShotSilhouetteProps {
  shotKey: string;
  className?: string;
  state?: SilhouetteState; // default "neutral"
}

const ShotSilhouette = ({ shotKey, className, state = "neutral" }: ShotSilhouetteProps) => {
  const stroke = STROKE_BY_STATE[state];
  const strokeWidth = 1.5;
  const common = {
    fill: "none",
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { transition: "stroke 220ms cubic-bezier(0.16, 1, 0.3, 1)" },
  };

  switch (shotKey) {
    case "exterior_front":
      return (
        <svg viewBox="0 0 200 130" className={className}>
          {/* Hood + roof outline */}
          <path d="M30 95 Q30 60 50 50 L80 35 L120 35 L150 50 Q170 60 170 95" {...common} />
          {/* Bumper line */}
          <line x1="20" y1="95" x2="180" y2="95" {...common} />
          {/* Headlights */}
          <ellipse cx="55" cy="72" rx="14" ry="8" {...common} />
          <ellipse cx="145" cy="72" rx="14" ry="8" {...common} />
          {/* Grille */}
          <rect x="80" y="68" width="40" height="20" rx="3" {...common} />
          <line x1="85" y1="78" x2="115" y2="78" {...common} />
          {/* Wheels (lower edge) */}
          <circle cx="40" cy="105" r="10" {...common} />
          <circle cx="160" cy="105" r="10" {...common} />
        </svg>
      );

    case "exterior_driver":
    case "exterior_passenger": {
      // Detailed sedan side profile — replaces the simpler outline
      // per dealer feedback. Driver-side faces left (front of car
      // on the left edge); passenger-side mirrors it horizontally
      // so a customer standing on either side sees the front of
      // the car at the corresponding edge of the silhouette.
      const SedanSide = (
        <g {...common}>
          {/* Body outline — front bumper around the front wheel,
              hood, A-pillar, roof, C-pillar, trunk, rear bumper */}
          <path d="M 38 282
                   Q 32 232 52 220
                   Q 80 213 115 213
                   L 135 196
                   Q 152 184 180 178
                   L 285 168
                   Q 305 165 320 148
                   L 380 92
                   Q 402 76 442 75
                   L 528 75
                   Q 558 75 576 100
                   L 614 158
                   Q 638 165 654 174
                   L 660 235
                   Q 661 268 650 282" />
          {/* Rocker / under-body line tying the front and rear
              bumpers together along the bottom */}
          <line x1="38" y1="282" x2="650" y2="282" />
          {/* Front wheel + wheel-arch */}
          <circle cx="180" cy="290" r="56" />
          <path d="M 124 290 A 56 56 0 0 1 236 290" />
          {/* Rear wheel + wheel-arch */}
          <circle cx="540" cy="290" r="56" />
          <path d="M 484 290 A 56 56 0 0 1 596 290" />
          {/* Window glass */}
          <path d="M 320 152 L 380 96 L 442 86 L 528 86 L 576 102 L 614 158 Z" />
          {/* B-pillar (split between front and rear glass) */}
          <line x1="458" y1="86" x2="458" y2="158" />
          {/* Vertical seam between front and rear doors at the
              B-pillar, plus a hint of where the rear door ends */}
          <line x1="378" y1="158" x2="378" y2="270" />
          <line x1="458" y1="158" x2="458" y2="270" />
          {/* Door handles — front + rear */}
          <rect x="396" y="170" width="34" height="6" rx="2" />
          <rect x="510" y="170" width="34" height="6" rx="2" />
          {/* Side mirror (small bump above the A-pillar / front door) */}
          <ellipse cx="338" cy="138" rx="10" ry="6" />
          {/* Headlight cluster hint at the front */}
          <ellipse cx="78" cy="226" rx="20" ry="7" />
        </g>
      );
      return (
        <svg viewBox="0 0 700 350" className={className}>
          {shotKey === "exterior_passenger" ? (
            // Mirror horizontally so the customer's view from the
            // passenger side reads correctly (front of car on the
            // right edge of the silhouette).
            <g transform="translate(700,0) scale(-1,1)">{SedanSide}</g>
          ) : (
            SedanSide
          )}
        </svg>
      );
    }

    case "exterior_rear":
      return (
        <svg viewBox="0 0 200 130" className={className}>
          {/* Trunk + rear glass + roof */}
          <path d="M30 95 Q30 65 45 55 L75 42 L125 42 L155 55 Q170 65 170 95" {...common} />
          <line x1="20" y1="95" x2="180" y2="95" {...common} />
          {/* Rear glass */}
          <path d="M55 60 L80 50 L120 50 L145 60" {...common} />
          {/* Taillights */}
          <rect x="32" y="72" width="22" height="14" rx="3" {...common} />
          <rect x="146" y="72" width="22" height="14" rx="3" {...common} />
          {/* License plate area */}
          <rect x="80" y="78" width="40" height="14" rx="2" {...common} />
          {/* Wheels */}
          <circle cx="40" cy="105" r="10" {...common} />
          <circle cx="160" cy="105" r="10" {...common} />
        </svg>
      );

    case "dashboard_odometer":
      return (
        <svg viewBox="0 0 240 130" className={className}>
          {/* Steering wheel arc at the bottom */}
          <path d="M70 115 Q120 95 170 115" {...common} />
          <circle cx="120" cy="120" r="6" {...common} />
          {/* Gauge cluster — tach + speedo + center info */}
          <rect x="40" y="35" width="160" height="60" rx="10" {...common} />
          <circle cx="80" cy="65" r="22" {...common} />
          <circle cx="160" cy="65" r="22" {...common} />
          <rect x="110" y="55" width="20" height="20" rx="3" {...common} />
          {/* Odometer text-line hint inside center */}
          <line x1="113" y1="68" x2="127" y2="68" {...common} />
        </svg>
      );

    case "tires_wheels":
      return (
        <svg viewBox="0 0 200 200" className={className}>
          {/* Tire (outer) */}
          <circle cx="100" cy="100" r="85" {...common} />
          {/* Wheel (inner) */}
          <circle cx="100" cy="100" r="55" {...common} />
          {/* Hub */}
          <circle cx="100" cy="100" r="12" {...common} />
          {/* Spokes */}
          <line x1="100" y1="50" x2="100" y2="150" {...common} />
          <line x1="50" y1="100" x2="150" y2="100" {...common} />
          <line x1="65" y1="65" x2="135" y2="135" {...common} />
          <line x1="135" y1="65" x2="65" y2="135" {...common} />
          {/* Tread band hint (outer ring decorations) */}
          <circle cx="100" cy="100" r="78" strokeDasharray="4 4" {...common} />
        </svg>
      );

    case "interior_driver_seat":
      return (
        <svg viewBox="0 0 180 200" className={className}>
          {/* Seatback — slight curve, side bolsters suggested */}
          <path d="M50 30 Q50 20 60 20 L120 20 Q130 20 130 30 L130 110 L50 110 Z" {...common} />
          {/* Side bolster lines (the wear-tell zone) */}
          <line x1="60" y1="30" x2="60" y2="110" {...common} />
          <line x1="120" y1="30" x2="120" y2="110" {...common} />
          {/* Seat base / cushion */}
          <path d="M40 110 L140 110 L150 170 L30 170 Z" {...common} />
          {/* Bolster lines on the cushion (where getting-in-out wears) */}
          <line x1="48" y1="110" x2="38" y2="170" {...common} />
          <line x1="132" y1="110" x2="142" y2="170" {...common} />
          {/* Headrest */}
          <rect x="70" y="2" width="40" height="22" rx="6" {...common} />
        </svg>
      );

    case "interior_steering_wheel":
      return (
        <svg viewBox="0 0 200 200" className={className}>
          {/* Outer wheel rim */}
          <circle cx="100" cy="100" r="78" {...common} />
          {/* Inner rim hint (depth) */}
          <circle cx="100" cy="100" r="68" strokeDasharray="3 5" {...common} />
          {/* Center hub */}
          <ellipse cx="100" cy="100" rx="28" ry="22" {...common} />
          {/* Three-spoke layout (left, right, bottom) — modern cars */}
          <line x1="32" y1="100" x2="72" y2="100" {...common} />
          <line x1="128" y1="100" x2="168" y2="100" {...common} />
          <line x1="100" y1="122" x2="100" y2="170" {...common} />
          {/* Buttons / control hints on the spokes */}
          <circle cx="50" cy="100" r="3" {...common} />
          <circle cx="150" cy="100" r="3" {...common} />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 200 200" className={className}>
          <rect x="20" y="40" width="160" height="120" rx="12" {...common} />
        </svg>
      );
  }
};

export default ShotSilhouette;
