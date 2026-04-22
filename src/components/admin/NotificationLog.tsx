import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Mail, Phone, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

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
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("notification_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filterTrigger !== "all") query = query.eq("trigger_key", filterTrigger);
    if (filterChannel !== "all") query = query.eq("channel", filterChannel);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search.trim()) query = query.ilike("recipient", `%${search.trim()}%`);

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    setLogs((data as LogEntry[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [filterTrigger, filterChannel, filterStatus, search, page]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Notification Log</h2>
          <p className="text-sm text-muted-foreground">History of all email and SMS notifications sent</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{logs.filter(l => l.status === "sent").length}</p>
          <p className="text-[11px] text-muted-foreground">Sent (page)</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{logs.filter(l => l.status === "failed").length}</p>
          <p className="text-[11px] text-muted-foreground">Failed (page)</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{logs.filter(l => l.status === "error").length}</p>
          <p className="text-[11px] text-muted-foreground">Error (page)</p>
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
