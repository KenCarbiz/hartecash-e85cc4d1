import { motion } from "framer-motion";

interface Props {
  /** Tint of the car silhouette. Defaults to the dealer's brand
   *  primary; Velocity passes its blue, Marquee passes its ember. */
  color?: string;
  /** Optional larger size for hero placement. */
  size?: "sm" | "md" | "lg";
}

/**
 * A small left-to-right looping car silhouette over a thin road line.
 * Used for the "Calculating your offer…" reveal moment in the
 * SellFlowSimple wizard, primarily on the Velocity template per the
 * May-2026 prestige design audit ("the running-car animation belongs
 * here"). Other templates fall back to quieter loaders (thin line,
 * brass arc, hand-drawn fill) — see SellFlowSimple's loader switch.
 *
 * Pure SVG, no asset dependency, ~250 bytes gzipped.
 */
const RunningCarLoader = ({ color = "currentColor", size = "md" }: Props) => {
  const w = size === "lg" ? 240 : size === "md" ? 180 : 120;
  const h = Math.round(w * 0.42);

  return (
    <div className="relative inline-block" style={{ width: w, height: h }} aria-hidden="true">
      {/* Road line — fades on both ends to suggest motion */}
      <svg
        viewBox="0 0 240 100"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rcl-road" x1="0" x2="1">
            <stop offset="0%"  stopColor={color} stopOpacity="0" />
            <stop offset="20%" stopColor={color} stopOpacity="0.25" />
            <stop offset="80%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0" x2="240" y1="78" y2="78"
          stroke="url(#rcl-road)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Dashes that animate left-to-right to imply forward motion */}
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.rect
              key={i}
              y="77"
              width="14"
              height="2"
              fill={color}
              opacity="0.45"
              initial={{ x: 240 + i * 50 }}
              animate={{ x: -20 }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: i * 0.32,
                ease: "linear",
              }}
            />
          ))}
        </g>
      </svg>

      {/* The car. Subtle bob to feel alive without being toy-y. */}
      <motion.svg
        viewBox="0 0 80 40"
        className="absolute"
        style={{ left: "50%", top: "30%", width: w * 0.45, height: w * 0.45 * 0.5 }}
        initial={{ x: "-50%" }}
        animate={{ y: [0, -1.5, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Body */}
        <path
          d="M2 28 Q4 18, 18 16 L26 8 Q30 4, 38 4 L52 4 Q60 4, 64 10 L72 16 Q78 18, 78 28 L78 32 L2 32 Z"
          fill={color}
          opacity="0.95"
        />
        {/* Window strip */}
        <path
          d="M22 16 L28 8 Q32 6, 38 6 L52 6 Q58 6, 62 10 L68 16 Z"
          fill="#FFFFFF"
          opacity="0.18"
        />
        {/* Wheels — counter-rotate against the road dashes */}
        <motion.circle
          cx="20" cy="32" r="5"
          fill="#0F0F12"
          stroke={color}
          strokeWidth="1.2"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.55, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "20px 32px" }}
        />
        <motion.circle
          cx="60" cy="32" r="5"
          fill="#0F0F12"
          stroke={color}
          strokeWidth="1.2"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.55, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "60px 32px" }}
        />
        {/* Wheel hub dots so the rotation reads */}
        <circle cx="20" cy="32" r="1.5" fill={color} />
        <circle cx="60" cy="32" r="1.5" fill={color} />
      </motion.svg>
    </div>
  );
};

export default RunningCarLoader;
