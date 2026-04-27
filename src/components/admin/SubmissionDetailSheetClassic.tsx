/**
 * SubmissionDetailSheetClassic.tsx
 *
 * Faithful port of the approved Claude Design `CustomerFile.jsx` (Classic).
 * Source: project/handoff_customer_file/design_files/CustomerFile.jsx + the
 * extracted bundle in autocurb-customer-file-redesign/.
 *
 * Layout: blue gradient header (year/make/model + offer right) → arrival strip
 * (when customer is on-site) → 2-col body (1fr | 380px). Left rail: photos +
 * ID/intent + customer/vehicle + inspection. Right rail: next action, deal
 * status, offer breakdown, loan.
 *
 * Diverges from the prototype only where the mock data layer doesn't match
 * our schema — see the adapter helpers at the top.
 */

import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/utils";
import {
  ALL_STATUS_OPTIONS, getStatusLabel,
  ACCEPTED_NO_APPOINTMENT_STATUSES, ACCEPTED_WITH_APPOINTMENT_STATUSES,
  type Submission, type DealerLocation,
} from "@/lib/adminConstants";

// ── Props ────────────────────────────────────────────────────────────
// Matches the existing SubmissionDetailSheetProps so the entry export can
// drop us in as a one-line swap.
interface ClassicProps {
  selected: Submission | null;
  onClose: () => void;
  photos: { url: string; name: string }[];
  docs: { name: string; url: string; type: string }[];
  selectedApptTime: string | null;
  dealerLocations: DealerLocation[];
  canApprove: boolean;
  canUpdateStatus: boolean;
  auditLabel: string;
  onUpdate: (updated: Submission) => void;
  onRefresh: (sub: Submission) => void;
  onScheduleAppointment: (sub: Submission) => void;
}

// ── Mock-field adapters ──────────────────────────────────────────────
// The design references fields like sub.intent / sub.offer_accepted /
// sub.inspection_completed / sub.tires_pass that don't exist on our
// Submission type. Each adapter below derives the equivalent from real
// schema fields.

const intentFromSource = (lead_source: string): "sell" | "trade" | "unsure" => {
  switch (lead_source) {
    case "trade":
    case "in_store_trade": return "trade";
    case "service":        return "unsure";
    case "inventory":
    default:                return "sell";
  }
};

const isInspectionCompleted = (status: string): boolean =>
  [
    "inspection_completed",
    "appraisal_completed",
    "manager_approval_inspection",
    "price_agreed",
    "deal_finalized",
    "title_ownership_verified",
    "check_request_submitted",
    "purchase_complete",
  ].includes(status);

const isOfferAccepted = (status: string): boolean =>
  status === "offer_accepted" ||
  (ACCEPTED_NO_APPOINTMENT_STATUSES as readonly string[]).includes(status) ||
  (ACCEPTED_WITH_APPOINTMENT_STATUSES as readonly string[]).includes(status);

const statusToneFor = (status: string): "slate" | "blue" | "amber" | "emerald" | "red" => {
  if (["new"].includes(status)) return "blue";
  if (["contacted", "no_contact"].includes(status)) return "slate";
  if (["inspection_scheduled", "inspection_completed", "appraisal_completed",
       "manager_approval_inspection"].includes(status)) return "amber";
  if (["offer_accepted", "price_agreed", "deal_finalized",
       "title_ownership_verified", "check_request_submitted",
       "purchase_complete"].includes(status)) return "emerald";
  if (["dead_lead", "partial"].includes(status)) return "red";
  return "slate";
};

const intentMeta = {
  sell:   { label: "Selling",   sub: "Wants cash for the car",  onDark: "bg-emerald-400/25 text-emerald-100 border-emerald-300/40" },
  trade:  { label: "Trade-In",  sub: "Buying another car here", onDark: "bg-sky-400/25 text-sky-100 border-sky-300/40" },
  unsure: { label: "Undecided", sub: "Open to sell or trade",   onDark: "bg-amber-400/25 text-amber-100 border-amber-300/40" },
} as const;

const statusBadgeOnDark = (tone: string): string => {
  switch (tone) {
    case "emerald": return "bg-emerald-400/25 text-emerald-100 border-emerald-300/40";
    case "blue":    return "bg-sky-400/25 text-sky-100 border-sky-300/40";
    case "amber":   return "bg-amber-400/25 text-amber-100 border-amber-300/40";
    case "red":     return "bg-red-400/25 text-red-100 border-red-300/40";
    default:        return "bg-white/15 text-white border-white/25";
  }
};

