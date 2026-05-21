import { Lock } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";

const StepContact = ({ state, update, next }: StepContext) => {
  const c = state.contact;
  const set = (patch: Partial<typeof c>) => update({ contact: { ...c, ...patch } });
  const valid = c.firstName && c.lastName && c.email && c.phone;

  const onSubmit = () => {
    if (!valid) return;
    update({ offerUnlocked: true });
    next();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" value={c.firstName} onChange={(v) => set({ firstName: v })} />
        <Field label="Last name" value={c.lastName} onChange={(v) => set({ lastName: v })} />
        <Field label="Email" type="email" value={c.email} onChange={(v) => set({ email: v })} className="sm:col-span-2" />
        <Field label="Phone" type="tel" value={c.phone} onChange={(v) => set({ phone: v })} />
        <Field label="ZIP (optional)" value={c.zip} onChange={(v) => set({ zip: v })} />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>We never share your information. You'll see your offer on the next screen.</span>
      </div>

      <PrimaryCTA onClick={onSubmit} disabled={!valid}>See My Offer</PrimaryCTA>
    </div>
  );
};

const Field = ({
  label, value, onChange, type = "text", className,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) => (
  <label className={`block ${className ?? ""}`}>
    <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[hsl(262_83%_58%)] focus:ring-4 focus:ring-[hsl(262_83%_58%/0.1)]"
    />
  </label>
);

export default StepContact;
