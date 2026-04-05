import { useState } from "react";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Eye, Trash2, ChevronLeft, ChevronRight, CheckCircle,
  AlertTriangle, TrendingUp, UserCheck, XCircle, Camera, FileText,
  Rows3, Rows2,
} from "lucide-react";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import { ALL_STATUS_OPTIONS, getStatusLabel, isAcceptedWithAppointment, isAcceptedWithoutAppointment, isOfferPendingSubmission, isOfferUpdatedByStaff } from "@/lib/adminConstants";
import DashboardAnalytics from "@/components/admin/DashboardAnalytics";

interface SubmissionsTableProps {
  submissions: Submission[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (val: string) => void;
  storeFilter: string;
  onStoreFilterChange: (val: string) => void;
  dateRangeFilter: { from: string; to: string };
  onDateRangeFilterChange: (val: { from: string; to: string }) => void;
  showFilterPanel: boolean;
  onToggleFilterPanel: () => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  dealerLocations: DealerLocation[];
  canApprove: boolean;
  canDelete: boolean;
  auditLabel: string;
  userName: string;
  onView: (sub: Submission) => void;
  onDelete: (id: string) => void;
  onInlineStatusChange: (sub: Submission, newStatus: string) => void;
}

const SubmissionsTable = ({
  submissions,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  storeFilter,
  onStoreFilterChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  showFilterPanel,
  onToggleFilterPanel,
  page,
  total,
  pageSize,
  onPageChange,
  dealerLocations,
  canApprove,
  canDelete,
  auditLabel,
  userName,
  onView,
  onDelete,
  onInlineStatusChange,
}: SubmissionsTableProps) => {
  const [density, setDensity] = useState<"compact" | "spacious">(() => {
    try { return (localStorage.getItem("admin-table-density") as "compact" | "spacious") || "spacious"; }
    catch { return "spacious"; }
  });
  const isCompact = density === "compact";
  const toggleDensity = () => {
    const next = isCompact ? "spacious" : "compact";
    setDensity(next);
    localStorage.setItem("admin-table-density", next);
  };

  const cellPad = isCompact ? "px-2 py-1.5" : "px-3 py-3";
  const fontSize = isCompact ? "text-xs" : "text-sm";

  const getHoursSinceUpdate = (sub: Submission) => {
    const refDate = sub.status_updated_at || sub.created_at;
    return (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60);
  };

  const getSlaLevel = (hours: number, status: string): { color: string; borderClass: string; label: string; bgClass: string } => {
    if (["purchase_complete", "dead_lead"].includes(status))
      return { color: "text-muted-foreground", borderClass: "border-l-border", label: "", bgClass: "" };
    if (hours < 2)
      return { color: "text-success", borderClass: "border-l-success", label: "", bgClass: "" };
    if (hours < 12)
      return { color: "text-emerald-500", borderClass: "border-l-emerald-500", label: "", bgClass: "" };
    if (hours < 24)
      return { color: "text-amber-500", borderClass: "border-l-amber-500", label: "Aging", bgClass: "bg-amber-500/5" };
    if (hours < 48)
      return { color: "text-orange-500", borderClass: "border-l-orange-500", label: "Overdue", bgClass: "bg-orange-500/5" };
    return { color: "text-destructive", borderClass: "border-l-destructive", label: "Critical", bgClass: "bg-destructive/5" };
  };

  const formatAge = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const filtered = submissions.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      const matchesSearch =
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.vin?.toLowerCase().includes(q) ||
        s.plate?.toLowerCase().includes(q) ||
        `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (statusFilter === "__hot__") { if (!s.is_hot_lead) return false; }
    else if (statusFilter === "__mine__") { if (s.status_updated_by !== auditLabel && !s.appraised_by?.includes(userName)) return false; }
    else if (statusFilter && statusFilter !== "__all__" && s.progress_status !== statusFilter) return false;
    if (sourceFilter && sourceFilter !== "__all__" && s.lead_source !== sourceFilter) return false;
    if (storeFilter && storeFilter !== "__all__") {
      if (storeFilter === "__unassigned__") { if (s.store_location_id) return false; }
      else { if (s.store_location_id !== storeFilter) return false; }
    }
    if (dateRangeFilter.from || dateRangeFilter.to) {
      const d = new Date(s.created_at).toISOString().split('T')[0];
      if (dateRangeFilter.from && d < dateRangeFilter.from) return false;
      if (dateRangeFilter.to && d > dateRangeFilter.to) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(total / pageSize);

  const quickFilters = [
    { label: "All", value: "__all__", icon: undefined },
    { label: "Abandoned", value: "partial", icon: <AlertTriangle className="w-3 h-3" /> },
    { label: "New", value: "new", icon: undefined },
    { label: "My Queue", value: "__mine__", icon: <UserCheck className="w-3 h-3" /> },
    { label: "Hot Leads", value: "__hot__", icon: <TrendingUp className="w-3 h-3" /> },
    { label: "Dead", value: "dead_lead", icon: <XCircle className="w-3 h-3" /> },
  ];

  const getChipStyle = (value: string, isActive: boolean) => {
    if (!isActive) return "bg-muted/50 border-border text-muted-foreground hover:bg-muted";
    switch (value) {
      case "partial": return "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400";
      case "dead_lead": return "bg-destructive/10 border-destructive/40 text-destructive";
      case "__hot__": return "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-400";
      case "__mine__": return "bg-primary/15 border-primary/40 text-primary";
      default: return "bg-primary/10 border-primary/40 text-primary";
    }
  };

  return (
    <div>
      <div className="mb-6"><DashboardAnalytics /></div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDensity}
            className="text-muted-foreground hover:text-foreground px-2"
            title={isCompact ? "Spacious view" : "Compact view"}
          >
            {isCompact ? <Rows3 className="w-4 h-4" /> : <Rows2 className="w-4 h-4" />}
          </Button>
          <Button variant={showFilterPanel ? "default" : "outline"} size="sm" onClick={onToggleFilterPanel}>
            Filter {(statusFilter || sourceFilter || storeFilter || dateRangeFilter.from || dateRangeFilter.to) && "*"}
          </Button>
        </div>
      </div>

      {/* Quick-filter chips */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {quickFilters.map(chip => {
          const isActive = chip.value === "__hot__" ? statusFilter === "__hot__"
            : chip.value === "__mine__" ? statusFilter === "__mine__"
            : chip.value === "__all__" ? (!statusFilter || statusFilter === "__all__")
            : statusFilter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => onStatusFilterChange(chip.value)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${getChipStyle(chip.value, isActive)}`}
            >
              {chip.icon}
              {chip.label}
              {chip.value === "partial" && (
                <span className="ml-0.5 bg-amber-500/20 px-1.5 rounded-full text-[10px]">
                  {submissions.filter(s => s.progress_status === "partial").length}
                </span>
              )}
              {chip.value === "__mine__" && (
                <span className="ml-0.5 bg-primary/20 px-1.5 rounded-full text-[10px]">
                  {submissions.filter(s => s.status_updated_by === auditLabel || s.appraised_by?.includes(userName)).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showFilterPanel && (
        <div className="mb-4 bg-muted/40 rounded-lg border border-border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-2 block">Status</Label>
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  {ALL_STATUS_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block">Lead Source</Label>
              <Select value={sourceFilter} onValueChange={onSourceFilterChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sources</SelectItem>
                  <SelectItem value="inventory">Off Street Purchase</SelectItem>
                  <SelectItem value="service">Service Drive</SelectItem>
                  <SelectItem value="trade">Trade-In</SelectItem>
                  <SelectItem value="in_store_trade">In-Store Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block">Store</Label>
              <Select value={storeFilter} onValueChange={onStoreFilterChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All stores" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All stores</SelectItem>
                  {dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block">From Date</Label>
              <Input type="date" value={dateRangeFilter.from} onChange={(e) => onDateRangeFilterChange({ ...dateRangeFilter, from: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block">To Date</Label>
              <Input type="date" value={dateRangeFilter.to} onChange={(e) => onDateRangeFilterChange({ ...dateRangeFilter, to: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            onStatusFilterChange("__all__"); onSourceFilterChange("__all__"); onStoreFilterChange("__all__");
            onDateRangeFilterChange({ from: "", to: "" });
          }} className="text-xs">Clear Filters</Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
      ) : (
        <>
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className={`min-w-[1100px] ${fontSize}`}>
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Date</th>
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Name</th>
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Vehicle</th>
                    {!isCompact && <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>VIN</th>}
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Contact</th>
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Source</th>
                    <th className={`text-right ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Offer</th>
                    <th className={`text-left ${cellPad} font-semibold text-muted-foreground whitespace-nowrap min-w-[160px]`}>Status</th>
                    <th className={`text-center px-2 ${isCompact ? "py-1.5" : "py-3"} font-semibold text-muted-foreground whitespace-nowrap`}>Age</th>
                    <th className={`text-right ${cellPad} font-semibold text-muted-foreground whitespace-nowrap`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub, idx) => {
                    const hours = getHoursSinceUpdate(sub);
                    const sla = getSlaLevel(hours, sub.progress_status);
                    return (
                    <tr key={sub.id} className={`border-b border-border last:border-0 hover:bg-primary/5 transition-colors border-l-3 ${sla.borderClass} ${sla.bgClass} ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className={`${cellPad} whitespace-nowrap`}>{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td className={`${cellPad} font-medium text-card-foreground whitespace-nowrap`}>{sub.name || "—"}</td>
                      <td className={`${cellPad} whitespace-nowrap`}>
                        <span className="flex items-center gap-1">
                          {sub.is_hot_lead && <span title="Hot Lead">🔥</span>}
                          {sub.vehicle_year && sub.vehicle_make ? `${sub.vehicle_year} ${sub.vehicle_make} ${sub.vehicle_model || ""}` : sub.plate || "—"}
                          {sub.photos_uploaded && <span title="Photos uploaded"><Camera className="w-3 h-3 text-success ml-1 shrink-0" /></span>}
                          {sub.docs_uploaded && <span title="Docs uploaded"><FileText className="w-3 h-3 text-primary ml-0.5 shrink-0" /></span>}
                        </span>
                      </td>
                      {!isCompact && <td className={`${cellPad} text-xs font-mono text-muted-foreground whitespace-nowrap`}>{sub.vin || "—"}</td>}
                      <td className={`${cellPad} whitespace-nowrap`}>
                        <div>{sub.email || "—"}</div>
                        <div className="text-muted-foreground text-xs">{formatPhone(sub.phone) || ""}</div>
                      </td>
                      <td className={cellPad}>
                        <Badge variant={sub.lead_source === "service" ? "secondary" : sub.lead_source === "in_store_trade" || sub.lead_source === "trade" ? "default" : "outline"} className="text-xs">
                          {sub.lead_source === "service" ? "Service" : sub.lead_source === "in_store_trade" ? "In-Store" : sub.lead_source === "trade" ? "Trade-In" : "Off Street"}
                        </Badge>
                        {sub.store_location_id && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
                            {dealerLocations.find(l => l.id === sub.store_location_id)?.name || "—"}
                          </p>
                        )}
                      </td>
                      <td className={`${cellPad} text-right whitespace-nowrap`}>
                        {(() => {
                          const isAcceptedAppt = isAcceptedWithAppointment(sub);
                          const isAcceptedNoAppt = isAcceptedWithoutAppointment(sub);
                          const isPending = isOfferPendingSubmission(sub);
                          const isUpdated = isOfferUpdatedByStaff(sub);

                          const bubbleClass = isAcceptedAppt
                            ? "bg-primary/15 text-primary border-primary/30"
                            : isAcceptedNoAppt && isUpdated
                            ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                            : isAcceptedNoAppt
                            ? "bg-success/15 text-success border-success/30"
                            : isPending
                            ? "bg-warning/15 text-warning-foreground border-warning/30"
                            : "";

                          const offerValue = sub.offered_price || sub.estimated_offer_high;
                          if (!offerValue) return <span className="text-xs text-muted-foreground">—</span>;

                          const displayVal = sub.offered_price
                            ? `$${Math.floor(sub.offered_price).toLocaleString()}`
                            : `~$${Math.floor(sub.estimated_offer_high!).toLocaleString()}`;

                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${bubbleClass || "bg-muted/50 text-muted-foreground border-border"}`}>
                              {displayVal}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <Select value={sub.progress_status} onValueChange={(val) => onInlineStatusChange(sub, val)}>
                            <SelectTrigger className={`w-44 h-7 text-xs font-medium ${
                              sub.progress_status === "purchase_complete" ? "border-success/50 text-success" :
                              sub.progress_status === "dead_lead" ? "border-destructive/50 text-destructive" :
                              sub.progress_status === "partial" ? "border-amber-500/50 text-amber-600" :
                              sub.progress_status === "new" || sub.progress_status === "not_contacted" ? "border-muted text-muted-foreground" :
                              "border-accent/50 text-accent"
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUS_OPTIONS.filter(s => s.key !== "partial").map(s => {
                                const locked = ["deal_finalized", "check_request_submitted", "purchase_complete"].includes(s.key) && !canApprove;
                                return <SelectItem key={s.key} value={s.key} disabled={locked}>{s.label}{locked ? " 🔒" : ""}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                          {sub.progress_status === "partial" && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">⚠ Abandoned — needs follow-up</span>}
                          {isAcceptedWithoutAppointment(sub) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/15 border border-success/30 rounded-full px-2.5 py-0.5">
                              <CheckCircle className="w-3 h-3" /> Offer Accepted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs font-bold ${sla.color}`} title={`${Math.round(hours)}h since last update`}>
                            {formatAge(hours)}
                          </span>
                          {sla.label && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${sla.color}`}>
                              {sla.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onView(sub)}><Eye className="w-4 h-4" /></Button>
                          {canDelete && <Button variant="ghost" size="sm" onClick={() => onDelete(sub.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubmissionsTable;