// ── Formatters ───────────────────────────────────────────────────────
const fmtMoney = (n: number | string | null | undefined, big = false): string => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? Number(n.replace(/[^0-9.-]/g, "")) : n;
  if (!Number.isFinite(num)) return "—";
  return big
    ? `$${Math.floor(num).toLocaleString()}`
    : `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtNumber = (n: number | string | null | undefined): string => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? Number(n.replace(/[^0-9.-]/g, "")) : n;
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)} min ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
};

// ── Inline edit primitive ────────────────────────────────────────────
// Click value → input. Enter / blur saves; Escape cancels.
const InlineEdit = ({
  value, onSave, type = "text", placeholder = "—", mono = false, align = "right",
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  align?: "left" | "right";
}) => {
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
        className={`w-full px-2 py-1 -mx-2 -my-1 text-[13px] ${mono ? "font-mono" : ""} ${align === "right" ? "text-right" : ""} rounded-md border border-blue-400 bg-white outline-none focus:ring-2 focus:ring-blue-100`}
      />
    );
  }

  const empty = value == null || value === "";
  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={`group w-full px-2 py-1 -mx-2 -my-1 text-[13px] ${mono ? "font-mono text-[12.5px]" : ""} ${align === "right" ? "text-right" : "text-left"} rounded-md hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-colors cursor-text`}
      title="Click to edit"
    >
      <span className={`${empty ? "text-slate-400 italic" : "text-slate-900 font-semibold"}`}>
        {empty ? placeholder : value}
      </span>
    </button>
  );
};

// ── Card wrapper ─────────────────────────────────────────────────────
const Card = ({
  title, right, children, dense = false, className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
  className?: string;
}) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
      <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.1em]">{title}</h3>
      {right}
    </header>
    <div className={dense ? "p-3" : "p-4"}>{children}</div>
  </section>
);

// ── Read-only Row (label left, value right; hides if value is falsy) ─
const Row = ({ label, value, mono = false }: {
  label: string;
  value: React.ReactNode | null | undefined;
  mono?: boolean;
}) => {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[13px] font-semibold text-slate-900 text-right ${mono ? "font-mono text-[12.5px]" : ""}`}>
        {value}
      </span>
    </div>
  );
};

// ── Editable Row (label left, click value to edit) ───────────────────
const EditableRow = ({
  label, value, onSave, mono = false, type = "text", placeholder = "—",
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
  mono?: boolean;
  type?: string;
  placeholder?: string;
}) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-[13px] text-slate-500 shrink-0 pt-1">{label}</span>
    <div className="min-w-0 flex-1 max-w-[60%]">
      <InlineEdit value={value} onSave={onSave} mono={mono} type={type} placeholder={placeholder} />
    </div>
  </div>
);

// ── Tires/Brakes Pass/Fail tile ──────────────────────────────────────
const PassFail = ({ label, pass }: { label: string; pass: boolean | null }) => {
  if (pass == null) {
    return (
      <div className="flex-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
        <div className="text-sm font-bold text-slate-400 mt-0.5">Not inspected</div>
      </div>
    );
  }
  const ok = pass === true;
  return (
    <div className={`flex-1 rounded-lg border px-3 py-2.5 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className={`text-[11px] uppercase tracking-wider font-semibold ${ok ? "text-emerald-700" : "text-red-700"}`}>{label}</div>
      <div className={`text-sm font-bold mt-0.5 flex items-center gap-1.5 ${ok ? "text-emerald-800" : "text-red-800"}`}>
        {ok ? (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"/></svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 110-16 8 8 0 010 16zM8.7 10L6.3 7.7a1 1 0 011.4-1.4L10 8.6l2.3-2.3a1 1 0 011.4 1.4L11.4 10l2.3 2.3a1 1 0 01-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 10z"/></svg>
        )}
        {ok ? "Pass" : "Needs Attention"}
      </div>
    </div>
  );
};

// ── Photo carousel (inline, no modal) ────────────────────────────────
const PhotoCarousel = ({ items }: { items: { url: string; name: string }[] }) => {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [items.length]);

  if (!items.length) {
    return (
      <div className="aspect-[16/10] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
        No photos uploaded
      </div>
    );
  }
  const prev = () => setI((v) => (v - 1 + items.length) % items.length);
  const next = () => setI((v) => (v + 1) % items.length);
  const cur = items[i];

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-900 group">
        <img src={cur.url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" />
        {items.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/75 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z"/></svg>
            </button>
            <button
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/75 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
            </button>
          </>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-semibold backdrop-blur-sm">
          {i + 1} / {items.length}
        </div>
      </div>
      {items.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map((p, idx) => (
            <button
              key={`${p.name}-${idx}`}
              onClick={() => setI(idx)}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                idx === i ? "border-blue-600 ring-2 ring-blue-200" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SubmissionDetailSheetClassic(_props: ClassicProps) {
  // Shell + body to be filled in subsequent increments.
  return null;
}
