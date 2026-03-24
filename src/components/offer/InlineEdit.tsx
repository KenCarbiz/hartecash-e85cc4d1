import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  type?: "text" | "select" | "multi-select";
  options?: { value: string; label: string }[];
  /** For multi-select: current selected values */
  multiValue?: string[];
  onMultiSave?: (values: string[]) => void;
  className?: string;
  label?: string;
}

export function InlineEdit({
  value,
  onSave,
  type = "text",
  options,
  multiValue,
  onMultiSave,
  className,
  label,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [multiDraft, setMultiDraft] = useState<string[]>(multiValue || []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { setMultiDraft(multiValue || []); }, [multiValue]);

  const handleSave = () => {
    if (type === "multi-select" && onMultiSave) {
      onMultiSave(multiDraft);
    } else {
      onSave(draft);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setMultiDraft(multiValue || []);
    setEditing(false);
  };

  const toggleMulti = (val: string) => {
    if (val === "none") {
      setMultiDraft(["none"]);
    } else {
      setMultiDraft((prev) => {
        const without = prev.filter((v) => v !== "none");
        return without.includes(val) ? without.filter((v) => v !== val) : [...without, val];
      });
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-accent/10 cursor-pointer",
          className
        )}
        title={`Edit ${label || "value"}`}
      >
        <span className="truncate">{type === "multi-select" && multiValue
          ? (multiValue.length === 0 || (multiValue.length === 1 && multiValue[0] === "none")
            ? "None"
            : multiValue.filter(v => v !== "none").join(", "))
          : value || "—"}</span>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  }

  if (type === "select" && options) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm border border-input rounded-md bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={handleSave} className="p-1 rounded-md bg-success/10 text-success hover:bg-success/20">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCancel} className="p-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (type === "multi-select" && options) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => toggleMulti(o.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                multiDraft.includes(o.value)
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSave} className="p-1 rounded-md bg-success/10 text-success hover:bg-success/20">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleCancel} className="p-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Default: text input
  return (
    <div className="flex items-center gap-1.5">
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-7 text-sm w-32"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") handleCancel();
        }}
      />
      <button onClick={handleSave} className="p-1 rounded-md bg-success/10 text-success hover:bg-success/20">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={handleCancel} className="p-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
