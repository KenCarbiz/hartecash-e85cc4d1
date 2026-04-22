import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { clearFormConfigCache } from "@/hooks/useFormConfig";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, ChevronDown, Loader2, Car, ClipboardList, User, Flag, Lock, DollarSign, Banknote } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PricingRevealMode, RangeHighMode, PaymentSelectionTiming } from "@/lib/offerCalculator";

// Same 11 Black Book tiers the offer engine exposes — kept in sync with
// OfferSettings.tsx / the engine's getBBValue() lookup.
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

interface OfferFlowState {
  pricing_reveal_mode: PricingRevealMode;
  show_range_before_final: boolean;
  range_low_source: string;
  range_high_mode: RangeHighMode;
  range_high_source: string | null;
  range_high_percent: number;
  payment_selection_timing: PaymentSelectionTiming;
}

const OFFER_FLOW_DEFAULTS: OfferFlowState = {
  pricing_reveal_mode: "price_first",
  show_range_before_final: false,
  range_low_source: "wholesale_avg",
  range_high_mode: "percent_above_low",
  range_high_source: null,
  range_high_percent: 8,
  payment_selection_timing: "with_final_offer",
};

interface FormConfigData {
  id?: string;
  dealership_id: string;
  step_vehicle_build: boolean;
  step_condition_history: boolean;
  step_ai_photos: boolean;
  ai_photos_min_required: number;
  offer_before_details: boolean;
  q_overall_condition: boolean;
  q_exterior_damage: boolean;
  q_windshield_damage: boolean;
  q_moonroof: boolean;
  q_interior_damage: boolean;
  q_tech_issues: boolean;
  q_engine_issues: boolean;
  q_mechanical_issues: boolean;
  q_drivable: boolean;
  q_accidents: boolean;
  q_smoked_in: boolean;
  q_tires_replaced: boolean;
  q_num_keys: boolean;
  q_exterior_color: boolean;
  q_drivetrain: boolean;
  q_modifications: boolean;
  q_loan_details: boolean;
  q_next_step: boolean;
}

const DEFAULTS: FormConfigData = {
  dealership_id: "default",
  step_vehicle_build: true,
  step_condition_history: true,
  step_ai_photos: true,
  ai_photos_min_required: 4,
  offer_before_details: false,
  q_overall_condition: true,
  q_exterior_damage: true,
  q_windshield_damage: true,
  q_moonroof: true,
  q_interior_damage: true,
  q_tech_issues: true,
  q_engine_issues: true,
  q_mechanical_issues: true,
  q_drivable: true,
  q_accidents: true,
  q_smoked_in: true,
  q_tires_replaced: true,
  q_num_keys: true,
  q_exterior_color: true,
  q_drivetrain: true,
  q_modifications: true,
  q_loan_details: true,
  q_next_step: true,
};

const CONDITION_QUESTIONS = [
  { key: "q_overall_condition", label: "Overall Condition", desc: "Excellent / Very Good / Good / Fair rating" },
  { key: "q_exterior_damage", label: "Exterior Damage", desc: "Scratches, dents, rust, hail, etc." },
  { key: "q_windshield_damage", label: "Windshield Damage", desc: "Chipped or cracked windshield" },
  { key: "q_moonroof", label: "Moonroof / Sunroof", desc: "Whether vehicle has a moonroof" },
  { key: "q_interior_damage", label: "Interior Damage", desc: "Odors, stains, rips, dashboard damage" },
  { key: "q_tech_issues", label: "Technology Issues", desc: "Sound system, display, camera, sensors" },
  { key: "q_engine_issues", label: "Engine Issues", desc: "Check engine light, noises, vibration" },
  { key: "q_mechanical_issues", label: "Mechanical Issues", desc: "A/C, electrical, transmission, brakes" },
  { key: "q_drivable", label: "Drivable", desc: "Can the vehicle be driven to the dealership" },
  { key: "q_accidents", label: "Accidents", desc: "Number of reported accidents" },
  { key: "q_smoked_in", label: "Smoked In", desc: "Whether the vehicle was smoked in" },
  { key: "q_tires_replaced", label: "Tires Replaced", desc: "Whether tires have been replaced recently" },
  { key: "q_num_keys", label: "Number of Keys", desc: "How many keys come with the vehicle" },
];

const BUILD_QUESTIONS = [
  { key: "q_exterior_color", label: "Exterior Color", desc: "Color picker with common options" },
  { key: "q_drivetrain", label: "Drivetrain", desc: "FWD / RWD / AWD / 4WD selection" },
  { key: "q_modifications", label: "Modifications", desc: "Aftermarket or performance modifications" },
];

