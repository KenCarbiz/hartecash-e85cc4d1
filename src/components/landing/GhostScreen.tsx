import { motion } from "framer-motion";
import RunningCarLoader from "./RunningCarLoader";

export type GhostScreenKind =
  | "pulse-orb"
  | "sweep-arc"
  | "stack-reveal"
  | "card-skeleton"
  | "legacy-car";

interface Props {
  /** Which premium SaaS-grade variant to render. Each is built from
   *  the same vocabulary national tech brands use:
   *
   *    pulse-orb     → concentric rings pulsing outward from a solid
   *                    center (Apple Vision Pro / OpenAI style).
   *                    Premium, geometric, calm.
   *    sweep-arc     → a thin quarter-arc rotating with a soft
   *                    trailing gradient (Stripe Checkout / Linear).
   *                    Minimal, elegant, fast-feeling.
   *    stack-reveal  → four horizontal bars filling left-to-right in
   *                    sequence, top to bottom (Vercel deploy / build
   *                    pipeline). Tech-savvy, clearly progressing.
   *    card-skeleton → vehicle-card placeholder with a diagonal
   *                    shimmer sweep (Edmunds / Carvana). The
   *                    industry-standard pattern, executed cleanly.
   *    legacy-car    → the original RunningCarLoader (car silhouette
   *                    looping over a fading road line). Kept as an
   *                    option for dealers who want the familiar
   *                    Hartecash motion.
   */
  kind?: GhostScreenKind;
  /** Brand accent color (hex) for the moving parts. Defaults to a
   *  warm graphite that reads premium on light backgrounds. */
  accent?: string;
  /** Background color (hex) of the surrounding card / surface. The
   *  ghost is drawn over this. Defaults to a near-white surface. */
  background?: string;
  /** Top-line copy shown above the animation. */
  headline?: string;
  /** Quieter subhead under the headline. */
  subhead?: string;
  /** Compact mode for smaller surfaces (admin previews, mobile). */
  size?: "sm" | "md" | "lg";
  /** When true, fills the parent and centers content vertically. */
  fill?: boolean;
}

/**
 * GhostScreen — premium "system is thinking" placeholder shown
 * between wizard screens (BB lookup → confirm, condition →
 * computing). Four SaaS-grade variants the dealer can pick between
 * in admin so the thinking moment matches the rest of their
 * landing template's vibe.
 *
 * No image assets — pure SVG + framer-motion, ~1KB each gzipped.
 *
 * Premium-look guardrails:
 *   - geometric shapes only, no car silhouettes / wheels with tread
 *   - all colors / backgrounds dealer-controlled
 *   - all copy dealer-controlled
 *   - 16:9 / 1:1 aspect ratios, never cartoonish proportions
 *   - subtle motion (eased, not springy), 1.0–1.6s loops
 *
 * Reference list (each variant draws from one premium SaaS pattern):
 *   pulse-orb     → Apple Vision Pro launch, OpenAI loading
 *   sweep-arc     → Stripe checkout, Linear, Vercel
 *   stack-reveal  → Vercel deploy logs, Notion publish flow
 *   card-skeleton → Edmunds vehicle lookup, Carvana inventory load
 */
