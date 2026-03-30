import { cn } from "@/lib/utils";

const BRAKE_DEPTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];
const TIRE_DEPTH_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface BrakeDepths {
  leftFront: number | null;
  rightFront: number | null;
  leftRear: number | null;
  rightRear: number | null;
}

export interface TireDepths {
  leftFront: number | null;
  rightFront: number | null;
  leftRear: number | null;
  rightRear: number | null;
}

type CornerKey = keyof BrakeDepths;

function getStatus(depth: number) {
  if (depth <= 3) return { key: "replace", label: "Replace", color: "#EF4444" };
  if (depth <= 5) return { key: "fair", label: "Fair", color: "#F59E0B" };
  return { key: "good", label: "Good", color: "#22C55E" };
}

// Industry-standard 32nds-to-mm lookup (rounded to nearest whole mm)
const DEPTH_TO_MM: Record<number, number> = {
  1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 6, 9: 7, 10: 8,
};

function toMm(depth: number) {
  return DEPTH_TO_MM[depth] ?? Math.round((depth / 32) * 25.4);
}

/* ─── SVG visuals ─── */

function BrakeRotor({ color, side }: { color: string; side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <svg viewBox="0 0 160 160" className="h-20 w-20 md:h-24 md:w-24 shrink-0">
      <circle cx="80" cy="80" r="58" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="2" />
      <circle cx="80" cy="80" r="34" fill="hsl(var(--muted-foreground) / 0.3)" stroke="hsl(var(--foreground))" strokeWidth="3" />
      <circle cx="80" cy="80" r="12" fill="hsl(var(--foreground))" />
      <path
        d={isLeft ? "M90 22 Q124 22 132 52 L132 67 Q112 60 98 64 Z" : "M70 22 Q36 22 28 52 L28 67 Q48 60 62 64 Z"}
        fill={color}
      />
    </svg>
  );
}

