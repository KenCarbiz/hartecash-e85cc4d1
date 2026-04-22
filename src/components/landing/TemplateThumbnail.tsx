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

    // ── CINEMA: centered cinematic + model ribbon strip ──
    case "cinema":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <radialGradient id="cin" cx="0.5" cy="0.5" r="0.6">
                <stop offset="0%" stopColor="hsl(var(--primary) / 0.6)" />
                <stop offset="100%" stopColor="hsl(220 40% 8%)" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="160" height="80" fill="hsl(220 30% 8%)" />
            <rect x="0" y="0" width="160" height="80" fill="url(#cin)" />
            {/* Faux play circle */}
            <circle cx="120" cy="34" r="10" fill="none" stroke="hsl(var(--primary-foreground) / 0.25)" strokeWidth="1" />
            <polygon points="117,30 117,38 124,34" fill="hsl(var(--primary-foreground) / 0.35)" />
            {/* Centered headline */}
            <rect x="36" y="28" width="88" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="50" y="38" width="60" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="58" y="50" width="44" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="64" y="58" width="32" height="6" rx="3" fill="hsl(var(--accent))" />
            {/* Model ribbon strip */}
            <rect x="0" y="74" width="160" height="6" fill="hsl(220 40% 4%)" />
            {[6, 28, 50, 72, 94, 116, 138].map((x) => (
              <rect key={x} x={x} y="76" width="16" height="2.5" rx="1.25" fill="hsl(var(--primary-foreground) / 0.35)" />
            ))}
            {/* Form below */}
            <rect x="0" y="80" width="160" height="20" fill="hsl(var(--background))" />
            <rect x="40" y="84" width="80" height="13" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── PORTAL: split — vehicle photo left, CTA card grid right ──
    case "portal":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(var(--background))" />
            {/* Left photo block */}
            <rect x="6" y="8" width="84" height="68" rx="3" fill="hsl(var(--primary))" />
            <rect x="6" y="8" width="84" height="68" rx="3" fill="url(#cin)" opacity="0.6" />
            <rect x="11" y="13" width="20" height="2" rx="0.5" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="11" y="18" width="38" height="5" rx="0.7" fill="hsl(var(--primary-foreground) / 0.95)" />
            {/* Faint car ellipse */}
            <ellipse cx="48" cy="62" rx="22" ry="3" fill="rgba(255,255,255,0.2)" />
            <rect x="34" y="50" width="28" height="10" rx="3" fill="rgba(255,255,255,0.25)" />
            {/* Right CTA card grid 2x2 */}
            {[[96, 8], [128, 8], [96, 42], [128, 42]].map(([x, y], i) => (
              <g key={i}>
                <rect x={x} y={y} width="28" height="30" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.4" />
                <circle cx={x + 6} cy={y + 8} r="3" fill="hsl(var(--primary) / 0.2)" />
                <rect x={x + 4} y={y + 14} width="14" height="2" rx="0.4" fill="hsl(var(--foreground) / 0.7)" />
                <rect x={x + 4} y={y + 18} width="20" height="1.5" rx="0.4" fill="hsl(var(--muted-foreground) / 0.6)" />
              </g>
            ))}
            {/* Form strip below */}
            <rect x="6" y="82" width="148" height="12" rx="2" fill="hsl(var(--muted))" />
          </svg>
        </div>
      );

    // ── CAROUSEL: slider hero + 4-tile shortcut row ──
    case "carousel":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="62" fill="hsl(220 40% 14%)" />
            <rect x="0" y="0" width="160" height="62" fill="url(#cin)" opacity="0.7" />
            {/* Left/right chevrons */}
            <polygon points="6,30 12,26 12,34" fill="hsl(var(--primary-foreground) / 0.7)" />
            <polygon points="154,30 148,26 148,34" fill="hsl(var(--primary-foreground) / 0.7)" />
            {/* Headline */}
            <rect x="20" y="20" width="50" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="20" y="26" width="80" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="20" y="36" width="62" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.65)" />
            {/* Dots */}
            <rect x="74" y="56" width="10" height="2" rx="1" fill="hsl(var(--primary-foreground))" />
            <circle cx="92" cy="57" r="1" fill="hsl(var(--primary-foreground) / 0.5)" />
            <circle cx="98" cy="57" r="1" fill="hsl(var(--primary-foreground) / 0.5)" />
            {/* Tile row */}
            <rect x="0" y="62" width="160" height="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line x1={40 * i} y1="62" x2={40 * i} y2="76" stroke="hsl(var(--border))" strokeWidth="0.4" />
                <circle cx={20 + 40 * i} cy="69" r="2" fill="hsl(var(--primary))" />
                <rect x={26 + 40 * i} y="68" width="11" height="2" rx="0.4" fill="hsl(var(--foreground) / 0.7)" />
              </g>
            ))}
            <rect x="0" y="76" width="160" height="24" fill="hsl(var(--background))" />
            <rect x="40" y="82" width="80" height="14" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── SLAB: sticky search bar IS the hero ──
    case "slab":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <linearGradient id="slab-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(220 30% 22%)" />
                <stop offset="100%" stopColor="hsl(220 40% 8%)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="160" height="100" fill="url(#slab-bg)" />
            {/* Headline */}
            <rect x="22" y="18" width="116" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="38" y="28" width="84" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            {/* Big search bar */}
            <rect x="14" y="44" width="132" height="14" rx="3" fill="hsl(var(--card))" />
            <circle cx="22" cy="51" r="2" fill="hsl(var(--primary) / 0.7)" />
            <rect x="28" y="49" width="62" height="2" rx="0.4" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="28" y="53" width="46" height="2" rx="0.4" fill="hsl(var(--muted-foreground) / 0.4)" />
            <rect x="106" y="46" width="38" height="10" rx="2" fill="hsl(var(--primary))" />
            {/* Twin pills */}
            <rect x="48" y="68" width="28" height="7" rx="3.5" fill="hsl(var(--primary-foreground) / 0.1)" stroke="hsl(var(--primary-foreground) / 0.3)" strokeWidth="0.5" />
            <rect x="84" y="68" width="28" height="7" rx="3.5" fill="hsl(var(--primary-foreground) / 0.1)" stroke="hsl(var(--primary-foreground) / 0.3)" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── DIAGONAL: accent slash + italic accent ──
    case "diagonal":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(var(--background))" />
            {/* Diagonal accent slash */}
            <polygon points="0,0 100,0 60,100 0,100" fill="hsl(var(--accent))" />
            {/* Photo block right */}
            <polygon points="65,0 160,0 160,100 30,100" fill="hsl(220 40% 14%)" />
            <ellipse cx="125" cy="68" rx="22" ry="3" fill="rgba(255,255,255,0.18)" />
            <rect x="113" y="56" width="24" height="10" rx="3" fill="rgba(255,255,255,0.22)" />
            {/* Headline */}
            <rect x="6" y="22" width="56" height="6" rx="1" fill="hsl(var(--accent-foreground) / 0.95)" />
            <rect x="6" y="32" width="48" height="6" rx="1" fill="hsl(var(--accent-foreground) / 0.95)" />
            {/* Italic accent (slightly skewed rect) */}
            <g transform="skewX(-12)">
              <rect x="22" y="44" width="34" height="5" rx="1" fill="hsl(var(--accent-foreground) / 0.6)" />
            </g>
            <rect x="6" y="62" width="38" height="9" rx="2.5" fill="hsl(var(--foreground))" />
          </svg>
        </div>
      );

    // ── PICKUP: truck silhouette at warm horizon ──
    case "pickup":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(28 80% 60%)" />
                <stop offset="40%" stopColor="hsl(15 60% 35%)" />
                <stop offset="75%" stopColor="hsl(220 30% 12%)" />
                <stop offset="100%" stopColor="hsl(220 40% 8%)" />
              </linearGradient>
            </defs>
            {/* Brand ribbon */}
            <rect x="0" y="0" width="160" height="6" fill="hsl(var(--primary))" />
            <rect x="0" y="6" width="160" height="74" fill="url(#dawn)" />
            {/* Headline */}
            <rect x="8" y="20" width="84" height="5" rx="0.5" fill="hsl(var(--primary-foreground))" />
            <rect x="8" y="28" width="64" height="5" rx="0.5" fill="hsl(var(--primary-foreground))" />
            <rect x="8" y="38" width="68" height="2.5" rx="0.4" fill="hsl(var(--primary-foreground) / 0.8)" />
            {/* Twin CTAs */}
            <rect x="8" y="46" width="34" height="7" rx="1" fill="hsl(var(--accent))" />
            <rect x="46" y="46" width="34" height="7" rx="1" fill="hsl(var(--primary-foreground) / 0.1)" stroke="hsl(var(--primary-foreground) / 0.4)" strokeWidth="0.5" />
            {/* Truck silhouette */}
            <g fill="hsl(220 50% 4%)">
              <rect x="46" y="58" width="68" height="14" rx="2" />
              <rect x="56" y="52" width="42" height="10" rx="2" />
              <circle cx="58" cy="74" r="4" />
              <circle cx="102" cy="74" r="4" />
            </g>
            {/* Form strip */}
            <rect x="0" y="80" width="160" height="20" fill="hsl(var(--background))" />
            <rect x="40" y="84" width="80" height="13" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── MAGAZINE: full-bleed photo + oversized headline + thin underline ──
    case "magazine":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(40 15% 93%)" />
            {/* Top photo band */}
            <rect x="0" y="0" width="160" height="42" fill="hsl(220 30% 22%)" />
            <rect x="0" y="0" width="160" height="42" fill="url(#cin)" opacity="0.5" />
            <ellipse cx="120" cy="34" rx="28" ry="4" fill="rgba(255,255,255,0.15)" />
            <rect x="100" y="22" width="40" height="10" rx="2" fill="rgba(255,255,255,0.18)" />
            {/* Headline overflows up into photo */}
            <rect x="6" y="36" width="98" height="32" fill="hsl(40 15% 93%)" />
            <rect x="10" y="40" width="20" height="2" rx="0.5" fill="hsl(var(--primary))" />
            <rect x="10" y="46" width="86" height="6" rx="1" fill="hsl(var(--foreground))" />
            <rect x="10" y="55" width="74" height="6" rx="1" fill="hsl(var(--foreground))" />
            <rect x="10" y="65" width="20" height="0.7" fill="hsl(var(--foreground) / 0.4)" />
            <rect x="10" y="69" width="74" height="2.5" rx="0.4" fill="hsl(var(--muted-foreground))" />
            {/* Form strip */}
            <rect x="0" y="80" width="160" height="20" fill="hsl(var(--background))" />
            <rect x="40" y="84" width="80" height="13" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── CIRCULAR: promo bursts + payment chips ──
    case "circular":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <linearGradient id="circ-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(0 75% 50%)" />
                <stop offset="100%" stopColor="hsl(40 90% 55%)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="160" height="80" fill="url(#circ-bg)" />
            {/* Headline */}
            <rect x="6" y="18" width="80" height="6" rx="1" fill="white" />
            <rect x="6" y="27" width="64" height="6" rx="1" fill="white" />
            {/* Highlight block (yellow) */}
            <rect x="6" y="36" width="40" height="6" rx="1" fill="hsl(50 95% 60%)" />
            {/* Three chips */}
            <rect x="6"  y="56" width="28" height="14" rx="3" fill="white" />
            <rect x="38" y="56" width="28" height="14" rx="3" fill="white" />
            <rect x="70" y="56" width="28" height="14" rx="3" fill="white" />
            <rect x="9"  y="59" width="14" height="2" rx="0.4" fill="hsl(var(--muted-foreground))" />
            <rect x="9"  y="62" width="20" height="3" rx="0.5" fill="hsl(var(--foreground))" />
            <rect x="41" y="59" width="14" height="2" rx="0.4" fill="hsl(var(--muted-foreground))" />
            <rect x="41" y="62" width="20" height="3" rx="0.5" fill="hsl(var(--foreground))" />
            <rect x="73" y="59" width="14" height="2" rx="0.4" fill="hsl(var(--muted-foreground))" />
            <rect x="73" y="62" width="20" height="3" rx="0.5" fill="hsl(var(--foreground))" />
            {/* Burst medallion right */}
            <circle cx="132" cy="34" r="20" fill="hsl(50 95% 60%)" />
            <rect x="120" y="30" width="24" height="2" rx="0.4" fill="hsl(var(--foreground))" />
            <rect x="120" y="34" width="24" height="3" rx="0.5" fill="hsl(var(--foreground))" />
            <rect x="120" y="40" width="24" height="2" rx="0.4" fill="hsl(var(--foreground) / 0.7)" />
            {/* Form strip */}
            <rect x="0" y="80" width="160" height="20" fill="hsl(var(--background))" />
            <rect x="40" y="84" width="80" height="13" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── MOTION: drifting blobs + chat bubble ──
    case "motion":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="80" fill="hsl(220 40% 10%)" />
            <circle cx="40" cy="28" r="34" fill="hsl(180 70% 55% / 0.45)" />
            <circle cx="125" cy="55" r="38" fill="hsl(20 90% 60% / 0.4)" />
            <circle cx="80" cy="68" r="22" fill="hsl(180 70% 55% / 0.35)" />
            <rect x="20" y="20" width="120" height="6" rx="1" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="38" y="32" width="84" height="3" rx="0.5" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="50" y="46" width="26" height="7" rx="3.5" fill="hsl(20 90% 60%)" />
            <rect x="80" y="46" width="30" height="7" rx="3.5" fill="hsl(var(--primary-foreground) / 0.1)" stroke="hsl(var(--primary-foreground) / 0.3)" strokeWidth="0.5" />
            {/* Chat bubble bottom-right */}
            <circle cx="146" cy="70" r="6" fill="hsl(20 90% 60%)" />
            {/* Form strip */}
            <rect x="0" y="80" width="160" height="20" fill="hsl(var(--background))" />
            <rect x="40" y="84" width="80" height="13" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── MOSAIC: tile grid hero, no photo ──
    case "mosaic":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(var(--background))" />
            <rect x="36" y="6" width="88" height="3" rx="0.5" fill="hsl(var(--primary))" />
            <rect x="20" y="12" width="120" height="5" rx="1" fill="hsl(var(--foreground) / 0.85)" />
            <rect x="34" y="20" width="92" height="3" rx="0.5" fill="hsl(var(--muted-foreground) / 0.7)" />
            {/* 2x3 tile grid */}
            {[
              { x: 6,   y: 30, fill: "hsl(var(--primary) / 0.1)" },
              { x: 56,  y: 30, fill: "hsl(var(--accent) / 0.1)" },
              { x: 106, y: 30, fill: "hsl(var(--primary) / 0.1)" },
              { x: 6,   y: 54, fill: "hsl(var(--success) / 0.1)" },
              { x: 56,  y: 54, fill: "hsl(var(--primary) / 0.1)" },
              { x: 106, y: 54, fill: "hsl(var(--muted))" },
            ].map((t, i) => (
              <g key={i}>
                <rect x={t.x} y={t.y} width="48" height="20" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.4" />
                <rect x={t.x + 3} y={t.y + 3} width="6" height="6" rx="1.5" fill={t.fill} />
                <rect x={t.x + 3} y={t.y + 12} width="22" height="2" rx="0.4" fill="hsl(var(--foreground) / 0.7)" />
                <rect x={t.x + 3} y={t.y + 15.5} width="32" height="1.5" rx="0.4" fill="hsl(var(--muted-foreground) / 0.6)" />
              </g>
            ))}
            {/* Sell CTA strip */}
            <rect x="6" y="80" width="148" height="14" rx="2" fill="hsl(var(--primary))" />
            <rect x="12" y="84" width="60" height="2" rx="0.4" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="12" y="88" width="80" height="3" rx="0.5" fill="hsl(var(--primary-foreground))" />
            <rect x="118" y="84" width="32" height="6" rx="3" fill="hsl(var(--accent))" />
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
