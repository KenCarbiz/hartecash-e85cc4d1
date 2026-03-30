import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { clearFormConfigCache } from "@/hooks/useFormConfig";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, ChevronDown, Loader2, Car, ClipboardList, User, Flag, Lock } from "lucide-react";

interface FormConfigData {
  id?: string;
  dealership_id: string;
  step_vehicle_build: boolean;
  step_condition_history: boolean;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    steps: true,
    build: true,
    condition: true,
    details: false,
    offer: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("form_config" as any)
      .select("*")
      .eq("dealership_id", "default")
      .maybeSingle();
    if (data) {
      setConfig({ ...DEFAULTS, ...(data as any) });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...config, updated_at: new Date().toISOString() };
    delete (payload as any).id;

    const { data: existing } = await supabase
      .from("form_config" as any)
      .select("id")
      .eq("dealership_id", "default")
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

    setSaving(false);
    clearFormConfigCache();
    if (error) {
      toast({ title: "Error", description: (error as any).message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Form configuration updated." });
    }
  };

  const toggle = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }));
  const set = (key: string, val: boolean) => setConfig(c => ({ ...c, [key]: val }));

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

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Step 4 — Your Details</p>
                <p className="text-xs text-muted-foreground">Name, phone, email, ZIP — always required</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Required</Badge>
          </div>

          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Step 5 — Get Your Offer</p>
                <p className="text-xs text-muted-foreground">Review and submit — always required</p>
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
    </div>
  );
}
