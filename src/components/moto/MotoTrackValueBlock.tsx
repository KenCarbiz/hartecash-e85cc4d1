import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import type { MotoFlowState } from "./types";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const generateToken = () => {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Persistent "Track your vehicle value for free!" card. Renders below
 * the active step's main content from step 2 onward (skipped on the
 * search screen where we don't yet have a vehicle, and on the
 * schedule/queue end states where the customer has already converted).
 *
 * Inserts into the existing `watched_vehicles` table so the monthly
 * recompute-watched-values cron + dealer-branded value emails light up
 * automatically — this is the retention / re-engagement surface that
 * MotoAcquire uses to keep cold leads warm.
 */
const MotoTrackValueBlock = ({ state }: { state: MotoFlowState }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState(state.contact.email || "");
  const [saving, setSaving] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);

  const bb = state.bbVehicle;
  if (!bb || !bb.year || !bb.make || !bb.model) return null;

  const submit = async () => {
    if (!isEmail(email)) {
      toast({ title: "We need a valid email", variant: "destructive" });
      return;
    }
    setSaving(true);
    const token = generateToken();
    const { error } = await supabase.from("watched_vehicles" as never).insert({
      dealership_id: tenant.dealership_id,
      token,
      submission_id: state.submissionId,
      customer_name: `${state.contact.firstName} ${state.contact.lastName}`.trim() || null,
      email,
      phone: state.contact.phone || null,
      vin: bb.vin || null,
      vehicle_year: bb.year ? parseInt(bb.year, 10) : null,
      vehicle_make: bb.make,
      vehicle_model: bb.model,
      vehicle_trim: bb.series || null,
      mileage_at_save: Number((state.mileage || "").replace(/\D/g, "")) || 0,
      overall_condition: state.condition,
      baseline_value: state.offer.firm || state.offer.high || 0,
      current_value: state.offer.firm || state.offer.high || 0,
    } as never);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't subscribe", description: error.message, variant: "destructive" });
      return;
    }
    setSavedToken(token);
  };

  if (savedToken) {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700">
          <Check className="h-4 w-4" /> You're tracking this vehicle
        </div>
        <p className="mt-1 text-xs text-emerald-700/80">
          We'll email <span className="font-medium">{email}</span> when the value moves.
        </p>
        <a
          href={`/watch-my-car/${savedToken}`}
          className="mt-3 inline-block text-sm font-semibold text-[hsl(var(--cta-offer))] hover:underline"
        >
          Open your tracker →
        </a>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-[hsl(var(--cta-offer)/0.3)] bg-[hsl(var(--cta-offer)/0.04)] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--cta-offer)/0.15)]">
          <Bell className="h-5 w-5 text-[hsl(var(--cta-offer))]" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-[hsl(var(--cta-offer))]">
            Track your vehicle value for free!
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">
            Get a monthly email when your {bb.year} {bb.make} {bb.model}'s value
            changes. Know when it's the right time to trade or sell — completely free.
          </p>

          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--cta-offer))] px-4 py-2 text-sm font-bold text-[color:var(--cta-offer-text)] hover:opacity-95"
            >
              <Bell className="h-4 w-4" /> Track for free
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[hsl(var(--cta-offer))]"
              />
              <button
                type="button"
                disabled={saving || !isEmail(email)}
                onClick={submit}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--cta-offer))] px-4 py-2 text-sm font-bold text-[color:var(--cta-offer-text)] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Subscribe
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default MotoTrackValueBlock;
