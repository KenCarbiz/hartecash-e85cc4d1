/**
 * CustomerFileV2 — Conversation-first customer file slide-out.
 *
 * Drop-in alternative to SubmissionDetailSheet, used when
 * site_config.file_layout === "conversation". Accepts the IDENTICAL
 * props interface so AdminDashboard can swap them with one line.
 *
 * Layout (per Admin Refresh mockup):
 *   [ Accent header — customer · vehicle · offer ]
 *   [ Tabs — Conversation (default) | Activity | Deal | Vehicle ]
 *   [ 60/40 split: primary tab content | context rail ]
 *
 * The Classic SubmissionDetailSheet (~1.6k lines) is preserved untouched.
 * This V2 reuses adminConstants types and the same Sheet primitive so
 * Radix owns the open/close animation just like V1.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Activity, FileText, Car, X, Printer, StickyNote,
  Phone, Mail, Flame, ChevronDown, ChevronUp, Send, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import type { Submission, DealerLocation } from "@/lib/adminConstants";
import { ALL_STATUS_OPTIONS, getStatusLabel } from "@/lib/adminConstants";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CustomerFileAccentStyle from "./CustomerFileAccentStyle";
import SubmissionNotesModal, { fetchSubmissionNotes, type SubmissionNote } from "./SubmissionNotesModal";

interface CustomerFileV2Props {
  selected: Submission | null;
  onClose: () => void;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  activityLog: {
    id: string;
    action: string;
    old_value: string | null;
    new_value: string | null;
    performed_by: string | null;
    created_at: string;
  }[];
  duplicateWarnings: Record<string, string[]>;
  optOutStatus: { email: boolean; sms: boolean };
  selectedApptTime: string | null;
  selectedApptLocation: string | null;
  dealerLocations: DealerLocation[];
  canSetPrice: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canUpdateStatus: boolean;
  auditLabel: string;
  userName: string;
  onUpdate: (updated: Submission) => void;
  onDelete: (id: string) => void;
  onRefresh: (sub: Submission) => void;
  onScheduleAppointment: (sub: Submission) => void;
  onDeletePhoto: (fileName: string) => void;
  onDeleteDoc: (docType: string, fileName: string) => void;
  fetchActivityLog: (id: string) => void;
  fetchSubmissions: () => void;
}

type TabId = "conversation" | "activity" | "deal" | "vehicle";

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString()}`;

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

export default function CustomerFileV2(props: CustomerFileV2Props) {
  const { selected, onClose, activityLog, photos, docs, fetchActivityLog } = props;
  const { config } = useSiteConfig();
  const [tab, setTab] = useState<TabId>("conversation");

  // Refresh activity when a new submission is opened
  useEffect(() => {
    if (selected?.id) fetchActivityLog(selected.id);
  }, [selected?.id, fetchActivityLog]);

  const open = !!selected;

  // Reset to default tab on each open
  useEffect(() => {
    if (open) setTab("conversation");
  }, [open]);

  const sub = selected;

  const dealValue = useMemo(() => {
    if (!sub) return null;
    return sub.offered_price ?? sub.estimated_offer_high ?? null;
  }, [sub]);
  const dealKind = sub?.offered_price != null ? "Offer Given" : "Estimated Offer";

  return (
    <>
      <CustomerFileAccentStyle />
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-[1100px] flex flex-col bg-slate-50 dark:bg-slate-950 [&>button]:hidden"
          data-customer-file-v2
        >
          {sub && (
            <>
              <V2Header
                sub={sub}
                dealValue={dealValue}
                dealKind={dealKind}
                onClose={onClose}
                headerLayout={(((config as { customer_file_header_layout?: string }).customer_file_header_layout) as "a" | "b" | "c" | undefined) || "b"}
              />
              <V2Tabs tab={tab} onChange={setTab} unread={0} />
              <div className="flex-1 min-h-0 flex">
                <main className="flex-1 min-w-0 overflow-y-auto">
                  {tab === "conversation" && <ConversationTab sub={sub} activityLog={activityLog} />}
                  {tab === "activity" && <ActivityTab activityLog={activityLog} />}
                  {tab === "deal" && <DealTab sub={sub} auditLabel={props.auditLabel} onUpdate={props.onUpdate} />}
                  {tab === "vehicle" && <VehicleTab sub={sub} photos={photos} docs={docs} onUpdate={props.onUpdate} />}
                </main>
                <aside className="hidden lg:block w-[340px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 overflow-y-auto">
                  <ContextRail
                    sub={sub}
                    photos={photos}
                    docs={docs}
                    apptTime={props.selectedApptTime}
                    apptLocation={props.selectedApptLocation}
                    auditLabel={props.auditLabel}
                    onUpdate={props.onUpdate}
                  />
                </aside>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ─────────────── HEADER IDENTITY ROWS (A / B / C) ─────────────── */
