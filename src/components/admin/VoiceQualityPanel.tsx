/**
 * VoiceQualityPanel — the Monday-ritual page.
 *
 * The single highest-leverage habit in voice-AI training (synthesized
 * from the three research agents): every Monday, the head of the
 * buying desk listens to the 10 lowest-graded and 10 highest-graded
 * calls of the prior week and personally edits the cabinet.
 *
 * No tooling replaces that ritual — this UI just makes it cheap.
 *
 * Reads v_voice_call_quality (joins voice_call_log + most-recent
 * voice_call_grades). Three sections:
 *   - Gating fails (TCPA / quote-band / hallucination)  — always above
 *     the fold; these auto-retired variants and need root-cause review
 *   - 10 highest composite_score this week              — what to copy
 *   - 10 lowest composite_score this week               — what to fix
 *
 * Each row expands to show the rubric breakdown, grader rationale,
 * and a deep-link to the call transcript via the Cadence Timeline
 * tab on the customer file.
 *
 * Soft-falls-back when migrations haven't been applied — shows the
 * MigrationMissingCard so the panel doesn't crash the hub.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, ChevronDown, ChevronRight,
  Mic, Sparkles, ShieldAlert, Star, Play, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface QualityRow {
  call_id: string;
  submission_id: string | null;
  customer_name: string | null;
  vehicle_info: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  call_outcome: string | null;
  composite_score: number | null;
  gating_failed: boolean | null;
  dim_compliance: number | null;
  dim_quote_band: number | null;
  dim_hallucination: number | null;
  grader_rationale: string | null;
  grader_model: string | null;
  /** Customer NPS columns (joined via v_voice_call_quality_with_nps).
   *  Optional because the migration that adds them ships separately
   *  and the panel soft-falls-back to the base view if missing. */
  feedback_score?: number | null;
  feedback_comment?: string | null;
  feedback_captured_at?: string | null;
}

interface FullGrade extends QualityRow {
  dim_vehicle_confirm: number | null;
  dim_motivation_disco: number | null;
  dim_objection_handle: number | null;
  dim_close_control: number | null;
  dim_transfer_hygiene: number | null;
  dim_pacing: number | null;
  dim_brand_tone: number | null;
  golden_pinned?: boolean | null;
}

interface GradeRun {
  id: string;
  run_label: string;
  started_at: string;
  finished_at: string | null;
  call_count: number;
  avg_composite: number | null;
  gating_fail_count: number;
  baseline_run_id: string | null;
  notes: string | null;
}

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
};

