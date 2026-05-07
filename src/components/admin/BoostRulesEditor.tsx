import { useEffect, useState, useCallback, useRef } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Boost-Rules editor — dealer-tunable dollar amounts and on/off
 * toggles for each AI signal that can fire on the boost-offer page.
 *
 * Reads from boost_bump_rules + merges with the canonical defaults
 * below so dealers who haven't tuned anything still see realistic
 * values. Per-row autosave with a 500ms debounce so toggles + edits
 * persist immediately without a "Save" button to remember.
 *
 * The 10 signals split into four tiers by signal strength. Tier 1+2
 * (the five highest-impact ones) are visible by default; Tier 3+4
 * sit under a "Show advanced signals" toggle so the dealer can tune
 * what matters without analysis paralysis on the rest.
 */

type Tier = 1 | 2 | 3 | 4 | 5;

interface SignalDef {
  key: string;
  tier: Tier;
  label: string;       // short headline for the row
  description: string; // 1-sentence plain-English explanation
  defaultAmount: number;
  defaultEnabled: boolean;
  // When true, the bump amount is computed from Black Book
  // (re-appraisal delta) and the input field is hidden — only the
  // enable/disable toggle is meaningful.
  amountIsAuto?: boolean;
}

// Mirror SIGNAL_DEFAULTS in supabase/functions/boost-evaluate/index.ts
// — keep these two lists in sync. Order here drives display order
// inside each tier.
const SIGNALS: SignalDef[] = [
  // ── Tier 1 ── biggest movers
  {
    key: "ocr_mileage_reappraisal",
    tier: 1,
    label: "Lower-than-stated mileage discovered",
    description:
      "When the AI reads the dashboard and verified miles are LOWER than what the customer typed in, we re-run Black Book with the corrected number. The bump amount is whatever Black Book gives back — typically $500–$2,500 — so it isn't tunable here, but you can switch the whole step off.",
    defaultAmount: 0,
    defaultEnabled: true,
    amountIsAuto: true,
  },
  {
    key: "mileage_verified",
    tier: 1,
    label: "Mileage verified as accurate",
    description:
      "AI reads the dashboard and confirms it matches the customer's stated miles. Small confidence bump because we now know the offer is grounded in real numbers.",
    defaultAmount: 100,
    defaultEnabled: true,
  },
  {
    key: "condition_upgrade",
    tier: 1,
    label: "AI rates condition higher than customer did",
    description:
      "AI's view of the four exterior shots comes in one tier above what the customer self-rated (e.g. customer said 'Good', photos read 'Very Good'). Most common Tier 1 bump because customers under-rate themselves.",
    defaultAmount: 450,
    defaultEnabled: true,
  },

  // ── Tier 2 ── body and paint
  {
    key: "paint_match",
    tier: 2,
    label: "Paint matches across all panels",
    description:
      "AI compares paint color, gloss, and orange-peel texture between adjacent panels. No mismatch = no signs of post-collision repaint.",
    defaultAmount: 225,
    defaultEnabled: true,
  },
  {
    key: "no_accident_repair",
    tier: 2,
    label: "No accident-repair signs found",
    description:
      "AI looks for panel gaps, replaced fender liners, paint overspray on bolts, and other tells of past collision repair. None found = factory-original body.",
    defaultAmount: 175,
    defaultEnabled: true,
  },
  {
    key: "exterior_clean",
    tier: 2,
    label: "No moderate or severe exterior damage",
    description:
      "Across all four exterior photos, AI flags zero dents, scratches, rust, or missing trim worse than minor cosmetic wear.",
    defaultAmount: 175,
    defaultEnabled: true,
  },

  // ── Tier 3 ── tires and wheels
  {
    key: "tire_tread_high",
    tier: 3,
    label: "Tires above 7/32\" tread",
    description:
      "AI estimates remaining tread depth. Above 7/32\" means the dealer doesn't have to replace tires before resale — real recon avoidance.",
    defaultAmount: 200,
    defaultEnabled: true,
  },
  {
    key: "tire_tread_mid",
    tier: 3,
    label: "Tires at 5–6/32\" tread",
    description:
      "Mid-tread bracket — still legal and safe but closer to end of life.",
    defaultAmount: 100,
    defaultEnabled: true,
  },
  {
    key: "wheels_clean",
    tier: 3,
    label: "Wheels original, no curb damage",
    description:
      "AI checks the wheel design against the OEM pattern for that year/make/model AND looks for curb rash on the wheel face.",
    defaultAmount: 200,
    defaultEnabled: true,
  },

  // ── Tier 4 ── dashboard and cabin
  {
    key: "no_warning_lights",
    tier: 4,
    label: "Dashboard clear, no warning lights",
    description:
      "AI scans the gauge cluster for any illuminated warning icons (check engine, ABS, airbag, TPMS, etc.). Nothing lit = no hidden trouble codes at inspection.",
    defaultAmount: 200,
    defaultEnabled: true,
  },
  {
    key: "clean_cabin",
    tier: 4,
    label: "Cabin presents clean",
    description:
      "AI looks at visible interior for smoke yellowing, stains, rips, pet damage, heavy wear, or aftermarket installs.",
    defaultAmount: 125,
    defaultEnabled: true,
  },

  // ── Tier 5 — Bonus interior shots (driver seat + steering wheel)
  // These are the strongest mileage-honesty signals available from
  // a photo set. Only fire when the customer uploads the optional
  // bonus shot, so they're upside-only — never a baseline bump.
  {
    key: "driver_seat_low_wear",
    tier: 5,
    label: "Driver seat shows low wear",
    description:
      "AI checks the bolster, cushion, and back for heavy wear, rips, stains, or sagging. A clean driver seat suggests miles are honest — heavily-bolstered wear is the #1 'true miles higher than odometer says' tell in the appraisal industry.",
    defaultAmount: 200,
    defaultEnabled: true,
  },
  {
    key: "steering_wheel_unworn",
    tier: 5,
    label: "Steering wheel looks original",
    description:
      "AI checks the grip area for glossy wear band, leather cracking, or worn buttons. An original-condition wheel cross-checks the odometer reading — high-mileage cars almost always show a shiny worn grip from years of contact.",
    defaultAmount: 150,
    defaultEnabled: true,
  },
];

