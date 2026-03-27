import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Save, Loader2, CalendarIcon, Building2, Phone as PhoneIcon, Bot,
  Store, Network, Building, Rocket, CheckCircle, Clock, Pause, XCircle
} from "lucide-react";
import OnboardingChecklist from "./OnboardingChecklist";

interface DealerAccount {
  id: string;
  dealership_id: string;
  architecture: string;
  bdc_model: string;
  start_date: string | null;
  billing_date: number | null;
  plan_tier: string;
  plan_cost: number;
  special_instructions: string;
  onboarding_status: string;
  onboarded_by: string | null;
}

const ARCHITECTURE_OPTIONS = [
  { value: "single_store", label: "Single Store", icon: Store, desc: "One rooftop, one location. Simplest setup — hides multi-location routing." },
  { value: "multi_location", label: "Multi-Location", icon: Building2, desc: "Multiple stores under one brand. Enables ZIP/OEM routing and per-store settings." },
  { value: "dealer_group", label: "Dealer Group", icon: Network, desc: "Multiple brands/franchises. Full routing engine, buying center, and brand matching." },
];

const BDC_OPTIONS = [
  { value: "no_bdc", label: "No BDC", icon: Store, desc: "No dedicated BDC team. Leads go directly to sales staff or managers at each location." },
  { value: "single_bdc", label: "Single BDC", icon: PhoneIcon, desc: "One centralized team handles all inbound leads across locations." },
  { value: "multi_bdc", label: "Multi-Location BDC", icon: Building, desc: "Each location has its own BDC team. Leads route to the matched store's team." },
  { value: "ai_bdc", label: "AI BDC", icon: Bot, desc: "AI-powered lead handling with automated follow-ups and intelligent routing." },
];

