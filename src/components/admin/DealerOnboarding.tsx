import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import DealerWebsiteAutofillCard from "./DealerWebsiteAutofillCard";
import ArchitectureSelector from "./onboarding/ArchitectureSelector";
import BDCSelector from "./onboarding/BDCSelector";
import { architectureToDbValue } from "./onboarding/types";
import type { ArchitectureType } from "./onboarding/types";
import type { BDCType } from "./onboarding/BDCSelector";
import PricingPlanPicker, { type PlanSelection } from "@/components/platform/PricingPlanPicker";

interface DealerAccount {
  id: string;
  dealership_id: string;
  architecture: string;
  bdc_model: string;
  offer_logic_approver_role: string;
  start_date: string | null;
  billing_date: number | null;
  plan_tier: string;
  plan_cost: number;
  special_instructions: string;
  onboarding_status: string;
  onboarded_by: string | null;
}

function dbArchToArchType(dbArch: string, planTier: string): ArchitectureType {
  if (planTier === "enterprise" || dbArch === "enterprise") return "enterprise";
  if (dbArch === "dealer_group") return "dealer_group";
  if (dbArch === "multi_location") return "multi_location";
  if (dbArch === "single_store_secondary") return "single_store_secondary";
  return "single_store";
}

const ARCH_LABELS: Record<string, string> = {
  single_store: "Single Store",
  single_store_secondary: "Single + Secondary",
  multi_location: "Multi-Location",
  dealer_group: "Dealer Group",
  enterprise: "Enterprise",
};

