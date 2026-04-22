import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Minus, Activity,
  BarChart2, Car, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { RetailStats } from "@/components/admin/RetailMarketPanel";

// ── Types ──────────────────────────────────────────────────────────────────

interface RecentSale {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  acv_value: number | null;
  offered_price: number | null;
  appraisal_finalized_at: string | null;
  overall_condition: string | null;
  mileage: string | null;
}

interface MarketPulseCardProps {
  retailMarketStats: RetailStats | null;
  dealershipId: string;
  bbClassName?: string | null;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  condition?: string;
  mileage?: string | null;
  currentAcv?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, fallback = "—") {
  if (val == null || val === 0) return fallback;
  return `$${Math.round(val).toLocaleString()}`;
}

function daysAgo(isoDate: string | null) {
  if (!isoDate) return null;
  const diff = (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  return `${Math.floor(diff)}d ago`;
}

function calcMileageAdjustedRetail(
  marketAvgAsk: number | null,
  vehicleMileage: number,
  marketAvgMileage = 60_000
): { estimate: number; adjustmentPct: number; label: string } | null {
  if (!marketAvgAsk || marketAvgAsk === 0) return null;
  const diff = vehicleMileage - marketAvgMileage;
  const direction = diff > 0 ? "above" : "below";
  const steps = Math.floor(Math.abs(diff) / 10_000);
  let rawPct = diff > 0 ? -(steps * 3) : steps * 2;
  rawPct = Math.max(-25, Math.min(10, rawPct));
  const estimate = Math.round(marketAvgAsk * (1 + rawPct / 100));
  const label =
    rawPct === 0
      ? "At market avg mileage"
      : `${Math.abs(rawPct)}% ${rawPct < 0 ? "discount" : "premium"} — ${Math.abs(diff / 1000).toFixed(0)}k mi ${direction} avg`;
  return { estimate, adjustmentPct: rawPct, label };
}

function mdsSignal(mds: number | null) {
  if (mds == null)
    return { label: "Loading…", color: "text-muted-foreground", bg: "bg-muted/30 border-border/40", icon: Minus };
  if (mds <= 30)
    return { label: "Fast Mover", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", icon: TrendingUp };
  if (mds <= 60)
    return { label: "Normal Pace", color: "text-primary", bg: "bg-primary/10 border-primary/25", icon: Activity };
  return { label: "Slow Mover", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/25", icon: TrendingDown };
}

// ── StatPill ───────────────────────────────────────────────────────────────

function StatPill({
  label, value, sub, color = "text-card-foreground", loading, highlight,
}: {
  label: string; value: string; sub?: string;
  color?: string; loading?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 min-w-0 ${highlight ? "rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5 -mx-2" : ""}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">{label}</span>
      {loading ? (
        <Skeleton className="h-5 w-20 mt-0.5" />
      ) : (
        <span className={`text-base font-black tabular-nums leading-none ${color}`}>{value}</span>
      )}
      {sub && !loading && <span className="text-[9px] text-muted-foreground leading-tight">{sub}</span>}
    </div>
  );
}

const COND_LABEL: Record<string, string> = {
  excellent: "Excellent", very_good: "Very Good", good: "Good", fair: "Fair",
};

// ── Main Component ─────────────────────────────────────────────────────────

export default function MarketPulseCard({
  retailMarketStats, dealershipId, bbClassName,
  vehicleYear, vehicleMake, vehicleModel, mileage, currentAcv,
}: MarketPulseCardProps) {
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const statsLoading = retailMarketStats == null;

  useEffect(() => {
    if (!dealershipId || !bbClassName) { setSalesLoading(false); return; }
    (async () => {
      setSalesLoading(true);
      const { data } = await supabase
        .from("submissions")
        .select("id, vehicle_year, vehicle_make, vehicle_model, acv_value, offered_price, appraisal_finalized_at, overall_condition, mileage")
        .eq("dealership_id", dealershipId)
        .eq("appraisal_finalized", true)
        .eq("bb_class_name", bbClassName)
        .order("appraisal_finalized_at", { ascending: false })
        .limit(5);
      setRecentSales((data as RecentSale[]) || []);
      setSalesLoading(false);
    })();
  }, [dealershipId, bbClassName]);

  const mds = retailMarketStats?.market_days_supply ?? null;
  const signal = mdsSignal(mds);
  const SignalIcon = signal.icon;

  const activeMean = retailMarketStats?.active?.mean_price ?? null;
  const soldMean = retailMarketStats?.sold?.mean_price ?? null;
  const activeCount = retailMarketStats?.active?.vehicle_count ?? null;
  const soldCount = retailMarketStats?.sold?.vehicle_count ?? null;
  const meanDaysToTurn = retailMarketStats?.mean_days_to_turn ?? null;

  const spread = activeMean && soldMean ? activeMean - soldMean : null;
  const spreadPct = spread && activeMean ? ((spread / activeMean) * 100).toFixed(1) : null;

  const vehicleMileageNum = parseInt((mileage || "0").replace(/[^0-9]/g, "")) || 0;

  const mileageAdj = calcMileageAdjustedRetail(activeMean, vehicleMileageNum);
  const estRetail = mileageAdj?.estimate ?? null;

  const reconEstimate = 1_000;
  const projGross = estRetail && currentAcv
    ? estRetail - currentAcv - reconEstimate
    : null;

  const storeAcvValues = recentSales
    .map(s => s.acv_value)
    .filter((v): v is number => v != null && v > 0);
  const storeAvgAcv = storeAcvValues.length > 0
    ? Math.round(storeAcvValues.reduce((a, b) => a + b, 0) / storeAcvValues.length)
    : null;

  return (
    <div className="mb-5 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/40">
        <BarChart2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-card-foreground">Market Pulse</span>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {[vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ")}
          {bbClassName ? ` · ${bbClassName}` : ""}
        </span>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${signal.bg} ${signal.color}`}>
          <SignalIcon className="w-3 h-3 shrink-0" />
          {statsLoading
            ? <Skeleton className="h-3 w-20" />
            : <span>{signal.label}{mds != null ? ` · ${mds}d MDS` : ""}</span>
          }
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-3 pb-4 mb-4 border-b border-border/40">
          <StatPill label="Active Listings" value={activeCount != null ? activeCount.toString() : "—"} sub="comps in market" loading={statsLoading} />
          <StatPill label="Avg Asking Price" value={fmt(activeMean)} sub="market retail" loading={statsLoading} />
          <StatPill label="Avg Sold (90d)" value={fmt(soldMean)}
            sub={soldCount != null ? `${soldCount} units` : undefined}
            loading={statsLoading}
            color={soldMean ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}
          />
          <StatPill
            label="Asking → Sold Δ"
            value={spread != null ? `${spread > 0 ? "-" : "+"}${fmt(Math.abs(spread))}` : "—"}
            sub={spreadPct ? `${spreadPct}% discount` : undefined}
            loading={statsLoading}
            color={spread == null ? "text-muted-foreground" : spread > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}
          />
          <StatPill
            label="Avg Days to Turn"
            value={meanDaysToTurn != null ? `${Math.round(meanDaysToTurn)}d` : "—"}
            sub="retail cycle"
            loading={statsLoading}
            color={meanDaysToTurn == null ? "text-muted-foreground" : meanDaysToTurn <= 30 ? "text-emerald-600 dark:text-emerald-400" : meanDaysToTurn <= 60 ? "text-primary" : "text-amber-600"}
          />
          <StatPill
            label="Est. Retail This Unit"
            value={estRetail ? fmt(estRetail) : "—"}
            sub={mileageAdj?.label ?? (vehicleMileageNum > 0 ? `${vehicleMileageNum.toLocaleString()} mi` : "mileage unknown")}
            loading={statsLoading}
            color={estRetail ? "text-primary" : "text-muted-foreground"}
            highlight={!!estRetail}
          />
          <StatPill
            label="Est. Gross This Unit"
            value={projGross != null ? `${projGross >= 0 ? "+" : ""}${fmt(projGross)}` : "—"}
            sub={currentAcv ? `ACV $${currentAcv.toLocaleString()} · recon $${reconEstimate.toLocaleString()}` : undefined}
            loading={statsLoading || !currentAcv}
            color={projGross == null ? "text-muted-foreground" : projGross >= 2000 ? "text-emerald-600 dark:text-emerald-400" : projGross >= 0 ? "text-amber-600" : "text-destructive"}
          />
          <StatPill
            label="Your Store Avg ACV"
            value={storeAvgAcv != null ? fmt(storeAvgAcv) : "—"}
            sub={storeAcvValues.length > 0 ? `${storeAcvValues.length} finalized deal${storeAcvValues.length !== 1 ? "s" : ""}` : "no history yet"}
            loading={salesLoading}
            color={storeAvgAcv ? "text-card-foreground" : "text-muted-foreground"}
          />
        </div>

        {/* Recent Store Sales Table */}
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Your Recent Finalized Deals — Same Class
              </span>
            </div>
            {bbClassName && (
              <span className="text-[9px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{bbClassName}</span>
            )}
          </div>

          {salesLoading ? (
            <div className="p-3 space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          ) : recentSales.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              No finalized deals on record for this vehicle class yet. Populates automatically as appraisals complete.
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <span>Vehicle</span>
                <span className="text-right">Mileage</span>
                <span className="text-right">Condition</span>
                <span className="text-right">ACV</span>
                <span className="text-right">When</span>
              </div>

              {recentSales.map(sale => {
                const condColor =
                  sale.overall_condition === "excellent" ? "text-emerald-600 dark:text-emerald-400"
                  : sale.overall_condition === "very_good" ? "text-primary"
                  : sale.overall_condition === "fair" ? "text-amber-600"
                  : "text-card-foreground";

                const saleMileage = parseInt((sale.mileage || "0").replace(/[^0-9]/g, "")) || 0;
                const isClosestMileageMatch = vehicleMileageNum > 0 && saleMileage > 0
                  && Math.abs(saleMileage - vehicleMileageNum) < 20_000;

                return (
                  <div
                    key={sale.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-[11px] transition-colors items-center ${isClosestMileageMatch ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/20"}`}
                  >
                    <span className="font-semibold text-card-foreground truncate">
                      {[sale.vehicle_year, sale.vehicle_make, sale.vehicle_model].filter(Boolean).join(" ") || "—"}
                      {isClosestMileageMatch && (
                        <span className="ml-1.5 text-[8px] font-bold bg-primary/15 text-primary px-1 py-0.5 rounded">closest mi</span>
                      )}
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {sale.mileage ? `${Number(sale.mileage).toLocaleString()} mi` : "—"}
                    </span>
                    <span className={`text-right font-semibold tabular-nums ${condColor}`}>
                      {COND_LABEL[sale.overall_condition || ""] || sale.overall_condition || "—"}
                    </span>
                    <span className="text-right font-black tabular-nums text-primary">{fmt(sale.acv_value)}</span>
                    <span className="text-right text-muted-foreground tabular-nums whitespace-nowrap">{daysAgo(sale.appraisal_finalized_at)}</span>
                  </div>
                );
              })}

              {storeAvgAcv != null && (
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 bg-primary/5 border-t border-primary/20 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary col-span-3">Store Average ACV</span>
                  <span className="text-right text-base font-black text-primary tabular-nums">{fmt(storeAvgAcv)}</span>
                  <span className="text-right text-[9px] text-muted-foreground">{storeAcvValues.length} deals</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Auto-insight footer */}
        {!statsLoading && (soldMean != null || estRetail != null) && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
            {estRetail && currentAcv && projGross != null ? (
              projGross >= 1500 ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    At <strong className="text-primary">{fmt(currentAcv)}</strong> ACV, this unit estimates{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">{fmt(projGross)} gross</strong> retailing at{" "}
                    <strong className="text-primary">{fmt(estRetail)}</strong> (mileage-adjusted from {fmt(activeMean)} market avg).
                    {mileageAdj && mileageAdj.adjustmentPct < 0 && (
                      <span className="text-muted-foreground"> High mileage adjustment: {mileageAdj.adjustmentPct}%.</span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    At <strong className="text-amber-600">{fmt(currentAcv)}</strong> ACV, estimated gross is only{" "}
                    <strong className="text-amber-600">{fmt(projGross)}</strong> at mileage-adjusted retail of{" "}
                    <strong>{fmt(estRetail)}</strong>. Consider tightening the offer.
                  </p>
                </>
              )
            ) : storeAvgAcv != null && soldMean != null ? (
              storeAvgAcv <= soldMean ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Store avg ACV of <strong className="text-emerald-600 dark:text-emerald-400">{fmt(storeAvgAcv)}</strong> is{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">{fmt(soldMean - storeAvgAcv)} below</strong> the 90-day market sold avg ({fmt(soldMean)}). You're buying right on this class.
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Store avg ACV of <strong className="text-amber-600">{fmt(storeAvgAcv)}</strong> is{" "}
                    <strong className="text-amber-600">{fmt(storeAvgAcv - soldMean)} above</strong> the 90-day market sold avg ({fmt(soldMean)}). Watch margins on this class.
                  </p>
                </>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
