import { type LandingTemplate } from "@/hooks/useSiteConfig";

interface Props {
  template: LandingTemplate;
  className?: string;
}

/**
 * Schematic SVG previews of each landing template. Abstract on purpose —
 * they convey layout/vibe (split vs asymmetric vs search vs serif vs grid)
 * without needing real screenshots that would drift as the templates
 * evolve. Uses theme CSS vars so the dealer's palette applies.
 */
const TemplateThumbnail = ({ template, className = "" }: Props) => {
  const wrapClass = `w-full h-full rounded-md overflow-hidden bg-muted ${className}`;
  const common = {
    viewBox: "0 0 160 100",
    preserveAspectRatio: "xMidYMid slice" as const,
    className: "w-full h-full block",
  };

  switch (template) {
    // ── CLASSIC: split hero (text left, form right) + stacked sections ──
    case "classic":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="48" fill="hsl(var(--primary))" />
            <rect x="8" y="10" width="58" height="4" rx="1" fill="hsl(var(--primary-foreground) / 0.9)" />
            <rect x="8" y="17" width="46" height="4" rx="1" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="8" y="27" width="36" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            <rect x="8" y="32" width="40" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            <rect x="8" y="37" width="30" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            <rect x="82" y="8" width="70" height="72" rx="3" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
            <rect x="88" y="14" width="40" height="3" rx="1" fill="hsl(var(--foreground) / 0.7)" />
            <rect x="88" y="22" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="32" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="42" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="56" width="58" height="8" rx="2" fill="hsl(var(--primary))" />
            <rect x="0" y="48" width="160" height="52" fill="hsl(var(--background))" />
            <rect x="16" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
            <rect x="64" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
            <rect x="112" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
          </svg>
        </div>
      );

    // ── BOLD: asymmetric dark hero, big type left, proof column right ──
    case "bold":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <linearGradient id="bold-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(220 40% 8%)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="160" height="78" fill="url(#bold-bg)" />
            {/* Big asymmetric headline */}
            <rect x="8" y="12" width="100" height="9" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="8" y="24" width="78" height="9" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="8" y="40" width="80" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.6)" />
            <rect x="8" y="46" width="68" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.6)" />
            {/* Single CTA pill */}
            <rect x="8" y="56" width="46" height="9" rx="4.5" fill="hsl(var(--accent))" />
            {/* Proof column right */}
            <rect x="118" y="14" width="36" height="14" rx="2" fill="hsl(var(--primary-foreground) / 0.06)" stroke="hsl(var(--primary-foreground) / 0.15)" strokeWidth="0.5" />
            <rect x="121" y="18" width="14" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.85)" />
            <rect x="121" y="23" width="22" height="2" rx="0.5" fill="hsl(var(--primary-foreground) / 0.5)" />
            <rect x="118" y="32" width="36" height="14" rx="2" fill="hsl(var(--primary-foreground) / 0.06)" stroke="hsl(var(--primary-foreground) / 0.15)" strokeWidth="0.5" />
            <rect x="121" y="36" width="14" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.85)" />
            <rect x="121" y="41" width="22" height="2" rx="0.5" fill="hsl(var(--primary-foreground) / 0.5)" />
            {/* Form card peeking up */}
            <rect x="40" y="72" width="80" height="28" rx="3" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
            <rect x="46" y="78" width="68" height="3" rx="0.5" fill="hsl(var(--muted))" />
            <rect x="46" y="84" width="68" height="3" rx="0.5" fill="hsl(var(--muted))" />
            <rect x="46" y="91" width="68" height="5" rx="1" fill="hsl(var(--primary))" />
          </svg>
        </div>
      );

    // ── MINIMAL: huge whitespace, one giant search pill ──
    case "minimal":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(var(--background))" />
            {/* Tiny tagline */}
            <rect x="62" y="22" width="36" height="2" rx="0.5" fill="hsl(var(--primary) / 0.7)" />
            {/* Big centered headline */}
            <rect x="36" y="32" width="88" height="6" rx="1" fill="hsl(var(--foreground))" />
            <rect x="48" y="42" width="64" height="3" rx="0.5" fill="hsl(var(--muted-foreground) / 0.7)" />
            {/* One enormous search pill */}
            <rect x="20" y="56" width="120" height="14" rx="7" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.7" />
            <circle cx="30" cy="63" r="2" fill="hsl(var(--muted-foreground) / 0.5)" />
            <rect x="36" y="61" width="58" height="2" rx="0.4" fill="hsl(var(--muted-foreground) / 0.5)" />
            <rect x="36" y="65" width="48" height="2" rx="0.4" fill="hsl(var(--muted-foreground) / 0.3)" />
            <rect x="106" y="58.5" width="32" height="9" rx="4.5" fill="hsl(var(--primary))" />
            {/* Subtle bottom hint */}
            <circle cx="80" cy="84" r="1.4" fill="hsl(var(--muted-foreground) / 0.4)" />
          </svg>
        </div>
      );

    // ── ELEGANT: dark + cream + serif feel + horizontal rule motif ──
    case "elegant":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            {/* Dark hero band */}
            <rect x="0" y="0" width="160" height="58" fill="hsl(220 30% 9%)" />
            {/* Top rule + medallion */}
            <rect x="56" y="10" width="14" height="0.7" fill="hsl(45 80% 70%)" />
            <circle cx="80" cy="10" r="1.5" fill="hsl(45 80% 70%)" />
            <rect x="90" y="10" width="14" height="0.7" fill="hsl(45 80% 70%)" />
            {/* Two-line italic-ish display */}
            <rect x="32" y="20" width="96" height="6" rx="0.5" fill="hsl(40 30% 92%)" />
            <rect x="44" y="29" width="72" height="6" rx="0.5" fill="hsl(40 30% 92% / 0.85)" />
            <rect x="58" y="42" width="44" height="2.5" rx="0.5" fill="hsl(40 15% 75% / 0.7)" />
            {/* Gold CTA */}
            <rect x="64" y="48" width="32" height="6" rx="3" fill="hsl(45 80% 65%)" />
            {/* Bottom rule */}
            <rect x="64" y="56" width="32" height="0.6" fill="hsl(45 80% 65% / 0.4)" />
            {/* Cream form card */}
            <rect x="0" y="58" width="160" height="42" fill="hsl(40 30% 96%)" />
            <rect x="40" y="64" width="80" height="32" rx="4" fill="hsl(var(--card))" stroke="hsl(45 60% 80%)" strokeWidth="0.6" />
            <rect x="46" y="68" width="40" height="2" rx="0.5" fill="hsl(45 50% 40%)" />
            <rect x="46" y="73" width="68" height="4" rx="0.7" fill="hsl(var(--muted))" />
            <rect x="46" y="80" width="68" height="4" rx="0.7" fill="hsl(var(--muted))" />
            <rect x="46" y="88" width="68" height="5" rx="1.5" fill="hsl(220 30% 9%)" />
          </svg>
        </div>
      );

    // ── SHOWROOM: inventory-grid background, translucent form overlay ──
    case "showroom":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(220 30% 8%)" />
            {/* 6 inventory tiles with varying gradients */}
            {[
              { x: 4,  y: 4,  c1: "hsl(220 60% 35%)", c2: "hsl(220 40% 18%)" },
              { x: 56, y: 4,  c1: "hsl(0 50% 35%)",   c2: "hsl(0 30% 18%)" },
              { x: 108,y: 4,  c1: "hsl(40 30% 30%)",  c2: "hsl(40 20% 16%)" },
              { x: 4,  y: 52, c1: "hsl(180 40% 28%)", c2: "hsl(180 30% 16%)" },
              { x: 56, y: 52, c1: "hsl(280 30% 28%)", c2: "hsl(280 20% 16%)" },
              { x: 108,y: 52, c1: "hsl(120 25% 26%)", c2: "hsl(120 20% 16%)" },
            ].map((t, i) => (
              <g key={i}>
                <defs>
                  <linearGradient id={`tile-${i}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={t.c1} />
                    <stop offset="100%" stopColor={t.c2} />
                  </linearGradient>
                </defs>
                <rect x={t.x} y={t.y} width="48" height="44" rx="2" fill={`url(#tile-${i})`} opacity="0.9" />
                {/* Faint car silhouette */}
                <ellipse cx={t.x + 24} cy={t.y + 32} rx="14" ry="3" fill="rgba(255,255,255,0.18)" />
                <rect x={t.x + 12} y={t.y + 22} width="24" height="9" rx="2" fill="rgba(255,255,255,0.22)" />
              </g>
            ))}
            {/* Dim overlay */}
            <rect x="0" y="0" width="160" height="100" fill="hsl(220 30% 8% / 0.55)" />
            {/* Translucent form card right side */}
            <rect x="84" y="22" width="68" height="56" rx="3" fill="hsl(var(--background) / 0.95)" stroke="hsl(var(--border))" strokeWidth="0.6" />
            <rect x="90" y="28" width="32" height="2.5" rx="0.5" fill="hsl(var(--primary))" />
            <rect x="90" y="33" width="44" height="3" rx="0.5" fill="hsl(var(--foreground))" />
            <rect x="90" y="42" width="56" height="5" rx="1" fill="hsl(var(--muted))" />
            <rect x="90" y="49" width="56" height="5" rx="1" fill="hsl(var(--muted))" />
            <rect x="90" y="56" width="56" height="5" rx="1" fill="hsl(var(--muted))" />
            <rect x="90" y="68" width="56" height="6" rx="1.5" fill="hsl(var(--primary))" />
            {/* Headline left */}
            <rect x="6" y="32" width="68" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="6" y="42" width="56" height="6" rx="1" fill="hsl(var(--accent) / 0.9)" />
            <rect x="6" y="56" width="44" height="2.5" rx="0.5" fill="hsl(var(--primary-foreground) / 0.6)" />
          </svg>
        </div>
      );
  }
};

export default TemplateThumbnail;
