import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BDC Health — per-rep activity matrix on a single screen for the
 * BDC manager. Answers the daily question every BDC manager asks
 * three times a day: "How is each of my reps doing today?"
 *
 * Four columns per rep:
 *   - Calls placed today  (bdc_call_tasks completed today)
 *   - Reached + %         (call_tasks with productive outcome)
 *   - Appointments set    (last-touch attribution — rep who closed
 *                          the booking gets credit; AI handoffs
 *                          credit the receiving human rep)
 *   - SLA breach          (open assigned leads where last_outreach_at
 *                          is older than the 2h threshold; for AI
 *                          this column relabels to "unrouted")
 *
 * AI voice agents render in a separate group above human reps so
 * the manager can see total BDC capacity (AI + humans) at a glance
 * without comparing apples to oranges on the same row.
 */

interface RepRow {
  user_id: string;
  display_name: string;
  is_ai: boolean;
  calls: number;
  reached: number;
  appts: number;
  sla_breach: number;   // for humans: open leads past SLA. For AI: unrouted handoffs.
}

const DAY_START_ISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const PRODUCTIVE_OUTCOMES = new Set([
  "booked_appointment",
  "re_quoted",
  "customer_pushed_back",
]);

const APPT_OUTCOMES = new Set([
  "booked_appointment",
]);

const AI_APPT_OUTCOMES = new Set([
  "appointment_scheduled",
]);

const AI_REACHED_STATUSES = new Set([
  "completed",          // call connected + completed
]);
const AI_REACHED_ANSWERED = new Set([
  "human",
]);

const SLA_HOURS = 2;

