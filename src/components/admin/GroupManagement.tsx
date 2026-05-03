import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Network, Plus, Building2, Power, PowerOff, ArrowRightLeft, RefreshCw, Loader2, Clock,
} from "lucide-react";
import GroupKPISummary from "./GroupKPISummary";

type DealerGroup = {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  parent_group_id: string | null;
  master_msa_signed_at: string | null;
  master_msa_url: string | null;
  status: "active" | "pilot" | "paused" | "terminated";
  notes: string | null;
  created_at: string;
};

type DealerAccount = {
  dealership_id: string;
  display_name: string | null;
  dealer_group_id: string | null;
  architecture: string | null;
};

type Activation = {
  id: string;
  dealer_group_id: string;
  dealership_id: string;
  location_id: string | null;
  status: "pilot" | "active" | "deactivated" | "terminated";
  activated_at: string;
  pilot_ends_at: string;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  stripe_subscription_id: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Pilot ended";
  const days = Math.floor(ms / (24 * HOUR_MS));
  const hours = Math.floor((ms % (24 * HOUR_MS)) / HOUR_MS);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

function statusBadge(s: Activation["status"]) {
  switch (s) {
    case "pilot":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pilot</Badge>;
    case "active":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>;
    case "deactivated":
      return <Badge variant="secondary">Deactivated</Badge>;
    case "terminated":
      return <Badge variant="outline" className="text-muted-foreground">Terminated</Badge>;
  }
}

/**
 * Group Management — super-admin surface for the dealer-group ICP.
 *
 * Single page that combines:
 *   - Tier 2.6: list + edit dealer_groups (CRUD on the parent table)
 *   - Tier 2.10: per-group rooftop list with pilot countdown,
 *     activate / deactivate buttons (calls billing-activate-rooftop /
 *     billing-deactivate-rooftop edge functions)
 *   - Tier 3.13: detach rooftop button (calls detach_rooftop() RPC,
 *     gated to platform admins; requires ≥10-char reason)
 *
 * Reads from dealer_groups, dealer_accounts, rooftop_activations.
 * RLS already restricts the tables to platform admins on this surface.
 */
const GroupManagement = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<DealerGroup[]>([]);
  const [accounts, setAccounts] = useState<DealerAccount[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ slug: "", name: "", display_name: "" });
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateDealershipId, setActivateDealershipId] = useState("");
  const [activateBundle, setActivateBundle] = useState("all_apps_unlimited");
  const [activateCycle, setActivateCycle] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDetach, setConfirmDetach] = useState<{ dealershipId: string; activationId: string | null } | null>(null);
  const [detachReason, setDetachReason] = useState("");

  // Periodic refresh so the pilot countdown stays honest. 30s is enough.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const [g, a, ac] = await Promise.all([
      supabase.from("dealer_groups").select("*").order("created_at", { ascending: false }),
      supabase.from("dealer_accounts").select("dealership_id, display_name, dealer_group_id, architecture"),
      supabase.from("rooftop_activations").select("*").order("activated_at", { ascending: false }),
    ]);
    if (g.error) toast({ title: "Couldn't load groups", description: g.error.message, variant: "destructive" });
    if (a.error) toast({ title: "Couldn't load dealerships", description: a.error.message, variant: "destructive" });
    if (ac.error) toast({ title: "Couldn't load activations", description: ac.error.message, variant: "destructive" });
    setGroups((g.data as DealerGroup[]) ?? []);
    setAccounts((a.data as DealerAccount[]) ?? []);
    setActivations((ac.data as Activation[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const groupRooftops = useMemo(
    () => accounts.filter((a) => a.dealer_group_id === selectedGroupId),
    [accounts, selectedGroupId],
  );

  const groupActivations = useMemo(
    () => activations.filter((a) => a.dealer_group_id === selectedGroupId),
    [activations, selectedGroupId],
  );

  const accountsWithoutGroup = useMemo(
    () => accounts.filter((a) => a.dealer_group_id == null),
    [accounts],
  );

  // Active activation per dealership_id (the most recent pilot/active row).
  const activeByDealership = useMemo(() => {
    const out = new Map<string, Activation>();
    for (const a of groupActivations) {
      if (a.status !== "pilot" && a.status !== "active") continue;
      const cur = out.get(a.dealership_id);
      if (!cur || new Date(a.activated_at) > new Date(cur.activated_at)) {
        out.set(a.dealership_id, a);
      }
    }
    return out;
  }, [groupActivations]);

  const createGroup = async () => {
    if (!createForm.slug.trim() || !createForm.name.trim()) {
      toast({ title: "Slug and name required", variant: "destructive" });
      return;
    }
    setBusy("create");
    const { error } = await supabase.from("dealer_groups").insert({
      slug: createForm.slug.trim().toLowerCase(),
      name: createForm.name.trim(),
      display_name: createForm.display_name.trim() || null,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't create group", description: error.message, variant: "destructive" });
      return;
    }
    setCreateOpen(false);
    setCreateForm({ slug: "", name: "", display_name: "" });
    await reload();
    toast({ title: "Group created" });
  };

  const assignRooftop = async (dealershipId: string, groupId: string | null) => {
    setBusy(`assign:${dealershipId}`);
    const { error } = await supabase
      .from("dealer_accounts")
      .update({ dealer_group_id: groupId })
      .eq("dealership_id", dealershipId);
    setBusy(null);
    if (error) {
      toast({ title: "Assign failed", description: error.message, variant: "destructive" });
      return;
    }
    await reload();
  };

  const activateRooftop = async () => {
    if (!selectedGroup || !activateDealershipId) return;
    setBusy("activate");
    const { data, error } = await supabase.functions.invoke("billing-activate-rooftop", {
      body: {
        dealer_group_id: selectedGroup.id,
        dealership_id: activateDealershipId,
        bundle_id: activateBundle,
        cycle: activateCycle,
        origin: window.location.origin,
      },
    });
    setBusy(null);
    if (error) {
      toast({ title: "Activation failed", description: error.message, variant: "destructive" });
      return;
    }
    setActivateOpen(false);
    setActivateDealershipId("");
    const result = data as { kind?: string; url?: string };
    if (result?.kind === "checkout" && result.url) {
      window.location.href = result.url;
      return;
    }
    await reload();
    toast({ title: "Rooftop activated", description: "30-day pilot started." });
  };

  const deactivateActivation = async (activationId: string) => {
    const reason = window.prompt("Reason for deactivation?") ?? "";
    if (reason.trim().length < 1) return;
    setBusy(`deact:${activationId}`);
    const { data, error } = await supabase.functions.invoke("billing-deactivate-rooftop", {
      body: { activation_id: activationId, reason },
    });
    setBusy(null);
    if (error) {
      toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
      return;
    }
    await reload();
    const r = data as { kind?: string; message?: string };
    toast({
      title: r?.kind === "immediate" ? "Deactivated immediately" : "Cancellation scheduled",
      description: r?.message ?? undefined,
    });
  };

  const detachRooftop = async () => {
    if (!confirmDetach || !selectedGroup) return;
    if (detachReason.trim().length < 10) {
      toast({ title: "Reason needs ≥10 characters", variant: "destructive" });
      return;
    }
    setBusy("detach");
    // detach_rooftop is a SECURITY DEFINER RPC; pass NULL for "to independent".
    const { error } = await supabase.rpc("detach_rooftop", {
      _dealership_id: confirmDetach.dealershipId,
      _to_dealer_group_id: null,
      _reason: detachReason.trim(),
    });
    setBusy(null);
    if (error) {
      toast({ title: "Detach failed", description: error.message, variant: "destructive" });
      return;
    }
    setConfirmDetach(null);
    setDetachReason("");
    await reload();
    toast({
      title: "Rooftop detached",
      description: "Active activations were marked terminated. Cancel matching Stripe subs if not already.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Group Management</h2>
          <p className="text-sm text-muted-foreground">
            Dealer groups, master MSAs, per-rooftop activations and pilot windows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New group
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Group list */}
        <div className="border border-border rounded-xl divide-y divide-border bg-card max-h-[70vh] overflow-y-auto">
          {groups.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No dealer groups yet. Create one to start activating rooftops under a master MSA.
            </div>
          )}
          {groups.map((g) => {
            const rooftopCount = accounts.filter((a) => a.dealer_group_id === g.id).length;
            const isSel = g.id === selectedGroupId;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                  isSel ? "bg-primary/10 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm text-card-foreground truncate">
                    {g.display_name || g.name}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {rooftopCount} rooftop{rooftopCount === 1 ? "" : "s"} · {g.status}
                </div>
              </button>
            );
          })}
        </div>

        {/* Group detail */}
        <div className="space-y-4">
          {!selectedGroup && (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
              Pick a group on the left, or create a new one.
            </div>
          )}

          {selectedGroup && (
            <>
              <div className="border border-border rounded-xl bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{selectedGroup.display_name || selectedGroup.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedGroup.slug}</p>
                  </div>
                  <Badge
                    className={
                      selectedGroup.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedGroup.status === "pilot"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {selectedGroup.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Master MSA{" "}
                  {selectedGroup.master_msa_signed_at ? (
                    <span>signed {new Date(selectedGroup.master_msa_signed_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-amber-700">not signed yet</span>
                  )}
                  {selectedGroup.master_msa_url && (
                    <>
                      {" · "}
                      <a className="text-primary hover:underline" href={selectedGroup.master_msa_url} target="_blank" rel="noreferrer">
                        view MSA
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Group-wide KPI roll-up */}
              {groupRooftops.length > 0 && (
                <GroupKPISummary
                  rooftops={groupRooftops.map((r) => ({
                    dealership_id: r.dealership_id,
                    display_name: r.display_name,
                  }))}
                />
              )}

              {/* Rooftops + activations */}
              <div className="border border-border rounded-xl bg-card">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Rooftops in this group ({groupRooftops.length})
                  </h3>
                  <Button size="sm" onClick={() => setActivateOpen(true)} disabled={groupRooftops.length === 0}>
                    <Power className="w-3.5 h-3.5 mr-1.5" />
                    Activate rooftop
                  </Button>
                </div>
                {groupRooftops.length === 0 && (
                  <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                    No rooftops attached. Use the assignment panel below.
                  </div>
                )}
                {groupRooftops.map((rooftop) => {
                  const act = activeByDealership.get(rooftop.dealership_id);
                  const inPilot = act?.status === "pilot";
                  const pilotMs = act ? new Date(act.pilot_ends_at).getTime() - Date.now() : 0;
                  return (
                    <div
                      key={rooftop.dealership_id}
                      className="px-5 py-3 border-b border-border last:border-b-0 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{rooftop.display_name || rooftop.dealership_id}</span>
                          {act && statusBadge(act.status)}
                          {inPilot && (
                            <span className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatCountdown(pilotMs)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {rooftop.dealership_id}
                          {act?.stripe_subscription_id && <> · sub {act.stripe_subscription_id}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {act && (act.status === "pilot" || act.status === "active") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deactivateActivation(act.id)}
                            disabled={busy === `deact:${act.id}`}
                          >
                            <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                            Deactivate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmDetach({ dealershipId: rooftop.dealership_id, activationId: act?.id ?? null });
                            setDetachReason("");
                          }}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                          Detach
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assign new rooftop */}
              {accountsWithoutGroup.length > 0 && (
                <div className="border border-border rounded-xl bg-muted/20 p-5">
                  <h3 className="text-sm font-semibold mb-2">Attach a rooftop to this group</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {accountsWithoutGroup.length} dealership
                    {accountsWithoutGroup.length === 1 ? "" : "s"} currently independent.
                  </p>
                  <div className="space-y-1">
                    {accountsWithoutGroup.slice(0, 10).map((acc) => (
                      <div
                        key={acc.dealership_id}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <span className="truncate">
                          {acc.display_name || acc.dealership_id}{" "}
                          <span className="text-muted-foreground font-mono text-[11px]">
                            ({acc.dealership_id})
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => assignRooftop(acc.dealership_id, selectedGroup.id)}
                          disabled={busy === `assign:${acc.dealership_id}`}
                        >
                          {busy === `assign:${acc.dealership_id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Attach"
                          )}
                        </Button>
                      </div>
                    ))}
                    {accountsWithoutGroup.length > 10 && (
                      <p className="text-[11px] text-muted-foreground pt-2">
                        Showing 10 of {accountsWithoutGroup.length}.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Refresh-tick consumer to keep countdown re-render honest */}
      <span className="hidden">{refreshTick}</span>

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New dealer group</DialogTitle>
            <DialogDescription>
              The group is the parent of one or more rooftops. The master MSA lives here; rooftops activate beneath it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={createForm.slug}
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="harte-auto-group"
              />
            </div>
            <div>
              <Label className="text-xs">Name (legal)</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Harte Auto Group, LLC"
              />
            </div>
            <div>
              <Label className="text-xs">Display name (customer-facing)</Label>
              <Input
                value={createForm.display_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Harte Auto Group"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy === "create"}>
              Cancel
            </Button>
            <Button onClick={createGroup} disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate rooftop dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate rooftop</DialogTitle>
            <DialogDescription>
              Starts a 30-day pilot. No charge until day 31. During pilot the group can deactivate with no penalty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Rooftop</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={activateDealershipId}
                onChange={(e) => setActivateDealershipId(e.target.value)}
              >
                <option value="">— pick one —</option>
                {groupRooftops
                  .filter((r) => !activeByDealership.has(r.dealership_id))
                  .map((r) => (
                    <option key={r.dealership_id} value={r.dealership_id}>
                      {r.display_name || r.dealership_id}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bundle</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={activateBundle}
                  onChange={(e) => setActivateBundle(e.target.value)}
                >
                  <option value="all_apps_unlimited">All apps unlimited</option>
                  <option value="enterprise_group">Enterprise group</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Cycle</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={activateCycle}
                  onChange={(e) => setActivateCycle(e.target.value as "monthly" | "annual")}
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)} disabled={busy === "activate"}>
              Cancel
            </Button>
            <Button onClick={activateRooftop} disabled={busy === "activate" || !activateDealershipId}>
              {busy === "activate" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}
              Start pilot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detach confirm */}
      <AlertDialog open={!!confirmDetach} onOpenChange={(open) => { if (!open) setConfirmDetach(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach this rooftop?</AlertDialogTitle>
            <AlertDialogDescription>
              The rooftop will be removed from the group. Customer / lead history stays on the dealership and continues to be readable by the dealership's own admins. Active activations under this group will be marked terminated; <strong>cancel any underlying Stripe subscriptions first via Deactivate to avoid orphan billing.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs">Reason (≥10 chars, audit trail)</Label>
            <Textarea
              value={detachReason}
              onChange={(e) => setDetachReason(e.target.value)}
              placeholder="Sold to Lithia / Closing acquisition Q3 / etc."
              className="mt-1 min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "detach"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); detachRooftop(); }}
              disabled={busy === "detach" || detachReason.trim().length < 10}
            >
              {busy === "detach" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Detach rooftop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupManagement;
