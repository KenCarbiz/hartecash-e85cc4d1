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

import { useState, useMemo, useEffect, useCallback } from "react";
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
import SubmissionNotesModal, { fetchSubmissionNotes, type SubmissionNote } from "./SubmissionNotesModal";
import ClassicCommsCard from "./ClassicCommsCard";
import ClassicCommsFullView from "./ClassicCommsFullView";
import { useSiteConfig } from "@/hooks/useSiteConfig";

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

// ── DL at-a-glance (front by default, click "Back" to flip) ──────────
const DLAtGlance = ({
  front, back,
}: {
  front: { url: string; name: string } | null;
  back: { url: string; name: string } | null;
}) => {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"front" | "back">("front");
  const cur = side === "back" && back ? back : front;

  if (!front && !back) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
        <div className="w-14 h-9 rounded bg-slate-200 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z"/></svg>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Driver's License</div>
          <div className="text-xs text-slate-500">Not uploaded</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition text-left"
      >
        <div className="w-14 h-9 rounded overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
          {cur && /\.(jpg|jpeg|png|gif|webp)$/i.test(cur.name)
            ? <img src={cur.url} alt={`Driver's license — ${side}`} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-bold">DL</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Driver's License</div>
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"/></svg>
            Verified on file
          </div>
        </div>
        <span className="text-xs text-blue-700 font-semibold">{open ? "Hide" : "View"}</span>
      </button>
      {open && cur && (
        <div className="p-3 pt-0 space-y-2">
          <img src={cur.url} alt={`Driver's license — ${side}`} className="w-full rounded-md border border-slate-200" />
          {back && (
            <div className="flex gap-1.5 text-[11px] font-semibold">
              <button
                onClick={(e) => { e.stopPropagation(); setSide("front"); }}
                className={`flex-1 py-1.5 rounded-md border transition ${side === "front" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >Front</button>
              <button
                onClick={(e) => { e.stopPropagation(); setSide("back"); }}
                className={`flex-1 py-1.5 rounded-md border transition ${side === "back" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── QR handoff modal (shown when customer has arrived) ───────────────
const QRInspectionModal = ({
  open, onClose, sub,
}: {
  open: boolean;
  onClose: () => void;
  sub: Submission;
}) => {
  if (!open) return null;
  const inspectionUrl = `${window.location.origin}/inspection/${sub.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&ecc=M&data=${encodeURIComponent(inspectionUrl)}`;
  const initials = (sub.name || "?").split(" ").filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Walk to the Car</div>
            <div className="font-display text-[20px] leading-tight mt-0.5">Scan to open on your phone</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Close">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.9a1 1 0 011.4 0L10 7.2l2.3-2.3a1 1 0 011.4 1.4L11.4 8.6l2.3 2.3a1 1 0 01-1.4 1.4L10 10l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 8.6 6.3 6.3a1 1 0 010-1.4z"/></svg>
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#003b80] text-white text-[13px] font-bold flex items-center justify-center">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-slate-900 truncate">{sub.name || "Unknown customer"}</div>
            <div className="text-[12px] text-slate-500 truncate">
              {[sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ")}
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="relative p-4 bg-white rounded-xl border-2 border-slate-200">
            <img src={qrSrc} alt="QR code to open inspection on phone" className="w-[260px] h-[260px] block" />
          </div>
          <p className="text-[12.5px] text-slate-500 mt-4 text-center max-w-[320px] leading-snug">
            Point your phone or iPad camera at the code. The inspection will open
            pre-loaded with <span className="font-semibold text-slate-700">{sub.name || "this customer"}</span>'s car.
          </p>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Short Link</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5 truncate">
              {inspectionUrl.replace(/^https?:\/\//, "")}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(inspectionUrl)}
              className="h-7 px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Document types that go into the photo carousel (DL excluded) ────
const CAROUSEL_DOC_TYPES = new Set([
  "title", "title_front", "title_back", "title_inquiry",
  "registration", "payoff_verification", "appraisal", "carfax",
]);

const DL_IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

// ── Header identity row (A / B / C) ────────────────────────────────
// Three arrangements of the blue identity bar — same data, same width,
// different hierarchy. Picked at runtime from
// site_config.customer_file_header_layout (or per-location override).
const MoneyBlock = ({
  dealKind, dealValue, sub, align = "right",
}: {
  dealKind: string;
  dealValue: number | null;
  sub: Submission;
  align?: "left" | "right";
}) => {
  if (dealValue == null) return null;
  return (
    <div className={`text-left ${align === "right" ? "md:text-right" : ""}`}>
      <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold">{dealKind}</div>
      <div className="font-display text-[40px] leading-none tracking-tight mt-0.5">{fmtMoney(dealValue, true)}</div>
      {sub.acv_value != null && (
        <div className="text-[11px] text-white/60 mt-1">
          ACV {fmtMoney(sub.acv_value)}
          {sub.offered_price != null && (
            <span className={`ml-1 font-semibold ${sub.offered_price > sub.acv_value ? "text-emerald-300" : "text-red-300"}`}>
              {sub.offered_price > sub.acv_value ? "+" : ""}{fmtMoney(sub.offered_price - sub.acv_value)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const VehicleStrip = ({ sub }: { sub: Submission }) => (
  <div className="flex items-center gap-2 flex-wrap text-[12px] text-white/80">
    {sub.vin && <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider">{sub.vin}</span>}
    {sub.mileage && <span>{fmtNumber(sub.mileage)} mi</span>}
    {sub.exterior_color && (<><span className="text-white/55">·</span><span>{sub.exterior_color}</span></>)}
    {sub.plate && (<><span className="text-white/55">·</span><span>Plate {sub.plate}</span></>)}
  </div>
);

const CustomerContact = ({ sub }: { sub: Submission }) => (
  <div className="space-y-0.5 text-[13px] text-white/85">
    {sub.phone && (
      <div className="flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-white/60 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.5A1.5 1.5 0 013.5 2h2.6a1.5 1.5 0 011.4 1l.8 2.1a1.5 1.5 0 01-.4 1.7L6.5 8.1a11 11 0 005.4 5.4l1.3-1.4a1.5 1.5 0 011.7-.4l2.1.8a1.5 1.5 0 011 1.4v2.6a1.5 1.5 0 01-1.5 1.5C8.5 18 2 11.5 2 3.5z"/></svg>
        <a href={`tel:${sub.phone}`} className="font-mono hover:underline">{formatPhone(sub.phone)}</a>
      </div>
    )}
    {sub.email && (
      <div className="flex items-center gap-1.5 text-white/75">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5.5A1.5 1.5 0 013.5 4h13A1.5 1.5 0 0118 5.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 14.5v-9zm2.2.5L10 10.2 15.8 6H4.2z"/></svg>
        <a href={`mailto:${sub.email}`} className="truncate hover:underline">{sub.email}</a>
      </div>
    )}
  </div>
);

const ClassicHeaderIdentity = ({
  layout, sub, dealValue, dealKind,
}: {
  layout: "a" | "b" | "c";
  sub: Submission;
  dealValue: number | null;
  dealKind: string;
}) => {
  const vehicleTitle = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "—";

  // ── A: Vehicle-first — big YEAR · MAKE · MODEL dominates, no customer name in header
  if (layout === "a") {
    return (
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/60 font-semibold mb-1">
            {sub.vehicle_year}{sub.mileage ? ` · ${fmtNumber(sub.mileage)} mi` : ""}
          </div>
          <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
            {[sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "—"}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-[13px] text-white/80">
            {sub.vin && <span className="font-mono bg-white/10 rounded px-2 py-0.5 tracking-wider">{sub.vin}</span>}
            {sub.plate && <span>Plate · {sub.plate}</span>}
            {sub.exterior_color && <span className="text-white/60">· {sub.exterior_color}</span>}
          </div>
        </div>
        <MoneyBlock dealKind={dealKind} dealValue={dealValue} sub={sub} />
      </div>
    );
  }

  // ── C: Stacked — customer + money on top, divider, vehicle below
  if (layout === "c") {
    return (
      <>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold mb-1">Customer</div>
            <h1 className="font-display text-[32px] leading-[1.05] tracking-tight">
              {sub.name || "Unknown customer"}
            </h1>
            <div className="mt-1.5 text-[13px] text-white/80 flex items-center gap-3 flex-wrap">
              {sub.phone && <a href={`tel:${sub.phone}`} className="font-mono hover:underline">{formatPhone(sub.phone)}</a>}
              {sub.phone && sub.email && <span className="text-white/50">·</span>}
              {sub.email && <a href={`mailto:${sub.email}`} className="hover:underline">{sub.email}</a>}
            </div>
          </div>
          <MoneyBlock dealKind={dealKind} dealValue={dealValue} sub={sub} />
        </div>
        <div className="h-px bg-white/15 my-4" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold mb-1">Vehicle</div>
          <h2 className="font-display text-[24px] leading-[1.1] tracking-tight">{vehicleTitle}</h2>
          <div className="mt-1.5"><VehicleStrip sub={sub} /></div>
        </div>
      </>
    );
  }

  // ── B (default): Customer-first, vehicle-right — 12-col grid
  return (
    <div className="grid grid-cols-12 gap-6 items-start">
      <div className="col-span-12 md:col-span-4 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold mb-1">Customer</div>
        <h1 className="font-display text-[30px] leading-[1.1] tracking-tight truncate">
          {sub.name || "Unknown customer"}
        </h1>
        <div className="mt-2"><CustomerContact sub={sub} /></div>
      </div>
      <div className={`col-span-12 ${dealValue != null ? "md:col-span-5" : "md:col-span-8"} min-w-0 md:border-l md:border-white/15 md:pl-6`}>
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/55 font-bold mb-1">Vehicle</div>
        <h2 className="font-display text-[30px] leading-[1.1] tracking-tight">{vehicleTitle}</h2>
        <div className="mt-2"><VehicleStrip sub={sub} /></div>
      </div>
      {dealValue != null && (
        <div className="col-span-12 md:col-span-3 md:border-l md:border-white/15 md:pl-6">
          <MoneyBlock dealKind={dealKind} dealValue={dealValue} sub={sub} />
        </div>
      )}
    </div>
  );
};

export default function SubmissionDetailSheetClassic({
  selected, onClose, photos, docs, auditLabel,
  onUpdate, onScheduleAppointment,
}: ClassicProps) {
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const headerLayout: "a" | "b" | "c" =
    ((config as { customer_file_header_layout?: string }).customer_file_header_layout as "a" | "b" | "c") || "b";
  const [editState, setEditState] = useState<Submission | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [commsFullOpen, setCommsFullOpen] = useState(false);
  const [notes, setNotes] = useState<SubmissionNote[]>([]);

  // Refresh notes — called on open and after add.
  const refreshNotes = useCallback(async (subId: string) => {
    try {
      const rows = await fetchSubmissionNotes(subId);
      setNotes(rows);
    } catch {
      // Non-fatal — modal surfaces its own load error.
    }
  }, []);

  useEffect(() => {
    if (selected?.id) void refreshNotes(selected.id);
    else setNotes([]);
  }, [selected?.id, refreshNotes]);

  const sub = editState?.id === selected?.id ? editState : selected;

  // Reset local edit state whenever the parent opens a different submission.
  useEffect(() => { setEditState(null); }, [selected?.id]);

  // ── Single-field save (optimistic local + supabase write) ──────────
  async function saveField<K extends keyof Submission>(field: K, value: Submission[K]) {
    if (!sub) return;
    const next = { ...sub, [field]: value } as Submission;
    setEditState(next);
    const { error } = await supabase
      .from("submissions")
      .update({ [field]: value } as never)
      .eq("id", sub.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    onUpdate(next);
  }

  // ── Derived state (only valid when sub != null; guarded below) ─────
  if (!selected || !sub) {
    return (
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-5xl lg:max-w-6xl p-0 [&>button]:hidden" />
      </Sheet>
    );
  }

  const intent = intentMeta[intentFromSource(sub.lead_source)];
  const tone = statusToneFor(sub.progress_status);
  const inspectionCompleted = isInspectionCompleted(sub.progress_status);
  const offerAccepted = isOfferAccepted(sub.progress_status);
  const customerArrived = sub.progress_status === "customer_arrived";
  const manualAppraisalNeeded = !offerAccepted && !inspectionCompleted;
  const dealValue = sub.offered_price ?? sub.estimated_offer_high;
  const dealKind = sub.offered_price != null ? "Offer Given" : "Estimated Offer";
  const arrivedAt = customerArrived ? sub.status_updated_at : null;
  const statusLabel = getStatusLabel(sub.progress_status);
  const firstName = (sub.name || "Customer").split(/\s+/)[0];

  return (
    <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setEditState(null); onClose(); } }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-5xl lg:max-w-6xl p-0 flex flex-col overflow-hidden relative [&>button]:hidden"
      >
        <div className="flex flex-col h-full bg-slate-50">

          {/* ═══ BLUE HEADER ═══════════════════════════════════════════ */}
          <header className="shrink-0 bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white">
            <div className="px-6 pt-4 pb-5">

              {/* Top row: close + Customer File label | Notes / Print / Open Appraisal */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditState(null); onClose(); }}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.9a1 1 0 011.4 0L10 7.2l2.3-2.3a1 1 0 011.4 1.4L11.4 8.6l2.3 2.3a1 1 0 01-1.4 1.4L10 10l-2.3 2.3a1 1 0 01-1.4-1.4L8.6 8.6 6.3 6.3a1 1 0 010-1.4z"/></svg>
                  </button>
                  <span className="text-white/70 text-xs">Customer File</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setNotesOpen(true)}
                    className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 transition relative"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h3.5a1 1 0 01.9.55l.7 1.4H17a1 1 0 011 1V16a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/></svg>
                    Notes
                    {notes.length > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-white/25 text-white text-[10px] font-bold">
                        {notes.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-semibold flex items-center gap-1.5 transition"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a2 2 0 00-2 2v1h14V6a2 2 0 00-2-2H5zM17 9H3v5a2 2 0 002 2h10a2 2 0 002-2V9z"/></svg>
                    Print
                  </button>
                  {manualAppraisalNeeded && (
                    <button className="px-3 h-8 rounded-lg bg-white text-[#003b80] hover:bg-white/90 text-[12px] font-bold flex items-center gap-1.5 transition">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a.5.5 0 01.5.5v5.5H16a.5.5 0 010 1h-5.5V16a.5.5 0 01-1 0v-5.5H4a.5.5 0 010-1h5.5V4a.5.5 0 01.5-.5z"/></svg>
                      Open Appraisal
                    </button>
                  )}
                </div>
              </div>

              {/* Identity row — switches between A / B / C based on
                  site_config.customer_file_header_layout (per tenant or
                  per location). Default: B (Customer-first, vehicle-right). */}
              <ClassicHeaderIdentity
                layout={headerLayout}
                sub={sub}
                dealValue={dealValue}
                dealKind={dealKind}
              />

              {/* Status / intent / hot lead chips + submitted date */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 border whitespace-nowrap ${statusBadgeOnDark(tone)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {statusLabel}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 border whitespace-nowrap ${intent.onDark}`}>
                  {intent.label}
                </span>
                {sub.is_hot_lead && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md px-2.5 py-1 bg-orange-400/25 text-orange-100 border border-orange-300/50 whitespace-nowrap">
                    🔥 Hot Lead
                  </span>
                )}
                <span className="text-[11px] text-white/60 ml-auto">
                  Submitted {fmtDate(sub.created_at)}
                </span>
              </div>
            </div>

            {/* Arrival strip — only when customer has physically arrived */}
            {customerArrived && (
              <div className="bg-gradient-to-r from-red-600 to-red-500 border-t border-red-800/30">
                <div className="px-6 py-3 flex items-center gap-4 flex-wrap">
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="absolute inline-flex h-3 w-3 rounded-full bg-white/60 animate-ping" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">Customer Is Here Now</div>
                    <div className="text-[15px] font-bold text-white leading-tight">
                      {firstName} arrived {arrivedAt ? timeAgo(arrivedAt) : "moments ago"} · Car in Service Bay
                    </div>
                  </div>
                  <button
                    onClick={() => setQrOpen(true)}
                    className="h-10 px-4 rounded-lg bg-white text-red-700 text-[13px] font-bold inline-flex items-center justify-center gap-2 hover:bg-white/95 transition shadow-lg shadow-red-900/20"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/></svg>
                    Send QR to My Phone
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* ═══ BODY ═══════════════════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 max-w-[1400px] mx-auto">

              {/* ── LEFT / PRIMARY ──────────────────────────────────── */}
              <div className="space-y-5 min-w-0">

                {/* Photos + ID/Intent row */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
                  <Card title="Vehicle Photos" right={
                    <span className="text-[11px] text-slate-500">
                      {(() => {
                        const total = photos.length + docs.filter(d => CAROUSEL_DOC_TYPES.has(d.type)).length;
                        return `${total} ${total === 1 ? "photo" : "photos"}`;
                      })()}
                    </span>
                  }>
                    <PhotoCarousel items={[
                      ...photos.map(p => ({ url: p.url, name: p.name })),
                      ...docs.filter(d => CAROUSEL_DOC_TYPES.has(d.type)).map(d => ({ url: d.url, name: d.name })),
                    ]} />
                  </Card>

                  <div className="space-y-4">
                    <Card title="ID" dense>
                      <DLAtGlance
                        front={docs.find(d => (d.type === "drivers_license" || d.type === "drivers_license_front") && DL_IMAGE_RE.test(d.name)) || null}
                        back={docs.find(d => d.type === "drivers_license_back" && DL_IMAGE_RE.test(d.name)) || null}
                      />
                    </Card>
                    <Card title="Intent" dense>
                      <div className="px-1 py-1">
                        <div className="text-base font-bold text-slate-900">{intent.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{intent.sub}</div>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Customer + Vehicle (editable) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Card title="Customer">
                    <div className="space-y-0">
                      <EditableRow label="Name" value={sub.name} onSave={(v) => saveField("name", v)} placeholder="Unknown" />
                      <EditableRow label="Phone" value={sub.phone} onSave={(v) => saveField("phone", v)} type="tel" />
                      <EditableRow label="Email" value={sub.email} onSave={(v) => saveField("email", v)} type="email" />
                      <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-[13px] text-slate-500 shrink-0 pt-1">Address</span>
                        <div className="min-w-0 flex-1 max-w-[60%] space-y-0.5">
                          <InlineEdit
                            value={sub.address_street}
                            onSave={(v) => saveField("address_street", v)}
                            placeholder="Add street…"
                          />
                          <div className="flex items-baseline justify-end gap-1 -mt-0.5">
                            <div className="flex-1 max-w-[55%]">
                              <InlineEdit
                                value={sub.address_city}
                                onSave={(v) => saveField("address_city", v)}
                                placeholder="City"
                              />
                            </div>
                            <span className="text-[13px] text-slate-400">,</span>
                            <div className="w-[44px]">
                              <InlineEdit
                                value={sub.address_state}
                                onSave={(v) => saveField("address_state", v)}
                                placeholder="ST"
                              />
                            </div>
                            <div className="w-[68px]">
                              <InlineEdit
                                value={sub.zip}
                                onSave={(v) => saveField("zip", v)}
                                placeholder="ZIP"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Vehicle">
                    <div className="space-y-0">
                      <EditableRow label="Year" value={sub.vehicle_year} onSave={(v) => saveField("vehicle_year", v)} />
                      <EditableRow label="Make" value={sub.vehicle_make} onSave={(v) => saveField("vehicle_make", v)} />
                      <EditableRow label="Model" value={sub.vehicle_model} onSave={(v) => saveField("vehicle_model", v)} />
                      <EditableRow label="Trim" value={sub.vehicle_trim} onSave={(v) => saveField("vehicle_trim", v)} />
                      <EditableRow label="VIN" value={sub.vin} onSave={(v) => saveField("vin", v)} mono />
                      <EditableRow label="Plate" value={sub.plate} onSave={(v) => saveField("plate", v)} mono />
                      <EditableRow label="Mileage" value={sub.mileage} onSave={(v) => saveField("mileage", v)} />
                      <EditableRow label="Color" value={sub.exterior_color} onSave={(v) => saveField("exterior_color", v)} />
                      <Row label="Drivable" value={sub.drivable} />
                    </div>
                  </Card>
                </div>

                {/* Inspection card — three states: completed / arrived / pending */}
                <Card
                  title={inspectionCompleted ? "Inspection Summary" : customerArrived ? "Inspection · Customer Here" : "Inspection"}
                  right={
                    inspectionCompleted ? (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5">Completed</span>
                    ) : customerArrived ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-0.5">
                        <span className="relative flex items-center justify-center">
                          <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-red-500 opacity-60 animate-ping" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-600" />
                        </span>
                        Ready to Start
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5">Pending</span>
                    )
                  }
                >
                  {inspectionCompleted ? (
                    <div className="space-y-4">
                      {sub.overall_condition && (
                        <p className="text-[14px] leading-relaxed text-slate-700">{sub.overall_condition}</p>
                      )}
                      <div className="flex gap-3">
                        <PassFail label="Tires" pass={null} />
                        <PassFail label="Brakes" pass={null} />
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <button className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 inline-flex items-center gap-1.5 transition">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/></svg>
                          View Full Inspection
                        </button>
                        {manualAppraisalNeeded ? (
                          <button className="h-9 px-3.5 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[12px] font-bold inline-flex items-center gap-1.5 transition">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a7 7 0 100 14 7 7 0 000-14zm0 3a1 1 0 011 1v3h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H7a1 1 0 110-2h2V7a1 1 0 011-1z"/></svg>
                            Appraise Vehicle
                          </button>
                        ) : (
                          <button className="h-9 px-3 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition">
                            Re-Appraise
                          </button>
                        )}
                      </div>
                    </div>
                  ) : customerArrived ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 border border-red-300 p-4">
                        <div className="flex items-start gap-3">
                          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                            <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-60 animate-ping" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-red-900 text-sm">Customer is at the car</div>
                            <div className="text-[13px] text-red-800/90 mt-0.5 leading-snug">
                              Scan the QR on your phone or iPad and walk out to start the inspection.
                              Tires &amp; brakes will sync back here when you're done.
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setQrOpen(true)}
                        className="w-full h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold inline-flex items-center justify-center gap-2 transition shadow-sm"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/></svg>
                        Send QR to My Phone
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM10 6a.75.75 0 00-.75.75v4a.75.75 0 001.5 0v-4A.75.75 0 0010 6z"/></svg>
                        <div className="flex-1">
                          <div className="font-semibold text-amber-900 text-sm">No inspection completed yet</div>
                          <div className="text-[13px] text-amber-800/80 mt-0.5">Tires and brakes pass/fail will appear here once the car is inspected.</div>
                        </div>
                      </div>
                      <button className="w-full h-10 rounded-lg bg-[#003b80] hover:bg-[#002a5c] text-white text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a1 1 0 011-1h10a1 1 0 011 1v14l-5-3-5 3-1-.6V3z"/></svg>
                        Start Inspection
                      </button>
                    </div>
                  )}
                </Card>

              </div>

              {/* ── RIGHT / SECONDARY rail ──────────────────────────── */}
              <aside className="space-y-5 min-w-0">

                {/* Next Action card — tone changes by state */}
                {(() => {
                  let nextLabel: string;
                  let nextSub: string;
                  let nextBtn: string;
                  let nextTone: "blue" | "amber" | "green" | "red" = "blue";
                  let nextOnClick: (() => void) | null = null;

                  if (customerArrived) {
                    nextLabel = "Walk to the Car";
                    nextSub = `${firstName} is here. Scan the QR on your phone and start the inspection.`;
                    nextBtn = "Send QR to My Phone";
                    nextTone = "red";
                    nextOnClick = () => setQrOpen(true);
                  } else if (!inspectionCompleted) {
                    nextLabel = "Start Inspection";
                    nextSub = "Walk the car — tires, brakes, photos, docs.";
                    nextBtn = "Start Inspection";
                  } else if (manualAppraisalNeeded) {
                    nextLabel = "Appraise Vehicle";
                    nextSub = "Customer declined auto-offer. Manual appraisal required.";
                    nextBtn = "Open Appraisal";
                    nextTone = "amber";
                  } else if (sub.progress_status === "offer_accepted") {
                    nextLabel = "Review Offer";
                    nextSub = "Customer has an offer. Follow up to close.";
                    nextBtn = "Send Follow-Up";
                    nextTone = "green";
                  } else if (sub.progress_status === "inspection_scheduled") {
                    nextLabel = "Inspection Scheduled";
                    nextSub = "Customer is booked. Check in when they arrive.";
                    nextBtn = "Check In Customer";
                  } else {
                    nextLabel = "Finalize Deal";
                    nextSub = "Paperwork and check request.";
                    nextBtn = "Open Check Request";
                    nextTone = "green";
                  }

                  const toneBg = {
                    blue:  "from-[#003b80] to-[#005bb5]",
                    amber: "from-amber-600 to-amber-500",
                    green: "from-emerald-700 to-emerald-600",
                    red:   "from-red-600 to-red-500",
                  }[nextTone];

                  return (
                    <section className={`rounded-xl border border-slate-200 bg-gradient-to-br ${toneBg} text-white shadow-sm overflow-hidden`}>
                      <div className="px-4 py-2.5 border-b border-white/15 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/80">Next Action</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 rounded px-2 py-0.5">For Sales</span>
                      </div>
                      <div className="p-4">
                        <div className="font-display text-[20px] leading-tight">{nextLabel}</div>
                        <p className="text-[12.5px] text-white/80 mt-1 leading-snug">{nextSub}</p>
                        <button
                          onClick={nextOnClick || undefined}
                          className="w-full mt-3 h-10 rounded-lg bg-white text-slate-900 text-[13px] font-bold hover:bg-white/90 transition inline-flex items-center justify-center gap-1.5"
                        >
                          {customerArrived && (
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h5v5H3V3zm1 1v3h3V4H4zm8-1h5v5h-5V3zm1 1v3h3V4h-3zM3 12h5v5H3v-5zm1 1v3h3v-3H4zm8-1h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z"/></svg>
                          )}
                          {nextBtn}
                          {!customerArrived && (
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z"/></svg>
                          )}
                        </button>
                      </div>
                    </section>
                  );
                })()}

                {/* Comms tabs — SMS / Email / Calls preview + composer */}
                <ClassicCommsCard
                  submissionId={sub.id}
                  customerName={sub.name}
                  customerPhone={sub.phone}
                  customerEmail={sub.email}
                  onOpenFull={() => setCommsFullOpen(true)}
                />

                {/* Internal Notes — last 3 in a timeline + Add link → modal */}
                <Card
                  title={`Internal Notes${notes.length > 0 ? "  ·  " + notes.length : ""}`}
                  right={
                    <button
                      onClick={() => setNotesOpen(true)}
                      className="text-[11px] font-bold text-[#003b80] hover:underline"
                    >
                      + Add
                    </button>
                  }
                >
                  {notes.length === 0 ? (
                    <div className="text-[12.5px] text-slate-400 italic py-2">
                      No notes yet — click <span className="font-semibold not-italic text-slate-500">+ Add</span> to leave the first one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.slice(0, 3).map((n) => (
                        <div key={n.id} className="border-b border-slate-100 last:border-0 pb-2.5 last:pb-0">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <span className="text-[12px] font-bold text-slate-900">{n.author || "Staff"}</span>
                            <span className="text-[11px] text-slate-400">
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
                          <p className="text-[12.5px] text-slate-700 leading-relaxed line-clamp-3 whitespace-pre-wrap">{n.body}</p>
                        </div>
                      ))}
                      {notes.length > 3 && (
                        <button
                          onClick={() => setNotesOpen(true)}
                          className="text-[11px] font-semibold text-[#003b80] hover:underline pt-1"
                        >
                          See all {notes.length} notes →
                        </button>
                      )}
                    </div>
                  )}
                </Card>

                {/* Deal Status — current step + appointment + status select + schedule */}
                <Card title="Deal Status">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Current Step</div>
                      <div className={`text-sm font-bold mt-0.5 ${
                        tone === "emerald" ? "text-emerald-700" :
                        tone === "amber"   ? "text-amber-700" :
                        tone === "red"     ? "text-red-700" : "text-slate-900"
                      }`}>{statusLabel}</div>
                    </div>

                    {sub.appointment_set && sub.appointment_date && (
                      <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
                        <div className="text-[11px] uppercase tracking-wider text-sky-700 font-semibold">Appointment</div>
                        <div className="text-sm font-bold text-sky-900 mt-0.5">
                          {new Date(sub.appointment_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Select
                        value={sub.progress_status}
                        onValueChange={(v) => saveField("progress_status", v)}
                      >
                        <SelectTrigger className="flex-1 h-9 text-xs rounded-lg">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => onScheduleAppointment(sub)}
                        className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold transition"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Offer Breakdown — only when there is an offer or estimate */}
                {dealValue != null && (
                  <Card title="Offer Breakdown">
                    <div className="space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] text-slate-600">{dealKind}</span>
                        <span className="font-display text-[22px] text-slate-900 leading-none">{fmtMoney(dealValue, true)}</span>
                      </div>
                      {sub.acv_value != null && (
                        <div className="flex items-baseline justify-between text-[13px]">
                          <span className="text-slate-600">ACV</span>
                          <span className="font-semibold text-slate-800">{fmtMoney(sub.acv_value)}</span>
                        </div>
                      )}
                      {sub.loan_payoff_amount != null && (
                        <div className="flex items-baseline justify-between text-[13px]">
                          <span className="text-slate-600">Loan Payoff</span>
                          <span className="font-semibold text-slate-800">−{fmtMoney(sub.loan_payoff_amount)}</span>
                        </div>
                      )}
                      {sub.loan_payoff_amount != null && (
                        <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                          <span className="text-[12px] uppercase tracking-wider text-slate-500 font-semibold">Customer Equity</span>
                          <span className={`font-bold text-[15px] ${
                            (dealValue - sub.loan_payoff_amount) >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}>
                            {(dealValue - sub.loan_payoff_amount) >= 0 ? "+" : ""}{fmtMoney(dealValue - sub.loan_payoff_amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Loan card — only when loan info exists */}
                {(sub.loan_status || sub.loan_company) && (
                  <Card title="Loan">
                    <div className="space-y-0">
                      <Row label="Status" value={sub.loan_status} />
                      <Row label="Lender" value={sub.loan_company} />
                      <Row label="Balance" value={sub.loan_balance ? fmtMoney(sub.loan_balance) : null} />
                      <Row label="Verified Payoff" value={sub.loan_payoff_amount != null ? fmtMoney(sub.loan_payoff_amount) : null} />
                    </div>
                  </Card>
                )}

              </aside>

            </div>
          </div>
        </div>

        {/* Full-screen comms overlay — covers the slider when "See all" is clicked */}
        <ClassicCommsFullView
          open={commsFullOpen}
          onClose={() => setCommsFullOpen(false)}
          submissionId={sub.id}
          customerName={sub.name}
          customerPhone={sub.phone}
          customerEmail={sub.email}
        />

        <QRInspectionModal open={qrOpen} onClose={() => setQrOpen(false)} sub={sub} />

        <SubmissionNotesModal
          submissionId={sub.id}
          customerName={sub.name}
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          author={auditLabel || "Staff"}
          onChange={() => void refreshNotes(sub.id)}
        />
      </SheetContent>
    </Sheet>
  );
}
