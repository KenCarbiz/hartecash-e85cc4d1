import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, User } from "lucide-react";

type SubmissionRow = {
  id: string;
  token: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  dealership_id: string;
  store_location_id: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  status: string | null;
  offered_price: number | null;
  created_at: string;
};

interface Props {
  /** dealership_id → display_name. Used to label rooftop badges. */
  dealershipNames: Map<string, string>;
}

const DEBOUNCE_MS = 300;

/**
 * Group-wide customer search across every rooftop in the selected
 * dealer group. Live debounced search against submissions, scoped
 * to the group's dealership_ids by RLS — a group admin can see
 * any rooftop's leads, but a single-rooftop staff member can't
 * see sister rooftops.
 *
 * Hits these columns: name (ilike), email (ilike), phone (ilike),
 * vehicle_make + vehicle_model concatenated.
 *
 * Returns up to 25 results, sorted most-recent-first.
 *
 * Audit context: Tekion-benchmark feature. A 30-rooftop group's
 * BDC manager should be able to search "Smith Toyota Hartford"
 * and find them across every store without filing a ticket.
 */
const GroupCustomerSearch = ({ dealershipNames }: Props) => {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [results, setResults] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const dealershipIds = useMemo(() => Array.from(dealershipNames.keys()), [dealershipNames]);

  useEffect(() => {
    if (!debouncedQ || debouncedQ.length < 2) {
      setResults([]);
      return;
    }
    if (dealershipIds.length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const term = debouncedQ;
      // Build OR predicate. Postgrest .or() syntax: comma-separated.
      // Wrap each substring with %...% for ilike.
      const escaped = term.replace(/[%,]/g, "");
      const orClause = [
        `name.ilike.%${escaped}%`,
        `email.ilike.%${escaped}%`,
        `phone.ilike.%${escaped}%`,
        `vehicle_make.ilike.%${escaped}%`,
        `vehicle_model.ilike.%${escaped}%`,
      ].join(",");

      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, token, name, email, phone, dealership_id, store_location_id, vehicle_year, vehicle_make, vehicle_model, progress_status, offered_price, created_at",
        )
        .in("dealership_id", dealershipIds)
        .or(orClause)
        .order("created_at", { ascending: false })
        .limit(25);

      if (cancelled) return;
      if (error) {
        console.warn("Group customer search failed:", error.message);
        setResults([]);
      } else {
        setResults((data as SubmissionRow[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, dealershipIds]);

  return (
    <div className="border border-border rounded-xl bg-card">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          Search across all rooftops
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Find a customer in any of this group's stores by name, email, phone, or vehicle.
        </p>
      </div>
      <div className="px-5 py-3 border-b border-border">
        <Input
          aria-label="Search customers across group"
          placeholder="Smith / 860-555-0100 / 2018 Honda CR-V"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9"
        />
      </div>
      {loading && (
        <div aria-busy="true" aria-label="Searching customers" className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && debouncedQ.length >= 2 && results.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No customers match "{debouncedQ}" in this group.
        </div>
      )}
      {!loading && debouncedQ.length < 2 && q.length > 0 && (
        <div className="px-5 py-3 text-[11px] text-muted-foreground">
          Type at least 2 characters.
        </div>
      )}
      {!loading && results.length > 0 && (
        <ol className="divide-y divide-border">
          {results.map((r) => {
            const rooftop = dealershipNames.get(r.dealership_id) || r.dealership_id;
            const vehicle = [r.vehicle_year, r.vehicle_make, r.vehicle_model]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={r.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.name || "—"}</span>
                    <Badge variant="outline" className="text-[10px]">{rooftop}</Badge>
                    {r.status && (
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {[r.email, r.phone].filter(Boolean).join(" · ")}
                    {vehicle && <> · {vehicle}</>}
                    {r.offered_price && <> · ${r.offered_price.toLocaleString()}</>}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                    {new Date(r.created_at).toLocaleDateString()} · {r.id.slice(0, 8)}
                  </div>
                </div>
                <a
                  href={`/admin?section=submissions&submission=${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                  aria-label={`Open ${r.name || "customer"} in admin`}
                >
                  Open
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default GroupCustomerSearch;
