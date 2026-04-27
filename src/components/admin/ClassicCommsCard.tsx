/**
 * ClassicCommsCard — right-rail card on the Classic customer file with
 * SMS / Email / Calls sub-tabs, thread preview of the most recent few
 * messages on the active channel, and a quick-reply composer at the
 * bottom. "See all" jumps to the full ConversationThread view.
 *
 * Data:
 *   - SMS / Email events come from `conversation_events` filtered by channel
 *   - Calls come from `voice_call_log`
 * Empty state per channel when nothing exists yet.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Channel = "sms" | "email" | "calls";

interface ConvEvent {
  id: string;
  channel: string;
  direction: "in" | "out";
  actor_label: string | null;
  body_text: string | null;
  occurred_at: string;
}

interface CallEvent {
  id: string;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (h < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtDuration = (s: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

interface ClassicCommsCardProps {
  submissionId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  onOpenFull: () => void;
}

const ClassicCommsCard = ({ submissionId, customerPhone, customerEmail, onOpenFull }: ClassicCommsCardProps) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Channel>("sms");
  const [events, setEvents] = useState<ConvEvent[]>([]);
  const [calls, setCalls] = useState<CallEvent[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!submissionId) return;
    const [{ data: convData }, { data: callData }] = await Promise.all([
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ConvEvent[] | null }> } } } } })
        .from("conversation_events")
        .select("id, channel, direction, actor_label, body_text, occurred_at")
        .eq("submission_id", submissionId)
        .order("occurred_at", { ascending: false })
        .limit(20),
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: CallEvent[] | null }> } } } } })
        .from("voice_call_log")
        .select("id, status, outcome, duration_seconds, summary, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setEvents(convData || []);
    setCalls(callData || []);
  }, [submissionId]);

  useEffect(() => { void load(); }, [load]);

  const smsEvents = events.filter((e) => e.channel === "sms").slice(0, 3);
  const emailEvents = events.filter((e) => e.channel === "email").slice(0, 3);
  const smsUnread = smsEvents.filter((e) => e.direction === "in").length;
  const emailUnread = emailEvents.filter((e) => e.direction === "in").length;

  const counts: Record<Channel, number> = {
    sms: smsEvents.length,
    email: emailEvents.length,
    calls: calls.length,
  };

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await (supabase as never as {
      from: (t: string) => { insert: (rows: unknown) => Promise<{ error: { message: string } | null }> };
    })
      .from("conversation_events")
      .insert({
        submission_id: submissionId,
        channel: tab === "sms" ? "sms" : "email",
        direction: "out",
        actor_type: "staff",
        actor_label: "You",
        body_text: body,
        occurred_at: new Date().toISOString(),
      });
    setSending(false);
    if (error) {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    void load();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Tab strip */}
      <div className="flex items-center border-b border-slate-100">
        {(["sms", "email", "calls"] as Channel[]).map((c) => {
          const active = c === tab;
          const unread = c === "sms" ? smsUnread : c === "email" ? emailUnread : 0;
          return (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`flex-1 h-9 px-3 text-[11px] font-bold uppercase tracking-[0.08em] flex items-center justify-center gap-1.5 transition border-b-2 ${
                active
                  ? "text-slate-900 border-[#003b80]"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              }`}
            >
              {c === "calls" ? "Calls" : c.toUpperCase()}
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unread}
                </span>
              )}
              {unread === 0 && counts[c] > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {counts[c]}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={onOpenFull}
          className="text-[10.5px] font-bold text-slate-500 hover:text-slate-900 px-3 h-9 flex items-center gap-0.5 transition"
        >
          See all
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
        </button>
      </div>

      {/* Thread preview */}
      <div className="px-3 py-3 max-h-[180px] overflow-y-auto">
        {tab === "sms" && (
          smsEvents.length === 0 ? (
            <div className="text-[12.5px] text-slate-400 italic py-2 text-center">
              {customerPhone ? "No SMS yet — type a message below." : "No phone number on file."}
            </div>
          ) : (
            <div className="space-y-2">
              {[...smsEvents].reverse().map((e) => (
                <div key={e.id} className={`flex ${e.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-[12.5px] leading-snug ${
                    e.direction === "out"
                      ? "bg-[#003b80] text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}>
                    {e.body_text}
                  </div>
                </div>
              ))}
              {smsEvents.length > 0 && (
                <div className="text-center text-[10.5px] text-slate-400">
                  {fmtTime(smsEvents[0].occurred_at)}
                </div>
              )}
            </div>
          )
        )}

        {tab === "email" && (
          emailEvents.length === 0 ? (
            <div className="text-[12.5px] text-slate-400 italic py-2 text-center">
              {customerEmail ? "No email threads yet." : "No email on file."}
            </div>
          ) : (
            <div className="space-y-2">
              {emailEvents.map((e) => (
                <div key={e.id} className="rounded-md bg-slate-50 border border-slate-100 px-2.5 py-2">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold text-slate-700 truncate">
                      {e.actor_label || (e.direction === "in" ? "Customer" : "You")}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(e.occurred_at)}</span>
                  </div>
                  <div className="text-[12px] text-slate-700 leading-snug line-clamp-2">{e.body_text}</div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "calls" && (
          calls.length === 0 ? (
            <div className="text-[12.5px] text-slate-400 italic py-2 text-center">No call history.</div>
          ) : (
            <div className="space-y-1.5">
              {calls.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-baseline justify-between gap-2 px-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-slate-900">
                      {(c.outcome || c.status || "Call").replace(/_/g, " ")}
                    </div>
                    {c.summary && (
                      <div className="text-[11px] text-slate-500 truncate">{c.summary}</div>
                    )}
                  </div>
                  <div className="text-[10.5px] text-slate-400 shrink-0 text-right">
                    {fmtDuration(c.duration_seconds)}
                    <div>{fmtTime(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Composer — only for SMS/email */}
      {tab !== "calls" && (
        <div className="border-t border-slate-100 px-2 py-2 flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
            placeholder={tab === "sms" ? "Quick reply via SMS…" : "Quick reply via email…"}
            disabled={tab === "sms" ? !customerPhone : !customerEmail}
            className="flex-1 h-8 text-[12.5px] px-3 rounded-md bg-slate-50 border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
          <button
            onClick={() => void send()}
            disabled={!reply.trim() || sending}
            aria-label="Send"
            className="w-8 h-8 rounded-md bg-[#003b80] hover:bg-[#002a5c] disabled:bg-slate-200 text-white flex items-center justify-center transition shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 2.4a1 1 0 011-.4l13.5 4.8a1 1 0 010 1.9L4.5 13.5a1 1 0 01-1.4-1.2l1.6-3.8L3 4.6a1 1 0 01-.5-2.2zm2.6 5.6L4 11l11.5-3.3L4 4.4l1.1 3.6 6.4.5-6.4.5z"/></svg>
          </button>
        </div>
      )}
    </section>
  );
};

export default ClassicCommsCard;
