import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, MessageSquare, Flame, Clock, RefreshCw } from "lucide-react";
import { scoreBdcLead, type ScoreInputs } from "@/lib/bdcLeadScore";
import { formatPhone } from "@/lib/utils";

/**
 * BDCPriorityQueue — the "who should I call NEXT?" list for BDC reps.
 * Replaces chronological "all leads" scanning with a deterministic
 * score-ranked view.
 *
 * Pulls open leads for the current dealership (not purchased, not
 * lost, not already booked unless scoring decides otherwise), runs
 * each through scoreBdcLead, groups by band (now / today / later /
 * cold), and renders action affordances per row (tel:, sms:, open
 * customer file).
 *
 * Role-gated at the sidebar level — shown to sales_bdc,
 * internet_manager, and admin. Sales reps get the regular lead list.
 */

interface Lead extends ScoreInputs {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  dealership_id: string | null;
}

const BAND_ORDER = ["now", "today", "later", "cold"] as const;
const BAND_LABEL: Record<string, string> = {
  now: "Call now",
  today: "Today",
  later: "Later this week",
  cold: "Cold / closed",
};
const BAND_COLOR: Record<string, string> = {
  now: "bg-destructive/10 border-destructive/40 text-destructive",
  today: "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400",
  later: "bg-muted border-border text-muted-foreground",
  cold: "bg-muted/50 border-border text-muted-foreground/70",
};

const BDCPriorityQueue = ({ onOpenSubmission }: { onOpenSubmission?: (id: string) => void }) => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, dealership_id, created_at, offered_price, estimated_offer_high, appointment_set, progress_status, declined_reason, customer_walk_away_number, competitor_mentioned, portal_view_count, hot_followup_2h_sent_at"
        )
        .eq("dealership_id", tenant.dealership_id)
        .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .limit(300);
      if (!cancelled) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id, refreshTick]);

  const scored = useMemo(() => {
    return rows
      .map((lead) => ({ lead, result: scoreBdcLead(lead) }))
      .sort((a, b) => b.result.score - a.result.score);
  }, [rows]);

  const grouped = useMemo(() => {
    const map: Record<string, { lead: Lead; result: ReturnType<typeof scoreBdcLead> }[]> = {
      now: [], today: [], later: [], cold: [],
    };
    for (const entry of scored) {
      map[entry.result.band].push(entry);
    }
    return map;
  }, [scored]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Flame className="w-5 h-5 text-destructive" /> BDC Priority Queue
          </h2>
          <p className="text-xs text-muted-foreground">
            Score-ranked next-best lead. Higher bands need a call now.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshTick((n) => n + 1)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Scoring leads…
        </div>
      )}

      {!loading && BAND_ORDER.map((band) => {
        const list = grouped[band];
        if (list.length === 0) return null;
        return (
          <Card key={band}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-md px-2 py-1 border ${BAND_COLOR[band]}`}>
                  <Clock className="w-3 h-3" /> {BAND_LABEL[band]}
                </span>
                <span className="text-xs text-muted-foreground">{list.length} leads</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {list.slice(0, band === "cold" ? 10 : 50).map(({ lead, result }) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-border bg-background/60 hover:bg-muted/30 transition-colors p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-card-foreground truncate">{lead.name || "Unnamed"}</span>
                      <Badge variant="secondary" className="text-[10px]">{result.score}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {[lead.vehicle_year, lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(" ")}
                      {lead.offered_price || lead.estimated_offer_high
                        ? ` · $${Number(lead.offered_price || lead.estimated_offer_high).toLocaleString()}`
                        : ""}
                    </div>
                    {result.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {result.reasons.slice(0, 4).map((r, i) => (
                          <span key={i} className="text-[10px] text-muted-foreground bg-muted/50 border border-border/60 rounded-full px-1.5 py-0.5">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {lead.phone && (
                      <div className="flex gap-1">
                        <a href={`tel:${lead.phone}`} aria-label="Call">
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0"><Phone className="w-3.5 h-3.5" /></Button>
                        </a>
                        <a href={`sms:${lead.phone}`} aria-label="Text">
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0"><MessageSquare className="w-3.5 h-3.5" /></Button>
                        </a>
                      </div>
                    )}
                    {onOpenSubmission && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenSubmission(lead.id)}
                        className="h-7 text-[11px] text-muted-foreground"
                      >
                        Open file
                      </Button>
                    )}
                    {lead.phone && (
                      <span className="text-[10px] text-muted-foreground">{formatPhone(lead.phone)}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {!loading && scored.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No open leads to score. Quiet day at the desk.
        </div>
      )}
    </div>
  );
};

export default BDCPriorityQueue;
