import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
}

const StepYourDetails = ({ formData, update }: Props) => (
  <>
    <FormField label="Full Name">
      <Input
        placeholder="John Smith"
        value={formData.name}
        onChange={(e) => update("name", e.target.value)}
        className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
      />
    </FormField>
    <FormField label="Phone Number">
      <Input
        type="tel"
        placeholder="(555) 123-4567"
        value={formData.phone}
        onChange={(e) => update("phone", e.target.value)}
        className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
      />
    </FormField>
    <FormField label="Email Address">
      <Input
        type="email"
        placeholder="john@example.com"
        value={formData.email}
        onChange={(e) => update("email", e.target.value)}
        className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
      />
    </FormField>
    <FormField label="ZIP Code">
      <Input
        placeholder="06001"
        value={formData.zip}
        onChange={(e) => update("zip", e.target.value)}
        className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
      />
    </FormField>
    <FormField label="Do you have a loan or lease on your vehicle?">
      <div className="grid grid-cols-3 gap-2">
        {["Loan", "Lease", "Neither"].map((opt) => (
          <RadioOption key={opt} label={opt} selected={formData.loanStatus === opt} onClick={() => update("loanStatus", opt)} />
        ))}
      </div>
    </FormField>
  </>
);

export default StepYourDetails;
