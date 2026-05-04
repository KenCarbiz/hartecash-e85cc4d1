import { motion } from "framer-motion";

interface Props {
  /** Stroke color for the line-art car + road dashes. Defaults to a
   *  muted slate-blue that matches the original Hartecash artwork. */
  color?: string;
  /** Optional larger size for hero placement. */
  size?: "sm" | "md" | "lg";
}

/**
 * RunningCarLoader — the original Hartecash line-art "loading" animation.
 *
 * Thin outline hatchback drawn entirely as strokes (no fill), parked
 * over a dashed road that scrolls right-to-left to suggest motion.
 * Wheels rotate in place; speed lines flick past the front bumper.
 * Restored from the dealer's reference set — the prior solid
 * silhouette version was the wrong artwork.
 *
 * Pure SVG + framer-motion, no asset dependency.
 */
const RunningCarLoader = ({ color = "#5B6B8A", size = "md" }: Props) => {
  const w = size === "lg" ? 360 : size === "md" ? 260 : 180;
  const h = Math.round(w * 0.62);

  // Wheel positions in viewBox units. Used to anchor the rotating
  // wheel groups + their transformOrigin.
  const FRONT_WX = 254;
  const FRONT_WY = 152;
  const REAR_WX = 116;
  const REAR_WY = 152;
  const WHEEL_R = 26;

  // 5-spoke pattern reused for both wheels.
  const Spokes = () => (
    <g stroke={color} strokeWidth="2.4" strokeLinecap="round">
      {[0, 72, 144, 216, 288].map((deg) => (
        <line
          key={deg}
          x1="0"
          y1="0"
          x2="0"
          y2={-WHEEL_R + 6}
          transform={`rotate(${deg})`}
        />
      ))}
    </g>
  );

  return (
    <div
      className="relative inline-block"
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 360 220"
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ── Speed lines flicking past the front bumper ── */}
        <g strokeWidth="2.4" opacity="0.85">
          {[
            { y: 132, len: 14, delay: 0 },
            { y: 142, len: 22, delay: 0.18 },
            { y: 152, len: 16, delay: 0.36 },
            { y: 162, len: 10, delay: 0.54 },
          ].map((line, i) => (
            <motion.line
              key={i}
              y1={line.y}
              y2={line.y}
              initial={{ x1: 80 + line.len, x2: 80 }}
              animate={{ x1: [-20 + line.len, 80 + line.len], x2: [-20, 80] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: "linear",
                delay: line.delay,
              }}
            />
          ))}
        </g>

        {/* ── Car body (stroke-only line art) ──
              Hatchback profile: low front, raked windshield, full
              greenhouse, slightly sloped tailgate. Wheel arches cut
              into the lower body so the wheels read as a separate
              moving element. */}
        <g strokeWidth="2.6">
          {/* Lower body silhouette with circular wheel-arch cut-outs */}
          <path
            d={`
              M 80 168
              Q 78 162 84 150
              L 84 142
              Q 86 130 96 122
              Q 110 110 132 102
              L 178 86
              Q 200 78 232 80
              L 286 86
              Q 318 92 326 124
              L 340 132
              L 340 142
              Q 338 152 326 152
              L ${FRONT_WX + WHEEL_R + 6} 152
              A ${WHEEL_R + 6} ${WHEEL_R + 6} 0 0 0 ${FRONT_WX - WHEEL_R - 6} 152
              L ${REAR_WX + WHEEL_R + 6} 152
              A ${WHEEL_R + 6} ${WHEEL_R + 6} 0 0 0 ${REAR_WX - WHEEL_R - 6} 152
              L 92 156
              Z
            `}
          />

          {/* Greenhouse frame (windshield + side glass + rear glass) */}
          <path
            d={`
              M 138 116
              Q 136 108 144 102
              L 178 92
              Q 200 86 232 88
              L 282 92
              Q 304 96 310 110
              Q 312 116 308 122
            `}
          />

          {/* B-pillar (between front and rear doors) */}
          <line x1="220" y1="88" x2="220" y2="120" />
          {/* C-pillar (rear-door / rear-glass divider) */}
          <line x1="270" y1="92" x2="270" y2="122" />

          {/* Lower door / rocker line between the two wheels */}
          <line
            x1={REAR_WX + WHEEL_R + 12}
            y1="158"
            x2={FRONT_WX - WHEEL_R - 12}
            y2="158"
            opacity="0.6"
          />

          {/* Headlight + tail-light notch hints */}
          <line x1="322" y1="148" x2="332" y2="148" opacity="0.85" />
          <line x1="84" y1="150" x2="92" y2="150" opacity="0.85" />
        </g>

        {/* ── Wheels — static tire + spinning rim + spokes ── */}
        {[
          { cx: REAR_WX, cy: REAR_WY },
          { cx: FRONT_WX, cy: FRONT_WY },
        ].map((wheel, i) => (
          <g key={i}>
            {/* Tire — static outer ring */}
            <circle
              cx={wheel.cx}
              cy={wheel.cy}
              r={WHEEL_R}
              strokeWidth="3"
            />
            {/* Rim + spokes — rotates around wheel center */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${wheel.cx}px ${wheel.cy}px` }}
            >
              <circle
                cx={wheel.cx}
                cy={wheel.cy}
                r={WHEEL_R - 6}
                strokeWidth="2.2"
              />
              <g transform={`translate(${wheel.cx} ${wheel.cy})`}>
                <Spokes />
              </g>
              <circle
                cx={wheel.cx}
                cy={wheel.cy}
                r="3"
                fill={color}
                stroke="none"
              />
            </motion.g>
          </g>
        ))}

        {/* ── Dashed road scrolling right-to-left under the car ──
              The dashoffset animation suggests the ground moving past
              while the car (and the framing camera) stays still. */}
        <motion.line
          x1="20"
          x2="340"
          y1="198"
          y2="198"
          strokeWidth="2.4"
          strokeDasharray="14 10"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -120 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
};

export default RunningCarLoader;
