// VautoIntegration
// ----------------------------------------------------------------------------
// Premium admin panel for managing the Cox Automotive / vAuto inventory push
// integration. Today this operates in skeleton / staging mode — pushes are
// logged to vauto_push_log without hitting a real API. When Cox credentials
// become available, flipping the environment to "production" and filling in
// the API key will switch the same plumbing into live mode.
// ----------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Send, Truck, Key, Building2, Zap, Loader2, CheckCircle2, AlertCircle,
  Clock, RefreshCw, PlayCircle, ShieldCheck, HardHat,
} from "lucide-react";
import { InDevelopmentBadge } from "./InDevelopmentBadge";

/* ── Premium card shell ─────────────────────────────────────── */

const PremiumCard = ({
  icon: Icon,
  title,
  description,
  children,
  accent = "primary",
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  accent?: "primary" | "emerald" | "amber";
}) => {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center gap-3">
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-foreground/90 tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
};

/* ── Status chip ────────────────────────────────────────────── */

const StatusChip = ({ status }: { status: string }) => {
  const style =
    status === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
      : status === "failed"
      ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
  const Icon = status === "success" ? CheckCircle2 : status === "failed" ? AlertCircle : Clock;
  return (
    <Badge variant="outline" className={`${style} gap-1 capitalize`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
};

/* ── Types ──────────────────────────────────────────────────── */

interface DealerVautoConfig {
  vauto_enabled: boolean;
  vauto_api_key: string;
  vauto_dealer_id: string;
  vauto_auto_push: boolean;
  vauto_api_environment: "sandbox" | "production";
}

interface PushLogRow {
  id: string;
  submission_id: string;
  pushed_at: string;
  push_status: "pending" | "success" | "failed";
  vauto_vehicle_id: string | null;
  error_message: string | null;
  retry_count: number | null;
  submissions?: {
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  } | null;
}

const maskKey = (k: string) => {
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return `${k.slice(0, 4)}${"•".repeat(Math.max(0, k.length - 8))}${k.slice(-4)}`;
};

/* ── Main component ─────────────────────────────────────────── */

const VautoIntegration = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const dealershipId = tenant.dealership_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [cfg, setCfg] = useState<DealerVautoConfig>({
    vauto_enabled: false,
    vauto_api_key: "",
    vauto_dealer_id: "",
    vauto_auto_push: false,
    vauto_api_environment: "sandbox",
  });

  const [logs, setLogs] = useState<PushLogRow[]>([]);

  /* ── Fetch config + recent push history ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: dealer } = await supabase
      .from("dealer_accounts")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    if (dealer) {
      const d = dealer as any;
      setCfg({
        vauto_enabled: !!d.vauto_enabled,
        vauto_api_key: d.vauto_api_key || "",
        vauto_dealer_id: d.vauto_dealer_id || "",
        vauto_auto_push: !!d.vauto_auto_push,
        vauto_api_environment: (d.vauto_api_environment as "sandbox" | "production") || "sandbox",
      });
    }

    const { data: logData } = await (supabase as any)
      .from("vauto_push_log")
      .select("id, submission_id, pushed_at, push_status, vauto_vehicle_id, error_message, retry_count, submissions(year, make, model, vin)")
      .order("pushed_at", { ascending: false })
      .limit(25);

    setLogs((logData as PushLogRow[]) || []);
    setLoading(false);
  }, [dealershipId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Save config ── */
  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("dealer_accounts")
      .upsert(
        {
          dealership_id: dealershipId,
          vauto_enabled: cfg.vauto_enabled,
          vauto_api_key: cfg.vauto_api_key || null,
          vauto_dealer_id: cfg.vauto_dealer_id || null,
          vauto_auto_push: cfg.vauto_auto_push,
          vauto_api_environment: cfg.vauto_api_environment,
        } as any,
        { onConflict: "dealership_id" }
      );

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "vAuto settings saved", description: "Integration settings have been updated." });
    }
    setSaving(false);
  };

  /* ── Test connection ── */
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // Grab the most recent submission as a test payload — falls back gracefully.
      const { data: latest } = await supabase
        .from("submissions")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest?.id) {
        toast({
          title: "No submissions yet",
          description: "Create a submission first so we have something to push.",
          variant: "destructive",
        });
        setTesting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("push-to-vauto", {
        body: { submission_id: latest.id, pushed_by: "test-connection" },
      });

      if (error) throw error;

      const result = data as any;
      if (result?.status === "success") {
        toast({
          title: "Test push succeeded",
          description: `vAuto vehicle id: ${result.vauto_vehicle_id}`,
        });
      } else if (result?.status === "pending") {
        toast({
          title: "Test push staged",
          description: `Mode: ${result.mode || "skeleton"} · ${result.reason || "awaiting real credentials"}`,
        });
      } else if (result?.status === "skipped") {
        toast({
          title: "Test skipped",
          description: result.reason || "vAuto integration is not enabled.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test failed",
          description: result?.error || "Unknown error",
          variant: "destructive",
        });
      }
      fetchAll();
    } catch (e: any) {
      toast({ title: "Test failed", description: e?.message || String(e), variant: "destructive" });
    }
    setTesting(false);
  };

  /* ── Retry a failed push ── */
  const handleRetry = async (row: PushLogRow) => {
    setRetryingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("push-to-vauto", {
        body: {
          submission_id: row.submission_id,
          pushed_by: "retry",
          retry_log_id: row.id,
        },
      });
      if (error) throw error;
      const result = data as any;
      toast({
        title: result?.status === "success" ? "Retry succeeded" : "Retry " + (result?.status || "attempted"),
        description: result?.vauto_vehicle_id
          ? `vehicle id: ${result.vauto_vehicle_id}`
          : result?.error || result?.reason || "See log for details",
        variant: result?.status === "failed" ? "destructive" : undefined,
      });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e?.message || String(e), variant: "destructive" });
    }
    setRetryingId(null);
  };

  /* ── Derived UI state ── */
  const envBadge = cfg.vauto_api_environment === "production" ? (
    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
      <Zap className="w-3 h-3 mr-1" /> Production
    </Badge>
  ) : (
    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" variant="outline">
      <ShieldCheck className="w-3 h-3 mr-1" /> Sandbox
    </Badge>
  );

  const enabledBadge = cfg.vauto_enabled ? (
    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Enabled
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      <AlertCircle className="w-3 h-3 mr-1" /> Disabled
    </Badge>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black tracking-tight">vAuto (Cox Automotive)</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <Truck className="w-3.5 h-3.5" />
                Enterprise Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Push finalized appraisals into your Cox Automotive inventory system.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {enabledBadge}
            {envBadge}
            {cfg.vauto_auto_push && (
              <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
                <Zap className="w-3 h-3 mr-1" /> Auto-push
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Enterprise Beta banner */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-4 flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 shrink-0">
          <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-xs leading-relaxed text-blue-900 dark:text-blue-100">
          <p className="font-bold text-blue-700 dark:text-blue-300 text-[11px] uppercase tracking-wider mb-0.5">
            Enterprise Beta · vAuto Direct Push
          </p>
          <p>
            Push finalized appraisals directly into your Cox Automotive inventory
            system. <strong>Sandbox mode</strong> is active by default — it logs every
            push so you can validate the flow. <strong>Production mode</strong>
            activates once your Autocurb Success Manager has exchanged Cox API
            credentials with your vAuto account manager.
          </p>
        </div>
      </div>

      {/* Status card */}
      <PremiumCard icon={ShieldCheck} title="Integration Status" description="Live state of the vAuto sync bridge.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Mode</div>
            <div className="font-semibold capitalize">{cfg.vauto_api_environment}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {cfg.vauto_api_environment === "sandbox"
                ? "Payloads are staged — no calls are made to Cox."
                : "Live push to the Cox Automotive vAuto API."}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Credentials</div>
            <div className="font-semibold">{cfg.vauto_api_key ? "Configured" : "Not set"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dealer ID: {cfg.vauto_dealer_id || <span className="italic">unset</span>}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Auto-push</div>
            <div className="font-semibold">{cfg.vauto_auto_push ? "On" : "Off"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {cfg.vauto_auto_push
                ? "Finalized appraisals push automatically."
                : "Staff must push manually from each lead."}
            </p>
          </div>
        </div>
      </PremiumCard>

      {/* Credentials form */}
      <PremiumCard icon={Key} title="API Credentials" description="Cox Automotive / vAuto connection details.">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-4">
            <div>
              <Label htmlFor="vauto-enabled" className="text-sm font-semibold">
                Enable vAuto integration
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turn on to allow pushing finalized appraisals to vAuto.
              </p>
            </div>
            <Switch
              id="vauto-enabled"
              checked={cfg.vauto_enabled}
              onCheckedChange={(v) => setCfg({ ...cfg, vauto_enabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vauto-api-key" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="vauto-api-key"
                  type={reveal ? "text" : "password"}
                  value={reveal ? cfg.vauto_api_key : (cfg.vauto_api_key ? maskKey(cfg.vauto_api_key) : "")}
                  onChange={(e) => setCfg({ ...cfg, vauto_api_key: e.target.value })}
                  placeholder="cox_api_key_••••"
                  className="font-mono text-xs"
                  disabled={!reveal && !!cfg.vauto_api_key}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReveal((r) => !r)}
                >
                  {reveal ? "Hide" : "Edit"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vauto-dealer-id" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                vAuto Dealer ID
              </Label>
              <Input
                id="vauto-dealer-id"
                value={cfg.vauto_dealer_id}
                onChange={(e) => setCfg({ ...cfg, vauto_dealer_id: e.target.value })}
                placeholder="e.g. 10245"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Environment
            </Label>
            <RadioGroup
              value={cfg.vauto_api_environment}
              onValueChange={(v) => setCfg({ ...cfg, vauto_api_environment: v as "sandbox" | "production" })}
              className="grid grid-cols-2 gap-3"
            >
              <label
                htmlFor="env-sandbox"
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  cfg.vauto_api_environment === "sandbox" ? "border-primary bg-primary/5" : "border-border/40"
                }`}
              >
                <RadioGroupItem id="env-sandbox" value="sandbox" className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Sandbox</div>
                  <p className="text-xs text-muted-foreground">Logs payloads, no real calls.</p>
                </div>
              </label>
              <label
                htmlFor="env-production"
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  cfg.vauto_api_environment === "production" ? "border-primary bg-primary/5" : "border-border/40"
                }`}
              >
                <RadioGroupItem id="env-production" value="production" className="mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Production</div>
                  <p className="text-xs text-muted-foreground">Live push to Cox API.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-4">
            <div>
              <Label htmlFor="vauto-auto-push" className="text-sm font-semibold">
                Automatically push finalized appraisals to vAuto
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, finalizing an appraisal will silently kick off the push in the background.
              </p>
            </div>
            <Switch
              id="vauto-auto-push"
              checked={cfg.vauto_auto_push}
              onCheckedChange={(v) => setCfg({ ...cfg, vauto_auto_push: v })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !cfg.vauto_enabled}
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Building2 className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </div>
      </PremiumCard>

      {/* Push history */}
      <PremiumCard
        icon={Send}
        title="Recent Push History"
        description="Audit trail of the last 25 push attempts."
        accent="emerald"
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            No push attempts yet. Finalize an appraisal or run a test to see logs here.
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-muted/40">
                <tr className="border-b border-border/40">
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">Vehicle</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">Pushed</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">vAuto ID</th>
                  <th className="text-left px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">Retries</th>
                  <th className="text-right px-3 py-2 font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => {
                  const vehicle = row.submissions
                    ? `${row.submissions.year ?? ""} ${row.submissions.make ?? ""} ${row.submissions.model ?? ""}`.trim()
                    : "—";
                  return (
                    <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{vehicle || "—"}</div>
                        {row.submissions?.vin && (
                          <div className="text-[10px] font-mono text-muted-foreground">{row.submissions.vin}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(row.pushed_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <StatusChip status={row.push_status} />
                        {row.error_message && row.push_status !== "success" && (
                          <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 max-w-[220px] truncate" title={row.error_message}>
                            {row.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {row.vauto_vehicle_id || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.retry_count ?? 0}</td>
                      <td className="px-3 py-2 text-right">
                        {row.push_status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(row)}
                            disabled={retryingId === row.id}
                          >
                            {retryingId === row.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  );
};

export default VautoIntegration;
