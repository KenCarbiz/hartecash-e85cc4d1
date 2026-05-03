import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileDown, Loader2, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";

const EXPORTABLE_TABLES: { key: string; label: string; description: string }[] = [
  { key: "submissions", label: "Leads (submissions)", description: "Every customer submission and offer" },
  { key: "appointments", label: "Appointments", description: "Scheduled visits and check-ins" },
  { key: "follow_ups", label: "Follow-ups", description: "Cadence-engine task history" },
  { key: "consent_log", label: "Consent log", description: "TCPA + privacy consents" },
  { key: "damage_reports", label: "Inspection / damage reports", description: "Vehicle condition assessments" },
  { key: "voice_call_log", label: "Voice call log", description: "AI + click-to-dial call records" },
  { key: "notification_log", label: "Notification log", description: "Every SMS / email / voice send" },
  { key: "dealership_locations", label: "Locations", description: "Your store roster" },
];

type EgressLogRow = {
  id: string;
  export_kind: string;
  table_names: string[];
  status: string;
  download_url: string | null;
  expires_at: string | null;
  file_bytes: number | null;
  row_counts: Record<string, number>;
  created_at: string;
  exported_by_email: string | null;
};

/**
 * Data Egress — dealer self-service CSV export.
 *
 * Backs the brand promise: "We will give you your data back, in CSV,
 * in 24 hours, free, in your contract." (Tier 3.12 from the May-2026
 * tenant audit.)
 *
 * Calls the data-egress-export edge function with an allowlist of
 * dealer-owned tables. The edge function uploads the bundle to a
 * private storage bucket and returns a 24-hour signed URL.
 *
 * Past exports are listed below the form so the dealer can re-download
 * within the 24-hour window without re-running the queries.
 */
const DataEgressPanel = () => {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(EXPORTABLE_TABLES.map((t) => t.key)),
  );
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<EgressLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const reload = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("data_egress_log")
      .select("id, export_kind, table_names, status, download_url, expires_at, file_bytes, row_counts, created_at, exported_by_email")
      .eq("dealership_id", tenant.dealership_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      // If the migration isn't applied yet, table won't exist. Fail soft.
      console.warn("data_egress_log read failed:", error.message);
      setHistory([]);
    } else {
      setHistory((data as EgressLogRow[]) ?? []);
    }
    setLoadingHistory(false);
  }, [tenant.dealership_id]);

  useEffect(() => { void reload(); }, [reload]);

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(EXPORTABLE_TABLES.map((t) => t.key)));
    } else {
      setSelected(new Set());
    }
  };
  const toggleOne = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const startExport = async () => {
    if (selected.size === 0) {
      toast({ title: "Pick at least one table to export.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-egress-export", {
        body: {
          tables: Array.from(selected),
          from: from || undefined,
          to: to || undefined,
        },
      });
      if (error) throw error;

      const result = data as { ok?: boolean; url?: string; expires_at?: string; row_counts?: Record<string, number> };
      if (result?.ok && result.url) {
        // Auto-download via hidden anchor.
        const a = document.createElement("a");
        a.href = result.url;
        a.download = `${tenant.dealership_id}-export.csv`;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        const total = Object.values(result.row_counts ?? {}).reduce((s, n) => s + n, 0);
        toast({
          title: "Export ready",
          description: `${total.toLocaleString()} rows. Link valid for 24 hours.`,
        });
      } else {
        // Edge function may have streamed CSV directly when the bucket
        // isn't provisioned. supabase-js returns the body; trigger a
        // download from a Blob.
        const text = typeof data === "string" ? data : JSON.stringify(data);
        const blob = new Blob([text], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tenant.dealership_id}-export.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: "Export downloaded" });
      }
      await reload();
    } catch (e) {
      toast({
        title: "Export failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const allSelected = selected.size === EXPORTABLE_TABLES.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Export My Data</h2>
        <p className="text-sm text-muted-foreground">
          Your data is yours — pull it down as CSV any time, no charge, no rate limit.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-900">
          <strong className="block mb-1">Free data egress is in your contract.</strong>
          You can export all of your customer, lead, inspection, and communication data at any time.
          Exports include a provenance trail (what came from where) so you can hand the file to an OEM,
          buyer, or counsel without further work. Every export is logged below for audit.
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pick what to export</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => toggleAll(v === true)}
            />
            <span>Select all</span>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXPORTABLE_TABLES.map((t) => (
            <label
              key={t.key}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                selected.has(t.key) ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={selected.has(t.key)}
                onCheckedChange={() => toggleOne(t.key)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <Label className="text-xs">From (optional)</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To (optional)</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button onClick={startExport} disabled={busy || selected.size === 0}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            {busy ? "Exporting…" : `Export ${selected.size} table${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent exports</h3>
          <Button size="sm" variant="ghost" onClick={reload} disabled={loadingHistory}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {history.length === 0 && !loadingHistory && (
          <div className="px-5 py-8 text-sm text-muted-foreground text-center">
            No exports yet. Pick some tables above and click Export to start.
          </div>
        )}
        {history.map((row) => {
          const total = Object.values(row.row_counts ?? {}).reduce((s, n) => s + n, 0);
          const expired = row.expires_at && new Date(row.expires_at) < new Date();
          return (
            <div
              key={row.id}
              className="px-5 py-3 border-b border-border last:border-b-0 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">
                    {total.toLocaleString()} rows · {row.table_names.length} table{row.table_names.length === 1 ? "" : "s"}
                  </span>
                  <Badge variant={row.status === "ready" ? "secondary" : "outline"} className="text-[10px]">
                    {row.status}
                  </Badge>
                  {expired && <Badge variant="outline" className="text-[10px]">link expired</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(row.created_at).toLocaleString()}
                  {row.exported_by_email && ` · ${row.exported_by_email}`}
                  {row.file_bytes != null && ` · ${(row.file_bytes / 1024).toFixed(1)} KB`}
                </div>
              </div>
              {row.download_url && !expired && (
                <a href={row.download_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Download
                  </Button>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataEgressPanel;
