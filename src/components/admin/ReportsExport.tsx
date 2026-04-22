import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Loader2, ClipboardCopy, Users,
  TrendingUp, DollarSign, Target, Flame, CheckCircle, XCircle,
  BarChart3, CalendarDays, Filter, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStatusLabel } from "@/lib/adminConstants";

/* ── constants ────────────────────────────────────────── */

const SOURCE_LABELS: Record<string, string> = {
  inventory: "Off Street",
  service: "Service Drive",
  trade: "Trade-In",
  in_store_trade: "In-Store Trade",
};

type ReportType = "all" | "hot" | "completed" | "dead" | "by_source";

const REPORT_OPTIONS: { value: ReportType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "all", label: "All Leads", icon: Users, description: "Every submission in the selected date range" },
  { value: "hot", label: "Hot Leads Only", icon: Flame, description: "Leads flagged as high-priority" },
  { value: "completed", label: "Completed Deals", icon: CheckCircle, description: "Deals marked as purchased" },
  { value: "dead", label: "Dead Leads", icon: XCircle, description: "Leads that did not convert" },
  { value: "by_source", label: "Leads by Source", icon: BarChart3, description: "Grouped by lead acquisition channel" },
];

const COMPLETED_STATUSES = ["purchase_complete"];
const DEAD_STATUSES = ["dead_lead"];

const SELECT_FIELDS = "created_at, name, email, phone, vehicle_year, vehicle_make, vehicle_model, vin, mileage, overall_condition, progress_status, lead_source, offered_price, acv_value, estimated_offer_low, estimated_offer_high, photos_uploaded, docs_uploaded, is_hot_lead, zip, store_location_id, status_updated_at";

const CSV_HEADERS = [
  "Date", "Name", "Email", "Phone", "Year", "Make", "Model", "VIN",
  "Mileage", "Condition", "Status", "Source", "Offered Price", "ACV",
  "Est. Low", "Est. High", "Photos", "Docs", "Hot Lead", "ZIP", "Last Updated",
];

/* ── types ────────────────────────────────────────────── */

interface SubmissionRow {
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  mileage: string | null;
  overall_condition: string | null;
  progress_status: string;
  lead_source: string;
  offered_price: number | null;
  acv_value: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  is_hot_lead: boolean;
  zip: string | null;
  store_location_id: string | null;
  status_updated_at: string | null;
}

interface KpiStats {
  totalInRange: number;
  conversionRate: number;
  avgOfferValue: number;
  totalRevenue: number;
}

/* ── helpers ──────────────────────────────────────────── */

const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function rowToCSVArray(s: SubmissionRow): string[] {
  return [
    new Date(s.created_at).toLocaleDateString(),
    s.name || "",
    s.email || "",
    s.phone || "",
    s.vehicle_year || "",
    s.vehicle_make || "",
    s.vehicle_model || "",
    s.vin || "",
    s.mileage || "",
    s.overall_condition || "",
    getStatusLabel(s.progress_status),
    SOURCE_LABELS[s.lead_source] || s.lead_source || "",
    s.offered_price?.toString() || "",
    s.acv_value?.toString() || "",
    s.estimated_offer_low?.toString() || "",
    s.estimated_offer_high?.toString() || "",
    s.photos_uploaded ? "Yes" : "No",
    s.docs_uploaded ? "Yes" : "No",
    s.is_hot_lead ? "Yes" : "No",
    s.zip || "",
    s.status_updated_at ? new Date(s.status_updated_at).toLocaleDateString() : "",
  ];
}

