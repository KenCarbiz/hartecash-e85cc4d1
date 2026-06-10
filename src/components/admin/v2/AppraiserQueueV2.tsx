/**
 * Appraiser Queue (Admin V2) — native-V2 reimplement.
 *
 * Faithfully reuses the classic AppraiserQueue's data + logic (the
 * multi-clause auto-route fetch, AI re-appraisal accept/dismiss, manager
 * dismiss, bucket classification/sort, customer-present pinning) and
 * renders it in the V2 design system. Same Supabase queries / RPCs /
 * edge calls and the same /appraisal/:token open target, so behavior is
 * unchanged. V2-only — V1's AppraiserQueue.tsx is untouched.
 *
 * NOTE: built without a live DB to test against — verify the buckets,
 * AI bump apply, and dismiss in your environment after merge.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { isManagerRole, getStatusLabel } from "@/lib/adminConstants";
import { useToast } from "@/hooks/use-toast";
import {
  Flame, Wrench, Plus, Sparkles, ShieldAlert, UserX, Search, ArrowRight, X, Check, Loader2,
} from "lucide-react";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton, SecondaryButton } from "./theme";

const STALE_OFFER_HOURS = 1;
const ACCEPTED_OR_FINAL_STATUSES = [
  "offer_accepted", "price_agreed", "deal_finalized",
  "title_ownership_verified", "check_request_submitted",
  "purchase_complete", "dead_lead", "partial",
];

interface QueueRow {
  id: string; token: string; created_at: string; status_updated_at: string | null;
  name: string | null; phone: string | null; email: string | null;
  vehicle_year: string | null; vehicle_make: string | null; vehicle_model: string | null;
  vin: string | null; mileage: string | null; lead_source: string; progress_status: string;
  offered_price: number | null; estimated_offer_high: number | null; estimated_offer_low: number | null;
  acv_value: number | null; needs_appraisal: boolean; internal_notes: string | null;
}
interface AISuggestion {
  id: string; submission_id: string; old_offer: number | null; suggested_offer: number;
  delta: number; ai_confidence: number | null; photos_analyzed: number; reason: string;
  status: string; created_at: string;
}
type QueueReason = "walk_in" | "service" | "manual_entry" | "flagged" | "declined";

type Tone = "red" | "amber" | "purple" | "teal";
const REASON_META: Record<QueueReason, { label: string; tone: Tone; icon: typeof Flame; priority: number }> = {
  walk_in: { label: "Walk-In", tone: "red", icon: Flame, priority: 1 },
  service: { label: "Service", tone: "amber", icon: Wrench, priority: 2 },
  manual_entry: { label: "Manual", tone: "amber", icon: Plus, priority: 3 },
  flagged: { label: "Flagged", tone: "purple", icon: Sparkles, priority: 4 },
  declined: { label: "Declined", tone: "teal", icon: UserX, priority: 5 },
};

const isStaleOffer = (row: QueueRow): boolean => {
  if (!row.offered_price || row.offered_price <= 0) return false;
  if (ACCEPTED_OR_FINAL_STATUSES.includes(row.progress_status)) return false;
  const ts = row.status_updated_at || row.created_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() >= STALE_OFFER_HOURS * 3.6e6;
};
const classifyRow = (row: QueueRow): QueueReason => {
  if (row.progress_status === "customer_arrived") return "walk_in";
  if (row.progress_status === "offer_declined") return "declined";
  if (row.lead_source === "walk_in") return "walk_in";
  if (row.lead_source === "service") return "service";
  if (row.lead_source === "manual_entry") return "manual_entry";
  if (row.progress_status === "partial") return "flagged";
  if (row.needs_appraisal) return "flagged";
  if (isStaleOffer(row)) return "flagged";
  return "declined";
};
const formatAge = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);
const vehicleTitle = (r: QueueRow) => [r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "Vehicle";

const AppraiserQueueV2 = ({ userRole = "", isAppraiser = false }: { userRole?: string; isAppraiser?: boolean }) => {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, AISuggestion>>({});
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<"all" | "walk_ins" | "service" | "flagged" | "declined">("all");
  const [search, setSearch] = useState("");

  const autoRoute = Boolean((config as { auto_route_appraiser_queue?: boolean }).auto_route_appraiser_queue);
  const canAccess = userRole === "admin" || isManagerRole(userRole) || isAppraiser;

  const fetchQueue = async () => {
    setLoading(true);
    const withFlag = "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, needs_appraisal, internal_notes";
    const withoutFlag = "id, token, created_at, status_updated_at, name, phone, email, vehicle_year, vehicle_make, vehicle_model, vin, mileage, lead_source, progress_status, offered_price, estimated_offer_high, estimated_offer_low, acv_value, internal_notes";
    const cutoffIso = new Date(Date.now() - STALE_OFFER_HOURS * 3.6e6).toISOString();
    const acceptedFinalCsv = ACCEPTED_OR_FINAL_STATUSES.join(",");
    const orParts = ["and(needs_appraisal.eq.true,acv_value.is.null)"];
    if (autoRoute) {
      orParts.push("progress_status.eq.offer_declined");
      orParts.push("and(progress_status.eq.partial,acv_value.is.null)");
      orParts.push("and(lead_source.in.(walk_in,service,manual_entry),acv_value.is.null)");
      orParts.push(`and(offered_price.gt.0,status_updated_at.lt.${cutoffIso},progress_status.not.in.(${acceptedFinalCsv}))`);
    }
    let { data, error } = await supabase.from("submissions").select(withFlag).or(orParts.join(",")).order("created_at", { ascending: false });
    const columnMissing = error?.message?.includes("needs_appraisal") || (error?.message?.includes("column") && error?.message?.includes("does not exist"));
    if (columnMissing) {
      if (autoRoute) {
        const fb = await supabase.from("submissions").select(withoutFlag).or("progress_status.eq.offer_declined,progress_status.eq.partial,lead_source.in.(walk_in,service,manual_entry)").is("acv_value", null).order("created_at", { ascending: false });
        data = fb.data as typeof data; error = fb.error;
      } else { data = []; error = null; }
    }
    if (error) { console.error("[AppraiserQueueV2] fetch failed:", error); setRows([]); setLoading(false); return; }
    const queueRows = ((data as QueueRow[]) || []).map((r) => ({ ...r, needs_appraisal: (r as { needs_appraisal?: boolean }).needs_appraisal ?? false }));
    setRows(queueRows);
    if (queueRows.length > 0) {
      try {
        const { data: sugData } = await supabase.from("ai_reappraisal_log")
          .select("id, submission_id, old_offer, suggested_offer, delta, ai_confidence, photos_analyzed, reason, status, created_at")
          .in("submission_id", queueRows.map((r) => r.id)).in("status", ["suggested", "auto_applied"]).order("created_at", { ascending: false });
        if (sugData) {
          const byId: Record<string, AISuggestion> = {};
          for (const s of sugData as AISuggestion[]) if (!byId[s.submission_id]) byId[s.submission_id] = s;
          setSuggestions(byId);
        }
      } catch (e) { console.error("Failed to load AI suggestions:", e); }
    } else setSuggestions({});
    setLoading(false);
  };

  const acceptSuggestion = async (row: QueueRow, s: AISuggestion) => {
    const { data: u } = await supabase.auth.getUser();
    const actor = u?.user?.email || "unknown";
    const { error } = await supabase.from("submissions").update({ offered_price: s.suggested_offer }).eq("id", row.id);
    if (error) { toast({ title: "Failed to apply bump", description: error.message, variant: "destructive" }); return; }
    await supabase.from("ai_reappraisal_log").update({ status: "accepted", decided_at: new Date().toISOString(), decided_by: actor }).eq("id", s.id);
    await supabase.from("activity_log").insert({ submission_id: row.id, action: "AI Bump Accepted", old_value: s.old_offer ? `$${s.old_offer.toLocaleString()}` : "None", new_value: `$${s.suggested_offer.toLocaleString()}`, performed_by: actor });
    safeInvoke("send-notification", { body: { trigger_key: "customer_offer_increased", submission_id: row.id }, context: { from: "AppraiserQueueV2.applyBump" } });
    toast({ title: "Bump applied", description: `Offer raised to $${s.suggested_offer.toLocaleString()}. Customer will be notified.` });
    fetchQueue();
  };
  const dismissSuggestion = async (s: AISuggestion) => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("ai_reappraisal_log").update({ status: "dismissed", decided_at: new Date().toISOString(), decided_by: u?.user?.email || "unknown" }).eq("id", s.id);
    toast({ title: "Suggestion dismissed" }); fetchQueue();
  };
  const dismissFromQueue = async (row: QueueRow) => {
    const { error } = await supabase.from("submissions").update({ needs_appraisal: false }).eq("id", row.id);
    if (error) { toast({ title: "Dismiss failed", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast({ title: "Removed from queue" });
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.dealership_id, autoRoute, canAccess]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const pa = REASON_META[classifyRow(a)].priority, pb = REASON_META[classifyRow(b)].priority;
    return pa !== pb ? pa - pb : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }), [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((r) => {
      if (bucket !== "all") {
        const reason = classifyRow(r);
        const inB = (bucket === "walk_ins" && (reason === "walk_in" || reason === "manual_entry")) || (bucket === "service" && reason === "service") || (bucket === "flagged" && reason === "flagged") || (bucket === "declined" && reason === "declined");
        if (!inB) return false;
      }
      if (!q) return true;
      return [r.name, r.email, r.phone, r.vehicle_year, r.vehicle_make, r.vehicle_model, r.vin].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [sorted, bucket, search]);
  const counts = useMemo(() => {
    const c: Record<QueueReason, number> = { walk_in: 0, service: 0, manual_entry: 0, flagged: 0, declined: 0 };
    rows.forEach((r) => { c[classifyRow(r)]++; });
    return c;
  }, [rows]);
  const tiles = { walk_ins: counts.walk_in + counts.manual_entry, service: counts.service, flagged: counts.flagged, declined: counts.declined };

  if (!canAccess) {
    return (
      <PageShell title="Appraiser Queue" subtitle="Vehicles that need a number.">
        <Card className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="mb-3 h-10 w-10 text-[#9AA6BC]" />
          <p className="text-sm font-semibold text-[#06194A]">Appraiser access required</p>
          <p className="mt-1 max-w-md text-xs text-[#7A879C]">Visible to Used Car Managers, GSM/GM, Admins, and staff granted the Appraiser credential.</p>
        </Card>
      </PageShell>
    );
  }

  const present = visible.filter((r) => r.progress_status === "customer_arrived");
  const rest = visible.filter((r) => r.progress_status !== "customer_arrived");
  const TILE: { key: typeof bucket; label: string; n: number; tone: Tone }[] = [
    { key: "walk_ins", label: "Walk-ins", n: tiles.walk_ins, tone: "red" },
    { key: "service", label: "Service Drive", n: tiles.service, tone: "amber" },
    { key: "flagged", label: "Flagged", n: tiles.flagged, tone: "purple" },
    { key: "declined", label: "Declined", n: tiles.declined, tone: "teal" },
  ];

  return (
    <PageShell
      title="Appraiser Queue"
      subtitle={`${rows.length} ${rows.length === 1 ? "vehicle needs" : "vehicles need"} a number.`}
    >
      <div className="space-y-4">
        {/* Tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TILE.map((t) => (
            <StatCard key={t.key} label={t.label} value={t.n} tone={t.tone === "red" ? "red" : t.tone === "amber" ? "amber" : t.tone === "teal" ? "teal" : "purple"}
              onClick={() => setBucket(bucket === t.key ? "all" : t.key)} />
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA6BC]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, vehicle, phone, VIN…"
            className="w-full rounded-xl border border-[#E6EAF0] bg-white py-2 pl-9 pr-3 text-[13px] text-[#06194A] outline-none focus:border-[#6D28D9]/40" />
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[#7A879C]"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center text-sm text-[#7A879C]">
            {rows.length === 0 ? "Queue is clear — no vehicles waiting on a number." : "No leads match your filter."}
          </Card>
        ) : (
          <div className="space-y-4">
            {present.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#B91C1C]" /><SectionLabel>Customer present — {present.length}</SectionLabel></div>
                <div className="space-y-2">{present.map((row) => <RowCard key={row.id} {...{ row, suggestion: suggestions[row.id], navigate, dismissFromQueue, acceptSuggestion, dismissSuggestion }} />)}</div>
              </div>
            )}
            <div className="space-y-2">{rest.map((row) => <RowCard key={row.id} {...{ row, suggestion: suggestions[row.id], navigate, dismissFromQueue, acceptSuggestion, dismissSuggestion }} />)}</div>
          </div>
        )}
      </div>
    </PageShell>
  );
};

const RowCard = ({ row, suggestion, navigate, dismissFromQueue, acceptSuggestion, dismissSuggestion }: {
  row: QueueRow; suggestion?: AISuggestion;
  navigate: (to: string) => void;
  dismissFromQueue: (r: QueueRow) => void;
  acceptSuggestion: (r: QueueRow, s: AISuggestion) => void;
  dismissSuggestion: (s: AISuggestion) => void;
}) => {
  const reason = classifyRow(row);
  const meta = REASON_META[reason];
  const Icon = meta.icon;
  const expected = row.offered_price || row.estimated_offer_high || 0;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.tone === "red" ? "bg-[#FEE2E2] text-[#B91C1C]" : meta.tone === "amber" ? "bg-[#FEF3E2] text-[#B45309]" : meta.tone === "teal" ? "bg-[#E6FAF7] text-[#0F766E]" : "bg-[#EEF0FF] text-[#6D28D9]"}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[#06194A]">{row.name || "Customer"}</span>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <Pill tone="gray">{getStatusLabel(row.progress_status)}</Pill>
          </div>
          <div className="text-[12px] text-[#7A879C]">
            {vehicleTitle(row)} · {formatAge(row.created_at)}
            {expected > 0 && reason === "declined" && <> · saw {money(expected)}</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {row.needs_appraisal && (
            <button onClick={() => dismissFromQueue(row)} title="Remove from queue" className="rounded-lg border border-[#E6EAF0] p-1.5 text-[#9AA6BC] hover:text-[#B91C1C]"><X className="h-4 w-4" /></button>
          )}
          <PrimaryButton onClick={() => navigate(`/appraisal/${row.token}`)}>Appraise <ArrowRight className="h-4 w-4" /></PrimaryButton>
        </div>
      </div>

      {/* AI re-appraisal bump */}
      {suggestion && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#C9B8F0] bg-[#FAF8FF] p-3">
          <Sparkles className="h-4 w-4 shrink-0 text-[#6D28D9]" />
          <div className="min-w-0 flex-1 text-[12px] text-[#3B4763]">
            AI suggests <strong className="text-[#06194A]">{money(suggestion.suggested_offer)}</strong>
            {suggestion.old_offer ? <> (was {money(suggestion.old_offer)}, +{money(suggestion.delta)})</> : null}
            {suggestion.ai_confidence != null && <> · {Math.round(suggestion.ai_confidence * 100)}% conf</>}
            {suggestion.photos_analyzed ? <> · {suggestion.photos_analyzed} photos</> : null}
            {suggestion.reason && <span className="text-[#7A879C]"> · {suggestion.reason}</span>}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => dismissSuggestion(suggestion)}>Dismiss</SecondaryButton>
            <PrimaryButton onClick={() => acceptSuggestion(row, suggestion)}><Check className="h-4 w-4" /> Apply bump</PrimaryButton>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AppraiserQueueV2;
