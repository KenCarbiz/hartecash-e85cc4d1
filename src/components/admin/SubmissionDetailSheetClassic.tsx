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

export default function SubmissionDetailSheetClassic(_props: ClassicProps) {
  // Shell + body to be filled in subsequent increments.
  return null;
}