const fmtDuration = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const scoreBadge = (n: number | null) => {
  if (n == null) return { label: "ungraded", cls: "bg-slate-100 text-slate-500 border-slate-200" };
  if (n >= 0.5)  return { label: "+" + n.toFixed(1), cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (n >= 0)    return { label: n.toFixed(1),       cls: "bg-slate-100 text-slate-600 border-slate-300" };
  if (n >= -1)   return { label: n.toFixed(1),       cls: "bg-amber-100 text-amber-800 border-amber-300" };
  return                { label: n.toFixed(1),       cls: "bg-red-100 text-red-700 border-red-300" };
};

const dimBadge = (n: number | null, gating = false) => {
  if (n == null) return "bg-slate-50 text-slate-300 border-slate-200";
  if (n === 1) return gating
    ? "bg-red-100 text-red-700 border-red-400 font-bold"
    : "bg-amber-100 text-amber-800 border-amber-300";
  if (n <= 2) return "bg-amber-50 text-amber-700 border-amber-200";
  if (n >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

function MigrationMissingCard() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-sm text-amber-900 dark:text-amber-200">
      <div className="font-semibold mb-1">Voice quality data unavailable</div>
      <div className="text-[12.5px]">
        The <code>v_voice_call_quality</code> view requires migrations
        <code className="px-1 mx-0.5 bg-white/60 rounded">20260507150000</code>,
        <code className="px-1 mx-0.5 bg-white/60 rounded">20260507160000</code>,
        and <code className="px-1 mx-0.5 bg-white/60 rounded">20260507180000</code>.
        Apply them via Lovable Push — the panel auto-populates as
        graded calls land.
      </div>
    </div>
  );
}

const npsBadge = (n: number | null | undefined) => {
  if (n == null) return null;
  if (n >= 4) return { label: `★${n}`, cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (n === 3) return { label: `★${n}`, cls: "bg-slate-100 text-slate-600 border-slate-300" };
  return                   { label: `★${n}`, cls: "bg-red-100 text-red-700 border-red-300 font-bold" };
};

function CallRow({ row, expanded, onToggle, full, pinned, onTogglePin }: {
  row: QualityRow;
  expanded: boolean;
  onToggle: () => void;
  full: FullGrade | null;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const badge = scoreBadge(row.composite_score);
  const isGating = !!row.gating_failed;
  const nps = npsBadge(row.feedback_score);
  // "Disagreement" — LLM thought it went well, customer didn't (or
  // vice-versa). Worth listening to even if neither extreme.
  const llmHigh = (row.composite_score ?? 0) >= 0.5;
  const npsLow  = (row.feedback_score ?? 0) > 0 && (row.feedback_score ?? 0) <= 2;
  const llmLow  = (row.composite_score ?? 0) <= -0.5;
  const npsHigh = (row.feedback_score ?? 0) >= 4;
  const disagrees = (llmHigh && npsLow) || (llmLow && npsHigh);

  return (
    <div className={`rounded-lg border ${isGating ? "border-red-300 bg-red-50/30 dark:bg-red-900/10 dark:border-red-700" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}>
      <div className="flex items-stretch">
        {/* Pin-to-golden star — tappable separately from row expansion. */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          aria-label={pinned ? "Unpin from golden set" : "Pin to golden set"}
          title={pinned ? "Pinned to the golden-100 holdout. Tap to remove." : "Pin this call to the golden-100 holdout — it'll re-grade on every regression run."}
          className={`shrink-0 px-3 flex items-center justify-center transition ${
            pinned
              ? "text-amber-500 hover:text-amber-600"
              : "text-slate-300 hover:text-amber-500"
          }`}
        >
          <Star className={`w-4 h-4 ${pinned ? "fill-amber-400" : ""}`} />
        </button>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 text-left px-1 py-3 flex items-start gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
      >
        <span className="shrink-0 mt-0.5">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold uppercase tracking-wider rounded-md border px-2 py-0.5 ${badge.cls}`}>
              {badge.label}
            </span>
            {nps && (
              <span
                className={`text-[11px] font-bold uppercase tracking-wider rounded-md border px-2 py-0.5 ${nps.cls}`}
                title="Customer's post-call rating (1-5)"
              >
                {nps.label}
              </span>
            )}
            {disagrees && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider rounded-md border border-amber-400 bg-amber-50 text-amber-800 px-2 py-0.5"
                title="LLM grade and customer rating disagree — worth listening"
              >
                disagree
              </span>
            )}
            {isGating && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider rounded-md border border-red-400 bg-red-100 text-red-700 px-2 py-0.5">
                <ShieldAlert className="w-3 h-3" /> gating fail
              </span>
            )}
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {row.customer_name || "Customer"}
            </span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[12px] text-slate-600 dark:text-slate-400">{row.vehicle_info || "—"}</span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-500">{fmtTime(row.started_at)}</span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-500 font-mono">{fmtDuration(row.duration_seconds)}</span>
            {row.call_outcome && (
              <>
                <span className="text-[11px] text-slate-400">·</span>
                <span className="text-[11px] text-slate-500 capitalize">{row.call_outcome.replace(/_/g, " ")}</span>
              </>
            )}
          </div>
          {row.grader_rationale && (
            <div className="text-[12.5px] text-slate-600 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
              {row.grader_rationale}
            </div>
          )}
        </div>
      </button>
      </div>

      {expanded && full && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/30 dark:bg-slate-950/20">
          <div className="grid grid-cols-5 gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            <div>compliance*</div>
            <div>vehicle</div>
            <div>motivation</div>
            <div>quote band*</div>
            <div>objection</div>
            <div>close</div>
            <div>transfer</div>
            <div>pacing</div>
            <div>halluc.*</div>
            <div>tone</div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {[
              { v: full.dim_compliance,        gating: true  },
              { v: full.dim_vehicle_confirm,   gating: false },
              { v: full.dim_motivation_disco,  gating: false },
              { v: full.dim_quote_band,        gating: true  },
              { v: full.dim_objection_handle,  gating: false },
              { v: full.dim_close_control,     gating: false },
              { v: full.dim_transfer_hygiene,  gating: false },
              { v: full.dim_pacing,            gating: false },
              { v: full.dim_hallucination,     gating: true  },
              { v: full.dim_brand_tone,        gating: false },
            ].map((d, i) => (
              <span key={i} className={`text-center text-[12px] font-mono font-bold rounded border px-1 py-1 ${dimBadge(d.v, d.gating)}`}>
                {d.v ?? "—"}
              </span>
            ))}
          </div>
          {full.grader_rationale && (
            <div className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-snug whitespace-pre-line">
              <span className="font-bold uppercase tracking-wider text-[10.5px] text-slate-500">Rationale ({full.grader_model || "judge"}): </span>
              {full.grader_rationale}
            </div>
          )}
          {row.feedback_comment && (
            <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[12.5px] text-slate-700 dark:text-slate-300 leading-snug">
              <span className="font-bold uppercase tracking-wider text-[10.5px] text-slate-500">
                Customer ({row.feedback_score}/5):{" "}
              </span>
              "{row.feedback_comment}"
            </div>
          )}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <span>Call ID:</span>
            <code className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">{row.call_id}</code>
          </div>
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle: string;
  rows: QualityRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  fullById: Record<string, FullGrade>;
  pinnedById: Record<string, boolean>;
  onTogglePin: (callId: string) => void;
  emptyHint: string;
  icon: React.ElementType;
}

function Section({ title, subtitle, rows, expandedId, onToggle, fullById, pinnedById, onTogglePin, emptyHint, icon: Icon }: SectionProps) {
  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <Icon className="w-5 h-5 mt-0.5 text-slate-500 shrink-0" />
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{title}</h3>
          <p className="text-[12px] text-slate-500 max-w-prose">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-[12.5px] text-slate-500">
          {emptyHint}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <CallRow
              key={r.call_id}
              row={r}
              expanded={expandedId === r.call_id}
              onToggle={() => onToggle(r.call_id)}
              full={fullById[r.call_id] || null}
              pinned={!!pinnedById[r.call_id]}
              onTogglePin={() => onTogglePin(r.call_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VoiceQualityPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [highest, setHighest] = useState<QualityRow[]>([]);
  const [lowest, setLowest]   = useState<QualityRow[]>([]);
  const [gating, setGating]   = useState<QualityRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullById, setFullById] = useState<Record<string, FullGrade>>({});
  const [pinnedById, setPinnedById] = useState<Record<string, boolean>>({});
  const [runs, setRuns] = useState<GradeRun[]>([]);
  const [running, setRunning] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number>(0);

  const weekAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      setLoading(true);

      const headerCols = "call_id, submission_id, customer_name, vehicle_info, started_at, duration_seconds, call_outcome, composite_score, gating_failed, dim_compliance, dim_quote_band, dim_hallucination, grader_rationale, grader_model, feedback_score, feedback_comment, feedback_captured_at";

      // Prefer the NPS-joined view; fall back to the base view if the
      // 20260507210000 migration hasn't been applied yet (the new
      // columns simply won't be present and "does not exist" surfaces
      // as missing-table on the with_nps view).
      const tryView = async (view: string, headerCols: string) => {
        const sb = supabase as any;
        const [hi, lo, gate] = await Promise.all([
          sb.from(view).select(headerCols)
            .gte("started_at", weekAgoIso)
            .not("composite_score", "is", null)
            .order("composite_score", { ascending: false, nullsFirst: false })
            .limit(10),
          sb.from(view).select(headerCols)
            .gte("started_at", weekAgoIso)
            .not("composite_score", "is", null)
            .order("composite_score", { ascending: true, nullsFirst: false })
            .limit(10),
          sb.from(view).select(headerCols)
            .eq("gating_failed", true)
            .order("started_at", { ascending: false, nullsFirst: false })
            .limit(20),
        ]);
        return { hi, lo, gate };
      };
      let { hi, lo, gate } = await tryView("v_voice_call_quality_with_nps", headerCols);
      const baseColsOnly = headerCols.replace(/, feedback_[^,]+/g, "");
      if ((hi.error?.message || "").includes("does not exist")) {
        ({ hi, lo, gate } = await tryView("v_voice_call_quality", baseColsOnly));
      }

      if (cancel) return;

      const anyMissing = (hi.error?.message || "").includes("does not exist")
        || (lo.error?.message || "").includes("does not exist")
        || (gate.error?.message || "").includes("does not exist");

      setMissing(anyMissing);
      const hiRows = (hi.data as QualityRow[]) || [];
      const loRows = (lo.data as QualityRow[]) || [];
      const gtRows = (gate.data as QualityRow[]) || [];
      setHighest(hiRows);
      setLowest(loRows);
      setGating(gtRows);

      // Bulk-fetch pinned status for the union of visible call ids.
      const allIds = Array.from(new Set([...hiRows, ...loRows, ...gtRows].map((r) => r.call_id)));
      if (allIds.length) {
        const { data: pins } = await supabase
          .from("voice_call_grades")
          .select("call_id, golden_pinned, created_at")
          .in("call_id", allIds)
          .is("run_id", null)
          .order("created_at", { ascending: false });
        const seen = new Set<string>();
        const map: Record<string, boolean> = {};
        for (const p of pins || []) {
          const id = p.call_id as string;
          if (seen.has(id)) continue;
          seen.add(id);
          map[id] = !!p.golden_pinned;
        }
        if (!cancel) setPinnedById(map);
      }

      // Recent runs + pinned-count for the header.
      const [runsQ, pinnedQ] = await Promise.all([
        supabase
          .from("voice_grade_runs")
          .select("id, run_label, started_at, finished_at, call_count, avg_composite, gating_fail_count, baseline_run_id, notes")
          .order("started_at", { ascending: false })
          .limit(5),
        supabase
          .from("voice_call_grades")
          .select("call_id", { count: "exact", head: false })
          .eq("golden_pinned", true)
          .is("run_id", null),
      ]);
      if (!cancel) {
        setRuns((runsQ.data as GradeRun[]) || []);
        const uniq = new Set((pinnedQ.data || []).map((r) => r.call_id as string));
        setPinnedCount(uniq.size);
      }
      setLoading(false);
    };
    void load();
    return () => { cancel = true; };
  }, [weekAgoIso]);

  const togglePin = async (callId: string) => {
    const next = !pinnedById[callId];
    // Optimistic update.
    setPinnedById((prev) => ({ ...prev, [callId]: next }));
    setPinnedCount((c) => c + (next ? 1 : -1));
    const { data, error } = await supabase.rpc("mark_call_golden", {
      _call_id: callId,
      _pinned: next,
    });
    const result = data as { ok?: boolean; reason?: string } | null;
    if (error || !result?.ok) {
      // Roll back.
      setPinnedById((prev) => ({ ...prev, [callId]: !next }));
      setPinnedCount((c) => c + (next ? -1 : 1));
      toast({
        title: "Couldn't update pin",
        description: error?.message || result?.reason || "no_grade_yet",
        variant: "destructive",
      });
    }
  };

  const runRegression = async () => {
    if (running) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("regrade-golden-set", {
        body: { run_label: `regression ${new Date().toLocaleString()}` },
      });
      if (error) throw error;
      const result = data as {
        ok: boolean;
        reason?: string;
        run?: GradeRun;
        baseline?: GradeRun | null;
        succeeded?: number;
        failed?: number;
        total?: number;
      };
      if (!result?.ok) {
        toast({ title: "Run failed", description: result?.reason || "unknown", variant: "destructive" });
        return;
      }
      toast({
        title: "Regression complete",
        description: `${result.succeeded}/${result.total} calls re-graded${
          result.baseline?.avg_composite != null && result.run?.avg_composite != null
            ? ` · Δ ${(result.run.avg_composite - result.baseline.avg_composite).toFixed(2)}`
            : ""
        }`,
      });
      // Refresh runs.
      const { data: runsData } = await supabase
        .from("voice_grade_runs")
        .select("id, run_label, started_at, finished_at, call_count, avg_composite, gating_fail_count, baseline_run_id, notes")
        .order("started_at", { ascending: false })
        .limit(5);
      setRuns((runsData as GradeRun[]) || []);
    } catch (e) {
      toast({
        title: "Run failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const onToggle = async (callId: string) => {
    if (expandedId === callId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(callId);
    if (fullById[callId]) return;

    const { data } = await supabase
      .from("voice_call_grades")
      .select("call_id, dim_compliance, dim_vehicle_confirm, dim_motivation_disco, dim_quote_band, dim_objection_handle, dim_close_control, dim_transfer_hygiene, dim_pacing, dim_hallucination, dim_brand_tone, composite_score, gating_failed, rationale, grader_model, golden_pinned")
      .eq("call_id", callId)
      .is("run_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const merged = {
        ...(highest.find((r) => r.call_id === callId)
          || lowest.find((r) => r.call_id === callId)
          || gating.find((r) => r.call_id === callId)),
        ...data,
        grader_rationale: data.rationale ?? null,
      } as FullGrade;
      setFullById((prev) => ({ ...prev, [callId]: merged }));
    }
  };

  if (missing) return <MigrationMissingCard />;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[15px] font-bold text-card-foreground">Voice Quality — Monday Ritual</h2>
        <p className="text-[12.5px] text-muted-foreground max-w-prose mt-1">
          Every Monday, listen to the 10 lowest- and 10 highest-graded calls
          of the prior week and edit the training cabinet. No tooling replaces
          this step. Gating fails (TCPA, ACV out-of-band, hallucinated numbers)
          appear at the top — they auto-retire the variants in use and need
          root-cause review before the next call ships.
        </p>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-[12.5px] text-slate-500">
          Loading…
        </div>
      )}

      {!loading && (
        <>
          {/* Golden-100 control bar — pin + run regression */}
          <GoldenControlBar
            pinnedCount={pinnedCount}
            running={running}
            onRun={runRegression}
            runs={runs}
          />

          <Section
            title="Gating fails (TCPA · quote band · hallucination)"
            subtitle="Variants used in these calls were auto-retired. Listen first, then patch the cabinet so the failure mode can't recur."
            rows={gating}
            expandedId={expandedId}
            onToggle={onToggle}
            fullById={fullById}
            pinnedById={pinnedById}
            onTogglePin={togglePin}
            emptyHint="No gating fails this week. Keep that streak."
            icon={AlertTriangle}
          />
          <Section
            title="Top 10 this week"
            subtitle="What to copy. Pull patterns from the rationale into new variants."
            rows={highest}
            expandedId={expandedId}
            onToggle={onToggle}
            fullById={fullById}
            pinnedById={pinnedById}
            onTogglePin={togglePin}
            emptyHint="No graded calls yet."
            icon={Sparkles}
          />
          <Section
            title="Bottom 10 this week"
            subtitle="What to fix. The lowest-graded calls usually share a root cause — look for the pattern, then edit the phase or signal that produced it."
            rows={lowest}
            expandedId={expandedId}
            onToggle={onToggle}
            fullById={fullById}
            pinnedById={pinnedById}
            onTogglePin={togglePin}
            emptyHint="No graded calls yet."
            icon={Mic}
          />
        </>
      )}
    </div>
  );
}

