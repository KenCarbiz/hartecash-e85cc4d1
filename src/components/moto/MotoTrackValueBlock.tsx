import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import type { MotoFlowState } from "./types";
import { cn } from "@/lib/utils";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const generateToken = () => {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Soft value-curve illustration. Two points on a smooth green arc —
 * "$ Current Value" at the low end, "$$ Consider Selling" at the
 * high end. Matches the MotoAcquire screenshot exactly enough to feel
 * native without copying their asset.
 */
const ValueCurve = () => (
  <svg viewBox="0 0 320 160" className="mt-3 w-full max-w-md" aria-hidden>
    <path
      d="M 10 140 C 70 140 95 90 160 78 C 215 68 265 32 310 28"
      fill="none"
      stroke="#22c55e"
      strokeWidth="6"
      strokeLinecap="round"
    />
    {/* current value marker (low) */}
    <circle cx="160" cy="78" r="6" fill="#fff" stroke="#22c55e" strokeWidth="3" />
    <g transform="translate(120 30)">
      <rect width="80" height="28" rx="14" fill="#e4e7ec" />
      <text x="40" y="19" textAnchor="middle" fontSize="14" fontWeight="700" fill="#94a3b8">$</text>
      <polygon points="40,28 34,38 46,38" fill="#e4e7ec" />
    </g>
    <text x="115" y="22" fontSize="10" fontWeight="700" fill="#475569">CURRENT VALUE</text>
    {/* consider selling marker (high) */}
    <circle cx="260" cy="28" r="6" fill="#fff" stroke="#22c55e" strokeWidth="3" />
    <g transform="translate(230 -8) translate(0 8)">
      <rect width="80" height="28" rx="14" fill="#94a3b8" />
      <text x="40" y="19" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">$$</text>
      <polygon points="40,28 34,38 46,38" fill="#94a3b8" />
    </g>
    <text x="220" y="62" fontSize="10" fontWeight="700" fill="#475569">CONSIDER SELLING</text>
  </svg>
);

const SUB_STORAGE_PREFIX = "moto.watched_token.";

/**
 * Persistent retention card. Defaults to OPT-IN — the toggle in the
 * contact step (state.trackValue) is checked by default, so once the
 * customer's phone is verified and we have their email, we silently
 * insert a watched_vehicles row in the background and flip this card
 * to the "you're tracking" confirmation. The customer can opt out by
 * un-toggling on the contact step before verifying.
 *
 * Pre-contact (no email yet) the card is purely informational —
 * teaches the customer that the tracker exists with the green
 * value-curve illustration, no buttons, no friction.
 */
const MotoTrackValueBlock = ({ state }: { state: MotoFlowState }) => {
  const { tenant } = useTenant();
  const [expanded, setExpanded] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);

  const bb = state.bbVehicle;

  // Re-use the same token across reloads so the same browser session
  // doesn't insert duplicate watched_vehicles rows for one customer.
  // Keyed on VIN (or year+make+model when there is no VIN) so two
  // different cars in the same browser still get separate trackers.
  // Computed for all renders (hooks rule); the effect body itself
  // bails if there's no usable vehicle.
  const storageKey = bb
    ? SUB_STORAGE_PREFIX + (bb.vin || `${bb.year}-${bb.make}-${bb.model}`)
    : null;

  useEffect(() => {
    if (savedToken) return;
    if (!bb || !storageKey) return;
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) {
        setSavedToken(existing);
        return;
      }
    } catch (e) { console.debug("localStorage read blocked:", e); }

    // Auto-subscribe gate: must have phone verified + opt-in toggle
    // still on + a usable email.
    if (!state.contact.phoneVerified) return;
    if (!state.trackValue) return;
    if (!isEmail(state.contact.email)) return;

    const insert = async () => {
      const token = generateToken();
      const { error } = await supabase.from("watched_vehicles" as never).insert({
        dealership_id: tenant.dealership_id,
        token,
        submission_id: state.submissionId,
        customer_name: `${state.contact.firstName} ${state.contact.lastName}`.trim() || null,
        email: state.contact.email,
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
      if (error) {
        console.warn("[track-value] auto-subscribe failed (non-fatal):", error.message);
        return;
      }
      try { localStorage.setItem(storageKey, token); } catch (e) { console.debug("localStorage write blocked:", e); }
      setSavedToken(token);
    };
    void insert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.contact.phoneVerified, state.trackValue, state.contact.email, state.submissionId]);

  // Conditional renders AFTER all hooks have run (rules-of-hooks).
  // If the customer explicitly opted out at the contact step, or we
  // don't yet have a usable BB vehicle, render nothing.
  if (bb && state.contact.phoneVerified && !state.trackValue) return null;
  if (!bb || !bb.year || !bb.make || !bb.model) return null;

  // ── Confirmed state: customer is already on the auto-subscribe list ──
  if (savedToken) {
    return (
      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
        <h3 className="text-xl font-bold text-[hsl(var(--cta-offer))]">
          Track your vehicle value for free!
        </h3>
        <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <Check className="h-4 w-4" />
          You're subscribed — we'll email value updates monthly.
        </div>
        <a
          href={`/watch-my-car/${savedToken}`}
          className="mt-3 inline-block text-sm font-semibold text-[hsl(var(--cta-offer))] hover:underline"
        >
          Open your tracker →
        </a>
      </section>
    );
  }

  // ── Informational state (default) ──
  return (
    <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
      <h3 className="text-xl font-bold leading-tight text-[hsl(var(--cta-offer))]">
        Track your vehicle value for free!
      </h3>
      <p className="mt-2 text-base leading-relaxed text-zinc-500">
        Understand and track your vehicle's value—completely free. Know when it's the
        right time to trade in or sell for top value.
      </p>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--cta-offer))] hover:underline"
      >
        Learn More
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="mt-2 rounded-md bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-600">
          We use the same data sources that power our dealer pricing (Black Book data and
          comparable market listings) to recompute your vehicle's value every week. You'll
          get a monthly email when the value moves more than $200. No spam, unsubscribe anytime.
          {state.contact.phoneVerified && !state.trackValue ? (
            <span className="mt-2 block text-xs text-zinc-500">
              You opted out at the previous step — re-toggle "Track my vehicle value
              monthly via email" to enable.
            </span>
          ) : !state.contact.phoneVerified ? (
            <span className="mt-2 block text-xs text-zinc-500">
              We'll auto-subscribe you once you verify your phone — the "Track my
              vehicle value monthly" toggle on the contact step is on by default.
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-center">
        <ValueCurve />
      </div>
    </section>
  );
};

export default MotoTrackValueBlock;
