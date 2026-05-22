import { useState } from "react";
import { Lock, Check, ShieldCheck, FileText, FileSignature } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { JourneyOwnership, StepContext } from "../types";
import { trackContactSubmitted, trackCtaClicked } from "../analytics";

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "zip" | "mileage" | "ownership";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
const digitsOnly = (v: string) => v.replace(/\D/g, "");
const formatMiles = (digits: string) =>
  digits ? Number(digits).toLocaleString("en-US") : "";
const formatMoney = (digits: string) =>
  digits ? Number(digits).toLocaleString("en-US") : "";

const OWNERSHIP_OPTIONS: {
  value: JourneyOwnership;
  title: string;
  desc: string;
  Icon: typeof ShieldCheck;
}[] = [
  { value: "own", title: "I own it outright", desc: "No loan or lease on the vehicle.", Icon: ShieldCheck },
  { value: "loan", title: "I have a loan or lien", desc: "There is still a payoff balance.", Icon: FileText },
  { value: "lease", title: "It's leased", desc: "The vehicle is currently leased.", Icon: FileSignature },
];

const StepContact = ({ state, update, next }: StepContext) => {
  const c = state.contact;
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    firstName: false, lastName: false, email: false, phone: false, zip: false, mileage: false, ownership: false,
  });
  const set = (patch: Partial<typeof c>) => update({ contact: { ...c, ...patch } });
  const touch = (k: FieldKey) => setTouched((t) => ({ ...t, [k]: true }));

  const mileageNum = c.mileage ? Number(c.mileage) : NaN;
  const errors: Partial<Record<FieldKey, string>> = {
    firstName: !c.firstName.trim() ? "Required" : undefined,
    lastName: !c.lastName.trim() ? "Required" : undefined,
    email: !c.email.trim() ? "Required" : !isEmail(c.email) ? "Enter a valid email" : undefined,
    phone: !c.phone.trim() ? "Required" : !isPhone(c.phone) ? "Enter a valid phone number" : undefined,
    mileage: !c.mileage
      ? "Required"
      : !Number.isFinite(mileageNum) || mileageNum <= 0
        ? "Please enter a valid mileage."
        : undefined,
    ownership: !c.ownership ? "Please choose an ownership status." : undefined,
  };
  const valid =
    !errors.firstName && !errors.lastName && !errors.email && !errors.phone &&
    !errors.mileage && !errors.ownership;

  const onSubmit = () => {
    if (!valid) {
      setTouched({ firstName: true, lastName: true, email: true, phone: true, zip: true, mileage: true, ownership: true });
      return;
    }
    trackCtaClicked("contact", "See My Firm Offer");
    trackContactSubmitted();
    update({ offerUnlocked: true });
    next();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" value={c.firstName} onChange={(v) => set({ firstName: v })}
          onBlur={() => touch("firstName")} error={touched.firstName ? errors.firstName : undefined} autoComplete="given-name" />
        <Field label="Last name" value={c.lastName} onChange={(v) => set({ lastName: v })}
          onBlur={() => touch("lastName")} error={touched.lastName ? errors.lastName : undefined} autoComplete="family-name" />
        <Field label="Email" type="email" value={c.email} onChange={(v) => set({ email: v })}
          onBlur={() => touch("email")} error={touched.email ? errors.email : undefined}
          className="sm:col-span-2" autoComplete="email" placeholder="you@example.com" />
        <Field label="Phone" type="tel" value={c.phone} onChange={(v) => set({ phone: v })}
          onBlur={() => touch("phone")} error={touched.phone ? errors.phone : undefined}
          autoComplete="tel" placeholder="(555) 555-5555" />
        <Field label="ZIP (optional)" value={c.zip} onChange={(v) => set({ zip: v })}
          onBlur={() => touch("zip")} autoComplete="postal-code" placeholder="90210" />
        <Field
          label="Current mileage"
          value={formatMiles(c.mileage)}
          onChange={(v) => set({ mileage: digitsOnly(v) })}
          onBlur={() => touch("mileage")}
          error={touched.mileage ? errors.mileage : undefined}
          inputMode="numeric"
          placeholder="Enter current mileage"
          className="sm:col-span-2"
          helper="Accurate mileage helps us calculate your best available offer."
        />
      </div>

      {/* Ownership status — required */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="block text-sm font-medium text-slate-800">Vehicle ownership status</span>
          <span className="text-[11px] font-medium text-slate-400">Required</span>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          This helps us understand payoff, title, or lease details before finalizing your offer.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {OWNERSHIP_OPTIONS.map(({ value, title, desc, Icon }) => {
            const active = c.ownership === value;
            return (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.99 }}
                onClick={() => { set({ ownership: value }); touch("ownership"); }}
                className={`group relative flex h-full min-h-[120px] flex-col rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%/0.05)] shadow-[0_8px_24px_-12px_hsl(262_83%_58%/0.45),0_0_0_4px_hsl(262_83%_58%/0.08)]"
                    : "border-slate-200 bg-white hover:border-[hsl(262_83%_58%/0.55)] hover:bg-[hsl(262_83%_58%/0.035)]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-[hsl(262_83%_58%)] text-white" : "bg-[hsl(262_83%_58%/0.08)] text-[hsl(262_60%_45%)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      active ? "border-[hsl(262_83%_58%)] bg-[hsl(262_83%_58%)] text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{desc}</p>
              </motion.button>
            );
          })}
        </div>
        {touched.ownership && errors.ownership && (
          <p className="mt-2 text-xs font-medium text-red-600">{errors.ownership}</p>
        )}

        {/* Conditional follow-ups */}
        {c.ownership === "loan" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <Field
              label="Estimated payoff amount"
              value={formatMoney(c.payoffAmount || "")}
              onChange={(v) => set({ payoffAmount: digitsOnly(v) })}
              inputMode="numeric"
              placeholder="Enter estimated payoff"
              helper="If you're not sure, you can leave this blank and we'll help verify it."
            />
          </motion.div>
        )}

        {c.ownership === "lease" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Field
              label="Leasing company"
              value={c.leaseCompany || ""}
              onChange={(v) => set({ leaseCompany: v })}
              placeholder="e.g. Toyota Financial"
            />
            <Field
              label="Monthly payment (optional)"
              value={formatMoney(c.leaseMonthly || "")}
              onChange={(v) => set({ leaseMonthly: digitsOnly(v) })}
              inputMode="numeric"
              placeholder="Enter monthly payment"
            />
            <p className="text-xs text-slate-500 sm:col-span-2">
              Lease details help us understand your next steps.
            </p>
          </motion.div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Lock className="h-3.5 w-3.5" />
        </div>
        <span className="leading-relaxed">
          Your information stays secure. We'll only use it to send your offer and help with next steps.
        </span>
      </div>

      <PrimaryCTA onClick={onSubmit} disabled={!valid}>See My Firm Offer</PrimaryCTA>
    </div>
  );
};


const Field = ({
  label, value, onChange, onBlur, type = "text", className, error, autoComplete, placeholder, inputMode, helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  className?: string;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal" | "search" | "url" | "none";
  helper?: string;
}) => (
  <label className={`block ${className ?? ""}`}>
    <span className="mb-1.5 block text-sm font-medium text-slate-800">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoComplete={autoComplete}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`h-[52px] w-full rounded-xl border bg-white px-4 text-base text-slate-900 outline-none transition-all placeholder:text-slate-400 ${
        error
          ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
          : "border-[#E6EAF0] focus:border-[hsl(262_83%_58%)] focus:ring-4 focus:ring-[hsl(262_83%_58%/0.12)]"
      }`}
    />
    {error
      ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      : helper
        ? <span className="mt-1 block text-xs text-slate-500">{helper}</span>
        : null}
  </label>
);


export default StepContact;
