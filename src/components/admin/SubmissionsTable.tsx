import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Eye, ChevronLeft, ChevronRight, Inbox, Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import { ALL_STATUS_OPTIONS, getStatusLabel } from "@/lib/adminConstants";
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
  onView: (sub: Submission) => void;
}

// ── Local helpers ─────────────────────────────────────────────
const statusTone = (status: string): "slate" | "blue" | "amber" | "emerald" | "red" => {
  if (["new"].includes(status)) return "blue";
  if (["contacted", "no_contact"].includes(status)) return "slate";
  if (["inspection_scheduled", "inspection_completed", "appraisal_completed",
       "manager_approval_inspection"].includes(status)) return "amber";
  if (["offer_accepted", "price_agreed", "deal_finalized",
       "title_ownership_verified", "check_request_submitted",
       "purchase_complete"].includes(status)) return "emerald";
  if (["dead_lead", "partial"].includes(status)) return "red";
  return "slate";
};

const statusToneClasses: Record<string, string> = {
  slate:   "bg-slate-100 text-slate-700 border-slate-200",
  blue:    "bg-sky-50 text-sky-700 border-sky-200",
  amber:   "bg-amber-50 text-amber-800 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red:     "bg-red-50 text-red-700 border-red-200",
};

const shortStatusLabel = (status: string): string => {
  const short: Record<string, string> = {
    "new": "New",
    "contacted": "Contacted",
    "no_contact": "Unable to Reach",
    "offer_accepted": "Accepted",
    "inspection_scheduled": "Inspection",
    "inspection_completed": "Inspected",
    "appraisal_completed": "Appraised",
    "manager_approval_inspection": "MAI",
    "price_agreed": "Price Agreed",
    "deal_finalized": "Finalized",
    "title_ownership_verified": "Title Verified",
    "check_request_submitted": "Check Requested",
    "purchase_complete": "Purchased",
    "dead_lead": "Dead",
    "partial": "Abandoned",
  };
  return short[status] || getStatusLabel(status);
};

const intentFromSource = (s: Submission): { label: string; dotClass: string } => {
  switch (s.lead_source) {
    case "trade":
    case "in_store_trade":
      return { label: "Trade-In", dotClass: "bg-blue-500" };
    case "inventory":
      return { label: "Sell", dotClass: "bg-emerald-500" };
    case "service":
      return { label: "Unsure", dotClass: "bg-amber-500" };
    default:
      return { label: "Sell", dotClass: "bg-emerald-500" };
  }
};

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
  onView,
}: SubmissionsTableProps) => {
  const rowPad = "py-3.5";
  const cellPadX = "px-3";

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
    if (statusFilter && statusFilter !== "__all__" && s.progress_status !== statusFilter) return false;
    if (sourceFilter && sourceFilter !== "__all__" && s.lead_source !== sourceFilter) return false;
    if (storeFilter && storeFilter !== "__all__") {
      if (storeFilter === "__unassigned__") { if (s.store_location_id) return false; }
      else { if (s.store_location_id !== storeFilter) return false; }
    }
    if (dateRangeFilter.from || dateRangeFilter.to) {
      const d = new Date(s.created_at).toISOString().split("T")[0];
      if (dateRangeFilter.from && d < dateRangeFilter.from) return false;
      if (dateRangeFilter.to && d > dateRangeFilter.to) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="mb-6"><DashboardAnalytics /></div>

      {/* Search + filter toggle */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, VIN, phone…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant={showFilterPanel ? "default" : "outline"} size="sm" onClick={onToggleFilterPanel}>
          Filter {(sourceFilter || storeFilter || dateRangeFilter.from || dateRangeFilter.to) && "*"}
        </Button>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-32 rounded-md hidden md:block" />
                <Skeleton className="h-5 w-20 rounded-md hidden lg:block" />
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        (() => {
          const hasActiveFilters =
            (search && search.trim() !== "") ||
            (statusFilter && statusFilter !== "__all__") ||
            (sourceFilter && sourceFilter !== "__all__") ||
            (storeFilter && storeFilter !== "__all__") ||
            (dateRangeFilter.from || dateRangeFilter.to);
          const totalIsZero = total === 0 && !hasActiveFilters;

          if (totalIsZero) {
            return (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 animate-in fade-in bg-white rounded-xl border border-dashed border-slate-200">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center space-y-1 max-w-md">
                  <p className="text-base font-semibold text-slate-900">No leads yet</p>
                  <p className="text-sm text-slate-500">
                    As soon as a customer submits a trade-in through your website or
                    service drive, they'll land here. To start generating leads:
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => window.dispatchEvent(new CustomEvent("admin:navigate", { detail: "embed-toolkit" }))}
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Open Embed Toolkit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open("/", "_blank")}
                  >
                    Preview Customer Form
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <span className="text-sm font-medium">No submissions match your filters</span>
              <span className="text-xs text-muted-foreground/70">Try widening the date range or clearing a filter</span>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  onSearchChange("");
                  onStatusFilterChange("__all__");
                  onSourceFilterChange("__all__");
                  onStoreFilterChange("__all__");
                  onDateRangeFilterChange({ from: "", to: "" });
                }}
              >
                Clear all filters
              </Button>
            </div>
          );
        })()
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Customer</th>
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Vehicle</th>
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Intent</th>
                    <th className={`${cellPadX} py-2.5 text-right font-semibold`}>Offer</th>
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Status</th>
                    <th className={`${cellPadX} py-2.5 w-12`} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => {
                    const tone = statusTone(sub.progress_status);
                    const offerVal = sub.offered_price ?? sub.estimated_offer_high ?? null;
                    const isEstimate = sub.offered_price == null && (sub.estimated_offer_high ?? 0) > 0;
                    const intent = intentFromSource(sub);
                    const vehicleLine = sub.vehicle_year && sub.vehicle_make
                      ? [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ")
                      : "—";

                    return (
                      <tr
                        key={sub.id}
                        onClick={() => onView(sub)}
                        className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer"
                      >
                        <td className={`${cellPadX} ${rowPad}`}>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {sub.name || "Unknown customer"}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {sub.phone ? formatPhone(sub.phone) : "—"}
                            </div>
                          </div>
                        </td>
                        <td className={`${cellPadX} ${rowPad}`}>
                          <div className="min-w-0">
                            <div className="text-sm text-slate-900 truncate">
                              {vehicleLine}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {sub.vin || sub.plate || "No VIN"}
                            </div>
                          </div>
                        </td>
                        <td className={`${cellPadX} ${rowPad}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${intent.dotClass}`} />
                            <span className="text-sm text-slate-700">{intent.label}</span>
                          </div>
                        </td>
                        <td className={`${cellPadX} ${rowPad} text-right whitespace-nowrap`}>
                          {offerVal != null && offerVal > 0 ? (
                            <span className="text-sm font-bold text-slate-900">
                              {isEstimate ? "~" : ""}${Math.floor(offerVal).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className={`${cellPadX} ${rowPad}`}>
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 border ${statusToneClasses[tone]}`}
                          >
                            {shortStatusLabel(sub.progress_status)}
                          </span>
                        </td>
                        <td className={`${cellPadX} ${rowPad} text-right`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onView(sub); }}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            aria-label="View customer file"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total} leads
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                      className="h-8 w-8 p-0 text-xs font-semibold"
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubmissionsTable;
