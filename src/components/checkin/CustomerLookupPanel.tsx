import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Car, Phone, Mail, Loader2, X } from "lucide-react";

/**
 * CustomerLookupPanel — receptionist-friendly multi-field search that
 * finds existing submissions by name, phone, email, or last-6 VIN.
 *
 * Used on /inspection-checkin so the front desk can greet a walk-in,
 * type whatever the customer hands them (phone on the screen, name
 * badge, appointment confirmation email), and pick the right record.
 *
 * Returns matches via `onPick` so the parent can route — open the
 * inspection, alert the sales rep, or send to the appraiser queue.
 */

interface Match {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  progress_status: string | null;
  assigned_rep_email: string | null;
}

interface Props {
  onPick: (match: Match) => void;
}

const LAST6_RE = /^[A-HJ-NPR-Z0-9]{6}$/i;

const CustomerLookupPanel = ({ onPick }: Props) => {
  const { tenant } = useTenant();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, tenant.dealership_id]);

  const runSearch = async (q: string) => {
    setLoading(true);
    // Last-6 VIN is a precise match — prefer it. Otherwise do a loose
    // OR across name/phone/email using ilike so the receptionist can
    // type part of any field (first name, last 4 of phone, prefix of
    // email) and still get the hit.
    let builder = supabase
      .from("submissions")
      .select("id, name, phone, email, vin, vehicle_year, vehicle_make, vehicle_model, progress_status, assigned_rep_email")
      .eq("dealership_id", tenant.dealership_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (LAST6_RE.test(q)) {
      builder = builder.ilike("vin", `%${q.toUpperCase()}`);
    } else {
      const digitsOnly = q.replace(/\D/g, "");
      const esc = q.replace(/[%_]/g, (m) => `\\${m}`);
      const orParts: string[] = [
        `name.ilike.%${esc}%`,
        `email.ilike.%${esc}%`,
      ];
      if (digitsOnly.length >= 3) {
        orParts.push(`phone.ilike.%${digitsOnly}%`);
      }
      builder = builder.or(orParts.join(","));
    }

    const { data, error } = await builder;
    setLoading(false);
    setHasSearched(true);
    if (error) {
      console.warn("CustomerLookupPanel search error:", error);
      setResults([]);
      return;
    }
    setResults((data as any) || []);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
  };

  return (
    <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground">Find a customer</h3>
          <p className="text-xs text-muted-foreground">Search by name, phone, email, or last 6 of VIN</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Jane Smith · 555-1234 · jane@ · VIN456"
          className="h-12 text-base pl-9 pr-10"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Clear"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No matches. Double-check the spelling or try a different field.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="w-full text-left rounded-xl border border-border bg-background/60 hover:bg-muted/40 hover:border-primary/40 transition-colors p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-card-foreground truncate">{r.name || "Unknown customer"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                    {r.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <Car className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {[r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "No vehicle on file"}
                      {r.vin ? ` · ${r.vin.slice(-6)}` : ""}
                    </span>
                  </div>
                </div>
                {r.progress_status && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5">
                    {r.progress_status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default CustomerLookupPanel;
