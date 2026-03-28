import { cn } from "@/lib/utils";

interface TreadDepthPickerProps {
  label: string;
  value: number | null;
  onChange: (depth: number) => void;
}

const DEPTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const getColor = (d: number) => {
  if (d >= 6) return "bg-green-500 border-green-600 text-white";
  if (d >= 4) return "bg-amber-400 border-amber-500 text-amber-950";
  if (d >= 1) return "bg-red-500 border-red-600 text-white";
  return "bg-red-700 border-red-800 text-white";
};

const getZoneLabel = (d: number) => {
  if (d >= 10) return "New";
  if (d >= 6) return "Good";
  if (d >= 4) return "Fair";
  if (d >= 1) return "Low";
  return "Bald";
};

const TreadDepthPicker = ({ label, value, onChange }: TreadDepthPickerProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {value !== null && (
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full border",
            getColor(value)
          )}>
            {value}/32 · {getZoneLabel(value)}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {DEPTHS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "flex-1 h-10 rounded-md text-xs font-bold border transition-all active:scale-95",
              value === d
                ? cn(getColor(d), "ring-2 ring-offset-1 ring-primary shadow-md scale-105")
                : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TreadDepthPicker;
