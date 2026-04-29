import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Mail, Phone, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";

interface LogEntry {
  id: string;
  created_at: string;
  trigger_key: string;
  channel: string;
  recipient: string;
  status: string;
  error_message: string | null;
  submission_id: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  customer_offer_ready: "Offer Ready",
  customer_offer_increased: "Offer Increased",
  customer_offer_accepted: "Offer Accepted",
  customer_appointment_booked: "Appt Booked (Customer)",
  customer_appointment_reminder: "Appt Reminder",
  customer_appointment_rescheduled: "Appt Rescheduled",
  staff_customer_accepted: "Customer Accepted (Staff)",
  staff_deal_completed: "Deal Completed (Staff)",
  new_submission: "New Submission",
  hot_lead: "Hot Lead",
  appointment_booked: "Appt Booked (Staff)",
  photos_uploaded: "Photos Uploaded",
  docs_uploaded: "Docs Uploaded",
  status_change: "Status Change",
};

const PAGE_SIZE = 25;

export default function NotificationLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Full-filter stats — separate query so the "Sent / Failed / Error"
  // numbers reflect the entire filtered set, not just the current page.
  const [filterStats, setFilterStats] = useState<{ sent: number; failed: number; error: number }>({
    sent: 0, failed: 0, error: 0,
  });

  // Common filter application — used by both the page query and the
  // stats query so they always reflect the same WHERE clause.
  const applyFilters = (q: ReturnType<typeof supabase.from>) => {
    let r = q as ReturnType<ReturnType<typeof supabase.from>["select"]>;
    if (filterTrigger !== "all") r = r.eq("trigger_key", filterTrigger);
    if (filterChannel !== "all") r = r.eq("channel", filterChannel);
    if (filterStatus !== "all") r = r.eq("status", filterStatus);
    if (search.trim()) r = r.ilike("recipient", `%${search.trim()}%`);
    if (dateFrom) r = r.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) r = r.lte("created_at", `${dateTo}T23:59:59`);
    return r;
  };

  const fetchLogs = async () => {
    setLoading(true);
    const base = supabase.from("notification_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
    const { data, count } = await applyFilters(base as unknown as ReturnType<typeof supabase.from>)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setLogs((data as LogEntry[]) || []);
    setTotalCount(count || 0);

    // Stats across the FULL filtered set (status only, head-only).
    const counts = await Promise.all(
      (["sent", "failed", "error"] as const).map(async (s) => {
        const q = supabase
          .from("notification_log")
          .select("*", { count: "exact", head: true });
        let scoped = q as unknown as ReturnType<typeof supabase.from>;
        // Re-apply non-status filters; force the status filter to s.
        if (filterTrigger !== "all") scoped = (scoped as any).eq("trigger_key", filterTrigger);
        if (filterChannel !== "all") scoped = (scoped as any).eq("channel", filterChannel);
        if (search.trim()) scoped = (scoped as any).ilike("recipient", `%${search.trim()}%`);
        if (dateFrom) scoped = (scoped as any).gte("created_at", `${dateFrom}T00:00:00`);
        if (dateTo) scoped = (scoped as any).lte("created_at", `${dateTo}T23:59:59`);
        const { count: c } = await (scoped as any).eq("status", s);
        return [s, c || 0] as const;
      }),
    );
    setFilterStats({
      sent: counts.find(([s]) => s === "sent")?.[1] || 0,
      failed: counts.find(([s]) => s === "failed")?.[1] || 0,
      error: counts.find(([s]) => s === "error")?.[1] || 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrigger, filterChannel, filterStatus, search, dateFrom, dateTo, page]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-[10px]"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "error":
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const channelIcon = (channel: string) => {
    return channel === "email"
      ? <Mail className="w-3.5 h-3.5 text-blue-500" />
      : <Phone className="w-3.5 h-3.5 text-green-500" />;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  // Get unique trigger keys from TRIGGER_LABELS
  const triggerOptions = Object.entries(TRIGGER_LABELS);

  // CSV export — pulls up to 5000 rows matching the current filters
  // (separate query because the visible page is paginated). Common
  // ask for compliance audits and back-office reconciliation.
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const base = supabase
        .from("notification_log")
        .select("created_at, trigger_key, channel, recipient, status, error_message, submission_id")
        .order("created_at", { ascending: false })
        .limit(5000);
      const { data } = await applyFilters(base as unknown as ReturnType<typeof supabase.from>);
      const rows = (data as LogEntry[]) || [];
      if (rows.length === 0) {
        setExporting(false);
        return;
      }
      const csvEscape = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      const headers = ["When", "Trigger", "Channel", "Recipient", "Status", "Error", "Submission ID"];
      const csv = [
        headers.join(","),
        ...rows.map((r) => [
          r.created_at,
          TRIGGER_LABELS[r.trigger_key] || r.trigger_key,
          r.channel,
          r.recipient,
          r.status,
          r.error_message || "",
          r.submission_id || "",
        ].map((v) => csvEscape(String(v))).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notification-log-${new Date().toISOString().slice(0, 10)}-${rows.length}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Notification Log</h2>
          <p className="text-sm text-muted-foreground">History of all email and SMS notifications sent</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={exporting || totalCount === 0}
            className="gap-1.5"
            title="Export the filtered log as a CSV (up to 5000 rows)"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 text-sm h-9"
          />
        </div>
        <Select value={filterTrigger} onValueChange={v => { setFilterTrigger(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="All Triggers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            {triggerOptions.map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterChannel} onValueChange={v => { setFilterChannel(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range presets — populate the From/To pickers in one
          click. Same shortcuts as Reports (#89). */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mr-1">Range:</span>
        {(() => {
          const toIso = (d: Date) => d.toISOString().slice(0, 10);
          const today = new Date();
          const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
          const presets: Array<{ label: string; from: () => string; to: () => string }> = [
            { label: "Today", from: () => toIso(startOf(today)), to: () => toIso(today) },
            { label: "7d", from: () => toIso(new Date(Date.now() - 7 * 86400000)), to: () => toIso(today) },
            { label: "30d", from: () => toIso(new Date(Date.now() - 30 * 86400000)), to: () => toIso(today) },
            { label: "90d", from: () => toIso(new Date(Date.now() - 90 * 86400000)), to: () => toIso(today) },
            { label: "This month", from: () => toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: () => toIso(today) },
            { label: "Last month", from: () => toIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: () => toIso(new Date(today.getFullYear(), today.getMonth(), 0)) },
          ];
          return (
            <>
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setDateFrom(p.from()); setDateTo(p.to()); setPage(0); }}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md border border-border bg-card hover:bg-muted transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                className="h-7 text-[11px] w-[140px]"
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                className="h-7 text-[11px] w-[140px]"
                aria-label="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Clear
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Stats — full-filter totals via head-only count queries, not
          just the visible page. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{filterStats.sent}</p>
          <p className="text-[11px] text-muted-foreground">Sent</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{filterStats.failed}</p>
          <p className="text-[11px] text-muted-foreground">Failed</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{filterStats.error}</p>
          <p className="text-[11px] text-muted-foreground">Error</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No notifications found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Trigger</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Channel</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Recipient</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Timestamp</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium">
                        {TRIGGER_LABELS[log.trigger_key] || log.trigger_key}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {channelIcon(log.channel)}
                        <span className="text-xs capitalize">{log.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono text-muted-foreground">{log.recipient}</span>
                    </td>
                    <td className="px-4 py-2.5">{statusBadge(log.status)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      {log.error_message ? (
                        <span className="text-[10px] text-red-500 truncate block" title={log.error_message}>
                          {log.error_message.slice(0, 80)}{log.error_message.length > 80 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
