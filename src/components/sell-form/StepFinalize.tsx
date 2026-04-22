import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import type { FormData } from "./types";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  offerFirst?: boolean;
}

const StepFinalize = ({ formData, update, offerFirst }: Props) => {
  const { config } = useSiteConfig();
  const dealerName = config.dealership_name || "our dealership";

  return (
    <>
      <div className="mb-5">
        <p className="text-sm font-semibold text-card-foreground mb-1">
          {offerFirst ? "One last step — where should we send your offer?" : "You're almost there!"}
        </p>
        <p className="text-sm text-muted-foreground">
          {offerFirst
            ? "Enter your details so we can deliver your personalized cash offer instantly."
            : "Add your details and we'll show your offer right away. We'll also send you a copy."}
        </p>
      </div>

      <FormField label="Full Name" required>
        <Input
          placeholder="John Smith"
          value={formData.name}
          onChange={(e) => update("name", e.target.value)}
          className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
        />
      </FormField>
      <FormField label="Phone Number" required>
        <Input
          type="tel"
          placeholder="(555) 123-4567"
          value={formData.phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            let formatted = digits;
            if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
            else if (digits.length > 0) formatted = `(${digits}`;
            update("phone", formatted);
          }}
          className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
        />
      </FormField>
      <FormField label="Email Address" required>
        <Input
          type="email"
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => update("email", e.target.value)}
          className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
        />
      </FormField>

      <div className="p-3 bg-muted/50 border border-border rounded-lg mb-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from {dealerName} at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. See our{" "}
          <a href="/privacy#sms-consent" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Privacy Policy</a>{" "}
          and{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Terms of Service</a>.
        </p>
      </div>
    </>
  );
};

export default StepFinalize;
