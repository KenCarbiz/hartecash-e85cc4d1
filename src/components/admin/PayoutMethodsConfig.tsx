import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Save,
  FileText,
  Landmark,
  Building2,
  Zap,
  ArrowLeftRight,
  Wallet,
} from "lucide-react";

/**
 * Payout Methods admin — dealer-facing config for the Payment Center.
 *
 * Persists `enabled_payout_methods` on site_config. The customer-facing
 * PaymentsPage renders ONLY the methods toggled on here. Default for
 * new dealers is paper-check-only because that reflects how the
 * majority of dealerships actually settle with sellers today.
 */

type PayoutKey =
  | "paper_check"
  | "ach"
  | "eft"
  | "instant_debit"
  | "wire_transfer";

type State = Record<PayoutKey, boolean>;

const DEFAULTS: State = {
  paper_check: true,
  ach: false,
  eft: false,
  instant_debit: false,
  wire_transfer: false,
};

const METHODS: {
  key: PayoutKey;
  label: string;
  icon: typeof Wallet;
  timing: string;
  helper: string;
}[] = [
  {
    key: "paper_check",
    label: "Paper Check",
    icon: FileText,
    timing: "Available same day at appointment",
    helper:
      "Print a dealership check and hand it to the customer at vehicle drop-off. The default for most rooftops.",
  },
  {
    key: "ach",
    label: "ACH Deposit",
    icon: Landmark,
    timing: "Typically arrives within 1–2 business days",
    helper:
      "Secure bank-to-bank transfer to the customer's checking account. Requires bank account verification at checkout.",
  },
  {
    key: "eft",
    label: "EFT Transfer",
    icon: ArrowLeftRight,
    timing: "Usually clears within 1 business day",
    helper:
      "Electronic funds transfer between participating banks. Slightly faster than ACH where supported.",
  },
  {
    key: "instant_debit",
    label: "Instant Debit Transfer",
    icon: Zap,
    timing: "Delivered to debit card in minutes",
    helper:
      "Push-to-card payout to an eligible debit card. Network fees may apply. Limited bank support.",
  },
  {
    key: "wire_transfer",
    label: "Wire Transfer",
    icon: Building2,
    timing: "Same-day for transfers before cutoff",
    helper:
      "Best for high-dollar transactions. Customer provides wire instructions and the dealer initiates the transfer.",
  },
];

const PayoutMethodsConfig = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [state, setState] = useState<State>(DEFAULTS);
  const [saved, setSaved] = useState<State>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_config")
        .select("enabled_payout_methods")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      const row = (data as any)?.enabled_payout_methods as Partial<State> | null;
      const merged: State = { ...DEFAULTS, ...(row ?? {}) };
      setState(merged);
      setSaved(merged);
      setLoading(false);
    })();
  }, [dealershipId]);

  const dirty = (Object.keys(state) as PayoutKey[]).some(
    (k) => state[k] !== saved[k],
  );
  const noneEnabled = !Object.values(state).some(Boolean);

  const toggle = (k: PayoutKey, v: boolean) =>
    setState((s) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    if (noneEnabled) {
      toast({
        title: "At least one method required",
        description:
          "Enable at least one payout method so customers have a way to get paid.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        enabled_payout_methods: state,
        updated_at: new Date().toISOString(),
      })
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSaved(state);
    qc.invalidateQueries({ queryKey: ["site_config"] });
    toast({
      title: "Payout methods saved",
      description: "Customers will see your updated options immediately.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Payout Methods</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choose which payout options customers can pick in the Payment
            Center. Most dealerships start with paper check only.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} className="shrink-0">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save payout methods
        </Button>
      </header>

      {noneEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Enable at least one payout method so customers can complete the
          transaction.
        </div>
      )}

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const enabled = state[m.key];
          return (
            <li
              key={m.key}
              className={`flex items-start gap-4 p-4 transition-colors ${
                enabled ? "bg-white" : "bg-zinc-50/40"
              }`}
            >
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  enabled
                    ? "bg-[hsl(263_70%_50%/0.1)] text-[hsl(263_70%_50%)]"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{m.label}</p>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                    {m.timing}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{m.helper}</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => toggle(m.key, v)}
                aria-label={`Enable ${m.label}`}
              />
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-zinc-400">
        The Payment Center renders only the methods enabled above. Default for
        new dealers is paper check only — turn on additional rails as your
        treasury workflow supports them.
      </p>
    </section>
  );
};

export default PayoutMethodsConfig;
