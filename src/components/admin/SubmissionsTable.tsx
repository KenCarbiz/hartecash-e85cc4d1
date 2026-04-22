import { useState, useCallback, useMemo } from "react";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Eye, Trash2, ChevronLeft, ChevronRight, MoreHorizontal,
  Phone, MessageSquare, Mail, DollarSign, Calendar, Check,
  Rows3, Rows2, X, Inbox, Sparkles, Flame, User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import {
  ALL_STATUS_OPTIONS, getStatusLabel,
  isAcceptedWithAppointment, isAcceptedWithoutAppointment,
} from "@/lib/adminConstants";
import { calculateLeadScore, getScoreColor } from "@/lib/leadScoring";
import { nextActionForLead, type LeadAction } from "@/lib/leadNextAction";
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
  onScheduleAppointment?: (sub: Submission) => void;
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

const initialsOrFallback = (sub: Submission): { kind: "text" | "icon"; value: string } => {
  if (sub.name && sub.name.trim()) {
    const parts = sub.name.trim().split(/\s+/).filter(Boolean);
    return {
      kind: "text",
      value: parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(),
    };
  }
  if (sub.vehicle_make && sub.vehicle_make.trim()) {
    return { kind: "text", value: sub.vehicle_make.trim()[0].toUpperCase() };
  }
  return { kind: "icon", value: "user" };
};

const formatMiles = (m: string | null): string => {
  if (!m) return "";
  const n = parseInt(m.replace(/\D/g, ""), 10);
  return isNaN(n) ? "" : n.toLocaleString();
};

const formatSmartAge = (createdAt: string): string => {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}d`;
  return `${Math.round(days / 7)}w`;
};

const formatSpread = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  if (abs >= 1000) {
    const k = abs / 1000;
    const formatted = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${formatted}k`;
  }
  return `${sign}$${abs}`;
};

const ActionIcon = ({ icon }: { icon: LeadAction["icon"] }) => {
  if (icon === "phone") return <Phone className="w-3.5 h-3.5" />;
  if (icon === "dollar") return <DollarSign className="w-3.5 h-3.5" />;
  if (icon === "calendar") return <Calendar className="w-3.5 h-3.5" />;
  if (icon === "check") return <Check className="w-3.5 h-3.5" />;
  if (icon === "eye") return <Eye className="w-3.5 h-3.5" />;
  return null;
};

const hoursSince = (iso: string | null | undefined): number => {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
};