function TireWheel({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16 md:h-20 md:w-20 shrink-0" aria-hidden="true">
      <rect x="25" y="10" width="70" height="100" rx="18" fill="hsl(var(--foreground))" />
      <rect x="35" y="18" width="50" height="84" rx="12" fill="hsl(var(--muted-foreground) / 0.4)" />
      <line x1="60" y1="20" x2="60" y2="100" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1="48" y1="24" x2="48" y2="96" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="72" y1="24" x2="72" y2="96" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <line x1="40" y1="50" x2="80" y2="50" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.4" />
      <line x1="40" y1="70" x2="80" y2="70" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}

function Arrow({ side, color }: { side: "left" | "right"; color: string }) {
  return side === "left" ? (
    <svg width="24" height="16" className="shrink-0">
      <line x1="22" y1="8" x2="4" y2="8" stroke={color} strokeWidth="2" />
      <polygon points="4,2 0,8 4,14" fill={color} />
    </svg>
  ) : (
    <svg width="24" height="16" className="shrink-0">
      <line x1="2" y1="8" x2="20" y2="8" stroke={color} strokeWidth="2" />
      <polygon points="20,2 24,8 20,14" fill={color} />
    </svg>
  );
}

function Readout({ depth, status, minMm }: { depth: number; status: ReturnType<typeof getStatus>; minMm?: number }) {
  const mm = toMm(depth, minMm);
  return (
    <div className="text-center">
      <div className="text-xl md:text-2xl font-bold" style={{ color: status.color }}>{mm} mm</div>
      <div className="text-xs md:text-sm font-semibold" style={{ color: status.color }}>{depth}/32</div>
      <div className="text-[10px] uppercase text-muted-foreground font-semibold">{status.label}</div>
    </div>
  );
}

/* ─── Corner ─── */

function Corner({
  label,
  depth,
  side,
  type,
  onChange,
  readOnly,
}: {
  label: string;
  depth: number | null;
  side: "left" | "right";
  type: "brake" | "tire";
  onChange?: (depth: number) => void;
  readOnly?: boolean;
}) {
  const isLeft = side === "left";
  const status = depth != null ? getStatus(depth) : null;
  const fallbackColor = "hsl(var(--muted-foreground) / 0.3)";
  const color = status?.color ?? fallbackColor;
  const options = type === "brake" ? BRAKE_DEPTH_OPTIONS : TIRE_DEPTH_OPTIONS;

  return (
    <div className={cn("flex flex-col gap-1.5", isLeft ? "items-start" : "items-end")}>
      <div className="text-xs font-semibold text-card-foreground">{label}</div>
      <div className={cn("flex items-center gap-3", isLeft ? "flex-row" : "flex-row-reverse")}>
        {type === "brake" ? <BrakeRotor color={color} side={side} /> : <TireWheel color={color} />}
        <div className="flex flex-col gap-1.5 items-center">
          {!readOnly && onChange ? (
            <select
              value={depth ?? ""}
              onChange={(e) => onChange(Number(e.target.value))}
              className="border border-input bg-background rounded-md px-2 py-1 text-sm w-20"
            >
              <option value="" disabled>--</option>
              {options.map((d) => (
                <option key={d} value={d}>{d}/32</option>
              ))}
            </select>
          ) : depth != null ? (
            <div className="text-sm font-bold" style={{ color: status?.color }}>{depth}/32</div>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
          {depth != null && status && (
            <div className="flex items-center gap-2">
              {isLeft && <Arrow side="left" color={status.color} />}
              <Readout depth={depth} status={status} minMm={type === "tire" ? 2 : 1} />
              {!isLeft && <Arrow side="right" color={status.color} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Axle row ─── */

function AxleRow({
  left,
  right,
  axleLabel,
  type,
  onChangeLeft,
  onChangeRight,
  readOnly,
  compact,
}: {
  left: { label: string; depth: number | null; };
  right: { label: string; depth: number | null; };
  axleLabel: string;
  type: "brake" | "tire";
  onChangeLeft?: (d: number) => void;
  onChangeRight?: (d: number) => void;
  readOnly?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid items-center gap-4", compact ? "grid-cols-2" : "grid-cols-[1fr_auto_1fr]")}>
      <Corner label={left.label} depth={left.depth} side="left" type={type} onChange={onChangeLeft} readOnly={readOnly} />
      {!compact && (
        <div className="hidden md:flex items-center justify-center">
          <div className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm">
            {axleLabel}
          </div>
        </div>
      )}
      <Corner label={right.label} depth={right.depth} side="right" type={type} onChange={onChangeRight} readOnly={readOnly} />
    </div>
  );
}

/* ─── Legend ─── */

function Legend({ showTire }: { showTire: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="rounded-full border border-red-200 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        2–3 Replace
      </span>
      <span className="rounded-full border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
        4–5 Fair
      </span>
      <span className="rounded-full border border-green-200 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 text-[10px] font-semibold text-green-600">
        {showTire ? "6–10" : "6–9"} Good
      </span>
    </div>
  );
}

/* ─── Main Widget ─── */

interface TireBrakeWidgetProps {
  brakeDepths?: BrakeDepths;
  tireDepths?: TireDepths;
  onBrakeChange?: (id: CornerKey, depth: number) => void;
  onTireChange?: (id: CornerKey, depth: number) => void;
  readOnly?: boolean;
  compact?: boolean;
  showTires?: boolean;
  showBrakes?: boolean;
}

export default function BrakePadDepthWidget({
  brakeDepths,
  tireDepths,
  onBrakeChange,
  onTireChange,
  readOnly = false,
  compact = false,
  showTires = true,
  showBrakes = true,
}: TireBrakeWidgetProps) {
  // Backwards compat: accept old "depths" prop shape via rest
  const bd = brakeDepths ?? { leftFront: null, rightFront: null, leftRear: null, rightRear: null };
  const td = tireDepths ?? { leftFront: null, rightFront: null, leftRear: null, rightRear: null };

  return (
    <div className={cn("rounded-xl border border-border bg-gradient-to-b from-muted/40 to-background", compact ? "p-3" : "p-4 md:p-6")}>
      {/* Header + legend */}
      <div className={cn("flex flex-wrap items-center justify-between gap-2 mb-4", compact && "mb-3")}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {showTires && showBrakes ? "Tire Tread & Brake Pads" : showTires ? "Tire Tread" : "Brake Pads"}
          </div>
          {!compact && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">Rear axle top · Front axle bottom</div>
          )}
        </div>
        <Legend showTire={showTires} />
      </div>

      <div className="space-y-5">
        {/* Tire Tread Section */}
        {showTires && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Tire Tread</div>
            <div className="space-y-4">
              <AxleRow
                left={{ label: "Left Rear", depth: td.leftRear }}
                right={{ label: "Right Rear", depth: td.rightRear }}
                axleLabel="Rear Axle"
                type="tire"
                onChangeLeft={onTireChange ? (d) => onTireChange("leftRear", d) : undefined}
                onChangeRight={onTireChange ? (d) => onTireChange("rightRear", d) : undefined}
                readOnly={readOnly}
                compact={compact}
              />
              <AxleRow
                left={{ label: "Left Front", depth: td.leftFront }}
                right={{ label: "Right Front", depth: td.rightFront }}
                axleLabel="Front Axle"
                type="tire"
                onChangeLeft={onTireChange ? (d) => onTireChange("leftFront", d) : undefined}
                onChangeRight={onTireChange ? (d) => onTireChange("rightFront", d) : undefined}
                readOnly={readOnly}
                compact={compact}
              />
            </div>
          </div>
        )}

        {/* Divider */}
        {showTires && showBrakes && (
          <div className="border-t border-dashed border-border" />
        )}

        {/* Brake Pads Section */}
        {showBrakes && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Brake Pads</div>
            <div className="space-y-4">
              <AxleRow
                left={{ label: "Left Rear", depth: bd.leftRear }}
                right={{ label: "Right Rear", depth: bd.rightRear }}
                axleLabel="Rear Axle"
                type="brake"
                onChangeLeft={onBrakeChange ? (d) => onBrakeChange("leftRear", d) : undefined}
                onChangeRight={onBrakeChange ? (d) => onBrakeChange("rightRear", d) : undefined}
                readOnly={readOnly}
                compact={compact}
              />
              <AxleRow
                left={{ label: "Left Front", depth: bd.leftFront }}
                right={{ label: "Right Front", depth: bd.rightFront }}
                axleLabel="Front Axle"
                type="brake"
                onChangeLeft={onBrakeChange ? (d) => onBrakeChange("leftFront", d) : undefined}
                onChangeRight={onBrakeChange ? (d) => onBrakeChange("rightFront", d) : undefined}
                readOnly={readOnly}
                compact={compact}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
