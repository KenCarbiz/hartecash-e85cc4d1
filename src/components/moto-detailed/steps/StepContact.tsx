import { useState, type ReactNode } from "react";
import { Lock, Check, ShieldCheck, FileText, FileSignature, User, Mail, Phone, MapPin, Gauge, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryCTA from "../PrimaryCTA";
import type { JourneyOwnership, StepContext } from "../types";
import { trackContactSubmitted, trackCtaClicked } from "../analytics";

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "zip" | "mileage" | "ownership";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhone = (v: string) => v.replace(/\D/g, "").length >= 10;
const digitsOnly = (v: string) => v.replace(/\D/g, "");
// Progressive (xxx) xxx-xxxx mask. Stores digits in state; formats for display.
const formatPhone = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
const formatMiles = (digits: string) => (digits ? Number(digits).toLocaleString("en-US") : "");
const formatMoney = (digits: string) => (digits ? Number(digits).toLocaleString("en-US") : "");

const OWNERSHIP_OPTIONS: {
  value: JourneyOwnership;
  title: string;
  desc: string;
  Icon: typeof ShieldCheck;
}[] = [
  { value: "own",   title: "I own it outright",     desc: "No loan or lease on the vehicle.", Icon: ShieldCheck },
  { value: "loan",  title: "I have a loan or lien", desc: "There is still a payoff balance.", Icon: FileText },
  { value: "lease", title: "It's leased",           desc: "The vehicle is currently leased.", Icon: FileSignature },
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
    <div className="space-y-8">
      {/* ── Section 1 — Contact details ─────────────────────────── */}
      <Section title="Contact details" subtitle="So we can deliver your offer and follow up if needed.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={c.firstName} onChange={(v) => set({ firstName: v })}
            onBlur={() => touch("firstName")} error={touched.firstName ? errors.firstName : undefined}
            autoComplete="given-name" Icon={User} placeholder="Jane" />
          <Field label="Last name" value={c.lastName} onChange={(v) => set({ lastName: v })}
            onBlur={() => touch("lastName")} error={touched.lastName ? errors.lastName : undefined}
            autoComplete="family-name" Icon={User} placeholder="Doe" />
          <Field label="Email" type="email" value={c.email} onChange={(v) => set({ email: v })}
            onBlur={() => touch("email")} error={touched.email ? errors.email : undefined}
            className="sm:col-span-2" autoComplete="email" placeholder="you@example.com" Icon={Mail} />
          <Field label="Phone" type="tel" value={formatPhone(c.phone)} onChange={(v) => set({ phone: digitsOnly(v) })}
            onBlur={() => touch("phone")} error={touched.phone ? errors.phone : undefined}
            autoComplete="tel" inputMode="tel" placeholder="(555) 555-5555" Icon={Phone} />
          <Field label="ZIP (optional)" value={c.zip} onChange={(v) => set({ zip: v })}
            onBlur={() => touch("zip")} autoComplete="postal-code" placeholder="90210" Icon={MapPin} />
        </div>
      </Section>

      {/* ── Section 2 — Vehicle details ─────────────────────────── */}
      <Section title="Vehicle details" subtitle="Accurate mileage helps us calculate your best available offer.">
        <Field
          label="Current mileage"
          value={formatMiles(c.mileage)}
          onChange={(v) => set({ mileage: digitsOnly(v) })}
          onBlur={() => touch("mileage")}
          error={touched.mileage ? errors.mileage : undefined}
          inputMode="numeric"
          placeholder="Enter current mileage"
          Icon={Gauge}
          helper={!errors.mileage ? "Your offer may update once mileage is confirmed." : undefined}
        />
      </Section>

      {/* ── Section 3 — Ownership status ────────────────────────── */}
      <Section
        title="How is this vehicle currently owned?"
        subtitle="This helps us understand title, payoff, or lease details before finalizing your offer."
        required
      >
        <div className="space-y-2.5">
          {OWNERSHIP_OPTIONS.map(({ value, title, desc, Icon }) => {
            const active = c.ownership === value;
            return (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.995 }}
                onClick={() => { set({ ownership: value }); touch("ownership"); }}
                className={`group relative flex w-full items-center gap-4 rounded-2xl border px-5 py-5 text-left transition-all ${
                  active
                    ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%/0.06)] shadow-[0_10px_28px_-14px_hsl(263_70%_50%/0.45),0_0_0_4px_hsl(263_70%_50%/0.08)]"
                    : "border-slate-200 bg-white hover:border-[hsl(263_70%_50%/0.6)] hover:bg-[hsl(263_70%_50%/0.04)] hover:shadow-[0_6px_18px_-12px_hsl(263_70%_50%/0.3)]"
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all ${
                    active
                      ? "bg-[hsl(263_70%_50%)] text-white shadow-[0_6px_16px_-6px_hsl(263_70%_50%/0.55)]"
                      : "bg-[hsl(263_70%_50%/0.1)] text-[hsl(263_60%_45%)] ring-1 ring-[hsl(263_70%_50%/0.15)]"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-semibold tracking-tight text-slate-900">{title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{desc}</p>
                </div>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    active
                      ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%)] text-white shadow-[0_4px_12px_-4px_hsl(263_70%_50%/0.5)]"
                      : "border-slate-300 bg-white group-hover:border-[hsl(263_70%_50%/0.5)]"
                  }`}
                >
                  {active && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </motion.button>
            );
          })}
        </div>
        {touched.ownership && errors.ownership && (
          <p className="mt-2 text-xs font-medium text-red-600">{errors.ownership}</p>
        )}

        {/* Conditional follow-ups */}
        {c.ownership === "own" && (
          <motion.p
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[hsl(263_70%_50%/0.06)] px-3.5 py-2.5 text-[12.5px] text-[hsl(263_60%_38%)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Great — please have your title available when completing the transaction.
          </motion.p>
        )}

        {c.ownership === "loan" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payoff details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Lender name (optional)"
                value={c.lender || ""}
                onChange={(v) => set({ lender: v })}
                placeholder="e.g. Chase Auto"
              />
              <Field
                label="Estimated payoff amount (optional)"
                value={formatMoney(c.payoffAmount || "")}
                onChange={(v) => set({ payoffAmount: digitsOnly(v) })}
                inputMode="numeric"
                placeholder="$0"
              />
              <p className="text-xs text-slate-500 sm:col-span-2">
                If you're not sure, you can leave this blank and we'll help verify it.
              </p>
            </div>
          </motion.div>
        )}

        {c.ownership === "lease" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lease details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Leasing company (optional)"
                value={c.leaseCompany || ""}
                onChange={(v) => set({ leaseCompany: v })}
                placeholder="e.g. Toyota Financial"
              />
              <Field
                label="Monthly payment (optional)"
                value={formatMoney(c.leaseMonthly || "")}
                onChange={(v) => set({ leaseMonthly: digitsOnly(v) })}
                inputMode="numeric"
                placeholder="$0"
              />
              <p className="text-xs text-slate-500 sm:col-span-2">
                Lease details help us understand your next steps.
              </p>
            </div>
          </motion.div>
        )}
      </Section>

      {/* Privacy strip — compact */}
      <div className="flex items-center gap-2.5 rounded-[14px] border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-2.5 text-[12.5px] text-emerald-800">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Lock className="h-3.5 w-3.5" />
        </span>
        <span className="leading-snug">
          Your information stays secure. We'll only use it to send your offer and help with next steps.
        </span>
      </div>

      <PrimaryCTA onClick={onSubmit} disabled={!valid}>See My Firm Offer</PrimaryCTA>
    </div>
  );
};