const PLAN_TIERS = [
  { value: "starter", label: "Starter", cost: 299 },
  { value: "standard", label: "Standard", cost: 599 },
  { value: "premium", label: "Premium", cost: 999 },
  { value: "enterprise", label: "Enterprise", cost: 0 },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  active: { label: "Active", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  paused: { label: "Paused", icon: Pause, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-200" },
};

const DEFAULT_ACCOUNT: Omit<DealerAccount, "id"> = {
  dealership_id: "default",
  architecture: "single_store",
  bdc_model: "single_bdc",
  start_date: null,
  billing_date: null,
  plan_tier: "standard",
  plan_cost: 599,
  special_instructions: "",
  onboarding_status: "pending",
  onboarded_by: null,
};

interface DealerOnboardingProps {
  isAdmin?: boolean;
  onNavigate?: (section: string) => void;
}

const DealerOnboarding = ({ isAdmin = false, onNavigate }: DealerOnboardingProps) => {
  const [account, setAccount] = useState<Omit<DealerAccount, "id">>(DEFAULT_ACCOUNT);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  // Read-only for non-admins when account is active/finalized
  const readOnly = !isAdmin && ["active", "paused", "cancelled"].includes(account.onboarding_status);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dealer_accounts")
      .select("*")
      .eq("dealership_id", "default")
      .maybeSingle();
    if (data) {
      setExistingId(data.id);
      setAccount({
        dealership_id: data.dealership_id,
        architecture: data.architecture,
        bdc_model: data.bdc_model,
        start_date: data.start_date,
        billing_date: data.billing_date,
        plan_tier: data.plan_tier,
        plan_cost: Number(data.plan_cost),
        special_instructions: data.special_instructions,
        onboarding_status: data.onboarding_status,
        onboarded_by: data.onboarded_by,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...account,
      plan_cost: account.plan_cost,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("dealer_accounts").update(payload).eq("id", existingId));
    } else {
      const res = await supabase.from("dealer_accounts").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Account configuration saved." });
    }
  };

  const applyAutoConfig = async () => {
    setApplying(true);
    const updates: Record<string, any> = {};

    // Architecture-based auto-config
    if (account.architecture === "single_store") {
      updates.assign_auto_zip = false;
      updates.assign_oem_brand_match = false;
      updates.assign_buying_center = false;
      updates.assign_customer_picks = false;
    } else if (account.architecture === "multi_location") {
      updates.assign_auto_zip = true;
      updates.assign_oem_brand_match = false;
      updates.assign_buying_center = false;
    } else if (account.architecture === "dealer_group") {
      updates.assign_auto_zip = true;
      updates.assign_oem_brand_match = true;
      updates.assign_buying_center = false;
    }

    // BDC-based auto-config
    if (account.bdc_model === "no_bdc") {
      updates.assign_buying_center = false;
    } else if (account.bdc_model === "single_bdc") {
      updates.assign_buying_center = true;
    } else if (account.bdc_model === "ai_bdc") {
      updates.track_abandoned_leads = true;
    }

    const { error } = await supabase
      .from("site_config")
      .update(updates)
      .eq("dealership_id", "default");

    setApplying(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Auto-configured",
        description: `Platform settings updated for ${ARCHITECTURE_OPTIONS.find(a => a.value === account.architecture)?.label} + ${BDC_OPTIONS.find(b => b.value === account.bdc_model)?.label}.`,
      });
    }
  };

  const updateField = <K extends keyof Omit<DealerAccount, "id">>(key: K, value: Omit<DealerAccount, "id">[K]) => {
    setAccount(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[account.onboarding_status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-card-foreground">Dealer Onboarding</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {readOnly
              ? "Account configuration (read-only). Contact an admin to make changes."
              : "Configure the account architecture, BDC model, and billing for this dealership."}
          </p>
        </div>
        <Badge variant="outline" className={cn("gap-1.5 px-3 py-1", statusCfg.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {statusCfg.label}
        </Badge>
      </div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist onNavigate={onNavigate} />

      {/* Architecture */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Dealership Architecture
          </CardTitle>
          <CardDescription>How is this dealership structured?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {ARCHITECTURE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const selected = account.architecture === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => !readOnly && updateField("architecture", opt.value)}
                  disabled={readOnly}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                    readOnly && "opacity-70 cursor-default",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-md shrink-0",
                    selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* BDC Model */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PhoneIcon className="w-4 h-4 text-primary" />
            BDC Model
          </CardTitle>
          <CardDescription>How does the dealership handle inbound leads?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {BDC_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const selected = account.bdc_model === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => !readOnly && updateField("bdc_model", opt.value)}
                  disabled={readOnly}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                    readOnly && "opacity-70 cursor-default",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-md shrink-0",
                    selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Billing & Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            Billing & Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Plan Tier */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Plan Tier</Label>
              <Select
                disabled={readOnly}
                value={account.plan_tier}
                onValueChange={v => {
                  const tier = PLAN_TIERS.find(t => t.value === v);
                  updateField("plan_tier", v);
                  if (tier && tier.cost > 0) updateField("plan_cost", tier.cost);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TIERS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} {t.cost > 0 ? `— $${t.cost}/mo` : "— Custom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan Cost */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Monthly Cost ($)</Label>
              <Input
                type="number"
                min={0}
                value={account.plan_cost}
                onChange={e => updateField("plan_cost", Number(e.target.value))}
                disabled={readOnly}
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={readOnly}
                    className={cn("w-full justify-start text-left font-normal", !account.start_date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {account.start_date ? format(new Date(account.start_date + "T00:00:00"), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={account.start_date ? new Date(account.start_date + "T00:00:00") : undefined}
                    onSelect={d => updateField("start_date", d ? format(d, "yyyy-MM-dd") : null)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Billing Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Billing Day of Month</Label>
              <Select
                disabled={readOnly}
                value={account.billing_date?.toString() || ""}
                onValueChange={v => updateField("billing_date", v ? Number(v) : null)}
              >
                <SelectTrigger><SelectValue placeholder="Select day..." /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Account Status</Label>
            <Select
              value={account.onboarding_status}
              onValueChange={v => updateField("onboarding_status", v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Special Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Special Instructions</CardTitle>
          <CardDescription>Dealership-specific requirements, preferences, or notes for the onboarding team.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={account.special_instructions}
            onChange={e => updateField("special_instructions", e.target.value)}
            placeholder="e.g. No SMS follow-ups after 6pm, use dealer logo on all customer emails, custom offer floor of $2,000..."
            className="text-sm"
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {/* Actions — hidden in read-only mode */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {existingId ? "Update Account" : "Create Account"}
          </Button>
          <Button
            onClick={applyAutoConfig}
            disabled={applying}
            variant="outline"
            className="gap-2 flex-1"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Apply Auto-Config
          </Button>
        </div>
      )}
    </div>
  );
};

export default DealerOnboarding;
