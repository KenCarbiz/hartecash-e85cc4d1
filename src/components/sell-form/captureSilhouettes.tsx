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
    case "exterior_passenger":
      return (
        <svg viewBox="0 0 240 110" className={className}>
          {/* Side profile — windshield curve, roof, trunk */}
          <path
            d="M20 75 L40 75 Q50 55 70 50 L130 38 Q160 38 175 50 L210 65 L220 75"
            {...common}
          />
          <line x1="20" y1="80" x2="220" y2="80" {...common} />
          {/* Window glass */}
          <path d="M62 70 Q72 55 88 53 L138 45 Q150 47 162 56 L172 70" {...common} />
          <line x1="115" y1="48" x2="115" y2="70" {...common} />
          {/* Wheels */}
          <circle cx="55" cy="90" r="14" {...common} />
          <circle cx="185" cy="90" r="14" {...common} />
          {/* Door handle hint */}
          <line x1="100" y1="75" x2="115" y2="75" {...common} />
        </svg>
      );

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

    default:
      return (
        <svg viewBox="0 0 200 200" className={className}>
          <rect x="20" y="40" width="160" height="120" rx="12" {...common} />
        </svg>
      );
  }
};

export default ShotSilhouette;
