interface RadioOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

const RadioOption = ({ label, selected, onClick }: RadioOptionProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
      selected
        ? "border-accent bg-accent/10 text-accent"
        : "border-input bg-background text-card-foreground hover:border-muted-foreground/30"
    }`}
  >
    {label}
  </button>
);

export default RadioOption;
