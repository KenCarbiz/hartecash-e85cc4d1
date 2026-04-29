import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Shield, Car, Gauge, Save, GripVertical } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface DepthPolicy {
  id: string;
  name: string;
  policy_type: string;
  oem_brands: string[];
  all_brands: boolean;
  max_vehicle_age_years: number | null;
  max_mileage: number | null;
  min_tire_depth: number;
  min_brake_depth: number;
  is_active: boolean;
  sort_order: number;
}

const POLICY_TYPES = [
  { value: "standard", label: "Standard (All Vehicles)" },
  { value: "manufacturer_cpo", label: "Manufacturer Certified Pre-Owned" },
  { value: "limited_cpo", label: "Limited Certified Pre-Owned" },
  { value: "internal_cert", label: "Internal Dealership Certification" },
  { value: "custom", label: "Custom Policy" },
];

const COMMON_BRANDS = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep",
  "Kia", "Land Rover", "Lexus", "Lincoln", "Maserati", "Mazda", "Mercedes-Benz",
  "Mini", "Mitsubishi", "Nissan", "Porsche", "Ram", "Subaru", "Tesla", "Toyota",
  "Volkswagen", "Volvo",
];

const DepthPolicyManager = () => {
  const [policies, setPolicies] = useState<DepthPolicy[]>([]);
  // Snapshot of policies as of last fetch — used to compute the
  // "what will change" preview when an admin edits min_tire_depth or
  // min_brake_depth before saving.
  const [originals, setOriginals] = useState<Map<string, DepthPolicy>>(new Map());
  // Per-policy preview: how many submissions in the current dealer's
  // history would flip pass→fail (or fail→pass) under the new
  // thresholds. Computed on-demand when thresholds dirty.
  const [previews, setPreviews] = useState<Map<string, { loading: boolean; flipped: number; nowFails: number; nowPasses: number; total: number }>>(new Map());
  const [confirmSaveId, setConfirmSaveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  useEffect(() => { fetchPolicies(); }, [dealershipId]);

  const fetchPolicies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("depth_policies")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order");
    if (data) {
      setPolicies(data as DepthPolicy[]);
      const m = new Map<string, DepthPolicy>();
      (data as DepthPolicy[]).forEach((p) => m.set(p.id, { ...p }));
      setOriginals(m);
    }
    setLoading(false);
  };

  // Recompute the impact preview for a single policy. Pulls the
  // dealership's submission tire/brake values once, evaluates each
  // against old + new thresholds, counts the flips. Cached in
  // `previews` keyed by policy id.
  const previewImpact = async (policyId: string) => {
    const p = policies.find((x) => x.id === policyId);
    const orig = originals.get(policyId);
    if (!p || !orig) return;
    setPreviews((prev) => {
      const m = new Map(prev);
      m.set(policyId, { loading: true, flipped: 0, nowFails: 0, nowPasses: 0, total: 0 });
      return m;
    });
    const { data } = await supabase
      .from("submissions")
      .select("tire_lf, tire_rf, tire_lr, tire_rr, brake_lf, brake_rf, brake_lr, brake_rr")
      .eq("dealership_id", dealershipId)
      .or(
        "tire_lf.not.is.null,tire_rf.not.is.null,tire_lr.not.is.null,tire_rr.not.is.null," +
        "brake_lf.not.is.null,brake_rf.not.is.null,brake_lr.not.is.null,brake_rr.not.is.null",
      )
      .limit(5000);

    type Row = {
      tire_lf: number | null; tire_rf: number | null; tire_lr: number | null; tire_rr: number | null;
      brake_lf: number | null; brake_rf: number | null; brake_lr: number | null; brake_rr: number | null;
    };
    const rows = (data as Row[]) || [];
    const evalPass = (r: Row, minTire: number, minBrake: number): boolean => {
      const tires = [r.tire_lf, r.tire_rf, r.tire_lr, r.tire_rr].filter((v): v is number => v != null);
      const brakes = [r.brake_lf, r.brake_rf, r.brake_lr, r.brake_rr].filter((v): v is number => v != null);
      // If no readings, treat as "not evaluated" — no impact either way.
      if (tires.length === 0 && brakes.length === 0) return true;
      if (tires.length > 0 && Math.min(...tires) < minTire) return false;
      if (brakes.length > 0 && Math.min(...brakes) < minBrake) return false;
      return true;
    };

    let total = 0;
    let nowFails = 0;
    let nowPasses = 0;
    rows.forEach((r) => {
      const tires = [r.tire_lf, r.tire_rf, r.tire_lr, r.tire_rr].filter((v): v is number => v != null);
      const brakes = [r.brake_lf, r.brake_rf, r.brake_lr, r.brake_rr].filter((v): v is number => v != null);
      if (tires.length === 0 && brakes.length === 0) return;
      total += 1;
      const oldPass = evalPass(r, orig.min_tire_depth, orig.min_brake_depth);
      const newPass = evalPass(r, p.min_tire_depth, p.min_brake_depth);
      if (oldPass && !newPass) nowFails += 1;
      if (!oldPass && newPass) nowPasses += 1;
    });

    setPreviews((prev) => {
      const m = new Map(prev);
      m.set(policyId, { loading: false, flipped: nowFails + nowPasses, nowFails, nowPasses, total });
      return m;
    });
  };

  // Has the policy's threshold changed from saved? Used to gate the
  // preview render + the confirmation dialog.
  const isThresholdDirty = (p: DepthPolicy): boolean => {
    const orig = originals.get(p.id);
    if (!orig) return false;
    return orig.min_tire_depth !== p.min_tire_depth || orig.min_brake_depth !== p.min_brake_depth;
  };

  const addPolicy = async () => {
    const newPolicy = {
      dealership_id: dealershipId,
      name: "New Policy",
      policy_type: "standard",
      oem_brands: [] as string[],
      all_brands: true,
      min_tire_depth: 4,
      min_brake_depth: 3,
      sort_order: policies.length,
    };
    const { data, error } = await supabase.from("depth_policies").insert(newPolicy).select().single();
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    setPolicies(prev => [...prev, data as DepthPolicy]);
    toast({ title: "Policy added" });
  };

  const updatePolicy = async (policy: DepthPolicy) => {
    setSaving(policy.id);
    const { error } = await supabase.from("depth_policies").update({
      name: policy.name,
      policy_type: policy.policy_type,
      oem_brands: policy.oem_brands,
      all_brands: policy.all_brands,
      max_vehicle_age_years: policy.max_vehicle_age_years,
      max_mileage: policy.max_mileage,
      min_tire_depth: policy.min_tire_depth,
      min_brake_depth: policy.min_brake_depth,
      is_active: policy.is_active,
      updated_at: new Date().toISOString(),
    }).eq("id", policy.id);
    setSaving(null);
    if (error) { toast({ title: "Error saving", variant: "destructive" }); return; }
    // Re-baseline the originals snapshot for this policy so the
    // dirty-threshold UI clears immediately. Drop the cached preview.
    setOriginals((prev) => { const m = new Map(prev); m.set(policy.id, { ...policy }); return m; });
    setPreviews((prev) => { const m = new Map(prev); m.delete(policy.id); return m; });
    toast({ title: "Policy saved" });
  };

  const deletePolicy = (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDeletePolicy = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    const { error } = await supabase.from("depth_policies").delete().eq("id", id);
    if (!error) {
      setPolicies(prev => prev.filter(p => p.id !== id));
      toast({ title: "Deleted" });
    }
  };

  const updateLocal = (id: string, updates: Partial<DepthPolicy>) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const toggleBrand = (id: string, brand: string) => {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;
    const brands = policy.oem_brands.includes(brand)
      ? policy.oem_brands.filter(b => b !== brand)
      : [...policy.oem_brands, brand];
    updateLocal(id, { oem_brands: brands });
  };

  const getPolicyTypeColor = (type: string) => {
    switch (type) {
      case "manufacturer_cpo": return "bg-blue-500/10 text-blue-600 border-blue-400/40";
      case "limited_cpo": return "bg-cyan-500/10 text-cyan-600 border-cyan-400/40";
      case "internal_cert": return "bg-purple-500/10 text-purple-600 border-purple-400/40";
      case "custom": return "bg-amber-500/10 text-amber-600 border-amber-400/40";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading policies…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-card-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Tire & Brake Depth Policies
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set minimum tread and brake pad requirements for certifications and internal standards. Appraisers will see alerts when measurements fall below policy thresholds.
          </p>
        </div>
        <Button size="sm" onClick={addPolicy} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Policy
        </Button>
      </div>

      {policies.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No depth policies configured. Add one to set tire & brake requirements.
          </CardContent>
        </Card>
      )}

      {policies.map((policy) => (
        <Card key={policy.id} className={`transition-all ${!policy.is_active ? "opacity-60" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                <Input
                  value={policy.name}
                  onChange={e => updateLocal(policy.id, { name: e.target.value })}
                  className="h-8 text-sm font-semibold max-w-[240px]"
                />
                <Badge variant="outline" className={`text-[10px] ${getPolicyTypeColor(policy.policy_type)}`}>
                  {POLICY_TYPES.find(t => t.value === policy.policy_type)?.label || policy.policy_type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground">Active</Label>
                  <Switch
                    checked={policy.is_active}
                    onCheckedChange={v => updateLocal(policy.id, { is_active: v })}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // If the threshold changed AND we have a preview
                    // showing impact, route through the confirmation
                    // dialog. Otherwise save directly.
                    const preview = previews.get(policy.id);
                    if (isThresholdDirty(policy) && preview && !preview.loading && preview.flipped > 0) {
                      setConfirmSaveId(policy.id);
                    } else {
                      updatePolicy(policy);
                    }
                  }}
                  disabled={saving === policy.id}>
                  <Save className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletePolicy(policy.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Type + Brand scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Policy Type</Label>
                <Select value={policy.policy_type} onValueChange={v => updateLocal(policy.id, { policy_type: v })}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Brand Scope</Label>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">All Brands</Label>
                    <Switch
                      checked={policy.all_brands}
                      onCheckedChange={v => updateLocal(policy.id, { all_brands: v })}
                    />
                  </div>
                </div>
                {!policy.all_brands && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
                    {COMMON_BRANDS.map(brand => (
                      <Badge
                        key={brand}
                        variant={policy.oem_brands.includes(brand) ? "default" : "outline"}
                        className="text-[9px] cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => toggleBrand(policy.id, brand)}
                      >
                        {brand}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Depth minimums */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Gauge className="w-3 h-3" /> Min Tire Depth (/32")
                </Label>
                <Input
                  type="number" min={1} max={10}
                  value={policy.min_tire_depth}
                  onChange={e => {
                    updateLocal(policy.id, { min_tire_depth: Number(e.target.value) });
                    // Invalidate preview — debounced re-fetch via the
                    // dirty-state effect below would be cleaner, but
                    // for this small surface a click-to-preview button
                    // is enough.
                    setPreviews((prev) => { const m = new Map(prev); m.delete(policy.id); return m; });
                  }}
                  className="h-8 text-sm font-bold mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Gauge className="w-3 h-3" /> Min Brake Depth (/32")
                </Label>
                <Input
                  type="number" min={1} max={10}
                  value={policy.min_brake_depth}
                  onChange={e => {
                    updateLocal(policy.id, { min_brake_depth: Number(e.target.value) });
                    setPreviews((prev) => { const m = new Map(prev); m.delete(policy.id); return m; });
                  }}
                  className="h-8 text-sm font-bold mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Car className="w-3 h-3" /> Max Vehicle Age (Years)
                </Label>
                <Input
                  type="number" min={0} max={30}
                  value={policy.max_vehicle_age_years ?? ""}
                  onChange={e => updateLocal(policy.id, { max_vehicle_age_years: e.target.value ? Number(e.target.value) : null })}
                  placeholder="No limit"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Max Mileage</Label>
                <Input
                  type="number" min={0} step={1000}
                  value={policy.max_mileage ?? ""}
                  onChange={e => updateLocal(policy.id, { max_mileage: e.target.value ? Number(e.target.value) : null })}
                  placeholder="No limit"
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* Preview summary */}
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-[10px] text-muted-foreground">
              <strong className="text-card-foreground">Summary:</strong>{" "}
              {policy.all_brands ? "All brands" : policy.oem_brands.length > 0 ? policy.oem_brands.join(", ") : "No brands selected"} —{" "}
              Tires ≥ {policy.min_tire_depth}/32", Brakes ≥ {policy.min_brake_depth}/32"
              {policy.max_vehicle_age_years ? ` — ≤ ${policy.max_vehicle_age_years} years old` : ""}
              {policy.max_mileage ? ` — ≤ ${policy.max_mileage.toLocaleString()} miles` : ""}
            </div>

            {/* Threshold-change impact preview — appears whenever
                the admin has edited the tire or brake minimum. The
                preview button fetches the dealer's submission depth
                history and counts how many vehicles would flip
                pass→fail or fail→pass under the new thresholds. */}
            {isThresholdDirty(policy) && (() => {
              const orig = originals.get(policy.id);
              const preview = previews.get(policy.id);
              return (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      Thresholds changed:{" "}
                      {orig && orig.min_tire_depth !== policy.min_tire_depth && (
                        <span>tires {orig.min_tire_depth}→{policy.min_tire_depth}</span>
                      )}
                      {orig && orig.min_tire_depth !== policy.min_tire_depth && orig.min_brake_depth !== policy.min_brake_depth && " · "}
                      {orig && orig.min_brake_depth !== policy.min_brake_depth && (
                        <span>brakes {orig.min_brake_depth}→{policy.min_brake_depth}</span>
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => previewImpact(policy.id)}
                      disabled={preview?.loading}
                    >
                      {preview?.loading ? "Calculating…" : preview ? "Recalculate" : "Preview impact"}
                    </Button>
                  </div>
                  {preview && !preview.loading && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-background border border-border p-2">
                        <div className="text-lg font-bold text-foreground">{preview.total}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Inspected</div>
                      </div>
                      <div className={`rounded-md border p-2 ${preview.nowFails > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-background"}`}>
                        <div className={`text-lg font-bold ${preview.nowFails > 0 ? "text-red-600" : "text-foreground"}`}>{preview.nowFails}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Now fails</div>
                      </div>
                      <div className={`rounded-md border p-2 ${preview.nowPasses > 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background"}`}>
                        <div className={`text-lg font-bold ${preview.nowPasses > 0 ? "text-emerald-600" : "text-foreground"}`}>{preview.nowPasses}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Now passes</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!confirmSaveId} onOpenChange={(open) => { if (!open) setConfirmSaveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Threshold change will affect existing inspections</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {(() => {
                  if (!confirmSaveId) return null;
                  const p = policies.find((x) => x.id === confirmSaveId);
                  const orig = originals.get(confirmSaveId);
                  const preview = previews.get(confirmSaveId);
                  if (!p || !orig || !preview) return null;
                  return (
                    <>
                      <p>
                        <strong className="text-foreground">{p.name}</strong> — applying these new thresholds will change the pass/fail evaluation for past inspections in this dealership's history.
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-foreground">
                        <div className="rounded-md border border-border p-2">
                          <div className="text-lg font-bold">{preview.total}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inspected</div>
                        </div>
                        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2">
                          <div className="text-lg font-bold text-red-600">{preview.nowFails}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Now fails</div>
                        </div>
                        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2">
                          <div className="text-lg font-bold text-emerald-600">{preview.nowPasses}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Now passes</div>
                        </div>
                      </div>
                      <p className="text-xs">
                        Vehicles already acquired don't get retroactively re-graded — but new inspections + any future re-evaluations will use these thresholds. Continue?
                      </p>
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const p = policies.find((x) => x.id === confirmSaveId);
              setConfirmSaveId(null);
              if (p) updatePolicy(p);
            }}>
              Apply new thresholds
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Depth Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this depth policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeletePolicy}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DepthPolicyManager;
