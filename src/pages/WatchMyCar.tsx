import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Bell, BellOff, Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

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

const WatchMyCar = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const [watched, setWatched] = useState<Watched | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: w } = await supabase
        .from("watched_vehicles" as any)
        .select("*")
        .eq("token", token)
        .maybeSingle();
      setWatched(((w as unknown) as Watched) || null);
      if (w) {
        const { data: h } = await supabase
          .from("watched_vehicle_history" as any)
          .select("id, snapshot_value, delta_from_previous, checked_at")
          .eq("watched_vehicle_id", (w as any).id)
          .order("checked_at", { ascending: false })
          .limit(12);
        setHistory(((h as unknown) as HistoryRow[]) || []);
      }
      setLoading(false);
    })();
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!watched) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-2">Tracker not found</h1>
          <p className="text-sm text-muted-foreground">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const vehicleStr = [watched.vehicle_year, watched.vehicle_make, watched.vehicle_model].filter(Boolean).join(" ");
  const isUp = watched.delta_since_baseline > 0;
  const isDown = watched.delta_since_baseline < 0;
  const TrendIcon = isUp ? ArrowUp : isDown ? ArrowDown : TrendingUp;
  const trendClass = isUp ? "text-success" : isDown ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="text-base font-bold">Your car tracker</h1>
            <p className="text-[11px] text-muted-foreground">{vehicleStr}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Headline value */}
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Current estimated value</p>
          <p className="text-5xl font-extrabold tracking-tight tabular-nums">
            {fmt(watched.current_value || watched.baseline_value)}
          </p>
          <div className={`inline-flex items-center gap-1 mt-3 font-bold text-sm ${trendClass}`}>
            <TrendIcon className="w-4 h-4" />
            {watched.delta_since_baseline === 0
              ? "No change yet"
              : `${isUp ? "+" : ""}${fmt(watched.delta_since_baseline)} since you saved`}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Baseline: {fmt(watched.baseline_value)} · saved {new Date(watched.created_at).toLocaleDateString()}
          </p>

          {watched.submission_id && (
            <Link
              to={`/my-submission/${watched.submission_id}`}
              className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-full transition-colors"
            >
              Sell now <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Value history</h2>
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              We haven't checked yet. The first snapshot lands within 7 days.
            </div>
          ) : (
            <ol className="space-y-2">
              {history.map((h) => {
                const up = h.delta_from_previous > 0;
                const down = h.delta_from_previous < 0;
                return (
                  <li key={h.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <div>
                      <div className="font-bold tabular-nums">{fmt(h.snapshot_value)}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(h.checked_at).toLocaleDateString()}</div>
                    </div>
                    <div className={`text-sm font-semibold ${up ? "text-success" : down ? "text-destructive" : "text-muted-foreground"}`}>
                      {h.delta_from_previous === 0 ? "—" : `${up ? "+" : ""}${fmt(h.delta_from_previous)}`}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Notification preferences */}
        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> When to notify you
          </h2>
          <div className="flex items-center justify-between text-sm">
            <span>Email me when value changes</span>
            <Switch checked={watched.notify_email} disabled={saving} onCheckedChange={(v) => togglePref("notify_email", v)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Text me when value changes</span>
            <Switch checked={watched.notify_sms} disabled={saving} onCheckedChange={(v) => togglePref("notify_sms", v)} />
          </div>
        </section>

        {/* Stop tracking */}
        <section className="text-center">
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => togglePref("is_active", false)} className="text-muted-foreground hover:text-destructive">
            <BellOff className="w-4 h-4 mr-1.5" /> Stop tracking this car
          </Button>
        </section>
      </main>
    </div>
  );
};

export default WatchMyCar;
