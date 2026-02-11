import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField = ({ label, children }: FormFieldProps) => (
  <div className="mb-5">
    <Label className="text-sm font-semibold text-card-foreground mb-2 block">
      {label}
    </Label>
    {children}
  </div>
);

export default FormField;
