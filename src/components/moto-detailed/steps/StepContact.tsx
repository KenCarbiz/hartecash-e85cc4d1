import { useState } from "react";
import { Lock } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { trackContactSubmitted, trackCtaClicked } from "../analytics";

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "zip" | "mileage";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
const digitsOnly = (v: string) => v.replace(/\D/g, "");
const formatMiles = (digits: string) =>
  digits ? Number(digits).toLocaleString("en-US") : "";

const StepContact = ({ state, update, next }: StepContext) => {
  const c = state.contact;
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    firstName: false, lastName: false, email: false, phone: false, zip: false, mileage: false,
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
  };
  const valid = !errors.firstName && !errors.lastName && !errors.email && !errors.phone && !errors.mileage;

  const onSubmit = () => {
    if (!valid) {
      setTouched({ firstName: true, lastName: true, email: true, phone: true, zip: true, mileage: true });
      return;
    }
    trackCtaClicked("contact", "See My Offer");
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

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Lock className="h-3.5 w-3.5" />
        </div>
        <span className="leading-relaxed">
          Your information stays secure. We'll only use it to send your offer and help with next steps.
        </span>
      </div>

      <PrimaryCTA onClick={onSubmit} disabled={!valid}>See My Offer</PrimaryCTA>
    </div>
  );
};


const Field = ({
  label, value, onChange, onBlur, type = "text", className, error, autoComplete, placeholder,
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
      className={`h-[52px] w-full rounded-xl border bg-white px-4 text-base text-slate-900 outline-none transition-all placeholder:text-slate-400 ${
        error
          ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
          : "border-[#E6EAF0] focus:border-[hsl(262_83%_58%)] focus:ring-4 focus:ring-[hsl(262_83%_58%/0.12)]"
      }`}
    />
    {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
  </label>
);

export default StepContact;
