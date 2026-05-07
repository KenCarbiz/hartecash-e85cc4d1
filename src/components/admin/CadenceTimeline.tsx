/**
 * CadenceTimeline — per-customer touch & cadence explainability panel.
 *
 * Reads three append-only logs and merges them into a single time-
 * ordered timeline so a manager looking at a customer file can answer
 * "why did this customer get N messages?" without grepping function
 * logs:
 *
 *   - notification_log     — every send the system attempted (channel,
 *                             trigger_key, status, error, delivered_at).
 *   - cadence_log          — every cadence-engine tick decision (fired
 *                             vs skipped_quiet vs skipped_optout vs
 *                             skipped_consent), with outcome_detail.
 *   - conversation_events  — every customer↔dealer interaction (inbound
 *                             SMS, inbound email, voice calls, notes).
 *
 * The merged view is what makes "we sent two reminders, both delivered,
 * customer replied stop on the second" or "we tried to fire reminder
 * #3 but the engine skipped because we were inside quiet hours" legible
 * at a glance — instead of "BDC swears nothing went out, customer
 * swears they got 4 texts."
 *
 * All three tables soft-fall-back: if a migration hasn't been applied
 * the component just renders the rows it can find. notification_log
 * has shipped since v1; cadence_log requires 20260502030000;
 * conversation_events requires 20260420280000.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail, MessageSquare, Phone, Send, CheckCircle2,
  AlertCircle, Clock, MoreHorizontal, FileText, BellOff, ShieldCheck,
} from "lucide-react";

type Row = {
  id: string;
  ts: string;
  source: "notification" | "cadence" | "conversation";
  channel: string;
  direction?: "inbound" | "outbound" | "internal";
  title: string;
  detail?: string;
  status?: string;
  outcome?: string;
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const channelIcon = (channel: string) => {
  switch (channel) {
    case "email": return Mail;
    case "sms":   return MessageSquare;
    case "voice":
    case "call":  return Phone;
    case "note":  return FileText;
    default:      return Send;
  }
};

const sourceTone = (row: Row): { dot: string; label: string } => {
  if (row.source === "conversation") {
    if (row.direction === "inbound")  return { dot: "bg-emerald-500", label: "Customer" };
    if (row.direction === "outbound") return { dot: "bg-blue-500",    label: "Sent" };
    return { dot: "bg-slate-400", label: "Internal" };
  }
  if (row.source === "cadence") {
    if (row.outcome === "fired")    return { dot: "bg-blue-500",   label: "Cadence fired" };
    if (row.outcome === "skipped_quiet")  return { dot: "bg-amber-500",  label: "Quiet hours" };
    if (row.outcome === "skipped_optout") return { dot: "bg-slate-500",  label: "Opted out" };
    if (row.outcome === "skipped_consent")return { dot: "bg-slate-500",  label: "No consent" };
    if (row.outcome === "failed")   return { dot: "bg-red-500",    label: "Failed" };
    return { dot: "bg-slate-400", label: row.outcome || "Cadence" };
  }
  // notification
  if (row.status === "delivered") return { dot: "bg-emerald-500", label: "Delivered" };
  if (row.status === "sent")      return { dot: "bg-blue-500",    label: "Sent" };
  if (row.status === "queued" || row.status === "sending")
                                  return { dot: "bg-amber-500",   label: row.status };
  if (row.status === "undelivered" || row.status?.startsWith("failed") || row.status === "failed_carrier")
                                  return { dot: "bg-red-500",     label: row.status };
  return { dot: "bg-slate-400", label: row.status || "Unknown" };
};

const SourceIcon = ({ row }: { row: Row }) => {
  if (row.source === "cadence" && row.outcome?.startsWith("skipped"))
    return <BellOff className="w-3.5 h-3.5" />;
  if (row.source === "cadence" && row.outcome === "fired")
    return <ShieldCheck className="w-3.5 h-3.5" />;
  if (row.status === "delivered") return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (row.status?.startsWith("failed") || row.status === "undelivered")
    return <AlertCircle className="w-3.5 h-3.5" />;
  if (row.status === "queued" || row.status === "sending")
    return <Clock className="w-3.5 h-3.5" />;
  const Icon = channelIcon(row.channel);
  return <Icon className="w-3.5 h-3.5" />;
};

interface CadenceTimelineProps {
  submissionId: string | null;
  /** When false, the component renders nothing (e.g. when the submission
   *  is unselected). Saves the queries entirely. */
  visible?: boolean;
}

