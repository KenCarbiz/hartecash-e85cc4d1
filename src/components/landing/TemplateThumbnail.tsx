import { type LandingTemplate } from "@/hooks/useSiteConfig";

interface Props {
  template: LandingTemplate;
  className?: string;
}

/**
 * Schematic SVG previews of each landing template. Abstract on purpose —
 * they convey layout/vibe (split vs full-bleed vs search-bar vs review-wall
 * vs long-scroll) without needing real screenshots that would drift as the
 * templates evolve. Uses theme CSS vars so the dealer's palette applies.
 */
const TemplateThumbnail = ({ template, className = "" }: Props) => {
  const wrapClass = `w-full h-full rounded-md overflow-hidden bg-muted ${className}`;
  const common = {
    viewBox: "0 0 160 100",
    preserveAspectRatio: "xMidYMid slice" as const,
    className: "w-full h-full block",
  };

  switch (template) {
    // ── T1 Classic: split hero (text left, form right) + stacked sections ──
    case "classic":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            {/* Hero band */}
            <rect x="0" y="0" width="160" height="48" fill="hsl(var(--primary))" />
            {/* Hero headline lines */}
            <rect x="8" y="10" width="58" height="4" rx="1" fill="hsl(var(--primary-foreground) / 0.9)" />
            <rect x="8" y="17" width="46" height="4" rx="1" fill="hsl(var(--primary-foreground) / 0.7)" />
            <rect x="8" y="27" width="36" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            <rect x="8" y="32" width="40" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            <rect x="8" y="37" width="30" height="2.5" rx="1" fill="hsl(var(--primary-foreground) / 0.55)" />
            {/* Form card (right) */}
            <rect x="82" y="8" width="70" height="72" rx="3" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
            <rect x="88" y="14" width="40" height="3" rx="1" fill="hsl(var(--foreground) / 0.7)" />
            <rect x="88" y="22" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="32" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="42" width="58" height="6" rx="1" fill="hsl(var(--muted))" />
            <rect x="88" y="56" width="58" height="8" rx="2" fill="hsl(var(--primary))" />
            {/* Below-fold steps */}
            <rect x="0" y="48" width="160" height="52" fill="hsl(var(--background))" />
            <rect x="16" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
            <rect x="64" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
            <rect x="112" y="58" width="32" height="32" rx="4" fill="hsl(var(--muted))" />
          </svg>
        </div>
      );

    // ── T2 Video: full-bleed dark hero, centered CTA pill ──
    case "video":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <defs>
              <linearGradient id="vid-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(220 80% 10%)" />
              </linearGradient>
            </defs>
            {/* Cinematic hero fills frame */}
            <rect x="0" y="0" width="160" height="100" fill="url(#vid-bg)" />
            {/* Ambient glow */}
            <circle cx="48" cy="40" r="28" fill="hsl(var(--primary-foreground) / 0.08)" />
            <circle cx="112" cy="70" r="22" fill="hsl(var(--accent) / 0.12)" />
            {/* Big centered headline */}
            <rect x="34" y="38" width="92" height="6" rx="1.5" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="44" y="49" width="72" height="4" rx="1" fill="hsl(var(--primary-foreground) / 0.7)" />
            {/* Single CTA pill */}
            <rect x="60" y="66" width="40" height="10" rx="5" fill="hsl(var(--accent))" />
            {/* Bottom scroll cue */}
            <circle cx="80" cy="90" r="1.5" fill="hsl(var(--primary-foreground) / 0.7)" />
          </svg>
        </div>
      );

    // ── T3 Inventory-Forward: prominent search-bar pill ──
    case "inventory":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="60" fill="hsl(var(--primary))" />
            {/* Short headline */}
            <rect x="30" y="14" width="100" height="5" rx="1.5" fill="hsl(var(--primary-foreground) / 0.95)" />
            <rect x="44" y="23" width="72" height="3" rx="1" fill="hsl(var(--primary-foreground) / 0.65)" />
            {/* Search bar pill */}
            <rect x="20" y="34" width="120" height="14" rx="7" fill="hsl(var(--card))" />
            <circle cx="30" cy="41" r="2.5" fill="hsl(var(--primary))" />
            <rect x="36" y="38" width="48" height="2.5" rx="0.5" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="36" y="42.5" width="62" height="2" rx="0.5" fill="hsl(var(--muted-foreground) / 0.3)" />
            <rect x="110" y="37.5" width="24" height="7" rx="3.5" fill="hsl(var(--accent))" />
            {/* Quick stats strip */}
            <rect x="0" y="60" width="160" height="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
            <circle cx="22" cy="67" r="3" fill="hsl(var(--primary) / 0.25)" />
            <circle cx="78" cy="67" r="3" fill="hsl(var(--primary) / 0.25)" />
            <circle cx="134" cy="67" r="3" fill="hsl(var(--primary) / 0.25)" />
            {/* Form below */}
            <rect x="0" y="74" width="160" height="26" fill="hsl(var(--background))" />
            <rect x="44" y="80" width="72" height="14" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </svg>
        </div>
      );

    // ── T4 Trust-Wall: minimal hero, huge review wall below ──
    case "trust":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            {/* Pale hero */}
            <rect x="0" y="0" width="160" height="34" fill="hsl(var(--background))" />
            <rect x="36" y="10" width="88" height="4" rx="1" fill="hsl(var(--foreground) / 0.85)" />
            <rect x="52" y="17" width="56" height="2.5" rx="1" fill="hsl(var(--foreground) / 0.5)" />
            <rect x="62" y="23" width="36" height="6" rx="3" fill="hsl(var(--primary))" />
            {/* Stars row */}
            {[0, 1, 2, 3, 4].map((i) => (
              <polygon
                key={i}
                points={`${64 + i * 7},39 ${66 + i * 7},43 ${70 + i * 7},43 ${67 + i * 7},45.5 ${68 + i * 7},49.5 ${64 + i * 7},47 ${60 + i * 7},49.5 ${61 + i * 7},45.5 ${58 + i * 7},43 ${62 + i * 7},43`}
                fill="hsl(45 95% 55%)"
                opacity="0.9"
              />
            ))}
            {/* Review wall — 6 cards */}
            <rect x="0" y="54" width="160" height="46" fill="hsl(var(--muted) / 0.5)" />
            {[0, 1, 2].map((col) =>
              [0, 1].map((row) => (
                <g key={`${col}-${row}`}>
                  <rect
                    x={8 + col * 50}
                    y={58 + row * 20}
                    width="44"
                    height="16"
                    rx="1.5"
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--border))"
                    strokeWidth="0.5"
                  />
                  <rect x={12 + col * 50} y={61 + row * 20} width="20" height="1.5" rx="0.5" fill="hsl(var(--foreground) / 0.5)" />
                  <rect x={12 + col * 50} y={65 + row * 20} width="36" height="1" rx="0.3" fill="hsl(var(--muted-foreground) / 0.4)" />
                  <rect x={12 + col * 50} y={67.5 + row * 20} width="32" height="1" rx="0.3" fill="hsl(var(--muted-foreground) / 0.4)" />
                  <rect x={12 + col * 50} y={70 + row * 20} width="28" height="1" rx="0.3" fill="hsl(var(--muted-foreground) / 0.4)" />
                </g>
              )),
            )}
          </svg>
        </div>
      );

    // ── T5 Editorial: tall, stacked alternating image/text rows ──
    case "editorial":
      return (
        <div className={wrapClass}>
          <svg {...common}>
            <rect x="0" y="0" width="160" height="100" fill="hsl(var(--background))" />
            {/* Oversized headline */}
            <rect x="8" y="8" width="16" height="2" rx="0.5" fill="hsl(var(--primary) / 0.6)" />
            <rect x="8" y="14" width="120" height="7" rx="1.5" fill="hsl(var(--foreground) / 0.9)" />
            <rect x="8" y="24" width="90" height="3" rx="1" fill="hsl(var(--muted-foreground) / 0.7)" />
            {/* Alternating rows */}
            {/* Row 1: image left, text right */}
            <rect x="8" y="36" width="36" height="24" rx="2" fill="hsl(var(--primary) / 0.85)" />
            <rect x="50" y="40" width="36" height="2.5" rx="0.5" fill="hsl(var(--foreground) / 0.85)" />
            <rect x="50" y="46" width="60" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="50" y="49.5" width="54" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="50" y="53" width="48" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
            {/* Row 2: text left, image right (reversed) */}
            <rect x="116" y="64" width="36" height="24" rx="2" fill="hsl(var(--primary) / 0.7)" />
            <rect x="8" y="68" width="36" height="2.5" rx="0.5" fill="hsl(var(--foreground) / 0.85)" />
            <rect x="8" y="74" width="60" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="8" y="77.5" width="56" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
            <rect x="8" y="81" width="50" height="1.5" rx="0.3" fill="hsl(var(--muted-foreground) / 0.6)" />
          </svg>
        </div>
      );
  }
};

export default TemplateThumbnail;
