import type { Submission } from "@/lib/adminConstants";

export type LeadActionVariant = "primary" | "ghost" | "destructive";
export type LeadActionIcon = "phone" | "dollar" | "calendar" | "check" | "eye" | null;
export type LeadActionKey = "open" | "call" | "sms" | "offer" | "appt" | "revive";

export interface LeadAction {
  label: string;
  variant: LeadActionVariant;
  icon: LeadActionIcon;
  href?: string;
  actionKey: LeadActionKey;
}

export function nextActionForLead(s: Submission): LeadAction {
  const digits = s.phone?.replace(/\D/g, "");
  const tel = digits ? `tel:+1${digits}` : undefined;

  switch (s.progress_status) {
    case "new":
      return { label: "Call", variant: "primary", icon: "phone", href: tel, actionKey: "call" };
    case "contacted":
      return { label: "Follow up", variant: "ghost", icon: "phone", href: tel, actionKey: "call" };
    case "no_contact":
      return { label: "Retry", variant: "ghost", icon: "phone", href: tel, actionKey: "call" };
    case "inspection_scheduled":
      return { label: "Prep", variant: "ghost", icon: "eye", actionKey: "open" };
    case "inspection_completed":
      return { label: "Make offer", variant: "primary", icon: "dollar", actionKey: "offer" };
    case "appraisal_completed":
      return { label: "Make offer", variant: "primary", icon: "dollar", actionKey: "offer" };
    case "manager_approval_inspection":
      return { label: "Approve", variant: "primary", icon: "check", actionKey: "open" };
    case "offer_accepted":
      return { label: "Book appt", variant: "primary", icon: "calendar", actionKey: "appt" };
    case "price_agreed":
      return { label: "Book appt", variant: "primary", icon: "calendar", actionKey: "appt" };
    case "deal_finalized":
      return { label: "Finalize", variant: "ghost", icon: "check", actionKey: "open" };
    case "title_ownership_verified":
      return { label: "Cut check", variant: "ghost", icon: "check", actionKey: "open" };
    case "check_request_submitted":
      return { label: "View", variant: "ghost", icon: "eye", actionKey: "open" };
    case "purchase_complete":
      return { label: "View", variant: "ghost", icon: "eye", actionKey: "open" };
    case "dead_lead":
      return { label: "Revive", variant: "ghost", icon: null, actionKey: "revive" };
    case "partial":
      return { label: "View", variant: "ghost", icon: "eye", actionKey: "open" };
    default:
      return { label: "Open", variant: "ghost", icon: "eye", actionKey: "open" };
  }
}