export default function CadenceTimeline({
  submissionId,
  visible = true,
}: CadenceTimelineProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<{
    notification?: boolean;
    cadence?: boolean;
    conversation?: boolean;
  }>({});

  useEffect(() => {
    if (!visible || !submissionId) {
      setRows([]);
      return;
    }
    let cancel = false;

    const load = async () => {
      setLoading(true);

      const all: Row[] = [];
      const flag: typeof missing = {};

      // ── notification_log ─────────────────────────────────────────
      const notifQ = await supabase
        .from("notification_log")
        .select("id, created_at, channel, recipient, trigger_key, status, error_message")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (notifQ.error) {
        flag.notification = true;
      } else {
        for (const r of (notifQ.data || []) as Array<{
          id: string;
          created_at: string;
          channel: string;
          recipient: string | null;
          trigger_key: string | null;
          status: string;
          error_message: string | null;
        }>) {
          all.push({
            id: `n-${r.id}`,
            ts: r.created_at,
            source: "notification",
            channel: r.channel,
            direction: "outbound",
            title: r.trigger_key || `${r.channel} send`,
            detail: r.error_message
              ? `${r.recipient || "—"} · ${r.error_message}`
              : r.recipient || undefined,
            status: r.status,
          });
        }
      }

      // ── cadence_log ─────────────────────────────────────────────
      const cadQ = await supabase
        .from("cadence_log")
        .select("id, fired_at, cadence_state, step, channel, trigger_key, outcome, outcome_detail")
        .eq("submission_id", submissionId)
        .order("fired_at", { ascending: false })
        .limit(200);
      if (cadQ.error) {
        flag.cadence = true;
      } else {
        for (const r of (cadQ.data || []) as Array<{
          id: string;
          fired_at: string;
          cadence_state: string;
          step: number;
          channel: string;
          trigger_key: string | null;
          outcome: string;
          outcome_detail: string | null;
        }>) {
          all.push({
            id: `c-${r.id}`,
            ts: r.fired_at,
            source: "cadence",
            channel: r.channel,
            title: `${r.cadence_state} · step ${r.step}`,
            detail: [r.trigger_key, r.outcome_detail].filter(Boolean).join(" · ") || undefined,
            outcome: r.outcome,
          });
        }
      }

      // ── conversation_events ─────────────────────────────────────
      const convQ = await supabase
        .from("conversation_events")
        .select("id, occurred_at, channel, direction, actor_label, body_text")
        .eq("submission_id", submissionId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (convQ.error) {
        flag.conversation = true;
      } else {
        for (const r of (convQ.data || []) as Array<{
          id: string;
          occurred_at: string;
          channel: string;
          direction: "inbound" | "outbound" | "internal";
          actor_label: string | null;
          body_text: string | null;
        }>) {
          // Skip outbound system events that already show in notification_log
          // (those rows usually carry source_table='notification_log').
          all.push({
            id: `e-${r.id}`,
            ts: r.occurred_at,
            source: "conversation",
            channel: r.channel,
            direction: r.direction,
            title: `${r.actor_label || (r.direction === "inbound" ? "Customer" : "Staff")} · ${r.channel}`,
            detail: (r.body_text || "").slice(0, 240) || undefined,
          });
        }
      }

      all.sort((a, b) => (a.ts < b.ts ? 1 : -1));

      if (!cancel) {
        setRows(all);
        setMissing(flag);
        setLoading(false);
      }
    };

    void load();
    return () => { cancel = true; };
  }, [submissionId, visible]);

  if (!visible) return null;

  const missingNotes: string[] = [];
  if (missing.cadence)      missingNotes.push("cadence_log (20260502030000)");
  if (missing.conversation) missingNotes.push("conversation_events (20260420280000)");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700 dark:text-slate-300">
            Cadence & Touch Timeline
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5 max-w-prose">
            Why this customer received the messages they did. Merges every
            attempted send, every cadence-engine decision (including skips),
            and every inbound reply.
          </p>
        </div>
        <div className="text-[11px] text-slate-400 shrink-0">
          {rows.length} {rows.length === 1 ? "event" : "events"}
        </div>
      </div>

      {missingNotes.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200">
          Some data sources unavailable in this DB yet:{" "}
          <span className="font-semibold">{missingNotes.join(", ")}</span>.
          Apply the migrations via Lovable Push to enable full visibility.
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          No touches recorded yet for this customer.
        </div>
      ) : (
        <ol className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => {
            const tone = sourceTone(r);
            return (
              <li key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className="shrink-0 flex flex-col items-center pt-0.5">
                  <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 inline-flex items-center gap-1">
                      <SourceIcon row={r} />
                      {tone.label}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-500">{fmtTime(r.ts)}</span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-500 capitalize">{r.channel}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug mt-0.5">
                    {r.title}
                  </div>
                  {r.detail && (
                    <div className="text-[12.5px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug whitespace-pre-line break-words">
                      {r.detail}
                    </div>
                  )}
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-1" />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
