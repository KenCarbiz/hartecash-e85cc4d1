import { Check } from "lucide-react";

interface CheckboxOptionProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onClick: () => void;
}

const CheckboxOption = ({ label, subtitle, checked, onClick }: CheckboxOptionProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-3 ${
      checked
        ? "border-accent bg-accent/10 text-accent"
        : "border-input bg-background text-card-foreground hover:border-muted-foreground/30"
    }`}
  >
    <div
      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
        checked ? "border-accent bg-accent" : "border-muted-foreground/40"
      }`}
    >
      {checked && <Check className="w-3 h-3 text-accent-foreground" />}
    </div>
    <div>
      <span>{label}</span>
      {subtitle && (
        <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
      )}
    </div>
  </button>
);

export default CheckboxOption;
