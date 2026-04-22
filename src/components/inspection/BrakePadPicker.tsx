import { cn } from "@/lib/utils";

interface BrakePadPickerProps {
  label: string;
  value: number | null;
  onChange: (depth: number) => void;
}

const MIN = 1;
const MAX = 9;
const TICKS = Array.from({ length: MAX - MIN + 1 }, (_, i) => i + MIN);

const getColor = (d: number) => {
  if (d >= 6) return { fill: "#22c55e", text: "text-green-600", label: "Good" };
  if (d >= 4) return { fill: "#f59e0b", text: "text-amber-500", label: "Fair" };
  return { fill: "#ef4444", text: "text-red-500", label: "Replace" };
};

const BrakePadPicker = ({ label, value, onChange }: BrakePadPickerProps) => {
  const cx = 90;
  const cy = 85;
  const r = 70;
  // Arc from 180° (left) to 0° (right) — a half-circle
  const startAngle = Math.PI; // 180°
  const endAngle = 0;        // 0°

  const angleForValue = (v: number) => {
    const pct = (v - MIN) / (MAX - MIN);
    return startAngle - pct * (startAngle - endAngle);
  };

  // Build the arc path for the filled portion
  const describeArc = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(from);
    const y1 = cy + radius * Math.sin(from);
    const x2 = cx + radius * Math.cos(to);
    const y2 = cy + radius * Math.sin(to);
    const largeArc = Math.abs(from - to) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  const info = value !== null ? getColor(value) : null;
  const needleAngle = value !== null ? angleForValue(value) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {value !== null && info && (
          <span className={cn("text-xs font-bold", info.text)}>
            {value}/32 · {info.label}
          </span>
        )}
      </div>

      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 180 100" className="w-full max-w-[220px] h-auto">
          {/* Background arc */}
          <path
            d={describeArc(startAngle, endAngle, r)}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Filled arc */}
          {value !== null && (
            <path
              d={describeArc(startAngle, angleForValue(value), r)}
              fill="none"
              stroke={info!.fill}
              strokeWidth="14"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          )}

          {/* Tick marks — clickable */}
          {TICKS.map(t => {
            const angle = angleForValue(t);
            const outerR = r + 12;
            const innerR = r + 6;
            const ox = cx + outerR * Math.cos(angle);
            const oy = cy + outerR * Math.sin(angle);
            const ix = cx + innerR * Math.cos(angle);
            const iy = cy + innerR * Math.sin(angle);
            const lx = cx + (r + 22) * Math.cos(angle);
            const ly = cy + (r + 22) * Math.sin(angle);
            const isSelected = value === t;
            const tickColor = isSelected ? getColor(t).fill : "hsl(var(--muted-foreground))";

            return (
              <g
                key={t}
                onClick={() => onChange(t)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
              >
                {/* Larger invisible hit area */}
                <circle cx={ox} cy={oy} r="10" fill="transparent" />
                <line
                  x1={ix} y1={iy} x2={ox} y2={oy}
                  stroke={tickColor}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeLinecap="round"
                />
                <text
                  x={lx} y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={tickColor}
                  fontSize={isSelected ? "9" : "7"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  className="select-none pointer-events-none"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Needle */}
          {needleAngle !== null && (
            <>
              <line
                x1={cx}
                y1={cy}
                x2={cx + (r - 14) * Math.cos(needleAngle)}
                y2={cy + (r - 14) * Math.sin(needleAngle)}
                stroke={info!.fill}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <circle cx={cx} cy={cy} r="4" fill={info!.fill} className="transition-all duration-300" />
            </>
          )}

          {/* Center value */}
          {value !== null && (
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={info!.fill}
              fontSize="20"
              fontWeight="bold"
              className="transition-all duration-300"
            >
              {value}
            </text>
          )}
          <text
            x={cx}
            y={cy - (value !== null ? -2 : 8)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="7"
          >
            /32"
          </text>
        </svg>
      </div>
    </div>
  );
};

export default BrakePadPicker;