const BDC_LABELS: Record<string, string> = {
  no_bdc: "No BDC",
  single_bdc: "Single BDC",
  multi_bdc: "Multi-Location BDC",
  ai_bdc: "AI BDC",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-accent/10 text-accent-foreground border-accent/30" },
  active: { label: "Active", icon: CheckCircle, color: "bg-primary/10 text-primary border-primary/30" },
  paused: { label: "Paused", icon: Pause, color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const DEFAULT_ACCOUNT: Omit<DealerAccount, "id"> = {
  dealership_id: "default",
  architecture: "single_store",
  bdc_model: "single_bdc",
  offer_logic_approver_role: "gsm_gm",
  start_date: null,
  billing_date: null,
  plan_tier: "standard",
  plan_cost: 1995,
  special_instructions: "",
  onboarding_status: "pending",
  onboarded_by: null,
};

interface DealerOnboardingProps {
  isAdmin?: boolean;
  onNavigate?: (section: string) => void;
  targetDealershipId?: string | null;
  onDealershipChange?: (id: string | null) => void;
}

const DealerOnboarding = ({ isAdmin = false, onNavigate, targetDealershipId, onDealershipChange }: DealerOnboardingProps) => {
  const { tenant } = useTenant();
  const [tenants, setTenants] = useState<{ dealership_id: string; display_name: string }[]>([]);
  const dealershipId = targetDealershipId || tenant.dealership_id;
  const [account, setAccount] = useState<Omit<DealerAccount, "id">>({ ...DEFAULT_ACCOUNT, dealership_id: dealershipId });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [checklistVersion, setChecklistVersion] = useState(0);
  const { toast } = useToast();
  // Loaded subscription (if any) seeds the BigButton picker so admins
  // see the dealer's current plan when they open the screen.
  const [currentSubscription, setCurrentSubscription] = useState<{
    bundle_id: string | null;
    tier_ids: string[];
    billing_cycle: string;
    rooftop_count: number;
  } | null>(null);
  // Ref on the Billing & Plan card so clicking an architecture option
  // above can smoothly scroll the pricing rows into view.
  const billingRef = useRef<HTMLDivElement | null>(null);

  // Read-only for non-admins when account is active/finalized
  const readOnly = !isAdmin && ["active", "paused", "cancelled"].includes(account.onboarding_status);

  useEffect(() => {
    fetchAccount();
  }, [dealershipId]);

  useEffect(() => {
    const loadTenants = async () => {
      const { data } = await supabase.from("tenants").select("dealership_id, display_name").eq("is_active", true).order("display_name");
      if (data) setTenants(data);
    };
    if (isAdmin) loadTenants();
  }, [isAdmin]);

  const fetchAccount = async () => {
    setLoading(true);
    const [{ data }, subRes] = await Promise.all([
      supabase
        .from("dealer_accounts")
        .select("*")
        .eq("dealership_id", dealershipId)
        .maybeSingle(),
      supabase
        .from("dealer_subscriptions")
        .select("bundle_id, tier_ids, billing_cycle, rooftop_count")
        .eq("dealership_id", dealershipId)
        .maybeSingle(),
    ]);
    if (data) {
      setExistingId(data.id);
      setAccount({
        dealership_id: data.dealership_id,
        architecture: data.architecture,
        bdc_model: data.bdc_model,
        offer_logic_approver_role: data.offer_logic_approver_role,
        start_date: data.start_date,
        billing_date: data.billing_date,
        plan_tier: data.plan_tier,
        plan_cost: Number(data.plan_cost),
        special_instructions: data.special_instructions,
        onboarding_status: data.onboarding_status,
        onboarded_by: data.onboarded_by,
      });
    }
    if (subRes.data) {
      setCurrentSubscription({
        bundle_id: subRes.data.bundle_id ?? null,
        tier_ids: subRes.data.tier_ids ?? [],
        billing_cycle: subRes.data.billing_cycle ?? "monthly",
        rooftop_count: subRes.data.rooftop_count ?? 1,
      });
    }
    setLoading(false);
  };

  /**
   * Persist a plan selection from the BigButton picker into
   * dealer_subscriptions (new source of truth) AND mirror the monthly
   * amount into dealer_accounts.plan_cost for backward compatibility
   * with existing billing reports. Runs on every tier/bundle click.
   */
  const savePlanSelection = async (selection: PlanSelection) => {
    if (selection.kind === "enterprise") return;

    // Monthly total for this selection (pre-rooftop-multiplier). Used
    // to back-fill the legacy dealer_accounts.plan_cost column.
    // Intentionally permissive: if we can't resolve, leave untouched.
    let monthlyTotal = 0;
    if (selection.kind === "bundle") {
      const { data: b } = await supabase
        .from("platform_bundles")
        .select("monthly_price, annual_price")
        .eq("id", selection.bundleId)
        .maybeSingle();
      if (b)
        monthlyTotal =
          selection.cycle === "annual" && b.annual_price
            ? Number(b.annual_price) / 12
            : Number(b.monthly_price ?? 0);
    } else if (selection.kind === "tiers" && selection.tierIds.length > 0) {
      const { data: ts } = await supabase
        .from("platform_product_tiers")
        .select("id, monthly_price, annual_price")
        .in("id", selection.tierIds);
      for (const t of ts ?? []) {
        monthlyTotal +=
          selection.cycle === "annual" && t.annual_price
            ? Number(t.annual_price) / 12
            : Number(t.monthly_price ?? 0);
      }
    }
    monthlyTotal = Math.round(monthlyTotal * selection.rooftopCount);

    const subPayload = {
      dealership_id: dealershipId,
      status: "trial" as const,
      billing_cycle: selection.cycle,
      rooftop_count: selection.rooftopCount,
      bundle_id: selection.kind === "bundle" ? selection.bundleId : null,
      tier_ids: selection.kind === "tiers" ? selection.tierIds : [],
      product_ids: [],
      monthly_amount: monthlyTotal || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("dealer_subscriptions")
      .upsert(subPayload as never, { onConflict: "dealership_id" });

    if (error) {
      toast({
        title: "Couldn't save plan",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Mirror for legacy reports.
    if (existingId && monthlyTotal > 0) {
      await supabase
        .from("dealer_accounts")
        .update({ plan_cost: monthlyTotal })
        .eq("id", existingId);
      updateField("plan_cost", monthlyTotal);
    }

    setCurrentSubscription({
      bundle_id: subPayload.bundle_id,
      tier_ids: subPayload.tier_ids,
      billing_cycle: subPayload.billing_cycle,
      rooftop_count: subPayload.rooftop_count,
    });
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
      .eq("dealership_id", dealershipId);

    setApplying(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Auto-configured",
        description: `Platform settings updated for ${ARCH_LABELS[account.architecture] || account.architecture} + ${BDC_LABELS[account.bdc_model] || account.bdc_model}.`,
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
      {/* Dealer Picker */}
      {isAdmin && tenants.length > 1 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">Dealership:</Label>
          <Select value={dealershipId} onValueChange={(v) => onDealershipChange?.(v)}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tenants.map(t => (
                <SelectItem key={t.dealership_id} value={t.dealership_id}>{t.display_name} ({t.dealership_id})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Dealer Onboarding</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {readOnly
              ? "Account configuration (read-only). Contact an admin to make changes."
              : "Configure the account architecture, BDC model, and billing for this dealership."}
          </p>
        </div>
        <Badge variant="outline" className={cn("gap-1.5 px-3.5 py-1.5 text-xs font-bold", statusCfg.color)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {statusCfg.label}
        </Badge>
      </div>

      <DealerWebsiteAutofillCard
        dealershipId={dealershipId}
        onAutofillComplete={() => {
          fetchAccount();
          setChecklistVersion((prev) => prev + 1);
        }}
        onOpenQuestionnaire={onNavigate ? () => onNavigate("onboarding-script") : undefined}
        onNavigate={onNavigate}
      />

      {/* Onboarding Checklist */}
      <OnboardingChecklist key={`${dealershipId}-${checklistVersion}`} onNavigate={onNavigate} dealershipId={dealershipId} />

      {/* Architecture — Premium Selector */}
      <Card>
        <CardContent className="pt-6">
          <ArchitectureSelector
            selected={dbArchToArchType(account.architecture, account.plan_tier)}
            onSelect={(arch) => {
              if (readOnly) return;
              const dbArch = architectureToDbValue(arch);
              updateField("architecture", dbArch);
              // Multi-rooftop structures imply >1 rooftop — seed the
              // picker so admins don't have to fix the count manually.
              if (arch === "enterprise") {
                updateField("plan_tier", "enterprise");
              }
              // Smooth-scroll to the pricing section so the dealer
              // sees their plan choices populate inline.
              requestAnimationFrame(() => {
                billingRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              });
            }}
          />
        </CardContent>
      </Card>

      {/* BDC Model — Premium Selector */}
      <Card>
        <CardContent className="pt-6">
          <BDCSelector
            selected={account.bdc_model as BDCType}
            onSelect={(bdc) => {
              if (readOnly) return;
              updateField("bdc_model", bdc);
            }}
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {/* Offer Logic Approver */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            Offer Logic Approver
          </CardTitle>
          <CardDescription>
            When a manager builds or modifies offer logic, this role must approve before it goes live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={account.offer_logic_approver_role}
            onValueChange={(v) => updateField("offer_logic_approver_role", v)}
            disabled={readOnly}
          >
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gsm_gm">GSM / General Manager</SelectItem>
              <SelectItem value="admin">Dealership Admin</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div ref={billingRef} className="scroll-mt-4 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" />
              Billing & Plan
            </CardTitle>
            <CardDescription>
              Pick a tier for each app or choose the All-Apps Unlimited bundle. Changes
              save automatically. AutoLabels Basic is complimentary with AutoCurb or
              AutoLabels Premium.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <PricingPlanPicker
              variant="rows"
              autoSave
              readOnly={readOnly}
              initialSelection={
                currentSubscription?.bundle_id
                  ? {
                      kind: "bundle",
                      bundleId: currentSubscription.bundle_id,
                      cycle: (currentSubscription.billing_cycle as "monthly" | "annual") ?? "monthly",
                      rooftopCount: currentSubscription.rooftop_count,
                    }
                  : currentSubscription && currentSubscription.tier_ids.length > 0
                    ? {
                        kind: "tiers",
                        tierIds: currentSubscription.tier_ids,
                        cycle: (currentSubscription.billing_cycle as "monthly" | "annual") ?? "monthly",
                        rooftopCount: currentSubscription.rooftop_count,
                      }
                    : undefined
              }
              onConfirm={savePlanSelection}
            />

            {/* Account-level billing dates stay here — they're separate
                from tier selection. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={readOnly}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !account.start_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {account.start_date
                        ? format(new Date(account.start_date + "T00:00:00"), "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        account.start_date
                          ? new Date(account.start_date + "T00:00:00")
                          : undefined
                      }
                      onSelect={(d) =>
                        updateField("start_date", d ? format(d, "yyyy-MM-dd") : null)
                      }
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Billing Day of Month</Label>
                <Select
                  disabled={readOnly}
                  value={account.billing_date?.toString() || ""}
                  onValueChange={(v) => updateField("billing_date", v ? Number(v) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                        {d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Account Status</Label>
                <Select
                  value={account.onboarding_status}
                  onValueChange={(v) => updateField("onboarding_status", v)}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
