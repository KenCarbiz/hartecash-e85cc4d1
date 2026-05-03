import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, RefreshCw, Eye, ArrowRightLeft, FileSearch, Webhook, Download, Filter,
} from "lucide-react";

type AuditKind =
  | "tenant_view"
  | "rooftop_detach"
  | "data_egress"
  | "stripe_event";

type AuditRow = {
  ts: string;
  kind: AuditKind;
  actor_email: string | null;
  actor_role: string | null;
  target: string;
  detail: string;
  raw: Record<string, unknown>;
};

const KIND_META: Record<AuditKind, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  tenant_view:    { label: "View-as",    icon: Eye,            color: "text-amber-700" },
  rooftop_detach: { label: "Rooftop op", icon: ArrowRightLeft, color: "text-red-700"   },
  data_egress:    { label: "Data export",icon: FileSearch,     color: "text-sky-700"   },
  stripe_event:   { label: "Stripe",     icon: Webhook,        color: "text-emerald-700" },
};

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  if (dt < 60_000) return "just now";
  const mins = Math.floor(dt / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function rowsToCSV(rows: AuditRow[]): string {
  const cols = ["ts", "kind", "actor_email", "actor_role", "target", "detail"];
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.split('"').join('""')}"`
      : s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape((r as any)[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/**
 * Unified audit log surface — consolidates the four audit-trail tables
 * the platform writes into one searchable view:
 *
 *   - tenant_view_log     — super-admin "View As" sessions
 *   - rooftop_detach_log  — rooftop detaches + merges
 *   - data_egress_log     — CSV exports by dealers
 *   - stripe_events       — webhook deliveries (failed + processed)
 *
 * Audience: platform admin's compliance officer / finance auditor.
 * Reads are RLS-gated per the underlying tables — a dealer admin
 * sees nothing here, a platform admin sees everything.
 *
 * Filters: kind chips, free-text search across actor / target / detail.
 * One-click CSV export of the visible rows for handing to legal,
 * an OEM auditor, or a board pack.
 */
const UnifiedAuditLog = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<Set<AuditKind>>(
    () => new Set(["tenant_view", "rooftop_detach", "data_egress", "stripe_event"]),
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [viewLogs, detaches, egress, stripeEvents] = await Promise.all([
      supabase
        .from("tenant_view_log")
        .select("started_at, super_admin_email, target_dealership_id, target_display_name, reason, ended_at")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200),
      supabase
        .from("rooftop_detach_log")
        .select("performed_at, performed_by_email, dealership_id, from_dealer_group_id, to_dealer_group_id, reason, snapshot")
        .gte("performed_at", since)
        .order("performed_at", { ascending: false })
        .limit(200),
      supabase
        .from("data_egress_log")
        .select("created_at, exported_by_email, dealership_id, table_names, row_counts, status, file_bytes")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("stripe_events")
        .select("received_at, type, livemode, summary, processed_at")
        .gte("received_at", since)
        .order("received_at", { ascending: false })
        .limit(200),
    ]);

    const out: AuditRow[] = [];

    for (const r of (viewLogs.data as any[]) ?? []) {
      const ended = r.ended_at ? ` · ended ${fmtRelative(r.ended_at)}` : " · session open";
      out.push({
        ts: r.started_at,
        kind: "tenant_view",
        actor_email: r.super_admin_email,
        actor_role: "platform-admin",
        target: r.target_display_name || r.target_dealership_id,
        detail: `${r.reason}${ended}`,
        raw: r,
      });
    }

    for (const r of (detaches.data as any[]) ?? []) {
      const direction = (r.snapshot && (r.snapshot as any).kind === "merge") ? "merge into group" : "detach";
      out.push({
        ts: r.performed_at,
        kind: "rooftop_detach",
        actor_email: r.performed_by_email,
        actor_role: "platform-admin",
        target: r.dealership_id,
        detail: `${direction} · ${r.reason}`,
        raw: r,
      });
    }

    for (const r of (egress.data as any[]) ?? []) {
      const total = Object.values((r.row_counts ?? {}) as Record<string, number>).reduce(
        (s: number, n: number) => s + n, 0,
      );
      const sizeKb = r.file_bytes ? `${(r.file_bytes / 1024).toFixed(1)} KB` : "size n/a";
      out.push({
        ts: r.created_at,
        kind: "data_egress",
        actor_email: r.exported_by_email,
        actor_role: "dealer-admin",
        target: r.dealership_id,
        detail: `${total.toLocaleString()} rows · ${r.table_names.length} tables · ${sizeKb} · ${r.status}`,
        raw: r,
      });
    }

    for (const r of (stripeEvents.data as any[]) ?? []) {
      const processed = r.processed_at ? "processed" : "unprocessed";
      out.push({
        ts: r.received_at,
        kind: "stripe_event",
        actor_email: "stripe.com",
        actor_role: "system",
        target: r.type,
        detail: `${processed}${r.livemode ? "" : " · TEST"}${r.summary ? ` · ${r.summary}` : ""}`,
        raw: r,
      });
    }

    out.sort((a, b) => (a.ts > b.ts ? -1 : 1));
    setRows(out);
    setLoading(false);

    if (viewLogs.error) console.warn("tenant_view_log read failed:", viewLogs.error.message);
    if (detaches.error) console.warn("rooftop_detach_log read failed:", detaches.error.message);
    if (egress.error)   console.warn("data_egress_log read failed:", egress.error.message);
    if (stripeEvents.error) console.warn("stripe_events read failed:", stripeEvents.error.message);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!kindFilter.has(r.kind)) return false;
      if (!term) return true;
      const hay = [
        r.actor_email,
        r.target,
        r.detail,
        r.actor_role,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search, kindFilter]);

  const toggleKind = (k: AuditKind) => {
    const next = new Set(kindFilter);
    if (next.has(k)) next.delete(k); else next.add(k);
    setKindFilter(next);
  };

  const exportCSV = () => {
    const csv = rowsToCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${filtered.length.toLocaleString()} rows` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Last 30 days across view-as sessions, rooftop ops, data exports, and Stripe events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export {filtered.length}
          </Button>
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {(Object.keys(KIND_META) as AuditKind[]).map((k) => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            const active = kindFilter.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-primary/10 border-primary/30 text-card-foreground"
                    : "bg-muted/30 border-border text-muted-foreground"
                }`}
              >
                <Icon className={`w-3 h-3 ${active ? meta.color : ""}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <Input
            aria-label="Search audit log"
            placeholder="Search by email, dealership, reason, event type…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {loading && (
          <div className="px-5 py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No audit activity in the last 30 days."
              : "No rows match the current filter."}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <ol className="divide-y divide-border">
            {filtered.map((r, i) => {
              const meta = KIND_META[r.kind];
              const Icon = meta.icon;
              return (
                <li key={`${r.ts}-${i}`} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                      <span className="text-sm font-medium truncate">{r.target}</span>
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{r.detail}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                      {fmtRelative(r.ts)} · {r.actor_email || "unknown"}
                      {r.actor_role && r.actor_role !== "system" && ` (${r.actor_role})`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Reads are RLS-gated per source table. Window: 30 days. Older entries remain in the source tables and are visible via direct SQL.
      </p>
    </div>
  );
};

export default UnifiedAuditLog;
