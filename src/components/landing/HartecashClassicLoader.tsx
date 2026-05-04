import ghostCar from "@/assets/ghost-loader.png";

interface Props {
  /** Optional size — controls the rendered width. Defaults to "lg". */
  size?: "sm" | "md" | "lg";
  /** Optional headline shown below the car. */
  headline?: string;
  /** Optional subhead shown under the headline. */
  subhead?: string;
}

/**
 * HartecashClassicLoader — the official Hartecash loading animation.
 *
 * Uses the dealer's line-art ghost-car PNG (src/assets/ghost-loader.png)
 * over a dashed road that scrolls right-to-left. The car bobs gently
 * to imply motion. Same artwork as PortalSkeleton, but inline-friendly
 * so it can be dropped into a wizard card / overlay without taking
 * over the whole viewport.
 *
 * Visible at /preview/loader as a diagnostic preview, and used inside
 * GhostScreen as the `legacy-car` variant — the dealer-default.
 */
const HartecashClassicLoader = ({ size = "lg", headline, subhead }: Props) => {
  const w = size === "lg" ? 320 : size === "md" ? 240 : 160;
  const h = Math.round(w * 0.625);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      {/* Headline above the car so the customer sees the action
          before noticing the animation. */}
      {headline && (
        <p className="text-lg md:text-xl font-semibold tracking-tight mb-5">
          {headline}
        </p>
      )}
      <div
        className="relative"
        style={{ width: w, height: h }}
        aria-hidden="true"
      >
        <img
          src={ghostCar}
          alt=""
          className="w-full h-full object-contain"
          style={{ animation: "hcl-car-bounce 1.2s ease-in-out infinite" }}
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 320 200"
        >
          <style>{`
            @keyframes hcl-car-bounce {
              0%, 100% { transform: translateY(0); }
              50%      { transform: translateY(-3px); }
            }
            @keyframes hcl-road-scroll {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: -40; }
            }
          `}</style>
          <line
            x1="0"
            y1="170"
            x2="320"
            y2="170"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            strokeDasharray="12 8"
            opacity="0.4"
            style={{ animation: "hcl-road-scroll 0.6s linear infinite" }}
          />
        </svg>
      </div>
      {subhead && (
        <p className="text-sm text-muted-foreground mt-4 max-w-sm">{subhead}</p>
      )}
    </div>
  );
};

export default HartecashClassicLoader;