function buildCSVContent(rows: SubmissionRow[]): string {
  const mapped = rows.map(rowToCSVArray);
  return [CSV_HEADERS, ...mapped]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/* ── component ───────────────────────────────────────── */

const ReportsExport = () => {
  const { toast } = useToast();

  /* state */
  const [reportType, setReportType] = useState<ReportType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [allData, setAllData] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);

  /* fetch once on mount */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("submissions")
        .select(SELECT_FIELDS)
        .order("created_at", { ascending: false });

      if (!error && data) setAllData(data as SubmissionRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  /* filtered data */
  const filteredData = useMemo(() => {
    let rows = allData;

    // date range filter
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      rows = rows.filter(r => new Date(r.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59");
      rows = rows.filter(r => new Date(r.created_at) <= to);
    }

    // report type filter
    switch (reportType) {
      case "hot":
        return rows.filter(r => r.is_hot_lead);
      case "completed":
        return rows.filter(r => COMPLETED_STATUSES.includes(r.progress_status));
      case "dead":
        return rows.filter(r => DEAD_STATUSES.includes(r.progress_status));
      case "by_source":
      case "all":
      default:
        return rows;
    }
  }, [allData, reportType, dateFrom, dateTo]);

  /* KPI stats */
  const kpis = useMemo<KpiStats>(() => {
    const total = filteredData.length;
    const completed = filteredData.filter(r => COMPLETED_STATUSES.includes(r.progress_status)).length;
    const conversionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

    let offerSum = 0;
    let offerCount = 0;
    let revenue = 0;
    filteredData.forEach(r => {
      const price = r.offered_price || 0;
      if (price > 0) {
        offerSum += price;
        offerCount++;
      }
      if (COMPLETED_STATUSES.includes(r.progress_status) && price > 0) {
        revenue += price;
      }
    });

    return {
      totalInRange: total,
      conversionRate,
      avgOfferValue: offerCount > 0 ? Math.round(offerSum / offerCount) : 0,
      totalRevenue: revenue,
    };
  }, [filteredData]);

  /* source breakdown for "by_source" view */
  const sourceBreakdown = useMemo(() => {
    if (reportType !== "by_source") return [];
    const counts: Record<string, number> = {};
    filteredData.forEach(r => {
      const src = SOURCE_LABELS[r.lead_source] || r.lead_source || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([source, count]) => ({ source, count, pct: filteredData.length > 0 ? Math.round((count / filteredData.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData, reportType]);

  /* preview rows */
  const previewRows = useMemo(() => filteredData.slice(0, 10), [filteredData]);

  /* export CSV */
  const exportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const csvContent = buildCSVContent(filteredData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = reportType === "all" ? "all-leads" : reportType === "hot" ? "hot-leads" : reportType === "completed" ? "completed-deals" : reportType === "dead" ? "dead-leads" : "by-source";
      a.download = `${suffix}-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `${filteredData.length} records exported as CSV.` });
    } finally {
      setExporting(false);
    }
  }, [filteredData, reportType, toast]);

  /* copy to clipboard */
  const copyToClipboard = useCallback(async () => {
    setCopying(true);
    try {
      const csvContent = buildCSVContent(filteredData);
      await navigator.clipboard.writeText(csvContent);
      toast({ title: "Copied to clipboard", description: `${filteredData.length} records copied in CSV format.` });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    } finally {
      setCopying(false);
    }
  }, [filteredData, toast]);

  /* active report meta */
  const activeReport = REPORT_OPTIONS.find(r => r.value === reportType)!;

  /* ── render ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 animate-in fade-in">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-medium">Loading report data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-card-foreground tracking-tight">Reports & Export</h2>
              <p className="text-xs text-muted-foreground">Generate filtered reports, preview data, and export in multiple formats</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Filters Row ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Report Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3 h-3" /> Report Type
              </Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{activeReport.description}</p>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> From Date
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> To Date
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Leads"
          value={kpis.totalInRange.toLocaleString()}
          icon={Users}
          color="text-blue-500"
          bg="from-blue-500/5 to-transparent"
          sub={`in selected ${dateFrom || dateTo ? "date range" : "dataset"}`}
        />
        <KpiCard
          label="Conversion Rate"
          value={`${kpis.conversionRate}%`}
          icon={Target}
          color="text-emerald-500"
          bg="from-emerald-500/5 to-transparent"
          sub="completed / total leads"
        />
        <KpiCard
          label="Avg Offer Value"
          value={kpis.avgOfferValue > 0 ? fmt(kpis.avgOfferValue) : "--"}
          icon={TrendingUp}
          color="text-amber-500"
          bg="from-amber-500/5 to-transparent"
          sub="across leads with offers"
        />
        <KpiCard
          label="Total Revenue"
          value={kpis.totalRevenue > 0 ? fmt(kpis.totalRevenue) : "--"}
          icon={DollarSign}
          color="text-violet-500"
          bg="from-violet-500/5 to-transparent"
          sub="completed deal value"
        />
      </div>

      {/* ── Source Breakdown (conditional) ────────────────── */}
      {reportType === "by_source" && sourceBreakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent px-6 py-3 border-b border-border/50">
            <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Lead Source Breakdown
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {sourceBreakdown.map(({ source, count, pct }) => (
              <div key={source} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 shrink-0 font-medium">{source}</span>
                <div className="flex-1 h-7 bg-muted/30 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 flex items-center justify-end pr-2.5"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  >
                    {pct > 12 && <span className="text-[10px] font-bold text-white drop-shadow-sm">{count}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-20 justify-end">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                  <span className="text-xs font-bold text-card-foreground">{pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Table ─────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-500/10 via-gray-500/5 to-transparent px-6 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            Preview
            <Badge variant="outline" className="text-[10px] ml-1">{filteredData.length} total</Badge>
          </h3>
          {filteredData.length > 10 && (
            <span className="text-[10px] text-muted-foreground">Showing first 10 of {filteredData.length}</span>
          )}
        </div>

        {previewRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileSpreadsheet className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No records match your filters</p>
            <p className="text-xs mt-1">Try adjusting the report type or date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider w-24">Date</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Vehicle</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Source</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Offered</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Hot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => (
                  <TableRow key={idx} className="group">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-card-foreground">{row.name || "--"}</div>
                      {row.email && <div className="text-[10px] text-muted-foreground">{row.email}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-card-foreground whitespace-nowrap">
                      {[row.vehicle_year, row.vehicle_make, row.vehicle_model].filter(Boolean).join(" ") || "--"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {SOURCE_LABELS[row.lead_source] || row.lead_source || "--"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          COMPLETED_STATUSES.includes(row.progress_status)
                            ? "bg-emerald-500/15 text-emerald-600"
                            : DEAD_STATUSES.includes(row.progress_status)
                            ? "bg-red-500/15 text-red-600"
                            : ""
                        }`}
                      >
                        {getStatusLabel(row.progress_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-right text-card-foreground tabular-nums">
                      {row.offered_price ? fmt(row.offered_price) : "--"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.is_hot_lead && (
                        <Flame className="w-3.5 h-3.5 text-orange-500 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Export Actions ─────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent px-6 py-3 border-b border-border/50">
          <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-teal-500" />
            Export Options
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CSV Download */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">Download CSV</h4>
                  <p className="text-[10px] text-muted-foreground">Excel, Google Sheets, CRM compatible</p>
                </div>
              </div>
              <Button
                onClick={exportCSV}
                disabled={exporting || filteredData.length === 0}
                className="w-full gap-2"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Exporting..." : `Export ${filteredData.length} Records`}
              </Button>
            </div>

            {/* Copy to Clipboard */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <ClipboardCopy className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">Copy to Clipboard</h4>
                  <p className="text-[10px] text-muted-foreground">Paste directly into spreadsheets</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={copyToClipboard}
                disabled={copying || filteredData.length === 0}
                className="w-full gap-2"
              >
                {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCopy className="w-4 h-4" />}
                {copying ? "Copying..." : `Copy ${filteredData.length} Records`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── KPI Card sub-component ──────────────────────────── */

function KpiCard({ label, value, icon: Icon, color, bg, sub }: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  sub: string;
}) {
  return (
    <div className="relative overflow-hidden bg-card rounded-2xl border border-border p-4 shadow-sm cursor-default">
      <div className={`absolute inset-0 bg-gradient-to-br ${bg} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-2xl font-black text-card-foreground tracking-tight">{value}</span>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export default ReportsExport;
