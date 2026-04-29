import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TenantViewRow {
  id: string;
  super_admin_user_id: string;
  super_admin_email: string;
  target_dealership_id: string;
  target_display_name: string;
  reason: string;
  client_ip: string | null;
  user_agent: string | null;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  session_duration_seconds: number | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const fmtDuration = (secs: number | null): string => {
  if (secs == null) return "active";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/**
 * Platform-admin "View as Tenant" audit log. Each row records when a
 * super admin entered + exited tenant-view mode, against which tenant,
 * for what stated reason, and for how long.
 *
 * Read-only — auto-populated by TenantContext.setViewAsTenant /
 * clearViewAsTenant. Used by ops/legal/security to evidence access
 * when a dealer asks "who from your team has been in our admin?"
 *
 * Slots into the existing Compliance page; only platform admins
 * actually see it (RLS already restricts SELECT to admin role).
 */
const TenantViewLog = () => {
  const [rows, setRows] = useState<TenantViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tenant_view_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setRows((data as TenantViewRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (showOnlyActive && r.ended_at) return false;
      if (!q) return true;
      const hay = [
        r.super_admin_email, r.target_display_name, r.target_dealership_id,
        r.reason, r.ended_reason,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, showOnlyActive]);

  const activeCount = rows.filter((r) => !r.ended_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          Tenant View-As audit
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Every "View as Tenant" session by a platform admin. Last 200 entries; oldest first by start time. {activeCount > 0 && <span className="font-semibold text-amber-600">· {activeCount} currently active</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Input
            placeholder="Search admin email, target tenant, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <button
          onClick={() => setShowOnlyActive(!showOnlyActive)}
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition-colors ${
            showOnlyActive
              ? "bg-amber-500 border-amber-500 text-white"
              : "border-border hover:bg-muted"
          }`}
        >
          {showOnlyActive ? "Showing active only" : "Show only active"}
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {rows.length}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No platform admin has used View-As-Tenant yet."
              : "No entries match the current filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Started</th>
                  <th className="text-left px-3 py-2 font-medium">Admin</th>
                  <th className="text-left px-3 py-2 font-medium">Target tenant</th>
                  <th className="text-left px-3 py-2 font-medium">Reason</th>
                  <th className="text-left px-3 py-2 font-medium">Duration</th>
                  <th className="text-left px-3 py-2 font-medium">Ended</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const active = !r.ended_at;
                  return (
                    <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {fmtDate(r.started_at)}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.super_admin_email}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.target_display_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.target_dealership_id}</div>
                      </td>
                      <td className="px-3 py-2 max-w-md">
                        <div className="text-foreground/80 leading-snug">{r.reason || "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        {active ? (
                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] gap-1">
                            <Clock className="w-3 h-3 animate-pulse" />
                            active
                          </Badge>
                        ) : (
                          <span className="font-mono text-foreground/80">{fmtDuration(r.session_duration_seconds)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.ended_at ? `${fmtDate(r.ended_at)}${r.ended_reason ? ` · ${r.ended_reason}` : ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantViewLog;
