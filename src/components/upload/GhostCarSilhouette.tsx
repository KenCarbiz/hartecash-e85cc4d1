import { ARCHETYPE_SHAPES, type VehicleArchetype } from "@/lib/vehicleArchetypes";

interface GhostCarSilhouetteProps {
  archetype: VehicleArchetype;
  shotId: string;
  color: string;
  width: number;
  height: number;
}

/**
 * Renders an SVG ghost silhouette for the given vehicle archetype and shot angle.
 * Used inside the camera viewfinder to help customers align their photos.
 */
const GhostCarSilhouette = ({ archetype, shotId, color, width: W, height: H }: GhostCarSilhouetteProps) => {
  const sw = 2.5;
  const sh = ARCHETYPE_SHAPES[archetype] || ARCHETYPE_SHAPES.sedan;

  // Side profile shots
  if (shotId === "driver_side" || shotId === "passenger_side") {
    const bodyTop = H * sh.roofHeight;
    const bodyBot = H * 0.70;
    const wheelR = H * 0.11;
    const frontWheel = W * 0.22;
    const rearWheel = W * 0.78;

    if (sh.hasBed) {
      // Truck: cab + bed
      const cabEnd = W * sh.roofEnd;
      const cabStart = W * sh.roofStart;
      return (
        <svg width={W} height={H} className="absolute inset-0">
          {/* Bed */}
          <rect x={W * 0.08} y={bodyBot - H * 0.15} width={cabStart - W * 0.08} height={H * 0.15}
            fill="none" stroke={color} strokeWidth={sw} opacity={0.6} rx={4} />
          {/* Cab */}
          <path d={`M${cabStart},${bodyBot} L${cabStart},${bodyTop} Q${cabStart + (cabEnd - cabStart) * 0.5},${bodyTop - H * 0.06} ${cabEnd},${bodyTop + H * 0.04} L${cabEnd},${bodyBot} Z`}
            fill="none" stroke={color} strokeWidth={sw} opacity={0.6} />
          {/* Body line */}
          <line x1={W * 0.06} y1={bodyBot} x2={W * 0.94} y2={bodyBot} stroke={color} strokeWidth={sw} opacity={0.4} />
          {/* Wheels */}
          <circle cx={frontWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
          <circle cx={rearWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        </svg>
      );
    }

    if (sh.isVan) {
      return (
        <svg width={W} height={H} className="absolute inset-0">
          <rect x={W * 0.06} y={bodyTop} width={W * 0.88} height={bodyBot - bodyTop}
            fill="none" stroke={color} strokeWidth={sw} opacity={0.6} rx={8} />
          <line x1={W * 0.06} y1={bodyBot} x2={W * 0.94} y2={bodyBot} stroke={color} strokeWidth={sw} opacity={0.4} />
          <circle cx={frontWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
          <circle cx={rearWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        </svg>
      );
    }

    // Default sedan/SUV side
    const roofL = W * sh.roofStart;
    const roofR = W * sh.roofEnd;
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <path d={`M${W * 0.06},${bodyBot} L${W * 0.06},${bodyBot - H * 0.04} L${roofL},${bodyBot - H * 0.04} L${roofL + W * 0.06},${bodyTop} L${roofR - W * 0.06},${bodyTop} L${roofR},${bodyBot - H * 0.04} L${W * 0.94},${bodyBot - H * 0.04} L${W * 0.94},${bodyBot} Z`}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.6} />
        <circle cx={frontWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        <circle cx={rearWheel} cy={bodyBot} r={wheelR} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
      </svg>
    );
  }

  // Front / Rear
  if (shotId === "front" || shotId === "rear") {
    const wide = archetype !== "sedan";
    const bL = W * (wide ? 0.10 : 0.15);
    const bW = W * (wide ? 0.80 : 0.70);
    const bT = H * 0.25;
    const bH = H * 0.50;
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={bL} y={bT} width={bW} height={bH} rx={12}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.6} />
        {archetype !== "van" && !sh.hasBed && (
          <path d={`M${bL + bW * 0.15},${bT} Q${W / 2},${bT - H * 0.12} ${bL + bW * 0.85},${bT}`}
            fill="none" stroke={color} strokeWidth={sw} opacity={0.4} />
        )}
        {/* Headlights / taillights */}
        <circle cx={bL + bW * 0.12} cy={bT + bH * 0.3} r={H * 0.04} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
        <circle cx={bL + bW * 0.88} cy={bT + bH * 0.3} r={H * 0.04} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
      </svg>
    );
  }

  // Rocker panel
  if (shotId === "driver_rocker" || shotId === "pass_rocker") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={W * 0.08} y={H * 0.35} width={W * 0.84} height={H * 0.30}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} rx={6} />
        <text x={W / 2} y={H * 0.52} textAnchor="middle" fill={color} fontSize={14} fontWeight={600} opacity={0.7}>
          AIM HERE
        </text>
      </svg>
    );
  }

  // Windshield
  if (shotId === "windshield") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <path d={`M${W * 0.12},${H * 0.75} L${W * 0.25},${H * 0.18} L${W * 0.75},${H * 0.18} L${W * 0.88},${H * 0.75} Z`}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        <text x={W / 2} y={H * 0.52} textAnchor="middle" fill={color} fontSize={12} fontWeight={600} opacity={0.6}>
          SCAN FOR CHIPS
        </text>
      </svg>
    );
  }

  // Wheel / Tire
  if (shotId === "wheel") {
    const r = Math.min(W, H) * 0.36;
    const ri = r * 0.48;
    const cx = W / 2;
    const cy = H / 2;
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        <circle cx={cx} cy={cy} r={ri} fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const rad = deg * Math.PI / 180;
          return <line key={deg} x1={cx + ri * Math.cos(rad)} y1={cy + ri * Math.sin(rad)}
            x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)}
            stroke={color} strokeWidth={1} opacity={0.3} />;
        })}
        <text x={cx} y={cy + r + 18} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} opacity={0.6}>
          CHECK TREAD
        </text>
      </svg>
    );
  }

  // Engine Bay
  if (shotId === "hood") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={W * 0.1} y={H * 0.15} width={W * 0.8} height={H * 0.65}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} rx={10} />
        <line x1={W * 0.35} y1={H * 0.15} x2={W * 0.35} y2={H * 0.8} stroke={color} strokeWidth={1} opacity={0.25} />
        <line x1={W * 0.65} y1={H * 0.15} x2={W * 0.65} y2={H * 0.8} stroke={color} strokeWidth={1} opacity={0.25} />
      </svg>
    );
  }

  // Trunk
  if (shotId === "trunk") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={W * 0.12} y={H * 0.1} width={W * 0.76} height={H * 0.75}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} rx={8} />
      </svg>
    );
  }

  // Driver Door Interior
  if (shotId === "driver_door") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={W * 0.15} y={H * 0.1} width={W * 0.7} height={H * 0.78}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} rx={10} />
        {/* Seat shape */}
        <rect x={W * 0.35} y={H * 0.45} width={W * 0.3} height={H * 0.35}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} rx={6} />
      </svg>
    );
  }

  // Dashboard
  if (shotId === "dashboard") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <rect x={W * 0.08} y={H * 0.2} width={W * 0.84} height={H * 0.55}
          fill="none" stroke={color} strokeWidth={sw} opacity={0.5} rx={8} />
        {/* Odometer area */}
        <rect x={W * 0.32} y={H * 0.35} width={W * 0.36} height={H * 0.22}
          fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} rx={4} />
        <text x={W / 2} y={H * 0.49} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} opacity={0.6}>
          ODOMETER
        </text>
      </svg>
    );
  }

  // Undercarriage / wheel well
  if (shotId === "undercarriage") {
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.38;
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
          const rad = deg * Math.PI / 180;
          return <line key={deg} x1={cx} y1={cy}
            x2={cx + r * 0.8 * Math.cos(rad)} y2={cy + r * 0.8 * Math.sin(rad)}
            stroke={color} strokeWidth={1} opacity={0.2} />;
        })}
        <text x={cx} y={cy + r + 18} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} opacity={0.6}>
          CHECK FOR RUST
        </text>
      </svg>
    );
  }

  // Damage close-up — simple crosshair
  if (shotId === "damage") {
    return (
      <svg width={W} height={H} className="absolute inset-0">
        <line x1={W / 2} y1={H * 0.15} x2={W / 2} y2={H * 0.85} stroke={color} strokeWidth={1.5} opacity={0.4} />
        <line x1={W * 0.15} y1={H / 2} x2={W * 0.85} y2={H / 2} stroke={color} strokeWidth={1.5} opacity={0.4} />
        <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.2} fill="none" stroke={color} strokeWidth={sw} opacity={0.5} />
        <text x={W / 2} y={H * 0.92} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} opacity={0.6}>
          FOCUS ON DAMAGE
        </text>
      </svg>
    );
  }

  return null;
};

export default GhostCarSilhouette;