const DETAILS_QUESTIONS = [
  { key: "q_loan_details", label: "Loan / Payoff Details", desc: "Loan company, balance, and payment info" },
];

const OFFER_QUESTIONS = [
  { key: "q_next_step", label: "Next Step Preference", desc: "How the customer wants to proceed" },
];

export default function FormConfiguration() {
  const { toast } = useToast();
  const [config, setConfig] = useState<FormConfigData>(DEFAULTS);
  const [offerFlow, setOfferFlow] = useState<OfferFlowState>(OFFER_FLOW_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    steps: true,
    build: true,
    condition: true,
    details: false,
    offer: false,
    reveal: true,
    payment: true,
  });

  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  useEffect(() => {
    fetchConfig();
  }, [dealershipId]);

  const fetchConfig = async () => {
    setLoading(true);
    const [formRes, offerRes] = await Promise.all([
      supabase.from("form_config" as any).select("*").eq("dealership_id", dealershipId).maybeSingle(),
      supabase.from("offer_settings" as any).select(
        "pricing_reveal_mode, show_range_before_final, range_low_source, range_high_mode, range_high_source, range_high_percent, payment_selection_timing"
      ).eq("dealership_id", dealershipId).maybeSingle(),
    ]);
    if (formRes.data) {
      setConfig({ ...DEFAULTS, ...(formRes.data as any) });
    }
    if (offerRes.data) {
      const row = offerRes.data as any;
      setOfferFlow({
        pricing_reveal_mode: (row.pricing_reveal_mode as PricingRevealMode) || OFFER_FLOW_DEFAULTS.pricing_reveal_mode,
        show_range_before_final: !!row.show_range_before_final,
        range_low_source: (row.range_low_source as string) || OFFER_FLOW_DEFAULTS.range_low_source,
        range_high_mode: (row.range_high_mode as RangeHighMode) || OFFER_FLOW_DEFAULTS.range_high_mode,
        range_high_source: (row.range_high_source as string) ?? null,
        range_high_percent: Number(row.range_high_percent ?? OFFER_FLOW_DEFAULTS.range_high_percent),
        payment_selection_timing:
          (row.payment_selection_timing as PaymentSelectionTiming) || OFFER_FLOW_DEFAULTS.payment_selection_timing,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Keep offer_before_details (form_config) in sync with pricing_reveal_mode
    // (offer_settings) so any legacy code still reading the old column
    // keeps working.
    const offerBeforeDetails = offerFlow.pricing_reveal_mode === "price_first";
    const payload = {
      ...config,
      offer_before_details: offerBeforeDetails,
      updated_at: new Date().toISOString(),
    };
    delete (payload as any).id;

    const { data: existing } = await supabase
      .from("form_config" as any)
      .select("id")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("form_config" as any)
        .update(payload)
        .eq("id", (existing as any).id));
    } else {
      ({ error } = await supabase.from("form_config" as any).insert(payload));
    }

    // Persist the offer-flow settings on offer_settings
    const { error: offerErr } = await supabase
      .from("offer_settings" as any)
      .update({
        pricing_reveal_mode: offerFlow.pricing_reveal_mode,
        show_range_before_final: offerFlow.show_range_before_final,
        range_low_source: offerFlow.range_low_source,
        range_high_mode: offerFlow.range_high_mode,
        range_high_source: offerFlow.range_high_mode === "bb_value" ? offerFlow.range_high_source : null,
        range_high_percent: offerFlow.range_high_mode === "percent_above_low" ? offerFlow.range_high_percent : null,
        payment_selection_timing: offerFlow.payment_selection_timing,
      } as any)
      .eq("dealership_id", dealershipId);

    setSaving(false);
    clearFormConfigCache();
    const err = (error || offerErr) as any;
    if (err) {
      // Diagnose the two most common causes (unapplied migration or stale
      // PostgREST cache) so the dealer doesn't chase a raw Postgres message.
      const msg: string = err.message || "";
      const missingCol =
        /schema cache/i.test(msg) ||
        (/column/i.test(msg) && /does not exist/i.test(msg)) ||
        /pricing_reveal_mode|range_low_source|payment_selection_timing|step_ai_photos/.test(msg);
      toast({
        title: missingCol ? "Pending migration" : "Save failed",
        description: missingCol
          ? "One or more form-flow columns (pricing_reveal_mode, range_low_source, payment_selection_timing, step_ai_photos) aren't provisioned on this environment yet. Apply the pending Supabase migrations or refresh the PostgREST schema cache, then try again."
          : msg,
        variant: "destructive",
      });
    } else {
      // Reflect the derived column locally so the visible Step 4/5 labels
      // update immediately without a refetch.
      setConfig((c) => ({ ...c, offer_before_details: offerBeforeDetails }));
      toast({ title: "Saved", description: "Form configuration updated." });
    }
  };

  const toggle = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }));
  const set = (key: string, val: boolean) => setConfig(c => ({ ...c, [key]: val }));
  const updateFlow = <K extends keyof OfferFlowState>(k: K, v: OfferFlowState[K]) =>
    setOfferFlow((prev) => ({ ...prev, [k]: v }));

  const enabledCount = (questions: { key: string }[]) =>
    questions.filter(q => (config as any)[q.key]).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderQuestionRow = (q: { key: string; label: string; desc: string }, disabled?: boolean) => (
    <div
      key={q.key}
      className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
        (config as any)[q.key] && !disabled
          ? "bg-background"
          : "bg-muted/30 opacity-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <Switch
          checked={(config as any)[q.key] && !disabled}
          onCheckedChange={v => set(q.key, v)}
          disabled={disabled}
        />
        <div>
          <p className="text-sm font-medium">{q.label}</p>
          <p className="text-xs text-muted-foreground">{q.desc}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Form Configuration</h2>
          <p className="text-sm text-muted-foreground">Toggle which steps and questions customers see</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </div>

      {/* Step toggles */}
      <Collapsible open={openSections.steps} onOpenChange={() => toggle("steps")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Flag className="w-4 h-4" />
            Form Steps
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.steps ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          {/* Always-on steps */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Step 1 — Vehicle Info</p>
                <p className="text-xs text-muted-foreground">VIN/Plate lookup, mileage — always required</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Required</Badge>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3">
              <Switch
                checked={config.step_vehicle_build}
                onCheckedChange={v => set("step_vehicle_build", v)}
              />
              <div>
                <p className="text-sm font-medium">Step 2 — Vehicle Build</p>
                <p className="text-xs text-muted-foreground">Color, drivetrain, modifications</p>
              </div>
            </div>
            <Badge variant={config.step_vehicle_build ? "default" : "secondary"} className="text-xs">
              {config.step_vehicle_build ? "Active" : "Skipped"}
            </Badge>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3">
              <Switch
                checked={config.step_condition_history}
                onCheckedChange={v => set("step_condition_history", v)}
              />
              <div>
                <p className="text-sm font-medium">Step 3 — Condition & History</p>
                <p className="text-xs text-muted-foreground">Damage, mechanical, accidents, keys</p>
              </div>
            </div>
            <Badge variant={config.step_condition_history ? "default" : "secondary"} className="text-xs">
              {config.step_condition_history ? "Active" : "Skipped"}
            </Badge>
          </div>

          {/* AI Condition Scoring — adds an opt-in photo step that may
              raise the offer when actual condition beats self-report. */}
          <div className="py-2.5 px-3 rounded-lg bg-success/5 border border-success/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.step_ai_photos}
                  onCheckedChange={v => set("step_ai_photos", v)}
                />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    Step 3.5 — AI Condition Scoring
                    <span className="text-[10px] font-bold uppercase tracking-wider text-success bg-success/15 px-1.5 py-0.5 rounded">New</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Optional photo upload after Condition. Customer can skip — when they upload, the AI verifies actual condition and may bump the offer up.
                  </p>
                </div>
              </div>
              <Badge variant={config.step_ai_photos ? "default" : "secondary"} className="text-xs shrink-0">
                {config.step_ai_photos ? "Active" : "Skipped"}
              </Badge>
            </div>
            {config.step_ai_photos && (
              <div className="ml-10 flex items-center gap-2 pt-1">
                <Label className="text-xs text-muted-foreground" htmlFor="ai-photos-min">Min photos required:</Label>
                <Input
                  id="ai-photos-min"
                  type="number"
                  min={1}
                  max={8}
                  value={config.ai_photos_min_required}
                  onChange={(e) =>
                    set(
                      "ai_photos_min_required",
                      Math.max(1, Math.min(8, Number(e.target.value) || 4)) as any,
                    )
                  }
                  className="w-16 h-7 text-sm"
                />
                <span className="text-[11px] text-muted-foreground">
                  default 4 (front, rear, driver, passenger)
                </span>
              </div>
            )}
          </div>

          {/* The old "Offer-First Flow" toggle was removed — the Pricing
              Reveal card below supersedes it. offer_before_details on
              form_config is now derived automatically from the reveal
              mode on save. */}

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{config.offer_before_details ? "Step 4 — Get Your Offer" : "Step 4 — Your Details"}</p>
                <p className="text-xs text-muted-foreground">
                  {config.offer_before_details ? "Offer shown instantly — no contact needed yet" : "Name, phone, email, ZIP — always required"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Required</Badge>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{config.offer_before_details ? "Step 5 — Save Your Offer" : "Step 5 — Get Your Offer"}</p>
                <p className="text-xs text-muted-foreground">
                  {config.offer_before_details ? "Contact info collected to save & send the offer" : "Review and submit — always required"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Required</Badge>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Vehicle Build questions */}
      <Collapsible open={openSections.build} onOpenChange={() => toggle("build")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Car className="w-4 h-4" />
            Vehicle Build Questions
            <Badge variant="secondary" className="text-xs ml-1">
              {enabledCount(BUILD_QUESTIONS)}/{BUILD_QUESTIONS.length}
            </Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.build ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-1 px-1">
          {!config.step_vehicle_build && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-3 pb-2">
              ⚠ Vehicle Build step is disabled — these questions won't show regardless.
            </p>
          )}
          {BUILD_QUESTIONS.map(q => renderQuestionRow(q, !config.step_vehicle_build))}
        </CollapsibleContent>
      </Collapsible>

      {/* Condition & History questions */}
      <Collapsible open={openSections.condition} onOpenChange={() => toggle("condition")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <ClipboardList className="w-4 h-4" />
            Condition & History Questions
            <Badge variant="secondary" className="text-xs ml-1">
              {enabledCount(CONDITION_QUESTIONS)}/{CONDITION_QUESTIONS.length}
            </Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.condition ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-1 px-1">
          {!config.step_condition_history && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-3 pb-2">
              ⚠ Condition & History step is disabled — these questions won't show regardless.
            </p>
          )}
          {CONDITION_QUESTIONS.map(q => renderQuestionRow(q, !config.step_condition_history))}
        </CollapsibleContent>
      </Collapsible>

      {/* Your Details questions */}
      <Collapsible open={openSections.details} onOpenChange={() => toggle("details")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <User className="w-4 h-4" />
            Your Details Questions
            <Badge variant="secondary" className="text-xs ml-1">
              {enabledCount(DETAILS_QUESTIONS)}/{DETAILS_QUESTIONS.length}
            </Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.details ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-1 px-1">
          {DETAILS_QUESTIONS.map(q => renderQuestionRow(q))}
        </CollapsibleContent>
      </Collapsible>

      {/* Offer questions */}
      <Collapsible open={openSections.offer} onOpenChange={() => toggle("offer")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Flag className="w-4 h-4" />
            Get Your Offer Questions
            <Badge variant="secondary" className="text-xs ml-1">
              {enabledCount(OFFER_QUESTIONS)}/{OFFER_QUESTIONS.length}
            </Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.offer ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-1 px-1">
          {OFFER_QUESTIONS.map(q => renderQuestionRow(q))}
        </CollapsibleContent>
      </Collapsible>

      {/* ─────────────────────────────────────────────────────────────
          Pricing Reveal, Range Configuration, and Payment Selection
          Timing were moved here from Landing & Flow so every "what the
          customer sees in the form" decision lives in one place. Visual
          treatment preserved from the original.
          ───────────────────────────────────────────────────────────── */}

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
            const active = offerFlow.pricing_reveal_mode === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => updateFlow("pricing_reveal_mode", o.v)}
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
        {offerFlow.pricing_reveal_mode !== "range_then_price" && (
          <div className="flex items-start gap-3 mt-4 p-3 rounded-lg bg-muted/40 border border-border">
            <Switch
              checked={offerFlow.show_range_before_final}
              onCheckedChange={(v) => updateFlow("show_range_before_final", v)}
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
      {(offerFlow.pricing_reveal_mode === "range_then_price" || offerFlow.show_range_before_final) && (
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
                value={offerFlow.range_low_source}
                onValueChange={(v) => updateFlow("range_low_source", v)}
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
                value={offerFlow.range_high_mode}
                onValueChange={(v) => updateFlow("range_high_mode", v as RangeHighMode)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bb_value">Second Black Book tier</SelectItem>
                  <SelectItem value="percent_above_low">Percent above the low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {offerFlow.range_high_mode === "bb_value" ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold">High Range Source</Label>
                <Select
                  value={offerFlow.range_high_source ?? ""}
                  onValueChange={(v) => updateFlow("range_high_source", v)}
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
                    value={offerFlow.range_high_percent}
                    onChange={(e) => updateFlow("range_high_percent", Number(e.target.value))}
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
            const active = offerFlow.payment_selection_timing === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => updateFlow("payment_selection_timing", o.v)}
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
    </div>
  );
}
