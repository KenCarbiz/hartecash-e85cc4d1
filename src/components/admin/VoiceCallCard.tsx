import { useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, MessageSquare, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

/**
 * Shape of a voice_call_log row that's safe to render. Required
 * fields are the minimum we always SELECT; optional fields appear
 * when the underlying SELECT pulls them and the Bland.ai webhook has
 * filled them in.
 */
export interface VoiceCallRow {
  id: string;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
  direction?: string | null;
  performed_by?: string | null;
  transcript?: string | null;
  recording_url?: string | null;
  phone_number?: string | null;
  customer_name?: string | null;
}

const OUTCOME_COLORS: Record<string, string> = {
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  appointment_scheduled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  callback_requested: "bg-blue-50 text-blue-700 border-blue-200",
  wants_higher_offer: "bg-amber-50 text-amber-700 border-amber-200",
  voicemail_left: "bg-purple-50 text-purple-700 border-purple-200",
  not_interested: "bg-slate-100 text-slate-600 border-slate-200",
  no_answer: "bg-slate-100 text-slate-600 border-slate-200",
  opted_out: "bg-red-50 text-red-700 border-red-200",
};

function fmtDuration(secs: number | null | undefined): string {
  if (!secs || secs < 1) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return d.toLocaleDateString();
}

interface Props {
  call: VoiceCallRow;
  /** Compact mode for the inline customer-file card (smaller padding, smaller transcript). */
  compact?: boolean;
}

/**
 * Renders a voice_call_log row in the customer-file timeline.
 * Includes: direction icon, outcome badge, duration + relative time,
 * native HTML5 audio player when recording_url is set, expand-to-read
 * transcript. Used by ClassicCommsCard, ClassicCommsFullView, and
 * CustomerFileV2 so all three surfaces stay consistent.
 */
export default function VoiceCallCard({ call, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  const direction = (call.direction || "").toLowerCase();
  const outcome = (call.outcome || call.status || "").toLowerCase();
  const isInbound = direction === "inbound" || direction === "in" || outcome.includes("voicemail");
  const isVoicemail = outcome.includes("voicemail");

  const DirIcon = isVoicemail ? MessageSquare : isInbound ? PhoneIncoming : PhoneOutgoing;
  const iconClass = isInbound ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100";

  const outcomeLabel = (call.outcome || call.status || "Call")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (s) => s.toUpperCase());
  const outcomeColor = OUTCOME_COLORS[outcome] || "bg-muted text-muted-foreground border-border";

  const dirLabel = isInbound ? "Inbound" : "Outbound";
  const meta = [
    fmtRelative(call.created_at),
    call.duration_seconds ? fmtDuration(call.duration_seconds) : null,
    call.phone_number,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasTranscript = !!(call.transcript && call.transcript.trim().length > 0);
  const hasRecording = !!call.recording_url;
  const hasDetail = hasTranscript || hasRecording;

  const padding = compact ? "p-3" : "p-4";
  const iconSize = compact ? "w-7 h-7" : "w-9 h-9";

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${padding} flex items-start gap-3`}>
      <div className={`${iconSize} rounded-full ${iconClass} flex items-center justify-center shrink-0 mt-0.5`}>
        <DirIcon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${outcomeColor}`}>
            {outcomeLabel}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">{dirLabel}</span>
          {meta && <span className="text-[11px] text-slate-400">· {meta}</span>}
        </div>

        {call.performed_by && (
          <div className="text-[11px] text-slate-500 mt-0.5">
            <Phone className="w-3 h-3 inline mr-1" />
            {call.performed_by}
          </div>
        )}

        {call.summary && (
          <p className={`${compact ? "text-[12px]" : "text-[13px]"} italic text-slate-700 mt-1.5`}>
            "{call.summary}"
          </p>
        )}

        {hasRecording && (
          <div className="mt-2">
            <audio
              controls
              preload="none"
              src={call.recording_url || undefined}
              className="w-full max-w-[420px] h-9"
            >
              <a href={call.recording_url || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                Open recording <ExternalLink className="w-3 h-3" />
              </a>
            </audio>
          </div>
        )}

        {hasDetail && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide transcript" : "Show transcript"}
          </button>
        )}

        {expanded && hasTranscript && (
          <pre className={`${compact ? "text-[11.5px]" : "text-[12px]"} text-slate-600 mt-2 p-3 bg-slate-50 rounded-md whitespace-pre-wrap font-sans leading-relaxed max-h-[320px] overflow-y-auto`}>
            {call.transcript}
          </pre>
        )}
      </div>
    </div>
  );
}
