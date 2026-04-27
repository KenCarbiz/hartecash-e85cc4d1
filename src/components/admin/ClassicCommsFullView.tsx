/**
 * ClassicCommsFullView — full-screen overlay over the Classic customer file
 * slide-out, opened from the "See all" link on the right-rail comms card.
 *
 * Four sub-tabs:
 *   - SMS      — 2-way chat bubbles + AI assist + templates + composer
 *   - Email    — email thread cards + AI assist + templates + composer
 *   - Calls    — call log (read-only)
 *   - Unified  — merged chronological feed of all three
 *
 * Bottom controls (SMS / Email only):
 *   - Tone strip: Friendly · Professional · Urgent · Brief
 *   - Templates : Follow up offer / Confirm appointment / Nudge / They arrived / Loan payoff
 *   - Composer  + Refine button (purple) + Send
 *
 * AI generation + refine call the `generate-sms-with-claude` edge function,
 * which proxies to Anthropic. Templates pull customer context server-side
 * (offer, vehicle, prior conversation) so the salesperson doesn't have to.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Channel = "sms" | "email" | "calls" | "unified";
type Tone = "friendly" | "professional" | "urgent" | "brief";

interface ConvMessage {
  id: string;
  channel: "sms" | "email";
  direction: "in" | "out";
  actor_label: string | null;
  body_text: string | null;
  occurred_at: string;
  metadata?: { subject?: string; to?: string; from?: string } | null;
}

interface ConvCall {
  id: string;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
  direction?: string | null;
  performed_by?: string | null;
  transcript?: string | null;
}

const TONES: { k: Tone; label: string }[] = [
  { k: "friendly",     label: "Friendly" },
  { k: "professional", label: "Professional" },
  { k: "urgent",       label: "Urgent" },
  { k: "brief",        label: "Brief" },
];

const TEMPLATES = [
  { k: "follow_up",          label: "Follow-up offer" },
  { k: "confirm_appointment",label: "Confirm appointment" },
  { k: "nudge",              label: "Nudge (no response)" },
  { k: "they_arrived",       label: "They have arrived" },
  { k: "ask_loan_payoff",    label: "Ask about loan payoff" },
] as const;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffMs < 172_800_000) return "Yesterday " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtDuration = (s: number | null) => {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface ClassicCommsFullViewProps {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
}

const ClassicCommsFullView = ({
  open, onClose, submissionId, customerName, customerPhone, customerEmail,
}: ClassicCommsFullViewProps) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Channel>("sms");
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [calls, setCalls] = useState<ConvCall[]>([]);
  const [draft, setDraft] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [busy, setBusy] = useState<"none" | "ai" | "sending" | "logging">("none");
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [logDirection, setLogDirection] = useState<"outbound" | "inbound">("outbound");
  const [logOutcome, setLogOutcome] = useState<string>("connected");
  const [logSummary, setLogSummary] = useState("");
  const [logDuration, setLogDuration] = useState("");

  const load = useCallback(async () => {
    if (!submissionId) return;
    const [{ data: convData }, { data: callData }] = await Promise.all([
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ConvMessage[] | null }> } } } } })
        .from("conversation_events")
        .select("id, channel, direction, actor_label, body_text, occurred_at, metadata")
        .eq("submission_id", submissionId)
        .order("occurred_at", { ascending: true })
        .limit(200),
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ConvCall[] | null }> } } } } })
        .from("voice_call_log")
        .select("id, status, outcome, duration_seconds, summary, transcript, direction, performed_by, customer_name, created_at")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setMessages((convData || []).filter((m) => m.channel === "sms" || m.channel === "email"));
    setCalls(callData || []);
  }, [submissionId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Reset composer when switching tabs
  useEffect(() => { setDraft(""); setEmailSubject(""); }, [tab]);

  if (!open) return null;

  const smsMessages = messages.filter((m) => m.channel === "sms");
  const emailMessages = messages.filter((m) => m.channel === "email");
  const counts: Record<Channel, number> = {
    sms: smsMessages.length,
    email: emailMessages.length,
    calls: calls.length,
    unified: smsMessages.length + emailMessages.length + calls.length,
  };

  const isComposerChannel = tab === "sms" || tab === "email";
  const composerDisabled = (tab === "sms" && !customerPhone) || (tab === "email" && !customerEmail);
  const charLimit = tab === "sms" ? 320 : 1200;

  // ── AI: apply a template (server picks message based on tone + ctx) ──
  const applyTemplate = async (templateKey: typeof TEMPLATES[number]["k"]) => {
    if (busy !== "none") return;
    setBusy("ai");
    try {
      const { data, error } = await supabase.functions.invoke("generate-sms-with-claude", {
        body: {
          mode: "template",
          submission_id: submissionId,
          tone,
          template_key: templateKey,
          channel: tab === "email" ? "email" : "sms",
        },
      });
      if (error) throw error;
      const text = (data as { text?: string })?.text;
      if (text) setDraft(text);
      else toast({ title: "AI returned empty text", variant: "destructive" });
    } catch (e) {
      toast({ title: "AI generation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy("none");
    }
  };

  // ── AI: refine the current draft ──
  const refine = async () => {
    if (busy !== "none" || !draft.trim()) return;
    setBusy("ai");
    try {
      const { data, error } = await supabase.functions.invoke("generate-sms-with-claude", {
        body: {
          mode: "refine",
          submission_id: submissionId,
          tone,
          draft,
          channel: tab === "email" ? "email" : "sms",
        },
      });
      if (error) throw error;
      const text = (data as { text?: string })?.text;
      if (text) setDraft(text);
      else toast({ title: "AI returned empty text", variant: "destructive" });
    } catch (e) {
      toast({ title: "Refine failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy("none");
    }
  };

  const logCall = async () => {
    const summary = logSummary.trim();
    if (!summary || busy !== "none") return;
    setBusy("logging");
    try {
      // Parse "2:22" → 142 seconds. Plain numbers treated as seconds.
      let durationSeconds: number | null = null;
      const d = logDuration.trim();
      if (d) {
        if (d.includes(":")) {
          const [m, s] = d.split(":").map((v) => parseInt(v, 10));
          if (!isNaN(m) && !isNaN(s)) durationSeconds = m * 60 + s;
        } else {
          const n = parseInt(d, 10);
          if (!isNaN(n)) durationSeconds = n;
        }
      }
      const { error } = await (supabase as never as {
        from: (t: string) => { insert: (rows: unknown) => Promise<{ error: { message: string } | null }> };
      })
        .from("voice_call_log")
        .insert({
          submission_id: submissionId,
          direction: logDirection,
          outcome: logOutcome,
          status: "completed",
          summary,
          duration_seconds: durationSeconds,
          performed_by: "Staff",
          customer_name: customerName,
          created_at: new Date().toISOString(),
        });
      if (error) throw new Error(error.message);
      setLogFormOpen(false);
      setLogSummary("");
      setLogDuration("");
      void load();
    } catch (e) {
      toast({ title: "Couldn't save call", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy("none");
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || composerDisabled || busy !== "none") return;
    setBusy("sending");
    try {
      const isEmail = tab === "email";
      const metadata = isEmail
        ? { subject: emailSubject.trim() || "Re: Your trade-in offer" }
        : null;
      const { error } = await (supabase as never as {
        from: (t: string) => { insert: (rows: unknown) => Promise<{ error: { message: string } | null }> };
      })
        .from("conversation_events")
        .insert({
          submission_id: submissionId,
          channel: isEmail ? "email" : "sms",
          direction: "out",
          actor_type: "staff",
          actor_label: "You",
          body_text: body,
          occurred_at: new Date().toISOString(),
          metadata,
        });
      if (error) throw new Error(error.message);
      setDraft("");
      setEmailSubject("");
      void load();
    } catch (e) {
      toast({ title: "Send failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-slate-50 animate-in fade-in">
      {/* Header — Back to file + title */}
      <div className="shrink-0 flex items-center gap-3 px-5 h-12 border-b border-slate-200 bg-white">
        <button
          onClick={onClose}
          className="text-[12px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z"/></svg>
          Back to file
        </button>
        <span className="text-slate-300">·</span>
        <h2 className="text-[14px] font-bold text-slate-900">
          Messages with {customerName || "customer"}
        </h2>
      </div>

      {/* Sub-tabs */}
      <div className="shrink-0 flex items-center border-b border-slate-200 bg-white px-5">
        {(["sms", "email", "calls", "unified"] as Channel[]).map((c) => {
          const active = tab === c;
          return (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`h-12 px-4 text-[12px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5 transition border-b-2 ${
                active
                  ? "text-slate-900 border-[#003b80]"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              }`}
            >
              {c === "calls" ? "Calls" : c === "unified" ? "Unified" : c.toUpperCase()}
              {counts[c] > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                  active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}>{counts[c]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body — thread for active channel */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "sms" && (
          smsMessages.length === 0 ? (
            <div className="text-center text-[13px] text-slate-400 italic py-12">
              {customerPhone ? "No SMS yet — start the conversation below." : "No phone number on file."}
            </div>
          ) : (
            <div className="space-y-3 max-w-[640px] mx-auto">
              {smsMessages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    <div className={`px-4 py-2 rounded-2xl text-[13.5px] leading-snug ${
                      m.direction === "out"
                        ? "bg-[#003b80] text-white rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm shadow-sm"
                    }`}>
                      {m.body_text}
                    </div>
                    <div className={`text-[11px] text-slate-400 mt-1 ${m.direction === "out" ? "text-right" : "text-left"}`}>
                      {fmtTime(m.occurred_at)}
                      {m.direction === "out" && m.actor_label ? ` · ${m.actor_label}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "email" && (
          emailMessages.length === 0 ? (
            <div className="text-center text-[13px] text-slate-400 italic py-12">
              {customerEmail ? "No email threads yet." : "No email on file."}
            </div>
          ) : (
            <div className="space-y-3 max-w-[760px] mx-auto">
              {emailMessages.map((m) => {
                const subject = m.metadata?.subject || (m.direction === "out" ? "Your trade-in offer" : "Re: Your trade-in offer");
                const addressLine = m.direction === "out"
                  ? `To: ${customerEmail || "customer"}`
                  : `From: ${m.actor_label || "Customer"}${customerEmail ? ` <${customerEmail}>` : ""}`;
                return (
                  <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-slate-500">{addressLine}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{fmtTime(m.occurred_at)}</span>
                    </div>
                    <div className="text-[13.5px] font-bold text-slate-900 mt-0.5">{subject}</div>
                    <p className="text-[13px] text-slate-700 leading-relaxed mt-1 whitespace-pre-wrap line-clamp-3">{m.body_text}</p>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === "calls" && (
          <div className="space-y-2 max-w-[760px] mx-auto">
            {calls.length === 0 ? (
              <div className="text-center text-[13px] text-slate-400 italic py-8">No call history yet.</div>
            ) : (
              calls.map((c) => {
                const direction = (c.direction || "").toLowerCase();
                const outcome = (c.outcome || c.status || "call").toLowerCase();
                const isInbound = direction === "inbound" || direction === "in" || outcome.includes("voicemail");
                const isVoicemail = outcome.includes("voicemail");
                const iconBg = isInbound ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
                const dirLabel = isInbound ? "Inbound" : "Outbound";
                const outcomeLabel = (c.outcome || c.status || "Call").replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        {isVoicemail
                          ? <path d="M3 11a3 3 0 116 0 3 3 0 01-6 0zm8 0a3 3 0 116 0 3 3 0 01-6 0zm-3 3h4v2H8v-2z"/>
                          : <path d="M2 3.5A1.5 1.5 0 013.5 2h2.6a1.5 1.5 0 011.4 1l.8 2.1a1.5 1.5 0 01-.4 1.7L6.5 8.1a11 11 0 005.4 5.4l1.3-1.4a1.5 1.5 0 011.7-.4l2.1.8a1.5 1.5 0 011 1.4v2.6a1.5 1.5 0 01-1.5 1.5C8.5 18 2 11.5 2 3.5z"/>}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-slate-900">
                          {dirLabel} · {outcomeLabel}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {fmtTime(c.created_at)}{c.duration_seconds ? ` · ${fmtDuration(c.duration_seconds)}` : ""}
                        </span>
                      </div>
                      {c.performed_by && (
                        <div className="text-[12px] text-slate-500 mt-0.5">by {c.performed_by}</div>
                      )}
                      {c.summary && (
                        <p className="text-[13px] italic text-slate-700 mt-1.5">"{c.summary}"</p>
                      )}
                      {c.transcript && (
                        <details className="mt-2">
                          <summary className="text-[11px] font-semibold text-[#003b80] hover:underline cursor-pointer">
                            View transcript
                          </summary>
                          <pre className="text-[12px] text-slate-600 mt-2 p-3 bg-slate-50 rounded-md whitespace-pre-wrap font-sans leading-relaxed">{c.transcript}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Log a call — manual entry */}
            {!logFormOpen ? (
              <button
                onClick={() => setLogFormOpen(true)}
                className="w-full py-3 rounded-lg border-2 border-dashed border-slate-300 text-[13px] font-bold text-[#003b80] hover:bg-blue-50 hover:border-blue-400 transition flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5A1.5 1.5 0 013.5 2h2.6a1.5 1.5 0 011.4 1l.8 2.1a1.5 1.5 0 01-.4 1.7L6.5 8.1a11 11 0 005.4 5.4l1.3-1.4a1.5 1.5 0 011.7-.4l2.1.8a1.5 1.5 0 011 1.4v2.6a1.5 1.5 0 01-1.5 1.5C8.5 18 2 11.5 2 3.5z"/></svg>
                Log a call
              </button>
            ) : (
              <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Log a call</div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={logDirection}
                    onChange={(e) => setLogDirection(e.target.value as "outbound" | "inbound")}
                    className="h-9 text-[12px] rounded-md border border-slate-200 px-2 bg-white outline-none focus:border-blue-400"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                  </select>
                  <select
                    value={logOutcome}
                    onChange={(e) => setLogOutcome(e.target.value)}
                    className="h-9 text-[12px] rounded-md border border-slate-200 px-2 bg-white outline-none focus:border-blue-400"
                  >
                    <option value="connected">Connected</option>
                    <option value="voicemail">Voicemail</option>
                    <option value="no_answer">No answer</option>
                    <option value="busy">Busy</option>
                    <option value="wrong_number">Wrong number</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={logDuration}
                  onChange={(e) => setLogDuration(e.target.value)}
                  placeholder="Duration (e.g. 2:22) — optional"
                  className="w-full h-9 text-[12px] rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                />
                <textarea
                  value={logSummary}
                  onChange={(e) => setLogSummary(e.target.value)}
                  placeholder="What was discussed?"
                  rows={3}
                  className="w-full text-[13px] rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 resize-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => { setLogFormOpen(false); setLogSummary(""); setLogDuration(""); }}
                    className="text-[12px] font-semibold px-3 h-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void logCall()}
                    disabled={!logSummary.trim() || busy !== "none"}
                    className="text-[12px] font-bold px-3.5 h-8 rounded-md bg-[#003b80] hover:bg-[#002a5c] disabled:bg-slate-300 text-white transition"
                  >
                    {busy === "logging" ? "Saving…" : "Save call"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "unified" && (
          (() => {
            const merged = [
              ...smsMessages.map((m) => ({ k: "sms" as const, ts: m.occurred_at, m })),
              ...emailMessages.map((m) => ({ k: "email" as const, ts: m.occurred_at, m })),
              ...calls.map((c) => ({ k: "call" as const, ts: c.created_at, c })),
            ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
            if (merged.length === 0) {
              return <div className="text-center text-[13px] text-slate-400 italic py-12">No communication yet.</div>;
            }
            return (
              <div className="space-y-2 max-w-[760px] mx-auto">
                {merged.map((row) => (
                  <div key={`${row.k}-${row.k === "call" ? row.c.id : row.m.id}`} className="rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-3">
                    <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 border ${
                      row.k === "sms" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      row.k === "email" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>{row.k}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-semibold text-slate-900">
                          {row.k === "call"
                            ? (row.c.outcome || row.c.status || "Call").replace(/_/g, " ")
                            : (row.m.actor_label || (row.m.direction === "in" ? "Customer" : "You"))}
                        </span>
                        <span className="text-[11px] text-slate-400">{fmtTime(row.ts)}</span>
                      </div>
                      <p className="text-[12.5px] text-slate-700 leading-snug line-clamp-2 mt-0.5">
                        {row.k === "call" ? (row.c.summary || "—") : row.m.body_text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* AI Assist + Templates + Composer (SMS/Email only) */}
      {isComposerChannel && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 space-y-2.5">
          {/* Tone strip */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mr-1 inline-flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l1.5 4 4 1.5-4 1.5L10 13l-1.5-4-4-1.5 4-1.5L10 2zm5 9l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></svg>
              AI Assist
            </span>
            {TONES.map((t) => (
              <button
                key={t.k}
                onClick={() => setTone(t.k)}
                className={`text-[11px] font-semibold px-2.5 h-6 rounded-full border transition ${
                  tone === t.k
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Templates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Templates</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.k}
                onClick={() => void applyTemplate(t.k)}
                disabled={busy !== "none"}
                className="text-[11px] font-semibold px-2.5 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-400 disabled:opacity-50 transition"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Email-only: Subject input */}
          {tab === "email" && (
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              disabled={composerDisabled}
              className="w-full text-[14px] font-semibold rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          )}

          {/* Body */}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
            }}
            placeholder={composerDisabled
              ? (tab === "sms" ? "No phone number on file." : "No email on file.")
              : "Type your message… or use AI Assist above"}
            rows={tab === "email" ? 5 : 2}
            disabled={composerDisabled}
            className="w-full text-[13px] rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {tab === "email" && (
                <button
                  onClick={() => toast({ title: "Attachments coming soon", description: "Wire-up requires storage bucket access." })}
                  disabled={composerDisabled}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.7 2.5a3.5 3.5 0 014.9 4.9l-7 7a2 2 0 11-2.8-2.8l5.6-5.6a.5.5 0 11.7.7L5.5 12.4a1 1 0 101.4 1.4l7-7a2.5 2.5 0 00-3.5-3.5l-7.5 7.5a3 3 0 104.2 4.2l5.7-5.7a.5.5 0 11.7.7l-5.7 5.7a4 4 0 11-5.6-5.6L9.7 2.5z"/></svg>
                  Attach file
                </button>
              )}
              {tab === "sms" && (
                <span className={`text-[11px] ${draft.length > charLimit ? "text-red-600 font-bold" : "text-slate-400"}`}>
                  {draft.length}/{charLimit} chars
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void refine()}
                disabled={!draft.trim() || busy !== "none"}
                className="text-[11px] font-semibold px-3 h-8 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 inline-flex items-center gap-1 transition"
              >
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l1.5 4 4 1.5-4 1.5L10 13l-1.5-4-4-1.5 4-1.5L10 2z"/></svg>
                {busy === "ai" ? "Refining…" : "Refine"}
              </button>
              <button
                onClick={() => void send()}
                disabled={!draft.trim() || busy !== "none" || composerDisabled || (tab === "sms" && draft.length > charLimit)}
                className="text-[12px] font-bold px-3.5 h-8 rounded-md bg-[#003b80] hover:bg-[#002a5c] disabled:bg-slate-300 text-white inline-flex items-center gap-1.5 transition"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 2.4a1 1 0 011-.4l13.5 4.8a1 1 0 010 1.9L4.5 13.5a1 1 0 01-1.4-1.2l1.6-3.8L3 4.6a1 1 0 01-.5-2.2z"/></svg>
                {busy === "sending" ? "Sending…" : `Send ${tab === "sms" ? "SMS" : "email"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassicCommsFullView;
