// 4-card KPI row on the Today home page. See
// frontend-redesign/CLAUDE_CODE_BRIEF.md §2.
//
// Metrics:
//   TODAY        — submissions w/ progress_status = "purchase_complete"
//                  AND status_updated_at::date = today
//   MTD GROSS    — sum(outcome_sale_price - acv_value) over completed
//                  submissions in the current month. Confirmed in the
//                  brief Q&A: outcome_sale_price is the column to use.
//                  Tolerant of NULLs and of the column not yet existing
//                  (we read via `(sub as any).outcome_sale_price`).
//   OPEN LEADS   — submissions whose progress_status is NOT in
//                  ('purchase_complete', 'dead_lead'). Sub-count: of
//                  those, how many are older than 24h with no offered
//                  price (the brief's "need action" criterion).
//   AVG RESPONSE — average minutes from submission.created_at to the
//                  first activity_log entry for that submission, over
//                  the last 30 days. Confirmed in the brief Q&A: derive
//                  from activity_log entries.
//
// Notes:
//   - status_updated_at is used as the "completed at" proxy per the
//     brief Q&A (a real purchased_at column doesn't exist yet).
//   - All four cards render even when their value is null/empty so the
//     layout doesn't shuffle as data loads.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Submission } from "@/lib/adminConstants";

interface TodayKpiRowProps {
  submissions: Submission[];
}

const COMPLETE_STATUSES = new Set(["purchase_complete"]);
const CLOSED_STATUSES = new Set(["purchase_complete", "dead_lead"]);
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDollars = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const sameLocalDay = (iso: string | null | undefined) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

const inCurrentMonth = (iso: string | null | undefined) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

// First-contact window: the activity_log query asks for the earliest
// entry per submission within the last 30 days. We only consider
// submissions whose own created_at also falls in that window — older
// leads would skew the average.
const useAvgResponseMinutes = (submissions: Submission[]) => {
  return useQuery({
    queryKey: ["today-kpi-avg-response", submissions.length],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
      const { data, error } = await supabase
        .from("activity_log")
        .select("submission_id, created_at")
        .gte("created_at", since)
        .not("submission_id", "is", null)
        .order("created_at", { ascending: true });

      // If the query fails (RLS, missing column, etc.) we silently
      // render `—` rather than blowing up the home page.
      if (error || !data) return null;

      const firstContactBySub = new Map<string, string>();
      for (const row of data as Array<{ submission_id: string | null; created_at: string }>) {
        if (!row.submission_id) continue;
        if (!firstContactBySub.has(row.submission_id)) {
          firstContactBySub.set(row.submission_id, row.created_at);
        }
      }

      const subById = new Map<string, string>();
      for (const s of submissions) {
        if (s.created_at) subById.set(s.id, s.created_at);
      }

      const deltas: number[] = [];
      for (const [subId, firstAt] of firstContactBySub) {
        const created = subById.get(subId);
        if (!created) continue;
        const t1 = new Date(firstAt).getTime();
        const t0 = new Date(created).getTime();
        if (Number.isFinite(t1) && Number.isFinite(t0) && t1 >= t0) {
          deltas.push((t1 - t0) / 60000);
        }
      }

      if (deltas.length === 0) return null;
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      return Math.round(avg);
    },
    staleTime: 5 * 60 * 1000,
  });
};

const fmtMinutes = (m: number | null | undefined) => {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
};

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

const KpiCard = ({ label, value, hint }: KpiCardProps) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const TodayKpiRow = ({ submissions }: TodayKpiRowProps) => {
  // TODAY
  const todayCount = submissions.filter(
    (s) => COMPLETE_STATUSES.has(s.progress_status) && sameLocalDay(s.status_updated_at),
  ).length;

  // MTD GROSS — outcome_sale_price isn't on the typed Submission shape;
  // read defensively.
  let mtdGross = 0;
  for (const s of submissions) {
    if (!COMPLETE_STATUSES.has(s.progress_status)) continue;
    if (!inCurrentMonth(s.status_updated_at)) continue;
    const sale = Number((s as any).outcome_sale_price ?? 0);
    const acv = Number(s.acv_value ?? 0);
    if (Number.isFinite(sale) && Number.isFinite(acv)) {
      mtdGross += sale - acv;
    }
  }

  // OPEN LEADS
  const open = submissions.filter((s) => !CLOSED_STATUSES.has(s.progress_status));
  const openCount = open.length;
  const now = Date.now();
  const needActionCount = open.filter((s) => {
    if (s.offered_price != null) return false;
    if (!s.created_at) return false;
    const t = new Date(s.created_at).getTime();
    return Number.isFinite(t) && now - t > DAY_MS;
  }).length;

  // AVG RESPONSE
  const { data: avgMin, isLoading: avgLoading } = useAvgResponseMinutes(submissions);
  const avgValue = avgLoading ? "…" : fmtMinutes(avgMin ?? null);
  const avgHint =
    avgMin == null
      ? "goal < 2h"
      : avgMin <= 120
      ? "goal < 2h ✓"
      : "goal < 2h";

  return (
    <section aria-label="Today metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Today" value={String(todayCount)} hint="Purchases closed today" />
      <KpiCard label="MTD Gross" value={fmtDollars(mtdGross)} hint="Sale − ACV, this month" />
      <KpiCard
        label="Open Leads"
        value={String(openCount)}
        hint={needActionCount > 0 ? `${needActionCount} need action` : "All caught up"}
      />
      <KpiCard label="Avg Response" value={avgValue} hint={avgHint} />
    </section>
  );
};

export default TodayKpiRow;
