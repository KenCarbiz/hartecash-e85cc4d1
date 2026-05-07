import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Save, Trash2, Loader2, Sparkles, Calendar } from "lucide-react";

type TriggerMoment = "pre_acceptance" | "post_acceptance";
type InventoryScope = "all" | "new_only" | "used_only" | "certified_only";

interface IncentiveRow {
  id: string;
  dealership_id: string;
  trigger_moment: TriggerMoment;
  headline: string;
  description: string | null;
  bonus_amount: number;
  inventory_scope: InventoryScope;
  inventory_price_floor: number | null;
  inventory_price_ceiling: number | null;
  inventory_url: string | null;
  is_active: boolean;
  active_until: string | null;
  disclaimer: string | null;
  sort_order: number;
}

const MOMENT_META: Record<TriggerMoment, { label: string; description: string }> = {
  pre_acceptance: {
    label: "Before acceptance",
    description: "Shown on the offer page + decline-winback emails as a reason to accept.",
  },
  post_acceptance: {
    label: "After acceptance",
    description: "Shown on the acceptance page + acceptance email as a sweetener at signing.",
  },
};

const SCOPE_OPTIONS: Array<{ value: InventoryScope; label: string }> = [
  { value: "all",             label: "Any vehicle" },
  { value: "new_only",        label: "New vehicles only" },
  { value: "used_only",       label: "Used vehicles only" },
  { value: "certified_only",  label: "Certified pre-owned only" },
];

/**
 * Trade-up incentive editor — admin tab under Communications hub.
 *
 * Each row is one incentive at one trigger moment (pre_acceptance or
 * post_acceptance). Dealers add, edit, toggle active, set the dollar
 * amount + eligible inventory scope. Edits write directly to the
 * dealer's tenant rows; there are no network defaults — incentives
 * are too margin-sensitive to share across rooftops.
 *
 * Empty-state: "no incentives configured" plus a single Add button.
 * Migration not applied yet → renders an in-context message pointing
 * at the migration filename.
 */
