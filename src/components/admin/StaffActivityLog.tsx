import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ActivityRow {
  id: string;
  submission_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

interface SubmissionLite {
  id: string;
  name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  token: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * Cross-submission audit browser. Reads activity_log rows for the
 * current tenant's submissions, joined with a slim submission row
 * (name + vehicle + token) so each entry deep-links back to the
 * customer file.
 *
 * Read-only — every mutation that lands here was triggered from
 * elsewhere in the admin. Filters by action type, performed_by
 * (staff member), and free-text search across customer name + vehicle.
 *
 * Slots into the existing Compliance page next to ConsentLog,
 * CommunicationLog, and VoiceComplianceLog so the dealer admin has
 * one consolidated audit surface.
 */
const StaffActivityLog = () => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, SubmissionLite>>({});
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [performerFilter, setPerformerFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // First fetch tenant submissions IDs so we can scope the activity
      // log lookup. RLS already restricts to the tenant; the explicit
      // .in() keeps payloads small and queries fast.
      const { data: subs } = await supabase
        .from("submissions")
        .select("id, name, vehicle_year, vehicle_make, vehicle_model, token")
        .eq("dealership_id", tenant.dealership_id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      const subList = (subs || []) as SubmissionLite[];
      const subMap: Record<string, SubmissionLite> = {};
      subList.forEach((s) => { subMap[s.id] = s; });
      setSubmissions(subMap);

      const ids = subList.map((s) => s.id);
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: log } = await supabase
        .from("activity_log")
        .select("id, submission_id, action, old_value, new_value, performed_by, created_at")
        .in("submission_id", ids)
        .order("created_at", { ascending: false })
        .limit(300);

      if (cancelled) return;
      setRows((log as ActivityRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  // Distinct action / performer values for filter dropdowns.
  const distinctActions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.action));
    return Array.from(set).sort();
  }, [rows]);
  const distinctPerformers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.performed_by) set.add(r.performed_by); });
    return Array.from(set).sort();
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (performerFilter !== "all" && r.performed_by !== performerFilter) return false;
      if (q) {
        const sub = submissions[r.submission_id];
        const hay = [
          r.action, r.old_value, r.new_value, r.performed_by,
          sub?.name, sub?.vehicle_year, sub?.vehicle_make, sub?.vehicle_model,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, submissions, actionFilter, performerFilter, search]);

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
          <Activity className="w-4 h-4 text-primary" />
          Staff activity log
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Last 300 audit entries across all submissions for this dealership. Status changes, manual edits, internal notes — every mutation logged.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Input
            placeholder="Search action, value, customer, vehicle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="Any action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {distinctActions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={performerFilter} onValueChange={setPerformerFilter}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue placeholder="Any staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {distinctPerformers.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(actionFilter !== "all" || performerFilter !== "all" || search) && (
          <button
            onClick={() => { setActionFilter("all"); setPerformerFilter("all"); setSearch(""); }}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No activity recorded for this dealership yet."
              : "No entries match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Action</th>
                  <th className="text-left px-3 py-2 font-medium">From → To</th>
                  <th className="text-left px-3 py-2 font-medium">By</th>
                  <th className="text-right px-3 py-2 font-medium">Open</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const sub = submissions[r.submission_id];
                  const vehicle = sub
                    ? [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ")
                    : "";
                  return (
                    <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{sub?.name || "—"}</div>
                        {vehicle && <div className="text-[10px] text-muted-foreground">{vehicle}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {r.action}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 max-w-md">
                        {r.old_value || r.new_value ? (
                          <div className="text-[11px] text-foreground/80 leading-snug truncate">
                            {r.old_value && <span className="line-through text-muted-foreground">{r.old_value}</span>}
                            {r.old_value && r.new_value && <span className="mx-1.5 text-muted-foreground">→</span>}
                            {r.new_value && <span>{r.new_value}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.performed_by || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {sub?.token && (
                          <a
                            href={`/admin?submission=${sub.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
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

export default StaffActivityLog;