function V2Identity({
  sub, dealValue, dealKind, layout,
}: {
  sub: Submission;
  dealValue: number | null;
  dealKind: string;
  layout: "a" | "b" | "c";
}) {
  const vehicleTitle = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "—";

  const Money = (
    <div className="text-left md:text-right">
      <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">{dealKind}</div>
      <div className="text-[36px] font-bold leading-none mt-0.5 font-mono">{fmtMoney(dealValue)}</div>
      {sub.acv_value != null && dealValue != null && (
        <div className="text-[11px] text-white/70 mt-1">
          ACV {fmtMoney(sub.acv_value)} ·{" "}
          <span className="text-emerald-300 font-semibold">
            +{fmtMoney(dealValue - Number(sub.acv_value))}
          </span>
        </div>
      )}
    </div>
  );

  const VehicleStrip = (
    <div className="flex items-center gap-2 flex-wrap text-[12px] text-white/80 mt-1">
      {sub.vin && <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider">{sub.vin}</span>}
      {sub.mileage != null && (<><span>·</span><span>{Number(sub.mileage).toLocaleString()} mi</span></>)}
      {sub.exterior_color && (<><span>·</span><span>{sub.exterior_color}</span></>)}
    </div>
  );

  const Contact = (
    <div className="space-y-0.5 text-[13px] text-white/85 mt-1">
      {sub.phone ? (
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3 shrink-0" />
          <a href={`tel:${sub.phone}`} className="hover:underline">{sub.phone}</a>
        </div>
      ) : (
        <div className="text-white/40 text-[12px] italic">No phone on file</div>
      )}
      {sub.email ? (
        <div className="flex items-center gap-1.5 truncate">
          <Mail className="w-3 h-3 shrink-0" />
          <a href={`mailto:${sub.email}`} className="truncate hover:underline">{sub.email}</a>
        </div>
      ) : (
        <div className="text-white/40 text-[12px] italic">No email on file</div>
      )}
    </div>
  );

  // ── A: Vehicle-first
  if (layout === "a") {
    return (
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">
            {sub.vehicle_year}{sub.mileage ? ` · ${Number(sub.mileage).toLocaleString()} mi` : ""}
          </div>
          <div className="text-[28px] font-bold leading-tight mt-0.5">
            {[sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "—"}
          </div>
          {VehicleStrip}
        </div>
        {Money}
      </div>
    );
  }

  // ── C: Stacked
  if (layout === "c") {
    return (
      <>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">Customer</div>
            <div className={`text-[24px] font-bold leading-tight mt-0.5 ${!sub.name ? "text-white/60 italic" : ""}`}>
              {sub.name || "Unknown customer"}
            </div>
            <div className="text-[12px] text-white/80 mt-1 flex items-center gap-3 flex-wrap">
              {sub.phone && <a href={`tel:${sub.phone}`} className="hover:underline">{sub.phone}</a>}
              {sub.phone && sub.email && <span className="text-white/50">·</span>}
              {sub.email && <a href={`mailto:${sub.email}`} className="hover:underline truncate">{sub.email}</a>}
            </div>
          </div>
          {Money}
        </div>
        <div className="h-px bg-white/15 my-3" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">Vehicle</div>
          <div className="text-[20px] font-bold leading-tight mt-0.5">{vehicleTitle}</div>
          {VehicleStrip}
        </div>
      </>
    );
  }

  // ── B (default): Customer-first, vehicle-right — 12-col grid
  return (
    <div className="grid grid-cols-12 gap-6 items-start">
      <div className="col-span-12 md:col-span-4 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">Customer</div>
        <div className={`text-[26px] font-bold leading-tight mt-0.5 truncate ${!sub.name ? "text-white/60 italic" : ""}`}>
          {sub.name || "Unknown customer"}
        </div>
        {Contact}
      </div>
      <div className="col-span-12 md:col-span-5 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">Vehicle</div>
        <div className="text-[22px] font-bold leading-tight mt-0.5 truncate">{vehicleTitle}</div>
        {VehicleStrip}
      </div>
      <div className="col-span-12 md:col-span-3">{Money}</div>
    </div>
  );
}

/* ─────────────── HEADER ─────────────── */
function V2Header({
  sub,
  dealValue,
  dealKind,
  onClose,
  headerLayout = "b",
}: {
  sub: Submission;
  dealValue: number | null;
  dealKind: string;
  onClose: () => void;
  headerLayout?: "a" | "b" | "c";
}) {
  return (
    <header
      className="shrink-0 text-white"
      style={{
        background:
          "linear-gradient(to right, var(--customer-file-accent, #003b80) 0%, var(--customer-file-accent-2, #005bb5) 100%)",
      }}
    >
      <div className="px-6 pt-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold"
            >
              <StickyNote className="w-3.5 h-3.5 mr-1.5" />
              Notes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        </div>

        <V2Identity sub={sub} dealValue={dealValue} dealKind={dealKind} layout={headerLayout} />

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {sub.progress_status && (
            <Badge className="bg-white/15 text-white border-0 text-[11px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {sub.progress_status.replace(/_/g, " ")}
            </Badge>
          )}
          {(() => {
            const intent = intentFromSource(sub.lead_source);
            const intentLabel = intent === "trade" ? "Trade-In" : intent === "unsure" ? "Unsure" : "Sell";
            const intentCls =
              intent === "trade"  ? "bg-sky-400/25 text-sky-100 border border-sky-300/40" :
              intent === "unsure" ? "bg-amber-400/25 text-amber-100 border border-amber-300/40" :
                                    "bg-emerald-400/25 text-emerald-100 border border-emerald-300/40";
            return (
              <Badge className={`${intentCls} text-[11px] uppercase tracking-wider font-bold`}>
                {intentLabel}
              </Badge>
            );
          })()}
          {sub.offered_price != null && sub.offered_price > 0 && (
            <Badge className="bg-emerald-400/90 text-emerald-950 border-0 text-[11px] uppercase tracking-wider font-bold">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Offer Accepted
            </Badge>
          )}
          {sub.is_hot_lead && (
            <Badge className="bg-amber-400/90 text-amber-950 border-0 text-[11px] uppercase tracking-wider font-bold">
              <Flame className="w-3 h-3 mr-1" /> Hot Lead
            </Badge>
          )}
          {sub.created_at && (
            <span className="text-[11px] text-white/60 ml-auto">
              Submitted {new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─────────────── TABS ─────────────── */
function V2Tabs({
  tab,
  onChange,
  unread,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  unread: number;
}) {
  const items: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "conversation", label: "Conversation", icon: MessageSquare },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "deal", label: "Deal", icon: FileText },
    { id: "vehicle", label: "Vehicle", icon: Car },
  ];
  return (
    <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-1">
      {items.map((t) => {
        const active = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative px-3.5 py-3 text-[12.5px] font-semibold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
              active
                ? "text-[var(--customer-file-accent,#003b80)]"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            style={
              active
                ? { borderColor: "var(--customer-file-accent, #003b80)" }
                : undefined
            }
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
            {t.id === "conversation" && unread > 0 && !active && (
              <span className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────── TAB: CONVERSATION (Activity + Follow-ups timeline) ─────────────── */
type TimelineEvent = {
  id: string;
  ts: string;
  kind: "follow_up" | "notification" | "activity";
  channel?: string;
  status?: string;
  title: string;
  detail?: string;
  who?: string;
};

const CHANNEL_ICON: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
  push: Send,
};

function statusTone(status?: string): { icon: React.ElementType; cls: string } {
  if (!status) return { icon: Clock, cls: "text-slate-400" };
  if (["sent", "delivered", "success"].includes(status)) return { icon: CheckCircle2, cls: "text-emerald-500" };
  if (["failed", "error", "bounced"].includes(status)) return { icon: AlertCircle, cls: "text-red-500" };
  return { icon: Clock, cls: "text-amber-500" };
}

/* ─────────────── TAB: CONVERSATION (full SMS / Email / Calls / Unified threads) ─────────────── */

type ConvChannel = "sms" | "email" | "calls" | "unified";

interface ConvMessage {
  id: string;
  channel: "sms" | "email";
  direction: "in" | "out";
  actor_label: string | null;
  body_text: string | null;
  occurred_at: string;
}

interface ConvCall {
  id: string;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  summary: string | null;
  created_at: string;
}

const fmtConvTime = (iso: string) => {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (h < 48) return "Yesterday " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtConvDuration = (s: number | null) => {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const AI_TONES = [
  { k: "friendly",     label: "Friendly" },
  { k: "professional", label: "Professional" },
  { k: "urgent",       label: "Urgent" },
  { k: "brief",        label: "Brief" },
] as const;

const SMS_TEMPLATES = [
  { k: "follow_up",          label: "Follow up on offer",   body: "Hi {first}, just checking in on the offer we sent — happy to talk through any questions." },
  { k: "confirm_appointment",label: "Confirm appointment",  body: "Hi {first}, confirming we're set for your appointment — see you then!" },
  { k: "nudge",              label: "Nudge (no response)",  body: "Hi {first}, didn't want to lose you in the shuffle — does the offer still work, or want to talk through it?" },
  { k: "they_arrived",       label: "They just arrived",    body: "Walking out to meet you now — give me 60 seconds." },
  { k: "ask_loan_payoff",    label: "Ask about loan payoff",body: "Hi {first}, quick one — do you have the current payoff amount on the loan? Helps us finalize numbers." },
] as const;

function ConversationTab({
  sub,
  activityLog: _activityLog,
}: {
  sub: Submission;
  activityLog: CustomerFileV2Props["activityLog"];
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<ConvChannel>("sms");
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [calls, setCalls] = useState<ConvCall[]>([]);
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<typeof AI_TONES[number]["k"]>("friendly");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [{ data: convData }, { data: callData }] = await Promise.all([
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ConvMessage[] | null }> } } } } })
        .from("conversation_events")
        .select("id, channel, direction, actor_label, body_text, occurred_at")
        .eq("submission_id", sub.id)
        .order("occurred_at", { ascending: true })
        .limit(200),
      (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: ConvCall[] | null }> } } } } })
        .from("voice_call_log")
        .select("id, status, outcome, duration_seconds, summary, created_at")
        .eq("submission_id", sub.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setMessages((convData || []).filter((m) => m.channel === "sms" || m.channel === "email"));
    setCalls(callData || []);
  }, [sub.id]);

  useEffect(() => { void load(); }, [load]);

  const smsMessages   = messages.filter((m) => m.channel === "sms");
  const emailMessages = messages.filter((m) => m.channel === "email");

  const counts: Record<ConvChannel, number> = {
    sms: smsMessages.length,
    email: emailMessages.length,
    calls: calls.length,
    unified: smsMessages.length + emailMessages.length + calls.length,
  };

  const charLimit = channel === "sms" ? 160 : 1000;
  const composerDisabled = channel === "calls"
    || (channel === "sms" && !sub.phone)
    || (channel === "email" && !sub.email);

  const applyTemplate = (t: typeof SMS_TEMPLATES[number]) => {
    const first = (sub.name || "there").split(/\s+/)[0];
    setDraft(t.body.replace("{first}", first));
  };

  const refineWithAi = () => {
    // UI-only stub for now — future: call edge function with current draft + tone.
    toast({ title: "AI refine not wired yet", description: `Tone: ${tone}. Draft will be polished here.` });
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || composerDisabled || sending) return;
    setSending(true);
    const { error } = await (supabase as never as {
      from: (t: string) => { insert: (rows: unknown) => Promise<{ error: { message: string } | null }> };
    })
      .from("conversation_events")
      .insert({
        submission_id: sub.id,
        channel: channel === "calls" ? "sms" : channel,
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
    setDraft("");
    void load();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs: SMS / Email / Calls / Unified */}
      <div className="shrink-0 flex items-center border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4">
        {(["sms", "email", "calls", "unified"] as ConvChannel[]).map((c) => {
          const active = c === channel;
          return (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`h-10 px-4 text-[12px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5 transition border-b-2 ${
                active
                  ? "text-slate-900 dark:text-slate-100 border-[var(--customer-file-accent,#003b80)]"
                  : "text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {c === "calls" ? "Calls" : c === "unified" ? "Unified" : c.toUpperCase()}
              {counts[c] > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold ${
                  active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}>{counts[c]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body — thread for active channel */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 dark:bg-slate-950">
        {channel === "sms" && (
          smsMessages.length === 0 ? (
            <div className="text-center text-[13px] text-slate-400 italic py-12">
              {sub.phone ? `No SMS yet — start a thread with ${(sub.name || "the customer").split(/\s+/)[0]} below.` : "No phone number on file."}
            </div>
          ) : (
            <div className="space-y-3 max-w-[640px] mx-auto">
              {smsMessages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    <div className={`px-4 py-2 rounded-2xl text-[13.5px] leading-snug ${
                      m.direction === "out"
                        ? "bg-[var(--customer-file-accent,#003b80)] text-white rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm shadow-sm"
                    }`}>
                      {m.body_text}
                    </div>
                    <div className={`text-[11px] text-slate-400 mt-1 ${m.direction === "out" ? "text-right" : "text-left"}`}>
                      {fmtConvTime(m.occurred_at)}{m.actor_label && m.direction === "out" ? ` · ${m.actor_label}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {channel === "email" && (
          emailMessages.length === 0 ? (
            <div className="text-center text-[13px] text-slate-400 italic py-12">
              {sub.email ? "No email threads yet." : "No email on file."}
            </div>
          ) : (
            <div className="space-y-3 max-w-[760px] mx-auto">
              {emailMessages.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-[12.5px] font-bold text-slate-900">{m.actor_label || (m.direction === "in" ? "Customer" : "You")}</span>
                    <span className="text-[11px] text-slate-400">{fmtConvTime(m.occurred_at)}</span>
                  </div>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{m.body_text}</p>
                </div>
              ))}
            </div>
          )
        )}

        {channel === "calls" && (
          calls.length === 0 ? (
            <div className="text-center text-[13px] text-slate-400 italic py-12">No call history.</div>
          ) : (
            <div className="space-y-2 max-w-[760px] mx-auto">
              {calls.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-slate-900 capitalize">
                      {(c.outcome || c.status || "Call").replace(/_/g, " ")}
                    </div>
                    {c.summary && <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-2">{c.summary}</p>}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 shrink-0">
                    <div className="font-semibold text-slate-700">{fmtConvDuration(c.duration_seconds)}</div>
                    <div>{fmtConvTime(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {channel === "unified" && (
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
                        <span className="text-[11px] text-slate-400">{fmtConvTime(row.ts)}</span>
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

      {/* AI Assist + Templates + Composer */}
      {channel !== "calls" && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 space-y-2.5">
          {/* AI Assist tone strip */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mr-1">⚡ AI Assist</span>
            {AI_TONES.map((t) => (
              <button
                key={t.k}
                onClick={() => setTone(t.k)}
                className={`text-[11px] font-semibold px-2.5 h-6 rounded-md border transition ${
                  tone === t.k
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Templates */}
          {channel === "sms" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Templates</span>
              {SMS_TEMPLATES.map((t) => (
                <button
                  key={t.k}
                  onClick={() => applyTemplate(t)}
                  className="text-[11px] font-semibold px-2.5 h-6 rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
            }}
            placeholder={composerDisabled
              ? (channel === "sms" ? "No phone number on file." : "No email on file.")
              : "Type your message… or use AI Assist above"}
            rows={2}
            disabled={composerDisabled}
            className="w-full text-[13px] rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] ${draft.length > charLimit ? "text-red-600 font-bold" : "text-slate-400"}`}>
              {draft.length}/{charLimit} chars
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={refineWithAi}
                disabled={!draft.trim()}
                className="text-[11px] font-semibold px-3 h-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Refine
              </button>
              <button
                onClick={() => void send()}
                disabled={!draft.trim() || sending || composerDisabled || draft.length > charLimit}
                className="text-[12px] font-bold px-3.5 h-8 rounded-md bg-[var(--customer-file-accent,#003b80)] hover:opacity-90 disabled:bg-slate-300 text-white transition"
              >
                {sending ? "Sending…" : `Send ${channel === "sms" ? "SMS" : "Email"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── TAB: ACTIVITY (matches design screenshot 2) ─────────────── */
type ActivityKind = "all" | "messages" | "calls" | "status" | "notes";

const activityKindOf = (action: string): { kind: ActivityKind; label: string; cls: string } => {
  const a = action.toLowerCase();
  if (a.includes("sms") && a.includes("in")) return { kind: "messages", label: "SMS IN", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (a.includes("sms") && a.includes("out")) return { kind: "messages", label: "SMS OUT", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (a.includes("sms")) return { kind: "messages", label: "SMS", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (a.includes("email") && a.includes("in")) return { kind: "messages", label: "EMAIL IN", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (a.includes("email") && a.includes("out")) return { kind: "messages", label: "EMAIL OUT", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (a.includes("email")) return { kind: "messages", label: "EMAIL", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (a.includes("call")) return { kind: "calls", label: "CALL", cls: "bg-purple-50 text-purple-700 border-purple-200" };
  if (a.includes("note")) return { kind: "notes", label: "NOTE", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (a.includes("status")) return { kind: "status", label: "STATUS", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return { kind: "status", label: action.toUpperCase().slice(0, 12), cls: "bg-slate-100 text-slate-600 border-slate-200" };
};

function ActivityTab({
  activityLog,
}: {
  activityLog: CustomerFileV2Props["activityLog"];
}) {
  const [filter, setFilter] = useState<ActivityKind>("all");

  const filters: { k: ActivityKind; label: string }[] = [
    { k: "all", label: "All" },
    { k: "messages", label: "Messages" },
    { k: "calls", label: "Calls" },
    { k: "status", label: "Status" },
    { k: "notes", label: "Notes" },
  ];

  const enriched = (activityLog || []).map((a) => ({ ...a, _kind: activityKindOf(a.action) }));
  const visible = filter === "all" ? enriched : enriched.filter((a) => a._kind.kind === filter);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700 dark:text-slate-300">Activity Timeline</h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => {
            const active = filter === f.k;
            return (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                className={`text-[11px] font-semibold px-2.5 h-7 rounded-md border transition ${
                  active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          {activityLog?.length ? "No activity matches this filter." : "No activity yet."}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <span className={`shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 border ${a._kind.cls}`}>
                {a._kind.label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-slate-900 dark:text-slate-100 leading-snug">
                  <span className="font-semibold">{(a.performed_by || "System")}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500">{fmtTime(a.created_at)}</span>
                </div>
                <div className="text-[12.5px] text-slate-700 dark:text-slate-300 mt-0.5 leading-snug">
                  {a.old_value && a.new_value
                    ? <>{a.action.replace(/_/g, " ")}: <span className="text-slate-500">{a.old_value}</span> → <span className="font-semibold">{a.new_value}</span></>
                    : a.new_value || a.action.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── INLINE EDIT PRIMITIVE (used by Deal + Vehicle tabs) ─────────────── */
function V2Inline({
  value, onSave, type = "text", placeholder = "—", mono = false,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => { setDraft(value ?? ""); }, [value]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim() === "" ? null : draft.trim();
    if (v !== value) onSave(v);
  };

  if (editing) {
    return (
      <input
        type={type}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className={`w-full text-right text-[13px] ${mono ? "font-mono" : ""} px-2 py-1 -mx-2 -my-1 rounded-md border border-blue-400 bg-white outline-none focus:ring-2 focus:ring-blue-100`}
      />
    );
  }

  const empty = value == null || value === "";
  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={`w-full text-right text-[13px] ${mono ? "font-mono" : ""} px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-colors cursor-text`}
      title="Click to edit"
    >
      <span className={empty ? "text-slate-400 italic" : "text-slate-900 dark:text-slate-100 font-semibold"}>
        {empty ? placeholder : value}
      </span>
    </button>
  );
}

async function saveSubmissionField<K extends keyof Submission>(id: string, field: K, value: Submission[K]) {
  return (supabase as never as { from: (t: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<unknown> } } })
    .from("submissions").update({ [field]: value }).eq("id", id);
}

function intentFromSource(lead_source: string | null | undefined): string {
  switch (lead_source) {
    case "trade":
    case "in_store_trade": return "trade";
    case "service": return "unsure";
    case "inventory":
    default: return "sell";
  }
}

function leadSourceLabel(lead_source: string | null | undefined): string {
  switch (lead_source) {
    case "trade": return "Trade-in form";
    case "in_store_trade": return "In-store trade";
    case "inventory": return "Off-street purchase";
    case "service": return "Service drive";
    default: return lead_source || "—";
  }
}

/* ─────────────── TAB: DEAL (matches design screenshot 3) ─────────────── */
function DealTab({
  sub, auditLabel, onUpdate,
}: {
  sub: Submission;
  auditLabel: string;
  onUpdate: (updated: Submission) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<SubmissionNote[]>([]);

  useEffect(() => {
    if (!sub.id) return;
    let cancelled = false;
    fetchSubmissionNotes(sub.id).then((rows) => { if (!cancelled) setNotes(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sub.id, notesOpen]);

  function save<K extends keyof Submission>(field: K, value: Submission[K]) {
    const next = { ...sub, [field]: value };
    onUpdate(next);
    void saveSubmissionField(sub.id, field, value);
  }

  return (
    <div className="p-6 space-y-3">
      <DealCard
        title="Customer"
        right={<span className="text-[10.5px] text-slate-400 italic">Click any field to edit</span>}
      >
        <DealRow label="Full Name"><V2Inline value={sub.name} onSave={(v) => save("name", v)} placeholder="Add name…" /></DealRow>
        <DealRow label="Phone"><V2Inline value={sub.phone} onSave={(v) => save("phone", v)} type="tel" placeholder="Add phone…" /></DealRow>
        <DealRow label="Email"><V2Inline value={sub.email} onSave={(v) => save("email", v)} type="email" placeholder="Add email…" /></DealRow>
        <DealRow label="Address"><V2Inline value={sub.address_street} onSave={(v) => save("address_street", v)} placeholder="Add street…" /></DealRow>
        <DealRow label="City / State / Zip">
          <span className="flex items-center gap-1 justify-end">
            <V2Inline value={sub.address_city} onSave={(v) => save("address_city", v)} placeholder="City" />
            <V2Inline value={sub.address_state} onSave={(v) => save("address_state", v)} placeholder="ST" />
            <V2Inline value={sub.zip} onSave={(v) => save("zip", v)} placeholder="ZIP" />
          </span>
        </DealRow>
      </DealCard>

      <DealCard
        title="Vehicle"
        right={<span className="text-[10.5px] text-slate-400 italic">Click any field to edit</span>}
      >
        <DealRow label="Year"><V2Inline value={sub.vehicle_year} onSave={(v) => save("vehicle_year", v)} placeholder="—" /></DealRow>
        <DealRow label="Make"><V2Inline value={sub.vehicle_make} onSave={(v) => save("vehicle_make", v)} placeholder="—" /></DealRow>
        <DealRow label="Model"><V2Inline value={sub.vehicle_model} onSave={(v) => save("vehicle_model", v)} placeholder="—" /></DealRow>
        <DealRow label="Trim"><V2Inline value={sub.vehicle_trim} onSave={(v) => save("vehicle_trim", v)} placeholder="Add trim…" /></DealRow>
        <DealRow label="Color"><V2Inline value={sub.exterior_color} onSave={(v) => save("exterior_color", v)} placeholder="—" /></DealRow>
        <DealRow label="VIN"><V2Inline value={sub.vin} onSave={(v) => save("vin", v)} mono placeholder="—" /></DealRow>
        <DealRow label="Plate"><V2Inline value={sub.plate} onSave={(v) => save("plate", v)} mono placeholder="—" /></DealRow>
        <DealRow label="Mileage"><V2Inline value={sub.mileage} onSave={(v) => save("mileage", v)} placeholder="—" /></DealRow>
      </DealCard>

      <DealCard title="Intent & Deal">
        <DealRow label="Intent">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{intentFromSource(sub.lead_source)}</span>
        </DealRow>
        <DealRow label="Submitted">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{fmtTime(sub.created_at)}</span>
        </DealRow>
        <DealRow label="Source">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{leadSourceLabel(sub.lead_source)}</span>
        </DealRow>
        <DealRow label="Assigned To">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{sub.appraised_by || sub.status_updated_by || "—"}</span>
        </DealRow>
      </DealCard>

      <DealCard
        title="Notes"
        right={
          <button onClick={() => setNotesOpen(true)} className="text-[11px] font-bold text-[var(--customer-file-accent,#003b80)] hover:underline">
            + Add note
          </button>
        }
      >
        {notes.length === 0 ? (
          <div className="text-[12.5px] text-slate-400 italic py-1">No notes yet — click <span className="font-semibold not-italic text-slate-500">+ Add note</span> to leave the first one.</div>
        ) : (
          <div className="space-y-2.5">
            {notes.slice(0, 4).map((n) => (
              <div key={n.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100">{n.author || "Staff"}</span>
                  <span className="text-[11px] text-slate-400">{fmtTime(n.created_at)}</span>
                </div>
                <p className="text-[12.5px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
            {notes.length > 4 && (
              <button onClick={() => setNotesOpen(true)} className="text-[11px] font-semibold text-[var(--customer-file-accent,#003b80)] hover:underline pt-0.5">
                See all {notes.length} →
              </button>
            )}
          </div>
        )}
      </DealCard>

      <SubmissionNotesModal
        submissionId={sub.id}
        customerName={sub.name}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        author={auditLabel || "Staff"}
        onChange={() => fetchSubmissionNotes(sub.id).then(setNotes).catch(() => {})}
      />
    </div>
  );
}

/* Card + Row primitives used by Deal/Vehicle tabs */
function DealCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700 dark:text-slate-300">{title}</h3>
        {right}
      </div>
      <div className="px-5 py-2 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
}

function DealRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[12.5px] text-slate-500 shrink-0">{label}</span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
    </div>
  );
}

/* ─────────────── TAB: VEHICLE (matches design screenshot 4) ─────────────── */
const DL_IMAGE_RE_V2 = /\.(jpg|jpeg|png|gif|webp)$/i;

function VehicleTab({
  sub, photos, docs, onUpdate,
}: {
  sub: Submission;
  photos: { url: string; name: string }[];
  docs: { type: string; name: string; url: string }[];
  onUpdate: (updated: Submission) => void;
}) {
  const [dlOpen, setDlOpen] = useState(false);
  const [dlSide, setDlSide] = useState<"front" | "back">("front");

  function save<K extends keyof Submission>(field: K, value: Submission[K]) {
    const next = { ...sub, [field]: value };
    onUpdate(next);
    void saveSubmissionField(sub.id, field, value);
  }

  const dlFront = docs.find(d => (d.type === "drivers_license" || d.type === "drivers_license_front") && DL_IMAGE_RE_V2.test(d.name)) || null;
  const dlBack = docs.find(d => d.type === "drivers_license_back" && DL_IMAGE_RE_V2.test(d.name)) || null;
  const dlCur = dlSide === "back" && dlBack ? dlBack : dlFront;

  const inspectionDone = ["inspection_completed","appraisal_completed","manager_approval_inspection","price_agreed","deal_finalized","title_ownership_verified","check_request_submitted","purchase_complete"].includes(sub.progress_status);

  return (
    <div className="p-6 space-y-3">
      {/* Vehicle fields — inline-editable, mirrors Deal tab Vehicle section */}
      <DealCard title="Vehicle" right={<span className="text-[10.5px] text-slate-400 italic">Click any field to edit</span>}>
        <DealRow label="Year"><V2Inline value={sub.vehicle_year} onSave={(v) => save("vehicle_year", v)} placeholder="—" /></DealRow>
        <DealRow label="Make"><V2Inline value={sub.vehicle_make} onSave={(v) => save("vehicle_make", v)} placeholder="—" /></DealRow>
        <DealRow label="Model"><V2Inline value={sub.vehicle_model} onSave={(v) => save("vehicle_model", v)} placeholder="—" /></DealRow>
        <DealRow label="Trim"><V2Inline value={sub.vehicle_trim} onSave={(v) => save("vehicle_trim", v)} placeholder="Add trim…" /></DealRow>
        <DealRow label="Color"><V2Inline value={sub.exterior_color} onSave={(v) => save("exterior_color", v)} placeholder="—" /></DealRow>
        <DealRow label="VIN"><V2Inline value={sub.vin} onSave={(v) => save("vin", v)} mono placeholder="—" /></DealRow>
        <DealRow label="Plate"><V2Inline value={sub.plate} onSave={(v) => save("plate", v)} mono placeholder="—" /></DealRow>
        <DealRow label="Mileage"><V2Inline value={sub.mileage} onSave={(v) => save("mileage", v)} placeholder="—" /></DealRow>
        <DealRow label="Drivable">
          <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{sub.drivable || "—"}</span>
        </DealRow>
      </DealCard>

      {/* Photos grid — up to 6 thumbnails */}
      <DealCard
        title={`Vehicle Photos${photos.length > 0 ? ` · ${photos.length}` : ""}`}
      >
        {photos.length === 0 ? (
          <div className="text-[12.5px] text-slate-400 italic py-2">No photos uploaded yet.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.slice(0, 12).map((p, i) => (
              <a key={`${p.name}-${i}`} href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] rounded-md overflow-hidden bg-slate-200 hover:opacity-90 transition">
                <img src={p.url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </DealCard>

      {/* Driver's License — verified-on-file badge + click to expand inline */}
      <DealCard
        title="Driver's License"
        right={
          (dlFront || dlBack) ? (
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-0.5">
              Verified on file
            </span>
          ) : (
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5">
              Not uploaded
            </span>
          )
        }
      >
        {!dlFront && !dlBack ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-16 h-10 rounded bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-300" />
            </div>
            <div className="text-[12.5px] text-slate-500">Customer uploads via QR link.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button onClick={() => setDlOpen((v) => !v)} className="w-full flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-1.5 rounded-md transition text-left">
              <div className="w-16 h-10 rounded overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                {dlCur && <img src={dlCur.url} alt={`Driver's license — ${dlSide}`} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Match to customer name</div>
                <div className="text-[12px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[var(--customer-file-accent,#003b80)]">{dlOpen ? "Hide" : "View"}</span>
            </button>
            {dlOpen && dlCur && (
              <div className="space-y-2">
                <img src={dlCur.url} alt={`DL ${dlSide}`} className="w-full rounded-md border border-slate-200" />
                {dlBack && (
                  <div className="flex gap-1.5 text-[11px] font-semibold">
                    <button
                      onClick={() => setDlSide("front")}
                      className={`flex-1 py-1.5 rounded-md border transition ${dlSide === "front" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >Front</button>
                    <button
                      onClick={() => setDlSide("back")}
                      className={`flex-1 py-1.5 rounded-md border transition ${dlSide === "back" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >Back</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DealCard>

      {/* Inspection Summary — pending or completed */}
      <DealCard
        title="Inspection Summary"
        right={
          inspectionDone ? (
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-0.5">
              Completed
            </span>
          ) : (
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-0.5">
              Pending
            </span>
          )
        }
      >
        {inspectionDone ? (
          <div className="space-y-3">
            {sub.overall_condition && (
              <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{sub.overall_condition}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-emerald-700">Tires</div>
                <div className="text-[13px] font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                </div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-emerald-700">Brakes</div>
                <div className="text-[13px] font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                </div>
              </div>
            </div>
            <button className="w-full h-9 rounded-md border border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-[12px] font-semibold text-slate-700 dark:text-slate-300 transition">
              Open Full Appraisal Tool
            </button>
          </div>
        ) : (
          <div className="text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
            No inspection yet — tires and brakes pass/fail will appear here once the car has been walked.
          </div>
        )}
      </DealCard>
    </div>
  );
}

/* ─────────────── CONTEXT RAIL (matches design screenshot 5) ─────────────── */
function ContextRail({
  sub,
  photos,
  docs,
  apptTime,
  apptLocation,
  auditLabel,
  onUpdate,
}: {
  sub: Submission;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  apptTime: string | null;
  apptLocation: string | null;
  auditLabel: string;
  onUpdate: (updated: Submission) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<SubmissionNote[]>([]);

  const refreshNotes = useCallback(async (subId: string) => {
    try { setNotes(await fetchSubmissionNotes(subId)); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (sub.id) void refreshNotes(sub.id);
  }, [sub.id, refreshNotes]);

  // Compute Next Action from progress_status — matches Classic helper.
  const nextAction = (() => {
    if (sub.progress_status === "customer_arrived") return { label: "Customer Is Here", sub: "Walk to the car and start the inspection.", cta: "Start Inspection ›", tone: "red" };
    if (["new", "contacted"].includes(sub.progress_status)) return { label: "Make First Contact", sub: "Respond within SLA (2h).", cta: "Send First Text ›", tone: "amber" };
    if (sub.progress_status === "offer_accepted") return { label: "Schedule Appointment", sub: "Customer accepted — book the inspection.", cta: "Schedule Appointment ›", tone: "blue" };
    if (sub.progress_status === "inspection_scheduled") return { label: "Prepare for Inspection", sub: apptTime ? `Booked ${fmtTime(apptTime)}${apptLocation ? ` · ${apptLocation}` : ""}.` : "Inspection booked.", cta: "View Inspection ›", tone: "blue" };
    if (sub.progress_status === "inspection_completed") return { label: "Build the Offer", sub: "Inspection done. Set ACV and offer.", cta: "Open Appraisal ›", tone: "amber" };
    if (sub.progress_status === "purchase_complete") return { label: "Deal Closed", sub: "Great work. Consider a review request.", cta: "Send Review Request ›", tone: "green" };
    return { label: "Follow Up", sub: "Stay in touch with the customer.", cta: "Send Follow-Up ›", tone: "blue" };
  })();

  const toneBg = {
    blue:  "from-[#003b80] to-[#005bb5]",
    amber: "from-amber-600 to-amber-500",
    green: "from-emerald-700 to-emerald-600",
    red:   "from-red-600 to-red-500",
  }[nextAction.tone];

  const updateStatus = async (newStatus: string) => {
    const next = { ...sub, progress_status: newStatus };
    onUpdate(next);
    await (supabase as never as { from: (t: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<unknown> } } })
      .from("submissions").update({ progress_status: newStatus }).eq("id", sub.id);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Next Action — gradient header, white CTA */}
      <section className={`rounded-xl border border-slate-200 bg-gradient-to-br ${toneBg} text-white shadow-sm overflow-hidden`}>
        <div className="px-4 py-2.5 border-b border-white/15 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/80">Next Action</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 rounded px-2 py-0.5">For Sales</span>
        </div>
        <div className="p-4">
          <div className="font-semibold text-[18px] leading-tight">{nextAction.label}</div>
          <p className="text-[12px] text-white/80 mt-1 leading-snug">{nextAction.sub}</p>
          <button className="w-full mt-3 h-10 rounded-lg bg-white text-slate-900 text-[13px] font-bold hover:bg-white/90 transition">
            {nextAction.cta}
          </button>
        </div>
      </section>

      {/* Deal Status — "CURRENT" + Update select */}
      <RailCard title="Deal Status">
        <div className="space-y-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current</div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
              {sub.progress_status || "new_submission"}
            </div>
          </div>
          <Select value={sub.progress_status} onValueChange={updateStatus}>
            <SelectTrigger className="h-8 text-[12px] rounded-md w-full">
              <SelectValue placeholder="Update Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUS_OPTIONS.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </RailCard>

      {/* Offer Breakdown */}
      <RailCard title="Offer Breakdown">
        <div className="text-[13px] space-y-1">
          {sub.offered_price != null && (
            <Row label="Offer Given" value={fmtMoney(sub.offered_price)} compact highlight />
          )}
          {sub.estimated_offer_high != null && sub.offered_price == null && (
            <Row label="Estimated" value={fmtMoney(sub.estimated_offer_high)} compact />
          )}
          {sub.acv_value != null && (
            <Row label="ACV" value={fmtMoney(sub.acv_value)} compact />
          )}
          {sub.offered_price == null && sub.estimated_offer_high == null && sub.acv_value == null && (
            <span className="text-[12px] text-slate-400 italic">No offer yet.</span>
          )}
        </div>
      </RailCard>

      {/* Internal Notes — wires to submission_notes table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            Internal Notes
            {notes.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {notes.length}
              </span>
            )}
          </h3>
          <button onClick={() => setNotesOpen(true)} className="text-[11px] font-bold text-[var(--customer-file-accent,#003b80)] hover:underline">
            + Add
          </button>
        </div>
        <div className="px-3.5 py-2.5">
          {notes.length === 0 ? (
            <span className="text-[12px] text-slate-400 italic">No notes yet.</span>
          ) : (
            <div className="space-y-2.5">
              {notes.slice(0, 2).map((n) => (
                <div key={n.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[11.5px] font-bold text-slate-900">{n.author || "Staff"}</span>
                    <span className="text-[10.5px] text-slate-400">
                      {(() => {
                        const d = new Date(n.created_at);
                        const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
                        if (diffMin < 1) return "just now";
                        if (diffMin < 60) return `${diffMin}m`;
                        const h = Math.floor(diffMin / 60);
                        if (h < 24) return `${h}h`;
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      })()}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-700 leading-snug line-clamp-2">{n.body}</p>
                </div>
              ))}
              {notes.length > 2 && (
                <button onClick={() => setNotesOpen(true)} className="text-[11px] font-semibold text-[var(--customer-file-accent,#003b80)] hover:underline pt-0.5">
                  See all {notes.length} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* More details — collapsed, with caption */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-md transition"
      >
        <span className="flex items-center gap-1.5">
          {moreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          More details
        </span>
        <span className="text-[10.5px] font-normal text-slate-400">Photos · DL · Inspection</span>
      </button>

      {moreOpen && (
        <>
          <RailCard title={`Photos (${photos.length})`}>
            {photos.length === 0 ? (
              <p className="text-[12px] text-slate-500">No photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.slice(0, 6).map((p) => (
                  <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded overflow-hidden bg-slate-200">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </RailCard>
          <RailCard title={`Documents (${docs.length})`}>
            {docs.length === 0 ? (
              <p className="text-[12px] text-slate-500">No documents uploaded.</p>
            ) : (
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li key={d.name}>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--customer-file-accent,#003b80)] hover:underline truncate block">
                      {d.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </RailCard>
        </>
      )}

      <SubmissionNotesModal
        submissionId={sub.id}
        customerName={sub.name}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        author={auditLabel || "Staff"}
        onChange={() => void refreshNotes(sub.id)}
      />
    </div>
  );
}

/* ─────────────── PRIMITIVES ─────────────── */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden border-l-[3px]" style={{ borderLeftColor: "var(--customer-file-accent, #003b80)" }}>
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      <div className="px-5 py-3 divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
      </div>
      <div className="px-3.5 py-2.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${compact ? "py-0.5" : "py-2"}`}>
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={`text-[13px] ${mono ? "font-mono" : ""} ${
          highlight
            ? "font-bold text-[var(--customer-file-accent,#003b80)]"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
