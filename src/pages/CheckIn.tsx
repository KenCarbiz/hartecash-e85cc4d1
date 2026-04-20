import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ScanLine, Hash, Car, ArrowRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

/**
 * /checkin — fast lot check-in kiosk. Sales or inspectors enter the last
 * 6 of the VIN (or open the camera scanner) and we jump straight to the
 * matched submission's inspection page. No login, no creating new
 * submissions — that lives on /inspection-checkin which we link to as a
 * fallback for "no match" + full-VIN scanning.
 */

interface Match {
  id: string;
  name: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  progress_status: string | null;
  created_at: string | null;
}

const LAST6_RE = /^[A-HJ-NPR-Z0-9]{6}$/;

const CheckIn = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [last6, setLast6] = useState("");
  const [looking, setLooking] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);

  const handleLookup = async (e?: FormEvent) => {
    e?.preventDefault();
    const normalized = last6.trim().toUpperCase();
    if (!LAST6_RE.test(normalized)) {
      toast({
        title: "Enter the last 6",
        description: "Six letters and numbers — no I, O, or Q.",
        variant: "destructive",
      });
      return;
    }

    setLooking(true);
    setMatches(null);
    const { data, error } = await supabase
      .from("submissions")
      .select("id, name, vin, vehicle_year, vehicle_make, vehicle_model, progress_status, created_at")
      .ilike("vin", `%${normalized}`)
      .eq("dealership_id", tenant.dealership_id)
      .order("created_at", { ascending: false })
      .limit(5);
    setLooking(false);

    if (error) {
      toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
      return;
    }

    const rows = (data as Match[]) || [];
    if (rows.length === 0) {
      setMatches([]);
      return;
    }
    if (rows.length === 1) {
      // Single hit — jump straight to the inspection page
      navigate(`/inspection/${rows[0].id}`);
      return;
    }
    // Multiple hits — show a disambiguation list
    setMatches(rows);
  };

  const vehicleLine = (m: Match) =>
    [m.vehicle_year, m.vehicle_make, m.vehicle_model].filter(Boolean).join(" ") || "Vehicle on file";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary via-primary/95 to-primary/80 flex flex-col">
      <SEO title="Inspection Check-In" description="Scan a VIN or enter the last 6 to open the customer's inspection." path="/checkin" />

      <header className="px-5 pt-8 pb-4 text-primary-foreground text-center">
        <div className="inline-flex items-center gap-2 bg-primary-foreground/10 border border-primary-foreground/20 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em]">
          <ScanLine className="w-3 h-3" /> Check-In
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-4">
          Scan a VIN or enter the last 6
        </h1>
        <p className="text-primary-foreground/75 text-sm mt-2">
          We'll pull up the customer's inspection in one tap.
        </p>
      </header>

      <main className="flex-1 px-5 pb-10">
        <div className="max-w-lg mx-auto space-y-4">
          {/* ── Primary: last 6 entry ── */}
          <form
            onSubmit={handleLookup}
            className="bg-card rounded-2xl shadow-2xl border border-border/50 p-6 space-y-4"
          >
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5 mb-2">
                <Hash className="w-3.5 h-3.5" /> Last 6 of VIN
              </label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoFocus
                value={last6}
                onChange={(e) => setLast6(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="e.g. 23A1B5"
                className="w-full text-center text-3xl md:text-4xl font-mono font-bold tracking-[0.35em] tabular-nums bg-muted/40 border-2 border-border rounded-xl py-4 px-4 focus:outline-none focus:border-primary transition-colors uppercase"
              />
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Found on the bottom of the windshield or door-jamb sticker.
              </p>
            </div>
            <button
              type="submit"
              disabled={!LAST6_RE.test(last6) || looking}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {looking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Looking up…
                </>
              ) : (
                <>
                  Open Inspection
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* ── Secondary: camera scanner (jumps to the full scanner screen) ── */}
          <button
            type="button"
            onClick={() => navigate("/inspection-checkin")}
            className="w-full bg-primary-foreground/10 hover:bg-primary-foreground/15 backdrop-blur border border-primary-foreground/25 text-primary-foreground font-bold text-base py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <ScanLine className="w-5 h-5" />
            Open VIN scanner
          </button>

          {/* ── Matches panel ── */}
          {matches && matches.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-100 rounded-2xl p-5 space-y-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">No matching submission</p>
                  <p className="text-sm opacity-90 mt-0.5">
                    No customer on file with a VIN ending in <span className="font-mono font-bold">{last6}</span>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/inspection-checkin")}
                className="w-full mt-2 bg-amber-500 hover:bg-amber-500/90 text-amber-950 font-bold text-sm py-2.5 rounded-xl"
              >
                Start a new check-in
              </button>
            </div>
          )}

          {matches && matches.length > 1 && (
            <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Multiple matches — pick the right one
              </p>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/inspection/${m.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-card-foreground truncate">
                          {vehicleLine(m)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m.name || "Unknown customer"}
                          {m.vin && <span className="font-mono ml-2 opacity-70">· {m.vin.slice(-6)}</span>}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="px-5 py-4 text-center text-[10px] text-primary-foreground/50">
        Can't find the VIN? Tap <span className="font-semibold">Open VIN scanner</span> for full scan + new-customer start.
      </footer>
    </div>
  );
};

export default CheckIn;