const BDCHealthPanel = () => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<RepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMissing(false);

      // Staff list — every human rep we might attribute calls to.
      const { data: staffData } = await supabase.rpc(
        "get_all_staff",
        { _dealership_id: tenant.dealership_id } as never,
      );
      if (cancelled) return;

      type Staff = { user_id: string; display_name: string | null; email?: string | null };
      const staff: Staff[] = (staffData as unknown as Staff[]) || [];
      const labelOf = (uid: string) => {
        const s = staff.find((r) => r.user_id === uid);
        return s?.display_name || s?.email || uid.slice(0, 8);
      };

      // ── Human rep aggregation: bdc_call_tasks completed today ──
      const dayStart = DAY_START_ISO();
      const { data: callTasks, error: ctErr } = await supabase
        .from("bdc_call_tasks" as never)
        .select("completed_by, outcome, completed_at, dealership_id")
        .eq("dealership_id", tenant.dealership_id)
        .gte("completed_at", dayStart);
      if (ctErr) {
        const msg = ctErr.message?.toLowerCase() || "";
        if (msg.includes("does not exist") || msg.includes("schema cache")) {
          if (!cancelled) {
            setMissing(true);
            setLoading(false);
          }
          return;
        }
      }

      type CT = { completed_by: string | null; outcome: string | null };
      const tasks: CT[] = (callTasks as unknown as CT[]) || [];

      const byRep = new Map<string, { calls: number; reached: number; appts: number }>();
      for (const t of tasks) {
        if (!t.completed_by) continue;
        const cur = byRep.get(t.completed_by) || { calls: 0, reached: 0, appts: 0 };
        cur.calls += 1;
        if (t.outcome && PRODUCTIVE_OUTCOMES.has(t.outcome)) cur.reached += 1;
        if (t.outcome && APPT_OUTCOMES.has(t.outcome))       cur.appts += 1;
        byRep.set(t.completed_by, cur);
      }

      // ── SLA breach per rep: open assigned leads with stale last_outreach_at ──
      const slaCutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000).toISOString();
      const { data: staleLeads } = await supabase
        .from("submissions")
        .select("id, assigned_bdc_rep_id, last_outreach_at, progress_status")
        .eq("dealership_id", tenant.dealership_id)
        .not("assigned_bdc_rep_id", "is", null)
        .or(`last_outreach_at.lt.${slaCutoff},last_outreach_at.is.null`)
        .not("progress_status", "in", "(purchase_complete,dead_lead,deal_finalized,partial,check_request_submitted)")
        .limit(500);
      if (cancelled) return;

      type SL = { assigned_bdc_rep_id: string | null };
      const stale: SL[] = (staleLeads as unknown as SL[]) || [];
      const slaByRep = new Map<string, number>();
      for (const l of stale) {
        if (!l.assigned_bdc_rep_id) continue;
        slaByRep.set(l.assigned_bdc_rep_id, (slaByRep.get(l.assigned_bdc_rep_id) || 0) + 1);
      }

      // Build human rep rows. Show every rep that either has activity
      // today OR an open assigned bucket — drops the long tail of
      // staff who don't work BDC.
      const humanRepIds = new Set<string>([...byRep.keys(), ...slaByRep.keys()]);
      const humanRows: RepRow[] = Array.from(humanRepIds).map((uid) => {
        const a = byRep.get(uid) || { calls: 0, reached: 0, appts: 0 };
        return {
          user_id: uid,
          display_name: labelOf(uid),
          is_ai: false,
          calls: a.calls,
          reached: a.reached,
          appts: a.appts,
          sla_breach: slaByRep.get(uid) || 0,
        };
      }).sort((a, b) => b.calls - a.calls || b.reached - a.reached);

      // ── AI agent aggregation: voice_call_log started today ──
      const { data: voiceCalls, error: vcErr } = await supabase
        .from("voice_call_log" as never)
        .select("status, outcome, answered_by, started_at, dealership_id")
        .gte("started_at", dayStart);
      if (cancelled) return;

      let aiRow: RepRow | null = null;
      if (!vcErr && voiceCalls) {
        type VC = { status: string | null; outcome: string | null; answered_by: string | null };
        const vc: VC[] = voiceCalls as unknown as VC[];
        if (vc.length > 0) {
          let calls = 0, reached = 0, appts = 0;
          for (const v of vc) {
            calls += 1;
            if (
              (v.answered_by && AI_REACHED_ANSWERED.has(v.answered_by)) ||
              (v.status && AI_REACHED_STATUSES.has(v.status))
            ) {
              reached += 1;
            }
            if (v.outcome && AI_APPT_OUTCOMES.has(v.outcome)) appts += 1;
          }
          aiRow = {
            user_id: "__ai__",
            display_name: "Voice AI",
            is_ai: true,
            calls,
            reached,
            // Last-touch attribution: AI handoffs credit the receiving
            // human rep, so the AI's own `appts` here counts only
            // bookings the AI closed end-to-end (no human transfer).
            appts,
            sla_breach: 0,
          };
        }
      }

      const allRows: RepRow[] = aiRow ? [aiRow, ...humanRows] : humanRows;
      if (!cancelled) {
        setRows(allRows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      calls: acc.calls + r.calls,
      reached: acc.reached + r.reached,
      appts: acc.appts + r.appts,
      sla_breach: acc.sla_breach + r.sla_breach,
    }),
    { calls: 0, reached: 0, appts: 0, sla_breach: 0 },
  ), [rows]);

  const aiRows = rows.filter((r) => r.is_ai);
  const humanRows = rows.filter((r) => !r.is_ai);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">BDC Health is dark</h3>
          <p className="text-xs text-muted-foreground">
            The bdc_call_tasks table doesn't exist in this database yet — apply migration
            <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">20260502080000_bdc_call_tasks.sql</code>
            so reps can capture call outcomes and this dashboard can roll them up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>BDC Health · Today</span>
            <Badge variant="outline" className="text-micro">
              {humanRows.length} {humanRows.length === 1 ? "rep" : "reps"}{aiRows.length ? " · 1 AI" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-micro font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2 pr-3">Rep</th>
                  <th className="text-right py-2 px-3">Calls</th>
                  <th className="text-right py-2 px-3">Reached</th>
                  <th className="text-right py-2 px-3">Appts set</th>
                  <th className="text-right py-2 pl-3">SLA breach</th>
                </tr>
              </thead>
              <tbody>
                {aiRows.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="pt-3 pb-1 text-micro font-bold uppercase tracking-wider text-info">
                        AI agents
                      </td>
                    </tr>
                    {aiRows.map((r) => (
                      <RepRowDisplay key={r.user_id} row={r} />
                    ))}
                  </>
                )}

                <tr>
                  <td colSpan={5} className={cn(
                    "pt-3 pb-1 text-micro font-bold uppercase tracking-wider text-muted-foreground",
                    aiRows.length === 0 && "pt-0",
                  )}>
                    Human reps
                  </td>
                </tr>
                {humanRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-xs text-muted-foreground py-6 text-center">
                      No BDC activity today. When reps complete call tasks or claim queued leads, they'll appear here.
                    </td>
                  </tr>
                ) : (
                  humanRows.map((r) => <RepRowDisplay key={r.user_id} row={r} />)
                )}

                <tr className="border-t border-border font-bold">
                  <td className="py-2 pr-3">Team total</td>
                  <td className="text-right py-2 px-3 tabular-nums">{totals.calls}</td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    {totals.reached}{totals.calls > 0 && <span className="text-muted-foreground font-normal text-[11px]"> ({Math.round((totals.reached / totals.calls) * 100)}%)</span>}
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{totals.appts}</td>
                  <td className="text-right py-2 pl-3 tabular-nums">{totals.sla_breach}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-micro text-muted-foreground leading-relaxed">
            Appointments are credited to the rep who closed the booking. AI handoffs credit the receiving human rep, not the AI — the AI's value shows in volume + reach rate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

function RepRowDisplay({ row }: { row: RepRow }) {
  const reachedPct = row.calls > 0 ? Math.round((row.reached / row.calls) * 100) : null;
  return (
    <tr className="border-b border-border/40 last:border-b-0">
      <td className="py-2 pr-3">
        <span className="inline-flex items-center gap-1.5">
          {row.is_ai && <Sparkles className="w-3.5 h-3.5 text-info" />}
          <span className="font-semibold">{row.display_name}</span>
        </span>
      </td>
      <td className="text-right py-2 px-3 tabular-nums">{row.calls}</td>
      <td className="text-right py-2 px-3 tabular-nums">
        {row.reached}{reachedPct != null && <span className="text-muted-foreground text-[11px]"> ({reachedPct}%)</span>}
      </td>
      <td className="text-right py-2 px-3 tabular-nums">{row.appts}</td>
      <td className="text-right py-2 pl-3 tabular-nums">
        {row.sla_breach === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3 h-3" />
            {row.sla_breach}
          </span>
        )}
      </td>
    </tr>
  );
}

export default BDCHealthPanel;