const TradeUpIncentiveEditor = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [rows, setRows] = useState<IncentiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    const { data, error } = await supabase
      .from("trade_up_incentives" as never)
      .select("*")
      .eq("dealership_id", tenant.dealership_id)
      .order("trigger_moment")
      .order("sort_order");
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        setMissing(true);
        setLoading(false);
        return;
      }
    }
    setRows((data as unknown as IncentiveRow[]) || []);
    setLoading(false);
  }, [tenant.dealership_id]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const updateLocal = (id: string, patch: Partial<IncentiveRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = async (moment: TriggerMoment) => {
    const { data, error } = await supabase
      .from("trade_up_incentives" as never)
      .insert({
        dealership_id: tenant.dealership_id,
        trigger_moment: moment,
        headline: moment === "pre_acceptance"
          ? "Trade us your car, take an extra $X off any vehicle on our lot"
          : "Take home a new vehicle today — your offer goes up by $X",
        description: null,
        bonus_amount: 500,
        inventory_scope: "all",
        is_active: false,
        sort_order: rows.filter((r) => r.trigger_moment === moment).length,
      } as never)
      .select()
      .single();
    if (error) {
      toast({ title: "Couldn't add incentive", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => [...prev, data as unknown as IncentiveRow]);
    toast({ title: "Incentive added — edit and save when ready" });
  };

  const saveRow = async (row: IncentiveRow) => {
    setSavingId(row.id);
    try {
      const { error } = await supabase
        .from("trade_up_incentives" as never)
        .update({
          trigger_moment: row.trigger_moment,
          headline: row.headline,
          description: row.description,
          bonus_amount: row.bonus_amount,
          inventory_scope: row.inventory_scope,
          inventory_price_floor: row.inventory_price_floor,
          inventory_price_ceiling: row.inventory_price_ceiling,
          inventory_url: row.inventory_url,
          is_active: row.is_active,
          active_until: row.active_until,
          disclaimer: row.disclaimer,
          sort_order: row.sort_order,
        } as never)
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: "Incentive saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Delete this incentive? Customers in active flows will stop seeing it on their next page load.")) return;
    const { error } = await supabase
      .from("trade_up_incentives" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Incentive deleted" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Trade-up incentives not enabled yet</h3>
          <p className="text-xs text-muted-foreground">
            Apply migration <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">20260507100000_trade_up_incentives.sql</code>
            via Lovable's "Push to Supabase" or the SQL editor, then refresh this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Trade-up incentives</h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Add a sweetener that goes to the customer when they trade their car AND buy from your lot.
            Two trigger moments — before they accept (incentive to accept) and after they accept (sweetener at signing). Both can be active at once with different amounts. Per-rooftop only; not shared across the network.
          </p>
        </CardContent>
      </Card>

      {(["pre_acceptance", "post_acceptance"] as TriggerMoment[]).map((moment) => {
        const meta = MOMENT_META[moment];
        const momentRows = rows.filter((r) => r.trigger_moment === moment);
        return (
          <section key={moment} className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h4 className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-warning" />
                  {meta.label}
                </h4>
                <p className="text-micro text-muted-foreground mt-0.5">{meta.description}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void addRow(moment)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add incentive
              </Button>
            </div>

            {momentRows.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-xs text-muted-foreground italic">
                  No {meta.label.toLowerCase()} incentive configured. Click "Add incentive" to start.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {momentRows.map((row) => (
                  <Card key={row.id} className={!row.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant={row.is_active ? "default" : "outline"} className="text-micro">
                            {row.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {row.bonus_amount > 0 && (
                            <Badge variant="outline" className="text-micro border-warning/40 text-warning">
                              ${Number(row.bonus_amount).toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteRow(row.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            disabled={savingId === row.id}
                            onClick={() => void saveRow(row)}
                          >
                            {savingId === row.id ? "Saving…" : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Headline</Label>
                          <Input
                            value={row.headline}
                            onChange={(e) => updateLocal(row.id, { headline: e.target.value })}
                            placeholder='"Take an extra $500 off any new car"'
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Bonus amount ($)</Label>
                          <Input
                            type="number"
                            value={row.bonus_amount}
                            onChange={(e) => updateLocal(row.id, { bonus_amount: Number(e.target.value) })}
                            className="mt-1 tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-micro font-bold uppercase tracking-wider">Description (optional)</Label>
                        <Textarea
                          value={row.description || ""}
                          onChange={(e) => updateLocal(row.id, { description: e.target.value || null })}
                          rows={2}
                          placeholder="Longer prose under the headline. Optional."
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Eligible inventory</Label>
                          <select
                            value={row.inventory_scope}
                            onChange={(e) => updateLocal(row.id, { inventory_scope: e.target.value as InventoryScope })}
                            className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {SCOPE_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Price floor ($)</Label>
                          <Input
                            type="number"
                            value={row.inventory_price_floor || ""}
                            onChange={(e) => updateLocal(row.id, { inventory_price_floor: e.target.value ? Number(e.target.value) : null })}
                            placeholder="optional"
                            className="mt-1 tabular-nums"
                          />
                        </div>
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Price ceiling ($)</Label>
                          <Input
                            type="number"
                            value={row.inventory_price_ceiling || ""}
                            onChange={(e) => updateLocal(row.id, { inventory_price_ceiling: e.target.value ? Number(e.target.value) : null })}
                            placeholder="optional"
                            className="mt-1 tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider">Inventory URL (optional)</Label>
                          <Input
                            value={row.inventory_url || ""}
                            onChange={(e) => updateLocal(row.id, { inventory_url: e.target.value || null })}
                            placeholder="https://yoursite.com/inventory?type=new"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-micro font-bold uppercase tracking-wider inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Active until (optional)
                          </Label>
                          <Input
                            type="date"
                            value={row.active_until ? row.active_until.slice(0, 10) : ""}
                            onChange={(e) => updateLocal(row.id, { active_until: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-micro font-bold uppercase tracking-wider">Disclaimer (micro fine print)</Label>
                        <Textarea
                          value={row.disclaimer || ""}
                          onChange={(e) => updateLocal(row.id, { disclaimer: e.target.value || null })}
                          rows={1}
                          placeholder='"OAC. Not combinable with other offers." — optional'
                          className="mt-1 text-micro"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <input
                          type="checkbox"
                          id={`active-${row.id}`}
                          checked={row.is_active}
                          onChange={(e) => updateLocal(row.id, { is_active: e.target.checked })}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <Label htmlFor={`active-${row.id}`} className="text-xs cursor-pointer">
                          {row.is_active ? "Active — currently shown to customers" : "Inactive — hidden from customers"}
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default TradeUpIncentiveEditor;
