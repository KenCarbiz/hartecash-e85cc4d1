import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, RotateCcw, Clock } from "lucide-react";
import type { Submission } from "@/lib/adminConstants";

/**
 * Sales Manager Dispatch — item 23 of the May-2026 audit.
 *
 * The "what's waiting on me" view a sales manager opens before each
 * lap of the floor. Three buckets, all driven off the same submissions
 * pull so a refresh updates every count consistently:
 *
 *   1. Declined — needs counter
 *      progress_status='offer_declined' OR a customer_walk_away_number
 *      above the current offer. Manager opens the file → SaveTheDeal
 *      action button (item 11) bumps the offer.
 *
 *   2. Flagged for review
 *      needs_appraisal=true AND acv_value IS NULL. Appraiser already
 *      flagged it; manager needs to weigh in before it goes back.
 *
 *   3. Stale offers
 *      offered_price>0, status not in any accepted/final state, and
 *      status_updated_at older than the dealer's stale threshold (1h
 *      default — same as AppraiserQueue's STALE_OFFER_HOURS).
 *
 * Click any row → opens the customer file via the parent's
 * onOpenSubmission callback. Today the panel reads the dealership's
 * full open submissions; future iteration could move to the
 * v_appraiser_queue / v_dispatch view (item 27 follow-up).
 */

const STALE_HOURS = 1;
const ACCEPTED_OR_FINAL = new Set([
  "offer_accepted", "price_agreed", "deal_finalized",
  "title_ownership_verified", "check_request_submitted",
  "purchase_complete", "dead_lead", "partial",
]);

interface DispatchRow {
  id: string;
  name: string | null;
  vehicle: string;
  offered_price: number | null;
  walk_away: number | null;
  declined_reason: string | null;
  age_hours: number;
}

interface SalesManagerDispatchProps {
  onOpenSubmission?: (id: string) => void;
}

const fmtAge = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
};

const fmtMoney = (n: number | null) =>
  n == null ? "—" : `$${n.toLocaleString()}`;

const buildRow = (s: Submission): DispatchRow => {
  const ts = (s.status_updated_at as string | undefined) || s.created_at;
  return {
    id: s.id,
    name: s.name,
    vehicle: [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "—",
    offered_price: s.offered_price as number | null,
    walk_away: (s as Submission & { customer_walk_away_number?: number | null }).customer_walk_away_number ?? null,
    declined_reason: s.declined_reason as string | null,
    age_hours: ts ? (Date.now() - new Date(ts).getTime()) / 3_600_000 : 0,
  };
};

const SalesManagerDispatch = ({ onOpenSubmission }: SalesManagerDispatchProps) => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, name, vehicle_year, vehicle_make, vehicle_model, offered_price, customer_walk_away_number, declined_reason, progress_status, needs_appraisal, acv_value, status_updated_at, created_at",
        )
        .eq("dealership_id", tenant.dealership_id)
        .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .limit(500);
      if (cancelled) return;
      setRows((data as never as Submission[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  const buckets = useMemo(() => {
    const declined: DispatchRow[] = [];
    const flagged: DispatchRow[] = [];
    const stale: DispatchRow[] = [];

    for (const s of rows) {
      if (ACCEPTED_OR_FINAL.has(s.progress_status as string)) continue;

      const offered = (s.offered_price as number | null) || 0;
      const walkAway = (s as Submission & { customer_walk_away_number?: number | null }).customer_walk_away_number || 0;

      // Bucket 1 — declined or has a walk-away above the current offer.
      if (
        s.progress_status === "offer_declined" ||
        (walkAway > 0 && walkAway > offered)
      ) {
        declined.push(buildRow(s));
        continue;
      }

      // Bucket 2 — appraiser flagged.
      if ((s as Submission & { needs_appraisal?: boolean }).needs_appraisal && s.acv_value == null) {
        flagged.push(buildRow(s));
        continue;
      }

      // Bucket 3 — stale offer.
      const ts = (s.status_updated_at as string | undefined) || s.created_at;
      const ageMs = ts ? Date.now() - new Date(ts).getTime() : 0;
      if (offered > 0 && ageMs > STALE_HOURS * 60 * 60 * 1000) {
        stale.push(buildRow(s));
      }
    }

    // Oldest first — the manager works from the most overdue down.
    declined.sort((a, b) => b.age_hours - a.age_hours);
    flagged.sort((a, b) => b.age_hours - a.age_hours);
    stale.sort((a, b) => b.age_hours - a.age_hours);
    return { declined, flagged, stale };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = buckets.declined.length + buckets.flagged.length + buckets.stale.length;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Manager dispatch</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                What's waiting on you. Three buckets, oldest first. Click any row to open the customer file — Save-the-deal and Open Appraisal actions are pinned on the file's action bar.
              </p>
            </div>
            <Badge variant="outline" className="text-micro">
              {total} {total === 1 ? "lead" : "leads"}
            </Badge>
          </div>

          <DispatchBucket
            title="Declined — needs counter"
            tone="destructive"
            icon={AlertTriangle}
            rows={buckets.declined}
            onOpen={onOpenSubmission}
            empty="No declined offers waiting. Either everything's been countered or the BDC is keeping up."
            renderRight={(r) => r.walk_away ? `walk-away ${fmtMoney(r.walk_away)}` : (r.declined_reason || "declined")}
          />

          <DispatchBucket
            title="Flagged for review"
            tone="warning"
            icon={RotateCcw}
            rows={buckets.flagged}
            onOpen={onOpenSubmission}
            empty="No leads flagged for your review. The appraiser hasn't escalated anything."
            renderRight={(r) => r.offered_price ? `current ${fmtMoney(r.offered_price)}` : "no offer yet"}
          />

          <DispatchBucket
            title="Stale offers"
            tone="info"
            icon={Clock}
            rows={buckets.stale}
            onOpen={onOpenSubmission}
            empty="No stale offers. Every active offer has moved within the last hour."
            renderRight={(r) => `${fmtMoney(r.offered_price)} · ${fmtAge(r.age_hours)}`}
          />
        </CardContent>
      </Card>
    </div>
  );
};

interface DispatchBucketProps {
  title: string;
  tone: "destructive" | "warning" | "info";
  icon: React.ElementType;
  rows: DispatchRow[];
  empty: string;
  onOpen?: (id: string) => void;
  renderRight: (row: DispatchRow) => string;
}

function DispatchBucket({ title, tone, icon: Icon, rows, empty, onOpen, renderRight }: DispatchBucketProps) {
  const toneCls = tone === "destructive"
    ? "text-destructive"
    : tone === "warning"
      ? "text-warning"
      : "text-info";
  return (
    <section className="mt-5 first:mt-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${toneCls}`} />
        <h4 className={`text-micro font-bold uppercase tracking-wider ${toneCls}`}>
          {title}
        </h4>
        <Badge variant="outline" className="text-micro">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{empty}</p>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border bg-card">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen?.(r.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {r.name || "Unnamed"} · {r.vehicle}
                  </div>
                  <div className="text-micro text-muted-foreground mt-0.5">
                    {fmtAge(r.age_hours)} ago · {renderRight(r)}
                  </div>
                </div>
                <span className="text-micro font-bold text-info shrink-0">Open</span>
              </button>
            </li>
          ))}
          {rows.length > 8 && (
            <li className="px-3 py-2 text-micro text-muted-foreground italic">
              + {rows.length - 8} more — open All Leads to see the full bucket.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export default SalesManagerDispatch;
