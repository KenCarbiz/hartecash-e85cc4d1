import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, MessageSquare, Mail, FileText, Activity, ChevronDown, ChevronUp,
  Loader2, Play, Clock, Send, StickyNote,
} from "lucide-react";

/**
 * ConversationThread — unified timeline of every customer↔dealer
 * touchpoint for a single submission. Reads from conversation_events
 * which is backfilled from legacy tables + auto-populated by
 * triggers going forward.
 *
 * Read-only in this commit. The inline reply composer (staff replies
 * via SMS / email / internal note from within the thread) ships as
 * a follow-up small push.
 */

interface ConvEvent {
  id: string;
  channel: "sms" | "email" | "voice" | "note" | "system" | "portal" | "status_change";
  direction: "inbound" | "outbound" | "internal";
  actor_type: "customer" | "staff" | "system" | "ai";
  actor_label: string | null;
  body_text: string | null;
  body_html: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
  note: FileText,
  system: Activity,
  status_change: Activity,
  portal: Activity,
};

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  voice: "Call",
  note: "Note",
  system: "System",
  status_change: "Status",
  portal: "Portal",
};

interface Props {
  submissionId: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  userEmail?: string | null;
  dealershipId?: string | null;
  canReply?: boolean;
}

const ConversationThread = ({
  submissionId,
  customerPhone,
  customerEmail,
  userEmail,
  dealershipId,
  canReply = true,
}: Props) => {
  const [events, setEvents] = useState<ConvEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [replyChannel, setReplyChannel] = useState<"sms" | "email" | "note">("note");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversation_events")
      .select("id, channel, direction, actor_type, actor_label, body_text, body_html, occurred_at, metadata")
      .eq("submission_id", submissionId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    setEvents((data as any[]) || []);
    setLoading(false);
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSendReply = async () => {
    const text = replyBody.trim();
    if (!text) return;
    setSending(true);
    try {
      if (replyChannel === "note") {
        // Internal note — direct insert, no customer contact. The
        // activity_log + conversation_events tables are separate here:
        // we write straight to conversation_events so the thread
        // renders immediately, and also log an activity_log row for
        // audit consistency (the trigger on activity_log also mirrors
        // into conversation_events but with a system-generated body —
        // the staff-typed body we're inserting below is richer).
        const { error } = await supabase.from("conversation_events").insert({
          submission_id: submissionId,
          dealership_id: dealershipId || "default",
          channel: "note",
          direction: "internal",
          actor_type: "staff",
          actor_label: userEmail || "Staff",
          body_text: text,
          occurred_at: new Date().toISOString(),
          source_table: "manual",
        } as any);
        if (error) throw error;
        await supabase.from("activity_log").insert({
          submission_id: submissionId,
          action: "Internal Note",
          old_value: null,
          new_value: text.slice(0, 500),
          performed_by: userEmail || "staff",
        } as any);
        toast({ title: "Note added", description: "Saved to the conversation timeline." });
      } else if (replyChannel === "sms") {
        if (!customerPhone) {
          toast({ title: "No phone on file", description: "Can't text the customer — phone number missing.", variant: "destructive" });
          setSending(false);
          return;
        }
        const { error } = await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "customer_staff_reply_sms",
            submission_id: submissionId,
            recipient_phone: customerPhone,
            custom_body: text,
          },
        });
        if (error) throw error;
        // The notification_log mirror trigger writes a conversation
        // event automatically once the send-notification function
        // logs to notification_log. Supplement with a richer event
        // so the timeline shows the actual typed body, not the generic
        // "customer_staff_reply_sms → phone" placeholder the mirror
        // would use.
        await supabase.from("conversation_events").insert({
          submission_id: submissionId,
          dealership_id: dealershipId || "default",
          channel: "sms",
          direction: "outbound",
          actor_type: "staff",
          actor_label: userEmail || "Staff",
          body_text: text,
          occurred_at: new Date().toISOString(),
          source_table: "manual_sms",
        } as any);
        toast({ title: "SMS sent", description: `Texted ${customerPhone}` });
      } else if (replyChannel === "email") {
        if (!customerEmail) {
          toast({ title: "No email on file", description: "Can't email the customer — email missing.", variant: "destructive" });
          setSending(false);
          return;
        }
        const { error } = await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "customer_staff_reply_email",
            submission_id: submissionId,
            recipient_email: customerEmail,
            custom_body: text,
          },
        });
        if (error) throw error;
        await supabase.from("conversation_events").insert({
          submission_id: submissionId,
          dealership_id: dealershipId || "default",
          channel: "email",
          direction: "outbound",
          actor_type: "staff",
          actor_label: userEmail || "Staff",
          body_text: text,
          occurred_at: new Date().toISOString(),
          source_table: "manual_email",
        } as any);
        toast({ title: "Email sent", description: `Emailed ${customerEmail}` });
      }
      setReplyBody("");
      await load();
    } catch (e) {
      toast({
        title: "Could not send",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const filtered = channelFilter
    ? events.filter((e) => e.channel === channelFilter)
    : events;

  const channelCounts = events.reduce((acc, e) => {
    acc[e.channel] = (acc[e.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading conversation…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
        No conversation events yet. Calls, texts, emails, and internal notes will appear here as they happen.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Channel filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setChannelFilter(null)}
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
            channelFilter === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          All · {events.length}
        </button>
        {Object.entries(channelCounts).map(([ch, count]) => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
              channelFilter === ch
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {CHANNEL_LABELS[ch] || ch} · {count}
          </button>
        ))}
      </div>

      {/* Reply composer — staff types a reply directly in the thread.
           Channel picker routes SMS / email / internal note through
           the right path (send-notification for outbound, direct
           insert for internal). */}
      {canReply && (
        <div className="rounded-xl border-2 border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Reply</span>
            {[
              { value: "note", label: "Internal note", Icon: StickyNote },
              { value: "sms", label: "SMS", Icon: MessageSquare },
              { value: "email", label: "Email", Icon: Mail },
            ].map(({ value, label, Icon }) => {
              const disabled =
                (value === "sms" && !customerPhone) ||
                (value === "email" && !customerEmail);
              return (
                <button
                  key={value}
                  onClick={() => !disabled && setReplyChannel(value as "sms" | "email" | "note")}
                  disabled={disabled}
                  title={disabled ? `No ${value === "sms" ? "phone" : "email"} on file` : undefined}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    replyChannel === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              );
            })}
          </div>
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder={
              replyChannel === "note"
                ? "Internal note — only visible to staff. Not sent to the customer."
                : replyChannel === "sms"
                ? `Text the customer…  (${customerPhone || "no phone on file"})`
                : `Email the customer…  (${customerEmail || "no email on file"})`
            }
            className="min-h-16 text-sm"
            disabled={sending}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {replyChannel === "note"
                ? "Internal only"
                : replyChannel === "sms"
                ? "Goes to customer's phone via SMS"
                : "Goes to customer's email"}
            </span>
            <Button size="sm" onClick={handleSendReply} disabled={sending || !replyBody.trim()} className="h-8 text-xs">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              {sending ? "Sending…" : replyChannel === "note" ? "Add note" : "Send"}
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {filtered.map((ev) => {
          const Icon = CHANNEL_ICONS[ev.channel] || Activity;
          const isCustomer = ev.actor_type === "customer" || ev.direction === "inbound";
          const isInternal = ev.direction === "internal";
          const md = ev.metadata || {};
          const recordingUrl = (md as any).recording_url as string | undefined;
          const transcript = (md as any).transcript as string | undefined;
          const hasDetail = !!transcript || !!recordingUrl;
          const expandedNow = !!expanded[ev.id];

          return (
            <div
              key={ev.id}
              className={`rounded-xl border p-3 flex items-start gap-3 ${
                isCustomer
                  ? "border-primary/30 bg-primary/5"
                  : isInternal
                  ? "border-border bg-muted/20"
                  : "border-border bg-background/60"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  ev.channel === "voice"
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    : ev.channel === "sms"
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : ev.channel === "email"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-card-foreground truncate">
                    {ev.actor_label || (ev.actor_type === "customer" ? "Customer" : "System")}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {CHANNEL_LABELS[ev.channel] || ev.channel}
                  </Badge>
                  {ev.direction === "inbound" && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5">← from customer</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(ev.occurred_at).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                </div>
                {ev.body_text && (
                  <p className="text-[12px] text-card-foreground whitespace-pre-wrap leading-snug break-words">
                    {ev.body_text}
                  </p>
                )}
                {typeof (md as any).duration_seconds === "number" && (md as any).duration_seconds > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Duration: {Math.round(((md as any).duration_seconds as number) / 60)}m{" "}
                    {Math.round(((md as any).duration_seconds as number) % 60)}s
                  </p>
                )}
                {hasDetail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 mt-1.5 text-[10px] text-primary"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))
                    }
                  >
                    {expandedNow ? (
                      <><ChevronUp className="w-3 h-3 mr-1" /> Hide details</>
                    ) : (
                      <><ChevronDown className="w-3 h-3 mr-1" /> Show details</>
                    )}
                  </Button>
                )}
                {expandedNow && recordingUrl && (
                  <a
                    href={recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary underline mt-1"
                  >
                    <Play className="w-3 h-3" /> Play recording
                  </a>
                )}
                {expandedNow && transcript && (
                  <pre className="mt-2 text-[10px] bg-muted/40 border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground max-h-60">
                    {transcript}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationThread;
