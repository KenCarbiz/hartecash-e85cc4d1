import { Label } from "@/components/ui/label";

export interface FormFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField = ({ label, hint, required, children }: FormFieldProps) => (
  <div className="mb-5">
    <Label className="text-sm font-semibold text-card-foreground mb-2 block">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
    {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
    {children}
  </div>
);

export default FormField;