const TIER_LABEL: Record<Tier, string> = {
  1: "Tier 1 — Biggest movers",
  2: "Tier 2 — Body & paint",
  3: "Tier 3 — Tires & wheels",
  4: "Tier 4 — Dashboard & cabin",
  5: "Tier 5 — Interior bonus shots",
};

interface RuleState {
  amount: number;
  enabled: boolean;
  saving?: boolean;
  saved?: boolean;
}

const BoostRulesEditor = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rules, setRules] = useState<Record<string, RuleState>>(() => {
    const init: Record<string, RuleState> = {};
    for (const s of SIGNALS) {
      init[s.key] = { amount: s.defaultAmount, enabled: s.defaultEnabled };
    }
    return init;
  });
  // Per-row debounced save — keeps autosave from firing on every keystroke.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load existing overrides → merge into defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("boost_bump_rules" as never)
        .select("signal_key, bump_amount, enabled")
        .eq("dealership_id", tenant.dealership_id);

      if (cancelled) return;
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("does not exist") || msg.includes("schema cache")) {
          toast({
            title: "Pending migration",
            description: "Apply 20260506210000_boost_bump_rules.sql to enable per-dealer tuning.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Couldn't load rules", description: error.message, variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      // Start from defaults, overlay any persisted rows.
      const next: Record<string, RuleState> = {};
      for (const s of SIGNALS) {
        next[s.key] = { amount: s.defaultAmount, enabled: s.defaultEnabled };
      }
      for (const r of data || []) {
        const key = (r as { signal_key: string }).signal_key;
        if (!next[key]) continue;
        next[key] = {
          amount: Number((r as { bump_amount: number }).bump_amount) || 0,
          enabled: (r as { enabled: boolean }).enabled !== false,
        };
      }
      setRules(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant.dealership_id, toast]);

  // Upsert one rule with a debounce so rapid input edits collapse
  // into a single write. Mark saving / saved on the row so the UI
  // reflects the autosave state.
  const persistRule = useCallback(
    (key: string, patch: Partial<Pick<RuleState, "amount" | "enabled">>, debounceMs = 0) => {
      // Optimistic local update
      setRules((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch, saving: true, saved: false },
      }));

      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(async () => {
        const current = { ...(SIGNALS.find((s) => s.key === key) || {}), ...patch } as Partial<RuleState>;
        // Read fresh rule state at fire time so we save the latest
        // value, not a stale closure capture.
        const live = await new Promise<RuleState>((resolve) => {
          setRules((prev) => {
            resolve(prev[key]);
            return prev;
          });
        });
        void current;

        const { error } = await supabase
          .from("boost_bump_rules" as never)
          .upsert(
            {
              dealership_id: tenant.dealership_id,
              signal_key: key,
              bump_amount: live.amount,
              enabled: live.enabled,
            } as never,
            { onConflict: "dealership_id,signal_key" } as never,
          );

        setRules((prev) => ({
          ...prev,
          [key]: { ...prev[key], saving: false, saved: !error },
        }));

        if (error) {
          toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
        } else {
          // Clear "saved" indicator after 1.5s
          setTimeout(() => {
            setRules((prev) =>
              prev[key]?.saved ? { ...prev, [key]: { ...prev[key], saved: false } } : prev,
            );
          }, 1500);
        }
      }, debounceMs);
    },
    [tenant.dealership_id, toast],
  );

  const visibleSignals = showAdvanced ? SIGNALS : SIGNALS.filter((s) => s.tier <= 2);
  const grouped = new Map<Tier, SignalDef[]>();
  for (const s of visibleSignals) {
    if (!grouped.has(s.tier)) grouped.set(s.tier, []);
    grouped.get(s.tier)!.push(s);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading boost rules…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm text-emerald-900 leading-relaxed">
        <p className="font-semibold mb-1 inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> How these rules work
        </p>
        <p className="text-emerald-800/90">
          When a customer uploads photos on the boost-offer page, our AI checks each one and looks for the
          signals below. Every signal that fires adds its dollar amount to the customer's offer. Signals
          you disable here never appear in the customer's receipt.
        </p>
      </div>

      {[...grouped.entries()]
        .sort(([a], [b]) => a - b)
        .map(([tier, signals]) => (
          <div key={tier} className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-card-foreground">{TIER_LABEL[tier]}</h4>
              <Badge variant="outline" className="text-[10px]">
                {signals.length} {signals.length === 1 ? "signal" : "signals"}
              </Badge>
            </div>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {signals.map((s) => {
                const r = rules[s.key];
                if (!r) return null;
                return (
                  <div key={s.key} className="px-4 py-4 bg-card flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="text-sm font-semibold text-card-foreground">{s.label}</Label>
                        {r.saving && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" /> Saving
                          </span>
                        )}
                        {r.saved && !r.saving && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                            <Check className="w-3 h-3" /> Saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {!s.amountIsAuto && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            max="2500"
                            step="25"
                            disabled={!r.enabled}
                            value={r.amount}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(2500, Number(e.target.value) || 0));
                              persistRule(s.key, { amount: val }, 500);
                            }}
                            className="w-24 text-right tabular-nums"
                          />
                        </div>
                      )}
                      {s.amountIsAuto && (
                        <span className="text-xs italic text-muted-foreground whitespace-nowrap">
                          Auto from Black Book
                        </span>
                      )}
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => persistRule(s.key, { enabled: v }, 0)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      <div className="flex justify-center pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced((v) => !v)}
          className="gap-1.5"
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Hide advanced signals
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Show advanced signals (tires, wheels, dashboard, cabin)
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default BoostRulesEditor;
