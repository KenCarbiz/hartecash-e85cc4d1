import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Layout, DollarSign, Banknote, Sparkles } from "lucide-react";
import { LANDING_TEMPLATES, type LandingTemplate } from "@/hooks/useSiteConfig";
import type { PricingRevealMode, RangeHighMode, PaymentSelectionTiming } from "@/lib/offerCalculator";
import TemplateThumbnail from "@/components/landing/TemplateThumbnail";

// Keep in sync with BB_VALUE_OPTIONS in OfferSettings.tsx — same 11 tiers.
const BB_TIERS = [
  { value: "wholesale_xclean", label: "Wholesale – Extra Clean" },
  { value: "wholesale_clean", label: "Wholesale – Clean" },
  { value: "wholesale_avg", label: "Wholesale – Average" },
  { value: "wholesale_rough", label: "Wholesale – Rough" },
  { value: "tradein_clean", label: "Trade-In – Clean" },
  { value: "tradein_avg", label: "Trade-In – Average" },
  { value: "tradein_rough", label: "Trade-In – Rough" },
  { value: "retail_xclean", label: "Retail – Extra Clean" },
  { value: "retail_clean", label: "Retail – Clean" },
  { value: "retail_avg", label: "Retail – Average" },
  { value: "retail_rough", label: "Retail – Rough" },
] as const;

interface State {
  landing_template: LandingTemplate;
  pricing_reveal_mode: PricingRevealMode;
  show_range_before_final: boolean;
  range_low_source: string;
  range_high_mode: RangeHighMode;
  range_high_source: string | null;
  range_high_percent: number;
  payment_selection_timing: PaymentSelectionTiming;
}

const DEFAULTS: State = {
  landing_template: "classic",
  pricing_reveal_mode: "price_first",
  show_range_before_final: false,
  range_low_source: "wholesale_avg",
  range_high_mode: "percent_above_low",
  range_high_source: null,
  range_high_percent: 8,
  payment_selection_timing: "with_final_offer",
};

