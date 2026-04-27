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
              <V2Header sub={sub} dealValue={dealValue} dealKind={dealKind} onClose={onClose} />
              <V2Tabs tab={tab} onChange={setTab} unread={0} />
              <div className="flex-1 min-h-0 flex">
                <main className="flex-1 min-w-0 overflow-y-auto">
                  {tab === "conversation" && <ConversationTab sub={sub} activityLog={activityLog} />}
                  {tab === "activity" && <ActivityTab activityLog={activityLog} />}
                  {tab === "deal" && <DealTab sub={sub} />}
                  {tab === "vehicle" && <VehicleTab sub={sub} />}
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

/* ─────────────── HEADER ─────────────── */
function V2Header({
  sub,
  dealValue,
  dealKind,
  onClose,
}: {
  sub: Submission;
  dealValue: number | null;
  dealKind: string;
  onClose: () => void;
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

        <div className="grid grid-cols-12 gap-6 items-start">
          <div className="col-span-12 md:col-span-4 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">
              Customer
            </div>
            <div className="text-[26px] font-bold leading-tight mt-0.5 truncate">
              {sub.name}
            </div>
            <div className="space-y-0.5 text-[13px] text-white/85 mt-1">
              {sub.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {sub.phone}
                </div>
              )}
              {sub.email && (
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3 h-3 shrink-0" />{" "}
                  <span className="truncate">{sub.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-5 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">
              Vehicle
            </div>
            <div className="text-[22px] font-bold leading-tight mt-0.5 truncate">
              {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[12px] text-white/80 mt-1">
              {sub.vin && (
                <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider">
                  {sub.vin}
                </span>
              )}
              {sub.mileage != null && (
                <>
                  <span>·</span>
                  <span>{Number(sub.mileage).toLocaleString()} mi</span>
                </>
              )}
              {sub.exterior_color && (
                <>
                  <span>·</span>
                  <span>{sub.exterior_color}</span>
                </>
              )}
            </div>
          </div>

          <div className="col-span-12 md:col-span-3 text-left md:text-right">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">
              {dealKind}
            </div>
            <div className="text-[36px] font-bold leading-none mt-0.5 font-mono">
              {fmtMoney(dealValue)}
            </div>
            {sub.acv_value != null && dealValue != null && (
              <div className="text-[11px] text-white/70 mt-1">
                ACV {fmtMoney(sub.acv_value)} ·{" "}
                <span className="text-emerald-300 font-semibold">
                  +{fmtMoney(dealValue - Number(sub.acv_value))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
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
          {sub.progress_status && (
            <Badge className="bg-white/15 text-white border-0 text-[11px] uppercase tracking-wider font-bold">
              {sub.progress_status.replace(/_/g, " ")}
            </Badge>
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

function ConversationTab({
  sub,
  activityLog,
}: {
  sub: Submission;
  activityLog: CustomerFileV2Props["activityLog"];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: followUps }, { data: notifs }] = await Promise.all([
        supabase
          .from("follow_ups")
          .select("id, channel, status, touch_number, error_message, triggered_by, created_at")
          .eq("submission_id", sub.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("notification_log")
          .select("id, channel, status, recipient, trigger_key, error_message, created_at")
          .eq("submission_id", sub.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const merged: TimelineEvent[] = [];

      for (const f of followUps || []) {
        const touch = f.touch_number === 1 ? "Gentle Nudge" : f.touch_number === 2 ? "Value Add" : "Last Chance";
        merged.push({
          id: `f-${f.id}`,
          ts: f.created_at,
          kind: "follow_up",
          channel: f.channel,
          status: f.status,
          title: `Follow-up #${f.touch_number} · ${touch}`,
          detail: f.error_message || `Sent via ${f.channel}`,
          who: f.triggered_by || "System",
        });
      }

      for (const n of notifs || []) {
        merged.push({
          id: `n-${n.id}`,
          ts: n.created_at,
          kind: "notification",
          channel: n.channel,
          status: n.status,
          title: (n.trigger_key || "Notification").replace(/_/g, " "),
          detail: n.error_message || `${n.channel} → ${n.recipient}`,
          who: "System",
        });
      }

      for (const a of activityLog || []) {
        merged.push({
          id: `a-${a.id}`,
          ts: a.created_at,
          kind: "activity",
          title: a.action.replace(/_/g, " "),
          detail:
            a.old_value && a.new_value
              ? `${a.old_value} → ${a.new_value}`
              : a.new_value || undefined,
          who: a.performed_by || "System",
        });
      }

      merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setEvents(merged);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sub.id, activityLog]);

  return (
    <div className="p-6 space-y-4">
      {/* Quick send card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              Reach out to {sub.name?.split(" ")[0] || "customer"}
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Send a follow-up via {sub.email ? "email" : ""}{sub.email && sub.phone ? ", SMS, or call" : sub.phone ? "SMS or call" : ""}.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {sub.email && (
              <a
                href={`mailto:${sub.email}`}
                aria-label="Send email"
                className="group flex flex-col items-center gap-1"
              >
                <span className="w-11 h-11 rounded-full bg-[var(--customer-file-accent,#003b80)] text-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
                  <Mail className="w-4 h-4" />
                </span>
                <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">Email</span>
              </a>
            )}
            {sub.phone && (
              <a
                href={`sms:${sub.phone}`}
                aria-label="Send SMS"
                className="group flex flex-col items-center gap-1"
              >
                <span className="w-11 h-11 rounded-full bg-[var(--customer-file-accent,#003b80)] text-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">SMS</span>
              </a>
            )}
            {sub.phone && (
              <a
                href={`tel:${sub.phone}`}
                aria-label="Call customer"
                className="group flex flex-col items-center gap-1"
              >
                <span className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
                  <Phone className="w-4 h-4" />
                </span>
                <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">Call</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Communication Timeline
          </h3>
          <span className="text-[11px] text-slate-400">{events.length} events</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              No outreach yet. Send the first follow-up above.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((e) => {
              const ChIcon = e.channel ? CHANNEL_ICON[e.channel] || Send : Activity;
              const tone = statusTone(e.status);
              const StatusIcon = tone.icon;
              return (
                <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "color-mix(in srgb, var(--customer-file-accent, #003b80) 10%, transparent)" }}
                  >
                    <ChIcon className="w-4 h-4 text-[var(--customer-file-accent,#003b80)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {e.title}
                      </span>
                      {e.status && (
                        <StatusIcon className={`w-3.5 h-3.5 ${tone.cls}`} />
                      )}
                    </div>
                    {e.detail && (
                      <div className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                        {e.detail}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {e.who} · {fmtTime(e.ts)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

/* ─────────────── TAB: ACTIVITY ─────────────── */
function ActivityTab({
  activityLog,
}: {
  activityLog: CustomerFileV2Props["activityLog"];
}) {
  if (!activityLog?.length) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          No activity yet.
        </div>
      </div>
    );
  }
  return (
    <div className="p-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {activityLog.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-start gap-3">
            <div className="w-1.5 h-1.5 mt-2 rounded-full bg-[var(--customer-file-accent,#003b80)]" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-slate-900 dark:text-slate-100">
                <span className="font-semibold">{a.action.replace(/_/g, " ")}</span>
                {a.old_value && a.new_value && (
                  <span className="text-slate-500">
                    {" "}
                    — {a.old_value} → <span className="text-slate-900 dark:text-slate-100 font-medium">{a.new_value}</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {a.performed_by || "System"} · {fmtTime(a.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── TAB: DEAL ─────────────── */
function DealTab({ sub }: { sub: Submission }) {
  const loanBalanceNum =
    sub.loan_balance != null && sub.loan_balance !== ""
      ? Number(sub.loan_balance)
      : null;
  return (
    <div className="p-6 space-y-3">
      <Card title="Offer">
        <Row label="Estimated High" value={fmtMoney(sub.estimated_offer_high)} />
        <Row label="Offered Price" value={fmtMoney(sub.offered_price)} highlight />
        <Row label="ACV" value={fmtMoney(sub.acv_value)} />
      </Card>
      <Card title="Status">
        <Row label="Status" value={sub.progress_status?.replace(/_/g, " ") || "—"} />
        <Row label="Created" value={sub.created_at ? fmtTime(sub.created_at) : "—"} />
      </Card>
      {loanBalanceNum != null && (
        <Card title="Loan">
          <Row label="Lender" value={sub.loan_company || "—"} />
          <Row label="Balance" value={fmtMoney(loanBalanceNum)} />
          <Row label="Monthly Payment" value={sub.loan_payment || "—"} />
        </Card>
      )}
    </div>
  );
}

/* ─────────────── TAB: VEHICLE ─────────────── */
function VehicleTab({ sub }: { sub: Submission }) {
  return (
    <div className="p-6 space-y-3">
      <Card title="Identification">
        <Row label="VIN" value={sub.vin || "—"} mono />
        <Row label="Year" value={String(sub.vehicle_year || "—")} />
        <Row label="Make" value={sub.vehicle_make || "—"} />
        <Row label="Model" value={sub.vehicle_model || "—"} />
        <Row label="Mileage" value={sub.mileage != null ? `${Number(sub.mileage).toLocaleString()} mi` : "—"} />
      </Card>
      <Card title="Appearance">
        <Row label="Exterior Color" value={sub.exterior_color || "—"} />
        <Row label="Interior Color" value={(sub as any).interior_color || "—"} />
      </Card>
      <Card title="Condition">
        <Row label="Overall" value={(sub as any).overall_condition || "—"} />
        <Row label="Accidents" value={(sub as any).accidents || "—"} />
        <Row label="Drivable" value={(sub as any).drivable ? "Yes" : "—"} />
      </Card>
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
