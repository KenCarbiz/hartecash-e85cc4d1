import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Store, Car, Clock, DollarSign, Package, CheckCircle,
  Loader2, BarChart3, HardHat,
} from "lucide-react";
import { InDevelopmentBadge } from "./InDevelopmentBadge";

/* ── types ──────────────────────────────────────────── */

interface WholesaleVehicle {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: string | null;
  overall_condition: string | null;
  exterior_color: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  acv_value: number | null;
  progress_status: string;
  wholesale_listed?: boolean;
}

const ELIGIBLE_STATUSES = ["dead_lead"];

/* ── main component ─────────────────────────────────── */

const WholesaleMarketplace = () => {
  const { tenant } = useTenant();
  const [vehicles, setVehicles] = useState<WholesaleVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, token, created_at, name, vehicle_year, vehicle_make, vehicle_model, mileage, overall_condition, exterior_color, offered_price, estimated_offer_high, acv_value, progress_status"
      )
      .or(`progress_status.in.(${ELIGIBLE_STATUSES.join(",")}),wholesale_listed.eq.true`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load wholesale vehicles");
      setLoading(false);
      return;
    }
    setVehicles((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  /* ── toggle listing ──────────────────────────────── */

  const toggleListing = async (vehicle: WholesaleVehicle) => {
    setTogglingId(vehicle.id);
    const newValue = !vehicle.wholesale_listed;
    const { error } = await supabase
      .from("submissions")
      .update({ wholesale_listed: newValue } as any)
      .eq("id", vehicle.id);

    if (error) {
      toast.error("Failed to update listing status");
      setTogglingId(null);
      return;
    }

    setVehicles((prev) =>
      prev.map((v) =>
        v.id === vehicle.id ? { ...v, wholesale_listed: newValue } : v
      )
    );
    toast.success(newValue ? "Vehicle listed to marketplace" : "Listing removed");
    setTogglingId(null);
  };

  /* ── computed stats ──────────────────────────────── */

  const stats = useMemo(() => {
    const listed = vehicles.filter((v) => v.wholesale_listed);
    const totalListed = listed.length;
    const prices = listed.map((v) => v.acv_value || v.offered_price || v.estimated_offer_high || 0).filter((p) => p > 0);
    const avgAskingPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const daysListed = listed.map((v) => daysSince(v.created_at));
    const avgDaysListed = daysListed.length > 0 ? Math.round(daysListed.reduce((a, b) => a + b, 0) / daysListed.length) : 0;
    return { totalListed, avgAskingPrice, avgDaysListed };
  }, [vehicles]);

  /* ── helpers ──────────────────────────────────────── */

  function daysSince(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  const getAcvValue = (v: WholesaleVehicle) =>
    v.acv_value || v.offered_price || v.estimated_offer_high || 0;

  const vehicleTitle = (v: WholesaleVehicle) =>
    [v.vehicle_year, v.vehicle_make, v.vehicle_model].filter(Boolean).join(" ") || "Unknown Vehicle";

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
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
          <Store className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-card-foreground tracking-tight">
              Wholesale Marketplace
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Store className="w-3.5 h-3.5" />
              Enterprise Beta
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            List vehicles to other dealers when you don't want to keep them
          </p>
        </div>
      </div>

      {/* Enterprise Beta banner */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-4 flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 shrink-0">
          <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-xs leading-relaxed text-blue-900 dark:text-blue-100">
          <p className="font-bold text-blue-700 dark:text-blue-300 text-[11px] uppercase tracking-wider mb-0.5">
            Enterprise Beta · Wholesale Marketplace
          </p>
          <p>
            Mark dead leads as wholesale-ready and route them into the
            inter-dealer network. Your Autocurb Success Manager will
            coordinate the handshake with other dealers in your market —
            contact them to activate cross-dealer listing visibility.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Listed"
          value={stats.totalListed}
          icon={Package}
          color="text-violet-500"
          bg="from-violet-500/15 to-purple-500/5"
        />
        <StatCard
          label="Avg Asking Price"
          value={stats.avgAskingPrice > 0 ? `$${stats.avgAskingPrice.toLocaleString()}` : "--"}
          icon={DollarSign}
          color="text-emerald-500"
          bg="from-emerald-500/15 to-emerald-600/5"
        />
        <StatCard
          label="Avg Days Listed"
          value={stats.avgDaysListed > 0 ? `${stats.avgDaysListed}d` : "--"}
          icon={BarChart3}
          color="text-amber-500"
          bg="from-amber-500/15 to-amber-600/5"
        />
      </div>

      {/* Vehicle Grid */}
      {vehicles.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3 mx-auto">
            <Car className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-card-foreground">
            No wholesale-eligible vehicles
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dead leads and wholesale-marked vehicles will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vehicle) => {
            const acv = getAcvValue(vehicle);
            const days = daysSince(vehicle.created_at);
            const isListed = !!vehicle.wholesale_listed;
            const isToggling = togglingId === vehicle.id;

            return (
              <div
                key={vehicle.id}
                className={`relative bg-card rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                  isListed
                    ? "border-violet-300 dark:border-violet-700"
                    : "border-border"
                }`}
              >
                {/* Listed Badge */}
                {isListed && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0 text-[10px] gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Listed
                    </Badge>
                  </div>
                )}

                {/* Vehicle Photo Placeholder */}
                <div className="bg-gradient-to-br from-muted/60 to-muted/30 px-6 py-8 flex items-center justify-center">
                  <Car className="w-12 h-12 text-muted-foreground/30" />
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-card-foreground leading-tight">
                      {vehicleTitle(vehicle)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {vehicle.mileage && (
                        <span className="text-[11px] text-muted-foreground">
                          {Number(vehicle.mileage).toLocaleString()} mi
                        </span>
                      )}
                      {vehicle.mileage && vehicle.overall_condition && (
                        <span className="text-muted-foreground/40">&middot;</span>
                      )}
                      {vehicle.overall_condition && (
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {vehicle.overall_condition}
                        </span>
                      )}
                      {vehicle.exterior_color && (
                        <>
                          <span className="text-muted-foreground/40">&middot;</span>
                          <span className="text-[11px] text-muted-foreground capitalize">
                            {vehicle.exterior_color}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ACV / Price */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        ACV / Appraisal
                      </p>
                      {acv > 0 ? (
                        <p className="text-lg font-black text-card-foreground">
                          ${acv.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-lg font-black text-muted-foreground">--</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        Days Listed
                      </p>
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <p className={`text-lg font-black ${days > 14 ? "text-amber-600 dark:text-amber-400" : "text-card-foreground"}`}>
                          {days}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleListing(vehicle)}
                    disabled={isToggling}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                      isListed
                        ? "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-card-foreground"
                    } ${isToggling ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isListed ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Store className="w-3.5 h-3.5" />
                    )}
                    {isListed ? "Remove from Marketplace" : "List to Marketplace"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Stat Card ──────────────────────────────────────── */

function StatCard({
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

export default WholesaleMarketplace;