const GhostScreen = ({
  kind = "legacy-car",
  accent = "#1F2937",
  background = "#FAFAFA",
  headline,
  subhead,
  size = "md",
  fill = false,
}: Props) => {
  const dim = size === "lg" ? 112 : size === "md" ? 84 : 60;

  let visual: React.ReactNode;
  switch (kind) {
    case "pulse-orb":
      // Concentric rings pulsing outward from a solid center, each
      // staggered. Reads "thinking calmly" rather than "spinning"
      // — premium because it doesn't fight for attention.
      visual = (
        <div
          aria-hidden="true"
          className="relative flex items-center justify-center"
          style={{ width: dim * 1.6, height: dim * 1.6 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                width: dim * 0.55,
                height: dim * 0.55,
                border: `1.5px solid ${accent}`,
              }}
              initial={{ scale: 0.4, opacity: 0.6 }}
              animate={{ scale: [0.4, 2.1], opacity: [0.55, 0] }}
              transition={{
                duration: 2.0,
                repeat: Infinity,
                ease: [0.16, 1, 0.3, 1],
                delay: i * 0.55,
              }}
            />
          ))}
          {/* Solid center */}
          <span
            className="rounded-full"
            style={{
              width: dim * 0.32,
              height: dim * 0.32,
              background: accent,
            }}
          />
        </div>
      );
      break;

    case "sweep-arc":
      // Thin quarter-arc rotating with a soft fade trail. The arc is
      // a stroke-dasharray trick on a circle so the "trail" is the
      // gap, not separate elements. Stripe / Linear style.
      visual = (
        <motion.svg
          viewBox="0 0 100 100"
          width={dim}
          height={dim}
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        >
          <defs>
            <linearGradient id="ghs-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0" />
              <stop offset="100%" stopColor={accent} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Faint background ring so the surface always reads "loading
              container" not "blank space". */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            opacity="0.10"
          />
          {/* Active arc — quarter sweep with gradient trail */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#ghs-arc)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="65 200"
          />
        </motion.svg>
      );
      break;

    case "stack-reveal":
      // Four stacked horizontal bars, each filling left-to-right then
      // resetting. Bars cycle in order. Vercel-deploy / build-log
      // pattern. Reads "we're working through the steps."
      visual = (
        <div
          aria-hidden="true"
          className="flex flex-col gap-2.5"
          style={{ width: dim * 2.2 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="relative h-[6px] rounded-full overflow-hidden"
              style={{ background: `${accent}1F` }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: accent }}
                initial={{ width: "0%" }}
                animate={{ width: ["0%", "100%", "100%", "0%"] }}
                transition={{
                  duration: 2.4,
                  times: [0, 0.45, 0.55, 1],
                  repeat: Infinity,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.18,
                }}
              />
            </div>
          ))}
        </div>
      );
      break;

    case "legacy-car":
      // The original RunningCarLoader — preserved as a dealer choice
      // for templates that intentionally want the familiar Hartecash
      // motion (running car over a road-line) rather than one of the
      // four geometric SaaS variants.
      visual = (
        <div style={{ color: accent }} aria-hidden="true">
          <RunningCarLoader color={accent} size={size} />
        </div>
      );
      break;

    case "card-skeleton":
      // Vehicle-card skeleton with a diagonal shimmer sweep — the
      // industry-standard pattern, executed at premium fidelity.
      // Quietly suggests "we're loading the detail of YOUR car"
      // without committing to year/make/model copy yet.
      visual = (
        <div
          aria-hidden="true"
          className="relative overflow-hidden rounded-xl"
          style={{
            width: dim * 3.0,
            height: dim * 1.05,
            background: `${accent}0F`,
            border: `1px solid ${accent}1F`,
          }}
        >
          {/* Thumbnail block */}
          <div
            className="absolute rounded-lg"
            style={{
              top: 10,
              left: 10,
              width: dim * 1.05,
              height: dim * 1.05 - 20,
              background: `${accent}26`,
            }}
          />
          {/* Title line */}
          <div
            className="absolute rounded-full"
            style={{
              top: 16,
              left: dim * 1.05 + 22,
              width: dim * 1.4,
              height: 9,
              background: `${accent}3D`,
            }}
          />
          {/* Sub line */}
          <div
            className="absolute rounded-full"
            style={{
              top: 34,
              left: dim * 1.05 + 22,
              width: dim * 0.95,
              height: 7,
              background: `${accent}29`,
            }}
          />
          {/* Stat chips */}
          <div
            className="absolute flex gap-2"
            style={{
              bottom: 14,
              left: dim * 1.05 + 22,
            }}
          >
            <div
              className="rounded-md"
              style={{
                width: dim * 0.45,
                height: 16,
                background: `${accent}29`,
              }}
            />
            <div
              className="rounded-md"
              style={{
                width: dim * 0.30,
                height: 16,
                background: `${accent}29`,
              }}
            />
          </div>
          {/* Diagonal shimmer sweep */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(110deg, transparent 0%, ${accent}1F 45%, ${accent}40 50%, ${accent}1F 55%, transparent 100%)`,
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
      );
      break;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        fill ? "min-h-[400px] w-full" : ""
      }`}
      style={{ background, color: accent }}
    >
      <div className="mb-6" style={{ color: accent }}>
        {visual}
      </div>
      {headline && (
        <p
          className="font-sans text-base md:text-lg font-medium tracking-tight"
          style={{ color: accent }}
        >
          {headline}
        </p>
      )}
      {subhead && (
        <p
          className="font-sans text-sm mt-2 max-w-sm leading-relaxed"
          style={{ color: `${accent}A6` }}
        >
          {subhead}
        </p>
      )}
    </div>
  );
};

export default GhostScreen;