/* ──────────────────────── GOLDEN-100 CONTROL BAR ──────────────────────── */
function GoldenControlBar({
  pinnedCount, running, onRun, runs,
}: {
  pinnedCount: number;
  running: boolean;
  onRun: () => void;
  runs: GradeRun[];
}) {
  const baseline = runs.length >= 2 ? runs[1] : null;
  const latest   = runs.length >= 1 ? runs[0] : null;
  const delta = latest?.avg_composite != null && baseline?.avg_composite != null
    ? latest.avg_composite - baseline.avg_composite
    : null;

  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-slate-900 dark:border-amber-700 p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Star className="w-5 h-5 mt-0.5 text-amber-500 fill-amber-400 shrink-0" />
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            Golden-100 Holdout
          </h3>
          <p className="text-[12px] text-slate-600 dark:text-slate-400 max-w-prose">
            Pin a diverse set of ~100 calls (mix of high/low/edge) by tapping the star next to any row.
            Then "Run regression" to re-grade the whole set — useful after rubric or judge-model changes
            to verify the grader hasn't drifted.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold">Pinned</div>
            <div className={`text-[20px] font-mono font-bold ${
              pinnedCount === 0 ? "text-slate-400"
              : pinnedCount < 50 ? "text-amber-600"
              : pinnedCount > 150 ? "text-amber-600"
              : "text-emerald-600"
            }`}>
              {pinnedCount}
            </div>
          </div>
          <Button
            onClick={onRun}
            disabled={running || pinnedCount === 0}
            className="h-10"
            title={pinnedCount === 0 ? "Pin some calls first" : `Re-grade ${pinnedCount} calls against the current rubric`}
          >
            {running ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Run regression</>
            )}
          </Button>
        </div>
      </div>

      {runs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
          <div className="text-[10.5px] uppercase tracking-wider text-slate-500 font-bold mb-2">
            Recent runs
            {delta != null && (
              <span className={`ml-3 inline-block font-mono normal-case ${
                delta > 0.05 ? "text-emerald-600"
                  : delta < -0.05 ? "text-red-600"
                  : "text-slate-500"
              }`}>
                Δ {delta > 0 ? "+" : ""}{delta.toFixed(2)} vs prior
              </span>
            )}
          </div>
          <div className="space-y-1">
            {runs.map((r, i) => {
              const prev = runs[i + 1];
              const d = r.avg_composite != null && prev?.avg_composite != null
                ? r.avg_composite - prev.avg_composite
                : null;
              return (
                <div key={r.id} className="flex items-center gap-3 text-[12px] py-1">
                  <span className="font-mono text-slate-500 shrink-0 w-[140px] truncate">
                    {new Date(r.started_at).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{r.run_label}</span>
                  <span className="text-slate-500 font-mono">
                    n={r.call_count}
                  </span>
                  <span className={`font-mono font-bold w-[60px] text-right ${
                    r.avg_composite == null ? "text-slate-300"
                      : r.avg_composite >= 0.5 ? "text-emerald-600"
                      : r.avg_composite >= 0  ? "text-slate-600"
                      : "text-red-600"
                  }`}>
                    {r.avg_composite != null ? r.avg_composite.toFixed(2) : "—"}
                  </span>
                  <span className={`font-mono w-[60px] text-right text-[11px] ${
                    d == null ? "text-slate-300"
                      : d > 0.05 ? "text-emerald-600"
                      : d < -0.05 ? "text-red-600"
                      : "text-slate-400"
                  }`}>
                    {d != null ? `${d > 0 ? "+" : ""}${d.toFixed(2)}` : ""}
                  </span>
                  {r.gating_fail_count > 0 && (
                    <span className="text-[11px] text-red-600 font-bold">
                      {r.gating_fail_count} gating
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