const LandingFlowConfig = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();

  const [state, setState] = useState<State>(DEFAULTS);
  const [saved, setSaved] = useState<State>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [siteRes, offerRes] = await Promise.all([
        supabase.from("site_config" as any).select("landing_template").eq("dealership_id", dealershipId).maybeSingle(),
        supabase.from("offer_settings" as any).select(
          "pricing_reveal_mode, show_range_before_final, range_low_source, range_high_mode, range_high_source, range_high_percent, payment_selection_timing"
        ).eq("dealership_id", dealershipId).maybeSingle(),
      ]);
      const next: State = {
        landing_template: ((siteRes.data as any)?.landing_template as LandingTemplate) || DEFAULTS.landing_template,
        pricing_reveal_mode: ((offerRes.data as any)?.pricing_reveal_mode as PricingRevealMode) || DEFAULTS.pricing_reveal_mode,
        show_range_before_final: !!(offerRes.data as any)?.show_range_before_final,
        range_low_source: ((offerRes.data as any)?.range_low_source as string) || DEFAULTS.range_low_source,
        range_high_mode: ((offerRes.data as any)?.range_high_mode as RangeHighMode) || DEFAULTS.range_high_mode,
        range_high_source: ((offerRes.data as any)?.range_high_source as string) ?? null,
        range_high_percent: Number((offerRes.data as any)?.range_high_percent ?? DEFAULTS.range_high_percent),
        payment_selection_timing:
          ((offerRes.data as any)?.payment_selection_timing as PaymentSelectionTiming) ||
          DEFAULTS.payment_selection_timing,
      };
      setState(next);
      setSaved(next);
      setLoading(false);
    })();
  }, [dealershipId]);

  const dirty = JSON.stringify(state) !== JSON.stringify(saved);

  const update = <K extends keyof State>(key: K, value: State[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);

    const { error: siteErr } = await supabase
      .from("site_config" as any)
      .update({ landing_template: state.landing_template, updated_at: new Date().toISOString() } as any)
      .eq("dealership_id", dealershipId);

    const { error: offerErr } = await supabase
      .from("offer_settings" as any)
      .update({
        pricing_reveal_mode: state.pricing_reveal_mode,
        show_range_before_final: state.show_range_before_final,
        range_low_source: state.range_low_source,
        range_high_mode: state.range_high_mode,
        range_high_source: state.range_high_mode === "bb_value" ? state.range_high_source : null,
        range_high_percent: state.range_high_mode === "percent_above_low" ? state.range_high_percent : null,
        payment_selection_timing: state.payment_selection_timing,
      } as any)
      .eq("dealership_id", dealershipId);

    setSaving(false);
    if (siteErr || offerErr) {
      toast({
        title: "Save failed",
        description: (siteErr || offerErr)?.message,
        variant: "destructive",
      });
      return;
    }
    setSaved(state);
    toast({ title: "Saved", description: "Landing page & offer flow updated." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rangeActive =
    state.pricing_reveal_mode === "range_then_price" || state.show_range_before_final;

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" /> Landing Page &amp; Offer Flow
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick the landing-page layout your customers see, decide when they get a price,
          and choose if payment is picked before or with the final offer.
          Locations can override the template in their own settings.
        </p>
      </header>

      {/* ── Template picker ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layout className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Landing Page Template</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Your / route renders whichever template is selected here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANDING_TEMPLATES.map((t) => {
            const active = state.landing_template === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => update("landing_template", t.value)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-muted/30 hover:bg-muted hover:border-primary/30"
                }`}
              >
                <div className="aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60">
                  <TemplateThumbnail template={t.value} />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  {active && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Pricing reveal ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Pricing Reveal</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Controls whether the customer sees a number before providing their contact info.
        </p>

        <div className="space-y-2">
          {([
            {
              v: "price_first",
              title: "Offer Before Contact",
              desc: "Show the exact cash offer on-screen first. Contact info is collected afterward.",
            },
            {
              v: "range_then_price",
              title: "Range, Then Final Offer",
              desc: "Show an estimated range based on Black Book, collect contact info, then reveal the exact offer.",
            },
            {
              v: "contact_first",
              title: "Offer After Contact",
              desc: "Customer provides contact info first; no number is shown until then.",
            },
          ] as { v: PricingRevealMode; title: string; desc: string }[]).map((o) => {
            const active = state.pricing_reveal_mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => update("pricing_reveal_mode", o.v)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      active ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-sm">{o.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Secondary toggle: show range even when reveal mode is price_first or contact_first */}
        {state.pricing_reveal_mode !== "range_then_price" && (
          <div className="flex items-start gap-3 mt-4 p-3 rounded-lg bg-muted/40 border border-border">
            <Switch
              checked={state.show_range_before_final}
              onCheckedChange={(v) => update("show_range_before_final", v)}
            />
            <div>
              <div className="font-semibold text-sm">
                Also show a range while the customer waits
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Displays the Black Book range as a preview before the final number is ready.
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Range config ── */}
      {rangeActive && (
        <section className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-bold mb-1">Range Configuration</h3>
          <p className="text-xs text-muted-foreground mb-5">
            Pick which Black Book tiers anchor the low and high ends of the range.
            <span className="block mt-1 opacity-80">
              Asterisk on the page: * preliminary — subject to final inspection.
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Low Range Source</Label>
              <Select
                value={state.range_low_source}
                onValueChange={(v) => update("range_low_source", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BB_TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">High Range Method</Label>
              <Select
                value={state.range_high_mode}
                onValueChange={(v) => update("range_high_mode", v as RangeHighMode)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bb_value">Second Black Book tier</SelectItem>
                  <SelectItem value="percent_above_low">Percent above the low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {state.range_high_mode === "bb_value" ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold">High Range Source</Label>
                <Select
                  value={state.range_high_source ?? ""}
                  onValueChange={(v) => update("range_high_source", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a tier…" /></SelectTrigger>
                  <SelectContent>
                    {BB_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold">Percent Above Low</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={state.range_high_percent}
                    onChange={(e) => update("range_high_percent", Number(e.target.value))}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Example: 8% above a $10,000 low = $10,800 high.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Payment timing ── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Banknote className="w-4 h-4 text-primary" />
          <h3 className="font-bold">Payment Selection Timing</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          When the customer picks how you pay them (ACH, check, wire, etc.).
        </p>
        <div className="space-y-2">
          {([
            {
              v: "before_final_offer",
              title: "Before Final Offer",
              desc: "Customer picks their preferred payment method before seeing the final offer.",
            },
            {
              v: "with_final_offer",
              title: "With the Final Offer",
              desc: "Payment method is chosen on the same screen as the accepted offer.",
            },
            {
              v: "none_before_final_offer",
              title: "After Final Offer (Handled Later)",
              desc: "Skip during the landing flow — your team confirms payment method in follow-up.",
            },
          ] as { v: PaymentSelectionTiming; title: string; desc: string }[]).map((o) => {
            const active = state.payment_selection_timing === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => update("payment_selection_timing", o.v)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      active ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-sm">{o.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="shadow-lg"
          size="lg"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default LandingFlowConfig;
