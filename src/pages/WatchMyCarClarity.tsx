import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Clarity-tier "Watch my car" tracker — Apple-minimal companion to
 * the legacy WatchMyCar page. Mounted by WatchMyCar.tsx as a
 * top-level dispatch when landing_template === "clarity". Same
 * watched_vehicles table reads + togglePref writes as legacy.
 */

interface Watched {
  id: string;
  token: string;
  customer_name: string | null;
  vin: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage_at_save: number;
  baseline_value: number;
  current_value: number;
  delta_since_baseline: number;
  last_checked_at: string | null;
  next_check_at: string;
  notify_email: boolean;
  notify_sms: boolean;
  is_active: boolean;
  created_at: string;
  submission_id: string | null;
  dealership_id: string;
}

interface HistoryRow {
  id: string;
  snapshot_value: number;
  delta_from_previous: number;
  checked_at: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const WatchMyCarClarity = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const [watched, setWatched] = useState<Watched | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data: w } = await supabase
        .from("watched_vehicles" as any)
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (cancelled) return;
      setWatched(((w as unknown) as Watched) || null);
      if (w) {
        const { data: h } = await supabase
          .from("watched_vehicle_history" as any)
          .select("id, snapshot_value, delta_from_previous, checked_at")
          .eq("watched_vehicle_id", (w as any).id)
          .order("checked_at", { ascending: false })
          .limit(12);
        if (!cancelled) setHistory(((h as unknown) as HistoryRow[]) || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const togglePref = async (field: "notify_email" | "notify_sms" | "is_active", value: boolean) => {
    if (!watched) return;
    setSaving(true);
    const { error } = await supabase
      .from("watched_vehicles" as any)
      .update({ [field]: value, updated_at: new Date().toISOString() } as any)
      .eq("token", watched.token);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    setWatched({ ...watched, [field]: value });
    toast({ title: field === "is_active" && !value ? "Tracking stopped" : "Saved" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" aria-hidden="true" />
      </div>
    );
  }

  if (!watched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Tracker not found</h1>
          <p className="text-sm text-zinc-500">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const vehicleStr = [watched.vehicle_year, watched.vehicle_make, watched.vehicle_model].filter(Boolean).join(" ");
  const isUp = watched.delta_since_baseline > 0;
  const isDown = watched.delta_since_baseline < 0;
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : TrendingUp;
  const trendClass = isUp ? "text-emerald-600" : isDown ? "text-red-600" : "text-zinc-500";

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.dealership_name} className="h-16 md:h-20 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">{config.dealership_name}</span>
            )}
          </Link>
          {config.phone && (
            <a
              href={`tel:${config.phone}`}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {config.phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 md:px-8 py-10 md:py-14 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {watched.customer_name ? `Tracking for ${watched.customer_name.split(" ")[0]}` : "Your tracker"}
          </p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            {vehicleStr}
          </h1>
        </motion.section>

        {/* Big number + trend */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-zinc-200 bg-zinc-50/40 p-8 md:p-10 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
            Current estimated value
          </p>
          <p className="font-sans text-[64px] md:text-[88px] font-bold tracking-[-0.035em] leading-[1] text-zinc-900 tabular-nums">
            {fmt(watched.current_value || watched.baseline_value)}
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-4 font-semibold text-sm ${trendClass}`}>
            <TrendIcon className="w-4 h-4" aria-hidden="true" />
            {watched.delta_since_baseline === 0
              ? "No change yet"
              : `${isUp ? "+" : ""}${fmt(watched.delta_since_baseline)} since you saved`}
          </div>
          <p className="text-[11px] text-zinc-500 mt-3">
            Baseline: {fmt(watched.baseline_value)} · saved {new Date(watched.created_at).toLocaleDateString()}
          </p>
        </motion.section>

        {/* History */}
        {history.length > 0 && (
          <section className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="px-6 py-5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold tracking-tight">History</h2>
            </div>
            <ul className="divide-y divide-zinc-100">
              {history.map((row) => (
                <li key={row.id} className="px-6 py-3.5 flex items-center justify-between text-sm">
                  <span className="text-zinc-600">
                    {new Date(row.checked_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-semibold text-zinc-900 tabular-nums">{fmt(row.snapshot_value)}</span>
                  {row.delta_from_previous !== 0 && (
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        row.delta_from_previous > 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {row.delta_from_previous > 0 ? "+" : ""}
                      {fmt(row.delta_from_previous)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Notification preferences */}
        <section className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-5 space-y-4">
          <h2 className="text-sm font-semibold tracking-tight">Notifications</h2>
          <PrefRow
            label="Email me when value changes"
            value={watched.notify_email}
            onChange={(v) => togglePref("notify_email", v)}
            disabled={saving}
          />
          <PrefRow
            label="Text me when value changes"
            value={watched.notify_sms}
            onChange={(v) => togglePref("notify_sms", v)}
            disabled={saving}
          />
          <div className="border-t border-zinc-100 pt-4">
            <PrefRow
              label="Keep tracking this vehicle"
              value={watched.is_active}
              onChange={(v) => togglePref("is_active", v)}
              disabled={saving}
            />
          </div>
        </section>

        <p className="text-[11px] text-zinc-400 text-center">
          Tracker updates monthly. Stop tracking any time.
        </p>
      </main>
    </div>
  );
};

const PrefRow = ({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-sm text-zinc-700">{label}</span>
    <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

export default WatchMyCarClarity;