const isStuck = (sub: Submission): boolean => {
  if (["purchase_complete", "dead_lead", "check_request_submitted", "partial"].includes(sub.progress_status)) {
    return false;
  }
  const ref = sub.status_updated_at || sub.created_at;
  return hoursSince(ref) > 24;
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
  canApprove,
  canDelete,
  auditLabel,
  userName,
  onView,
  onDelete,
  onInlineStatusChange,
  onScheduleAppointment,
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const rowPad = isCompact ? "py-2" : "py-3.5";
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
    if (statusFilter === "__hot__") { if (!s.is_hot_lead) return false; }
    else if (statusFilter === "__mine__") { if (s.status_updated_by !== auditLabel && !s.appraised_by?.includes(userName)) return false; }
    else if (statusFilter === "__appts__") { if (!s.appointment_set) return false; }
    else if (statusFilter === "__accepted__") { if (!isAcceptedWithoutAppointment(s) && !isAcceptedWithAppointment(s)) return false; }
    else if (statusFilter === "__stuck__") { if (!isStuck(s)) return false; }
    else if (statusFilter && statusFilter !== "__all__" && s.progress_status !== statusFilter) return false;

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

  const filteredIds = useMemo(() => new Set(filtered.map(s => s.id)), [filtered]);
  const activeSelectedIds = useMemo(() => {
    const ids = new Set<string>();
    selectedIds.forEach(id => { if (filteredIds.has(id)) ids.add(id); });
    return ids;
  }, [selectedIds, filteredIds]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const someVisibleSelected = filtered.some(s => selectedIds.has(s.id));

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.add(s.id));
        return next;
      });
    }
  }, [allVisibleSelected, filtered]);

  const handleBulkStatusChange = useCallback((newStatus: string) => {
    const selected = submissions.filter(s => activeSelectedIds.has(s.id));
    selected.forEach(sub => onInlineStatusChange(sub, newStatus));
    clearSelection();
  }, [activeSelectedIds, submissions, onInlineStatusChange, clearSelection]);

  const handleBulkDelete = useCallback(() => {
    activeSelectedIds.forEach(id => onDelete(id));
    clearSelection();
  }, [activeSelectedIds, onDelete, clearSelection]);

  const totalPages = Math.ceil(total / pageSize);

  // ── Chip counts: computed from the full submission set, not the filtered view
  const counts = useMemo(() => ({
    all: submissions.length,
    new: submissions.filter(s => s.progress_status === "new").length,
    hot: submissions.filter(s => s.is_hot_lead).length,
    appts: submissions.filter(s => s.appointment_set).length,
    accepted: submissions.filter(s => isAcceptedWithoutAppointment(s) || isAcceptedWithAppointment(s)).length,
    stuck: submissions.filter(isStuck).length,
  }), [submissions]);

  type Chip = { key: string; label: string; count: number };
  const chips: Chip[] = [
    { key: "__all__", label: "All", count: counts.all },
    { key: "new", label: "New", count: counts.new },
    { key: "__hot__", label: "Hot", count: counts.hot },
    { key: "__appts__", label: "Appointments", count: counts.appts },
    { key: "__accepted__", label: "Accepted", count: counts.accepted },
    { key: "__stuck__", label: "Stuck > 24h", count: counts.stuck },
  ];

  // ── Primary action button click handler (per action key)
  const handleActionClick = useCallback((sub: Submission, action: LeadAction) => {
    const logAction = async (label: string) => {
      try {
        await supabase.from("activity_log").insert({
          submission_id: sub.id,
          action: label,
          old_value: null,
          new_value: null,
          performed_by: auditLabel,
        });
      } catch {
        // activity log is best-effort — never block the outreach action on a log failure
      }
    };

    if (action.actionKey === "call" && action.href) {
      logAction("Call initiated");
      window.location.href = action.href;
      return;
    }
    if (action.actionKey === "sms" && action.href) {
      logAction("SMS initiated");
      window.location.href = action.href;
      return;
    }
    if (action.actionKey === "appt") {
      if (onScheduleAppointment) onScheduleAppointment(sub);
      else onView(sub);
      return;
    }
    // open, offer, revive all route to the detail sheet
    onView(sub);
  }, [auditLabel, onView, onScheduleAppointment]);

  const handleMenuCall = (sub: Submission) => {
    const digits = sub.phone?.replace(/\D/g, "");
    if (!digits) return;
    void supabase.from("activity_log").insert({
      submission_id: sub.id,
      action: "Call initiated",
      performed_by: auditLabel,
    });
    window.location.href = `tel:+1${digits}`;
  };
  const handleMenuSms = (sub: Submission) => {
    const digits = sub.phone?.replace(/\D/g, "");
    if (!digits) return;
    void supabase.from("activity_log").insert({
      submission_id: sub.id,
      action: "SMS initiated",
      performed_by: auditLabel,
    });
    window.location.href = `sms:+1${digits}`;
  };
  const handleMenuEmail = (sub: Submission) => {
    if (!sub.email) return;
    void supabase.from("activity_log").insert({
      submission_id: sub.id,
      action: "Email initiated",
      performed_by: auditLabel,
    });
    window.location.href = `mailto:${sub.email}`;
  };

  return (
    <div>
      <div className="mb-6"><DashboardAnalytics /></div>

      {/* Search + density + filter toggle */}
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
            Filter {(sourceFilter || storeFilter || dateRangeFilter.from || dateRangeFilter.to) && "*"}
          </Button>
        </div>
      </div>

      {/* Quick-filter chips */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {chips.map(chip => {
          const isActive =
            chip.key === "__all__"
              ? (!statusFilter || statusFilter === "__all__")
              : statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => onStatusFilterChange(chip.key)}
              className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[12px] font-semibold border transition-colors ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {chip.label}
              <span className={`text-[11px] font-semibold ${isActive ? "text-white/70" : "text-slate-400"}`}>
                · {chip.count}
              </span>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-24 rounded-md hidden md:block" />
                <Skeleton className="h-5 w-20 rounded-md hidden lg:block" />
                <Skeleton className="h-5 w-10 hidden xl:block" />
                <Skeleton className="h-6 w-12 rounded-full hidden xl:block" />
                <Skeleton className="h-7 w-24 rounded-md" />
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
                    <th className={`${cellPadX} py-2.5 w-10 text-center`}>
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all visible rows"
                      />
                    </th>
                    <th className={`${cellPadX} py-2.5 w-[44px]`} />
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Customer &amp; Vehicle</th>
                    <th className={`${cellPadX} py-2.5 text-left font-semibold`}>Status</th>
                    <th className={`${cellPadX} py-2.5 text-right font-semibold`}>Offer / ACV</th>
                    <th className={`px-2 py-2.5 text-center font-semibold`}>Age</th>
                    <th className={`px-2 py-2.5 text-center font-semibold`}>Score</th>
                    <th className={`${cellPadX} py-2.5 text-right font-semibold w-[200px]`} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => {
                    const action = nextActionForLead(sub);
                    const tone = statusTone(sub.progress_status);
                    const offerVal = sub.offered_price ?? sub.estimated_offer_high ?? null;
                    const isEstimate = sub.offered_price == null && (sub.estimated_offer_high ?? 0) > 0;
                    const spread = sub.offered_price != null && sub.acv_value != null
                      ? sub.offered_price - sub.acv_value
                      : null;
                    const ls = calculateLeadScore(sub);
                    const digits = sub.phone?.replace(/\D/g, "");
                    const miles = formatMiles(sub.mileage);
                    const vehicle = sub.vehicle_year && sub.vehicle_make
                      ? `${sub.vehicle_year} ${sub.vehicle_make} ${sub.vehicle_model || ""}`.trim()
                      : (sub.plate || "—");
                    const primaryBtnClasses =
                      "bg-slate-900 hover:bg-slate-800 text-white border border-slate-900";
                    const destructiveBtnClasses =
                      "bg-red-600 hover:bg-red-500 text-white border border-red-600";
                    const ghostBtnClasses =
                      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200";
                    const btnClass =
                      action.variant === "primary" ? primaryBtnClasses :
                      action.variant === "destructive" ? destructiveBtnClasses :
                      ghostBtnClasses;
                    const avatar = initialsOrFallback(sub);
                    const isRowSelected = selectedIds.has(sub.id);

                    return (
                      <tr
                        key={sub.id}
                        className={`border-t border-slate-100 transition-colors ${
                          isRowSelected ? "bg-sky-50/60" : "hover:bg-slate-50/60"
                        }`}
                      >
                        <td className={`${cellPadX} ${rowPad} text-center w-10`}>
                          <Checkbox
                            checked={isRowSelected}
                            onCheckedChange={() => toggleSelectOne(sub.id)}
                            aria-label={`Select ${sub.name || "submission"}`}
                          />
                        </td>
                        <td className={`${cellPadX} ${rowPad} w-[44px]`}>
                          <div
                            className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center"
                            aria-hidden
                          >
                            {avatar.kind === "text"
                              ? <span>{avatar.value}</span>
                              : <User className="w-4 h-4 text-slate-400" />}
                          </div>
                        </td>
                        <td className={`${cellPadX} ${rowPad}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {sub.name || "Unknown customer"}
                              </span>
                              {sub.is_hot_lead && (
                                <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" aria-label="Hot lead" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {vehicle}
                              {miles && <> · {miles} mi</>}
                            </div>
                          </div>
                        </td>
                        <td className={`${cellPadX} ${rowPad}`}>
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 border ${statusToneClasses[tone]}`}
                          >
                            {shortStatusLabel(sub.progress_status)}
                          </span>
                        </td>
                        <td className={`${cellPadX} ${rowPad} text-right whitespace-nowrap`}>
                          {offerVal != null && offerVal > 0 ? (
                            <div className="leading-tight">
                              <div className="text-sm font-bold text-slate-900">
                                {isEstimate ? "~" : ""}${Math.floor(offerVal).toLocaleString()}
                              </div>
                              {sub.acv_value != null && sub.acv_value > 0 && (
                                <div className="text-[11px] text-slate-400">
                                  ACV ${Math.floor(sub.acv_value).toLocaleString()}
                                  {spread != null && Math.abs(spread) >= 1 && (
                                    <span className={`ml-1.5 font-semibold ${spread >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                      {formatSpread(spread)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className={`px-2 ${rowPad} text-center`}>
                          <span className="text-xs font-semibold text-slate-600" title={new Date(sub.created_at).toLocaleString()}>
                            {formatSmartAge(sub.created_at)}
                          </span>
                        </td>
                        <td className={`px-2 ${rowPad} text-center`}>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-help ${getScoreColor(ls.score)}`}>
                                  {ls.score}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-xs space-y-1">
                                <div className="font-semibold">{ls.label}</div>
                                {ls.factors.map((f, i) => <div key={i}>{f}</div>)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className={`${cellPadX} ${rowPad} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActionClick(sub, action)}
                              className={`h-7 text-[12px] font-semibold gap-1 ${btnClass}`}
                            >
                              <ActionIcon icon={action.icon} />
                              {action.label}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => onView(sub)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleMenuCall(sub)}
                                  disabled={!digits}
                                >
                                  <Phone className="w-4 h-4 mr-2" />
                                  Call
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleMenuSms(sub)}
                                  disabled={!digits}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  SMS
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleMenuEmail(sub)}
                                  disabled={!sub.email}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Email
                                </DropdownMenuItem>
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => onDelete(sub.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {activeSelectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-xl shadow-2xl border border-border/60 ring-1 ring-primary/10 animate-in slide-in-from-bottom-4 fade-in duration-200">
              <span className="text-sm font-semibold text-card-foreground whitespace-nowrap">
                {activeSelectedIds.size} {activeSelectedIds.size === 1 ? "lead" : "leads"} selected
              </span>
              <div className="w-px h-6 bg-border" />
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="h-8 w-44 text-xs font-medium">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUS_OPTIONS.filter(s => s.key !== "partial").map(s => {
                    const locked = ["deal_finalized", "check_request_submitted", "purchase_complete"].includes(s.key) && !canApprove;
                    return <SelectItem key={s.key} value={s.key} disabled={locked}>{s.label}{locked ? " 🔒" : ""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 text-xs font-semibold gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1">
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            </div>
          )}

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
