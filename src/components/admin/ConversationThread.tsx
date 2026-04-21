import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, MessageSquare, Mail, FileText, Activity, ChevronDown, ChevronUp,
  Loader2, Play, Clock,
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

const ConversationThread = ({ submissionId }: { submissionId: string }) => {
  const [events, setEvents] = useState<ConvEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("conversation_events")
        .select("id, channel, direction, actor_type, actor_label, body_text, body_html, occurred_at, metadata")
        .eq("submission_id", submissionId)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (!cancelled) {
        setEvents((data as any[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

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
