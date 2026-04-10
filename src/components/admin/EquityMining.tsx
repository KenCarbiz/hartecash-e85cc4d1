import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Users, DollarSign, Send, Mail, CheckCircle, Clock,
  Filter, Loader2, Car, Pickaxe,
} from "lucide-react";

/* ── types ──────────────────────────────────────────── */

interface ServiceLead {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: string | null;
  overall_condition: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  acv_value: number | null;
  progress_status: string;
  lead_source: string;
  outreach_sent?: boolean;
}

const EARLY_STATUSES = ["new", "contacted", "not_contacted", "no_contact"];

/* ── main component ─────────────────────────────────── */

const EquityMining = () => {
  const { tenant } = useTenant();
  const [leads, setLeads] = useState<ServiceLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [outreachSentIds, setOutreachSentIds] = useState<Set<string>>(new Set());

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minOffer, setMinOffer] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, token, created_at, name, email, phone, vehicle_year, vehicle_make, vehicle_model, mileage, overall_condition, offered_price, estimated_offer_high, acv_value, progress_status, lead_source"
      )
      .eq("lead_source", "service")
      .in("progress_status", EARLY_STATUSES)
      .order("estimated_offer_high", { ascending: false, nullsFirst: false });

    if (error) {
      toast.error("Failed to load service leads");
      setLoading(false);
      return;
    }
    setLeads((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  /* ── filtered + sorted leads ──────────────────────── */

  const filtered = useMemo(() => {
    let result = leads;

    if (dateFrom) {
      result = result.filter((l) => l.created_at >= dateFrom);
    }
    if (dateTo) {
      const toEnd = dateTo + "T23:59:59";
      result = result.filter((l) => l.created_at <= toEnd);
    }
    if (minOffer) {
      const min = parseFloat(minOffer);
      if (!isNaN(min)) {
        result = result.filter(
          (l) => (l.offered_price || l.estimated_offer_high || 0) >= min
        );
      }
    }

    return result.sort((a, b) => {
      const aVal = a.offered_price || a.estimated_offer_high || 0;
      const bVal = b.offered_price || b.estimated_offer_high || 0;
      return bVal - aVal;
    });
  }, [leads, dateFrom, dateTo, minOffer]);

  /* ── KPI calculations ─────────────────────────────── */

  const kpis = useMemo(() => {
    const total = filtered.length;
    const highEquity = filtered.filter(
      (l) => (l.offered_price || l.estimated_offer_high || 0) >= 15000
    ).length;
    const outreachCount = outreachSentIds.size;
    const converted = filtered.filter(
      (l) => l.progress_status === "contacted"
    ).length;
    return { total, highEquity, outreachCount, converted };
  }, [filtered, outreachSentIds]);

  /* ── outreach helpers ─────────────────────────────── */

  const sendOutreach = async (lead: ServiceLead) => {
    setSendingId(lead.id);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "customer_equity_alert",
          submission_id: lead.id,
        },
      });
      if (error) throw error;
      setOutreachSentIds((prev) => new Set(prev).add(lead.id));
      toast.success(`Outreach sent to ${lead.name || "customer"}`);
    } catch {
      toast.error("Failed to send outreach");
    } finally {
      setSendingId(null);
    }
  };

  const sendBulkOutreach = async () => {
    const uncontacted = filtered.filter(
      (l) =>
        l.progress_status !== "contacted" && !outreachSentIds.has(l.id)
    );
    if (uncontacted.length === 0) {
      toast.info("No un-contacted leads to reach");
      return;
    }
    setBulkSending(true);
    let sent = 0;
    for (const lead of uncontacted) {
      try {
        await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "customer_equity_alert",
            submission_id: lead.id,
          },
        });
        setOutreachSentIds((prev) => new Set(prev).add(lead.id));
        sent++;
      } catch {
        // continue with next
      }
    }
    setBulkSending(false);
    toast.success(`Bulk outreach sent to ${sent} lead${sent !== 1 ? "s" : ""}`);
  };

  /* ── helpers ──────────────────────────────────────── */

  const daysSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const fmtCurrency = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toLocaleString()}`;

  const getEquityValue = (l: ServiceLead) =>
    l.offered_price || l.estimated_offer_high || 0;

  /* ── render ───────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Pickaxe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-card-foreground tracking-tight">
              Service Drive Opportunities
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Identify high-equity service customers for proactive acquisition
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </Button>
          <Button
            size="sm"
            onClick={sendBulkOutreach}
            disabled={bulkSending}
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
          >
            {bulkSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Bulk Outreach
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Date From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Date To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Min Offer ($)
              </label>
              <Input
                type="number"
                placeholder="e.g. 10000"
                value={minOffer}
                onChange={(e) => setMinOffer(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Service Leads"
          value={kpis.total}
          icon={Users}
          color="text-blue-500"
          bg="from-blue-500/15 to-blue-600/5"
        />
        <KpiCard
          label="High Equity"
          value={kpis.highEquity}
          icon={TrendingUp}
          color="text-emerald-500"
          bg="from-emerald-500/15 to-emerald-600/5"
        />
        <KpiCard
          label="Outreach Sent"
          value={kpis.outreachCount}
          icon={Mail}
          color="text-violet-500"
          bg="from-violet-500/15 to-violet-600/5"
        />
        <KpiCard
          label="Converted"
          value={kpis.converted}
          icon={CheckCircle}
          color="text-amber-500"
          bg="from-amber-500/15 to-amber-600/5"
        />
      </div>

      {/* Leads Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Service Drive Leads by Estimated Equity
            </h3>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Car className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-card-foreground">
              No service drive leads found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Service leads with early-stage statuses will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Est. Offer
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Days Since Visit
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const equity = getEquityValue(lead);
                  const days = daysSince(lead.created_at);
                  const wasSent = outreachSentIds.has(lead.id);
                  const isSending = sendingId === lead.id;

                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-card-foreground">
                            {lead.name || "Unknown"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {lead.email || lead.phone || "No contact info"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-card-foreground">
                          {[lead.vehicle_year, lead.vehicle_make, lead.vehicle_model]
                            .filter(Boolean)
                            .join(" ") || "N/A"}
                        </p>
                        {lead.mileage && (
                          <p className="text-[11px] text-muted-foreground">
                            {Number(lead.mileage).toLocaleString()} mi
                            {lead.overall_condition
                              ? ` \u00b7 ${lead.overall_condition}`
                              : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {equity > 0 ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ${equity.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span
                            className={`font-semibold ${
                              days > 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-card-foreground"
                            }`}
                          >
                            {days}d
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {wasSent ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px]">
                            Sent
                          </Badge>
                        ) : lead.progress_status === "contacted" ? (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0 text-[10px]">
                            Contacted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={wasSent ? "ghost" : "outline"}
                          disabled={isSending || wasSent}
                          onClick={() => sendOutreach(lead)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          {isSending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : wasSent ? (
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {wasSent ? "Sent" : "Send Outreach"}
                        </Button>
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

/* ── KPI Card ────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="relative overflow-hidden bg-card rounded-2xl border border-border p-4 shadow-sm">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${bg} pointer-events-none`}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            {label}
          </span>
          <div className="w-7 h-7 rounded-lg bg-background/60 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
        </div>
        <span className="text-3xl font-black text-card-foreground tracking-tight">
          {value}
        </span>
      </div>
    </div>
  );
}

export default EquityMining;
