interface Props {
  mds: number | null | undefined;
  variant?: "onLight" | "onDark";
  showLabel?: boolean;
  className?: string;
}

const tone = (mds: number | null | undefined): "hot" | "warm" | "cold" | "unknown" => {
  if (mds == null) return "unknown";
  if (mds <= 30) return "hot";
  if (mds <= 60) return "warm";
  return "cold";
};

const TONE_LIGHT = {
  hot:     { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", dot: "bg-emerald-500" },
  warm:    { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300",   dot: "bg-amber-500"   },
  cold:    { bg: "bg-rose-100",    text: "text-rose-800",    border: "border-rose-300",    dot: "bg-rose-500"    },
  unknown: { bg: "bg-slate-100",   text: "text-slate-700",   border: "border-slate-300",   dot: "bg-slate-400"   },
};

const TONE_DARK = {
  hot:     { bg: "bg-emerald-400/20", text: "text-emerald-100", border: "border-emerald-300/40", dot: "bg-emerald-400" },
  warm:    { bg: "bg-amber-400/20",   text: "text-amber-100",   border: "border-amber-300/40",   dot: "bg-amber-400"   },
  cold:    { bg: "bg-rose-400/20",    text: "text-rose-100",    border: "border-rose-300/40",    dot: "bg-rose-400"    },
  unknown: { bg: "bg-white/10",       text: "text-white/80",    border: "border-white/20",       dot: "bg-white/40"    },
};

const labelFor = (mds: number | null | undefined) => {
  if (mds == null) return "MDS —";
  return `${Math.round(mds)}d MDS`;
};

const tooltipFor = (mds: number | null | undefined) => {
  if (mds == null) return "Market Days Supply unavailable";
  if (mds <= 30) return `Hot market — ${Math.round(mds)} days to sell at current rate. Stretch on this car.`;
  if (mds <= 60) return `Average market — ${Math.round(mds)} days to sell. Hold the line.`;
  return `Slow mover — ${Math.round(mds)} days to sell. Discount aggressively.`;
};

export function MdsPill({ mds, variant = "onLight", showLabel = true, className = "" }: Props) {
  const t = tone(mds);
  const palette = variant === "onDark" ? TONE_DARK[t] : TONE_LIGHT[t];

  return (
    <span
      className={`${palette.bg} ${palette.text} ${palette.border} border inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-bold ${className}`}
      title={tooltipFor(mds)}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
      {showLabel && labelFor(mds)}
    </span>
  );
}
