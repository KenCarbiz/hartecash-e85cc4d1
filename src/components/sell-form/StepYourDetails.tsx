import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import type { FormData } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
}

const StepYourDetails = ({ formData, update }: Props) => {
  const showLoanFields = formData.loanStatus === "Sell" || formData.loanStatus === "Trade-In";
  const showLeaseFields = formData.loanStatus === "Lease Buyout";

  return (
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

      <div className="p-3 bg-muted/50 border border-border rounded-lg mb-5">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          By submitting this form, you consent to receive autodialed calls, texts (SMS/MMS), and emails from Harte Auto Group at the phone number and email provided regarding your vehicle submission, offer, and appointment. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out. See our{" "}
          <a href="/privacy#sms-consent" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Privacy Policy</a>{" "}
          and{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:no-underline">Terms of Service</a>.
        </p>
      </div>
      <FormField label="What would you like to do?" hint="Sell outright, trade in for tax savings, or buy out your lease.">
        <div className="grid grid-cols-2 gap-2">
          {["Sell", "Trade-In", "Lease Buyout", "Not Sure"].map((opt) => (
            <RadioOption key={opt} label={opt} selected={formData.loanStatus === opt} onClick={() => update("loanStatus", opt)} />
          ))}
        </div>
      </FormField>

      {formData.loanStatus === "Trade-In" && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            💡 <strong>Trade-In Tax Savings:</strong> When you trade in your vehicle with a new purchase, you only pay sales tax on the difference — saving you hundreds or even thousands.
          </p>
        </div>
      )}

      {showLeaseFields && (
        <>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              💡 <strong>Lease Buyout:</strong> We'll purchase your leased vehicle directly. If your car is worth more than the buyout price, you keep the equity.
            </p>
          </div>
          <FormField label="Leasing Company">
            <Input
              placeholder="e.g. Toyota Financial, Ally, GM Financial"
              value={formData.loanCompany}
              onChange={(e) => update("loanCompany", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="Lease Buyout Amount">
            <Input
              placeholder="$18,500"
              value={formData.loanBalance}
              onChange={(e) => update("loanBalance", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="Monthly Lease Payment">
            <Input
              placeholder="$350"
              value={formData.loanPayment}
              onChange={(e) => update("loanPayment", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
        </>
      )}

      {showLoanFields && (
        <FormField label="Do you have a loan on this vehicle?">
          <div className="grid grid-cols-2 gap-2">
            {["Yes — Has Loan", "No — Owned Free"].map((opt) => (
              <RadioOption key={opt} label={opt} selected={formData.loanCompany === opt} onClick={() => update("loanCompany", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {showLoanFields && formData.loanCompany === "Yes — Has Loan" && (
        <>
          <FormField label="Lender Name">
            <Input
              placeholder="e.g. Chase Auto, Capital One"
              value={formData.loanBalance}
              onChange={(e) => update("loanBalance", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="Remaining Balance">
            <Input
              placeholder="$12,000"
              value={formData.loanPayment}
              onChange={(e) => update("loanPayment", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
        </>
      )}
    </>
  );
};

export default StepYourDetails;