const Section = ({
  title, subtitle, required, children,
}: { title: string; subtitle?: string; required?: boolean; children: ReactNode }) => (
  <section>
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
      {required && <span className="text-[11px] font-medium text-slate-400">Required</span>}
    </div>
    {subtitle && <p className="mb-4 text-[12.5px] text-slate-500">{subtitle}</p>}
    {children}
  </section>
);

const Field = ({
  label, value, onChange, onBlur, type = "text", className, error, autoComplete, placeholder, inputMode, helper, Icon,
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
  Icon?: typeof User;
}) => (
  <label className={`block ${className ?? ""}`}>
    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors peer-focus:text-[hsl(263_70%_50%)]" strokeWidth={2} />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`peer h-[56px] w-full rounded-[14px] border bg-[#FAFBFF] ${Icon ? "pl-11" : "pl-4"} pr-4 text-[15px] font-medium text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 hover:bg-white focus:bg-white ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            : "border-[#E4E8F0] focus:border-[hsl(263_70%_50%)] focus:ring-4 focus:ring-[hsl(263_70%_50%/0.15)]"
        }`}
      />
    </div>
    {error
      ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>
      : helper
        ? <span className="mt-1.5 block text-xs text-slate-500">{helper}</span>
        : null}
  </label>
);

export default StepContact;
