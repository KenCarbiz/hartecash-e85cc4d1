import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Search, ShieldCheck, ShieldOff, Download, ChevronLeft, ChevronRight,
  RefreshCw, Loader2, CalendarDays, Ban, FileText, ChevronDown, ChevronUp,
  Filter, Hash,
} from "lucide-react";

/* ── types ─────────────────────────────────────────────── */

interface ConsentRecord {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  consent_type: string;
  consent_text: string;
  form_source: string;
  submission_token: string | null;
  ip_address: string | null;
  user_agent: string | null;
  withdrawn_at: string | null;
  withdrawn_by: string | null;
}

/* ── constants ─────────────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  sell_form: "Sell My Car",
  schedule_visit: "Schedule Visit",
  service_landing: "Service Landing",
};

const CONSENT_TYPE_LABELS: Record<string, string> = {
  sms_calls_email: "TCPA - SMS/Calls/Email",
};

const PAGE_SIZE = 25;

/* ── helpers ───────────────────────────────────────────── */

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
};

const consentTypeLabel = (type: string) =>
  CONSENT_TYPE_LABELS[type] || type || "TCPA - SMS/Calls/Email";

const escapeCSV = (val: string | null | undefined) => {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/* ── component ─────────────────────────────────────────── */

const ConsentLog = () => {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "withdrawn">("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmWithdrawRecord, setConfirmWithdrawRecord] = useState<ConsentRecord | null>(null);

  /* ── auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserEmail(data.session?.user?.email || "admin");
    });
  }, []);

  /* ── data fetch ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from("consent_log") as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    if (statusFilter === "active") query = query.is("withdrawn_at", null);
    if (statusFilter === "withdrawn") query = query.not("withdrawn_at", "is", null);

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.or(
        `customer_name.ilike.${s},customer_phone.ilike.${s},customer_email.ilike.${s},consent_type.ilike.${s}`,
      );
    }

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data, count } = await query;
    setRecords((data as ConsentRecord[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [search, dateFrom, dateTo, statusFilter, page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  /* ── filter helpers (reset page on change) ── */
  const resetPage = () => setPage(0);
  const handleSearchChange = (val: string) => { setSearch(val); resetPage(); };
  const handleDateFromChange = (val: string) => { setDateFrom(val); resetPage(); };
  const handleDateToChange = (val: string) => { setDateTo(val); resetPage(); };
  const handleStatusFilterChange = (val: string) => { setStatusFilter(val as any); resetPage(); };
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setStatusFilter("all"); resetPage(); };

  const hasFilters = search || dateFrom || dateTo || statusFilter !== "all";
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  /* ── page-level stats ── */
  const activeCount = useMemo(() => records.filter((r) => !r.withdrawn_at).length, [records]);
  const withdrawnCount = useMemo(() => records.filter((r) => !!r.withdrawn_at).length, [records]);

  /* ── withdraw consent ── */
  const handleWithdraw = (record: ConsentRecord) => {
    setConfirmWithdrawRecord(record);
  };

  const executeWithdraw = async () => {
    if (!confirmWithdrawRecord) return;
    const record = confirmWithdrawRecord;
    setConfirmWithdrawRecord(null);

    setWithdrawingId(record.id);
    try {
      await (supabase.from("consent_log") as any)
        .update({
          withdrawn_at: new Date().toISOString(),
          withdrawn_by: currentUserEmail,
        })
        .eq("id", record.id);
      await fetchRecords();
    } catch {
      // Silently fail -- record stays as-is
    } finally {
      setWithdrawingId(null);
    }
  };

  /* ── CSV export ── */
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let query = (supabase.from("consent_log") as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
      if (statusFilter === "active") query = query.is("withdrawn_at", null);
      if (statusFilter === "withdrawn") query = query.not("withdrawn_at", "is", null);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(
          `customer_name.ilike.${s},customer_phone.ilike.${s},customer_email.ilike.${s},consent_type.ilike.${s}`,
        );
      }

      const { data } = await query;
      if (!data || data.length === 0) return;

      const rows = data as ConsentRecord[];
      const headers = [
        "Date",
        "Name",
        "Phone",
        "Email",
        "Consent Type",
        "Source",
        "Consent Text",
        "IP Address",
        "User Agent",
        "Submission Token",
        "Status",
        "Withdrawn At",
        "Withdrawn By",
      ];

      const csvLines = [
        headers.join(","),
        ...rows.map((r) =>
          [
            escapeCSV(formatDate(r.created_at)),
            escapeCSV(r.customer_name),
            escapeCSV(r.customer_phone),
            escapeCSV(r.customer_email),
            escapeCSV(consentTypeLabel(r.consent_type)),
            escapeCSV(SOURCE_LABELS[r.form_source] || r.form_source),
            escapeCSV(r.consent_text),
            escapeCSV(r.ip_address),
            escapeCSV(r.user_agent),
            escapeCSV(r.submission_token),
            escapeCSV(r.withdrawn_at ? "Withdrawn" : "Active"),
            escapeCSV(r.withdrawn_at ? formatDate(r.withdrawn_at) : null),
            escapeCSV(r.withdrawn_by),
          ].join(","),
        ),
      ];

      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `consent-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  /* ── pagination helpers ── */
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | "ellipsis")[] = [0];
    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    if (start > 1) pages.push("ellipsis" as any);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 2) pages.push("ellipsis" as any);
    pages.push(totalPages - 1);
    return pages;
  }, [page, totalPages]);

  /* ── render ── */
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Consent Log</h2>
              <p className="text-[13px] text-muted-foreground">
                TCPA consent records with full audit trail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting || loading}
              className="gap-1.5 rounded-lg"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecords}
              disabled={loading}
              className="gap-1.5 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: totalCount, color: "text-foreground", icon: Hash },
            { label: "Active (page)", value: activeCount, color: "text-green-600 dark:text-green-400", icon: ShieldCheck },
            { label: "Withdrawn (page)", value: withdrawnCount, color: "text-orange-600 dark:text-orange-400", icon: ShieldOff },
            { label: "Current Page", value: `${page + 1} / ${totalPages || 1}`, color: "text-primary", icon: FileText },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/80 p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon className={`w-4 h-4 ${color} opacity-70`} />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Search
              </label>
              <Search className="absolute left-2.5 bottom-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Name, phone, email, consent type..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 text-sm h-9 rounded-lg"
              />
            </div>

            {/* Date From */}
            <div className="min-w-[150px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="text-sm h-9 rounded-lg"
              />
            </div>

            {/* Date To */}
            <div className="min-w-[150px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="text-sm h-9 rounded-lg"
              />
            </div>

            {/* Status filter */}
            <div className="min-w-[140px]">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="h-9 text-sm rounded-lg">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            <p className="text-xs text-muted-foreground">Loading consent records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center shadow-sm">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground mb-1">No consent records found</p>
            <p className="text-xs text-muted-foreground/70">
              {hasFilters
                ? "Try adjusting your filters or search terms."
                : "Consent records will appear here once customers submit forms."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="w-8" />
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Consent Type
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const isWithdrawn = !!r.withdrawn_at;
                    const isExpanded = expandedId === r.id;
                    const cellMuted = isWithdrawn ? "line-through decoration-muted-foreground/40 opacity-50" : "";

                    return (
                      <Fragment key={r.id}>
                        {/* ── Main row ── */}
                        <tr
                          className={`border-b border-border/50 last:border-0 transition-colors cursor-pointer ${
                            isWithdrawn
                              ? "bg-muted/10 text-muted-foreground"
                              : "hover:bg-muted/20"
                          } ${isExpanded ? "bg-primary/[0.03]" : ""}`}
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        >
                          {/* Expand chevron */}
                          <td className="pl-3 pr-0 py-2.5">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </td>

                          <td className={`px-4 py-2.5 text-xs whitespace-nowrap ${cellMuted}`}>
                            {formatDate(r.created_at)}
                          </td>

                          <td className={`px-4 py-2.5 text-sm font-medium ${cellMuted}`}>
                            {r.customer_name || <span className="text-muted-foreground/50">--</span>}
                          </td>

                          <td className={`px-4 py-2.5 text-sm font-mono tracking-tight ${cellMuted}`}>
                            {r.customer_phone || <span className="text-muted-foreground/50">--</span>}
                          </td>

                          <td className={`px-4 py-2.5 text-sm ${cellMuted}`}>
                            {r.customer_email || <span className="text-muted-foreground/50">--</span>}
                          </td>

                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${
                                isWithdrawn ? "opacity-50" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              {consentTypeLabel(r.consent_type)}
                            </span>
                          </td>

                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] rounded-md ${isWithdrawn ? "opacity-50" : ""}`}
                            >
                              {SOURCE_LABELS[r.form_source] || r.form_source}
                            </Badge>
                          </td>

                          <td className="px-4 py-2.5">
                            {isWithdrawn ? (
                              <div>
                                <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 text-[10px] rounded-md">
                                  <ShieldOff className="w-3 h-3 mr-1" /> Withdrawn
                                </Badge>
                                <p
                                  className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]"
                                  title={`${formatDate(r.withdrawn_at!)}${r.withdrawn_by ? ` by ${r.withdrawn_by}` : ""}`}
                                >
                                  {formatDate(r.withdrawn_at!)}
                                </p>
                              </div>
                            ) : (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] rounded-md">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Active
                              </Badge>
                            )}
                          </td>

                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            {!isWithdrawn && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 rounded-md"
                                    disabled={withdrawingId === r.id}
                                    onClick={() => handleWithdraw(r)}
                                  >
                                    {withdrawingId === r.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Ban className="w-3 h-3" />
                                    )}
                                    Withdraw
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p className="text-xs">Withdraw consent for this record</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExpanded && (
                          <tr key={`${r.id}-detail`} className="bg-muted/10 border-b border-border/50">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Consent text */}
                                <div className="md:col-span-2">
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">
                                    Consent Text
                                  </p>
                                  <p className="text-foreground/80 leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/40">
                                    {r.consent_text || "No consent text recorded."}
                                  </p>
                                </div>

                                {/* Metadata grid */}
                                <div className="space-y-2">
                                  <DetailItem label="Submission Token" value={r.submission_token} mono />
                                  <DetailItem label="IP Address" value={r.ip_address} mono />
                                </div>
                                <div className="space-y-2">
                                  <DetailItem label="User Agent" value={r.user_agent} />
                                  {isWithdrawn && (
                                    <>
                                      <DetailItem
                                        label="Withdrawn At"
                                        value={r.withdrawn_at ? formatDate(r.withdrawn_at) : null}
                                      />
                                      <DetailItem label="Withdrawn By" value={r.withdrawn_by} />
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/50 p-3 shadow-sm">
            <p className="text-xs text-muted-foreground tabular-nums">
              Showing {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
              {totalCount.toLocaleString()} records
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(0)}
                className="h-8 text-xs rounded-lg hidden sm:inline-flex"
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page number buttons */}
              {pageNumbers.map((pn, idx) =>
                pn === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-1 text-muted-foreground text-xs select-none">
                    ...
                  </span>
                ) : (
                  <Button
                    key={pn}
                    variant={pn === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pn as number)}
                    className={`h-8 w-8 text-xs rounded-lg p-0 ${
                      pn === page ? "pointer-events-none" : ""
                    }`}
                  >
                    {(pn as number) + 1}
                  </Button>
                ),
              )}

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                className="h-8 text-xs rounded-lg hidden sm:inline-flex"
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmWithdrawRecord} onOpenChange={(open) => { if (!open) setConfirmWithdrawRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw Consent</AlertDialogTitle>
            <AlertDialogDescription>
              Withdraw consent for {confirmWithdrawRecord?.customer_name || confirmWithdrawRecord?.customer_phone || confirmWithdrawRecord?.customer_email || "this record"}? This action will be logged and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeWithdraw}>Withdraw</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

/* ── detail helper ── */

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-0.5">
        {label}
      </p>
      <p
        className={`text-foreground/70 break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}
        title={value || undefined}
      >
        {value || <span className="text-muted-foreground/40 italic">Not recorded</span>}
      </p>
    </div>
  );
}

export default ConsentLog;
