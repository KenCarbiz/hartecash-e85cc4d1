import {
  UserPlus, PhoneCall, ClipboardList, Handshake, BadgeCheck, Trophy, XCircle, CheckCircle,
  type LucideIcon,
} from "lucide-react";

// ── Progress Stage Definitions ──
export interface ProgressStage {
  key: string;
  label: string;
  dbKeys: string[];
  icon: LucideIcon;
}

export const PROGRESS_STAGES_NOT_ACCEPTED: ProgressStage[] = [
  { key: "new", label: "New Lead", dbKeys: ["new"], icon: UserPlus },
  { key: "contacted", label: "Contacted", dbKeys: ["contacted"], icon: PhoneCall },
  { key: "inspected", label: "Inspection / Final Appraisal", dbKeys: ["inspection_scheduled", "inspection_completed"], icon: ClipboardList },
  { key: "deal_finalized", label: "Deal Finalized", dbKeys: ["deal_finalized"], icon: Handshake },
  { key: "docs_title", label: "Title / Ownership Verified", dbKeys: ["title_ownership_verified"], icon: BadgeCheck },
  { key: "purchase_complete", label: "Purchased", dbKeys: ["check_request_submitted", "purchase_complete"], icon: Trophy },
  { key: "dead_lead", label: "Dead Deal", dbKeys: ["dead_lead"], icon: XCircle },
];

export const PROGRESS_STAGES_ACCEPTED: ProgressStage[] = [
  { key: "new", label: "New Lead", dbKeys: ["new"], icon: UserPlus },
  { key: "offer_accepted", label: "Offer Accepted", dbKeys: ["offer_accepted"], icon: CheckCircle },
  { key: "inspected", label: "Inspection", dbKeys: ["inspection_scheduled", "inspection_completed"], icon: ClipboardList },
  { key: "deal_finalized", label: "Deal Finalized", dbKeys: ["deal_finalized"], icon: Handshake },
  { key: "docs_title", label: "Title / Ownership Verified", dbKeys: ["title_ownership_verified"], icon: BadgeCheck },
  { key: "purchase_complete", label: "Purchased", dbKeys: ["check_request_submitted", "purchase_complete"], icon: Trophy },
  { key: "dead_lead", label: "Dead Deal", dbKeys: ["dead_lead"], icon: XCircle },
];

export const ACCEPTED_NO_APPOINTMENT_STATUSES = ["offer_accepted", "appraisal_completed", "price_agreed"] as const;
export const ACCEPTED_WITH_APPOINTMENT_STATUSES = [
  "inspection_scheduled",
  "inspection_completed",
  "deal_finalized",
  "title_ownership_verified",
  "check_request_submitted",
  "purchase_complete",
] as const;

export const PROGRESS_STAGES = PROGRESS_STAGES_NOT_ACCEPTED;

export const getProgressStages = (sub: { offered_price?: number | null; progress_status: string }) => {
  const ACCEPTED_STATUSES = [...ACCEPTED_NO_APPOINTMENT_STATUSES, ...ACCEPTED_WITH_APPOINTMENT_STATUSES];
  const isAccepted = !!sub.offered_price || ACCEPTED_STATUSES.includes(sub.progress_status as any);
  return isAccepted ? PROGRESS_STAGES_ACCEPTED : PROGRESS_STAGES_NOT_ACCEPTED;
};

export const getStageIndex = (dbStatus: string): number => {
  const idx = PROGRESS_STAGES.findIndex(s => s.dbKeys.includes(dbStatus));
  return idx >= 0 ? idx : 0;
};

export const ALL_STATUS_OPTIONS = [
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Contacted" },
  { key: "offer_accepted", label: "Offer Accepted" },
  { key: "no_contact", label: "Unable to Reach" },
  { key: "inspection_scheduled", label: "Inspection Scheduled" },
  { key: "inspection_completed", label: "Inspection Completed" },
  { key: "appraisal_completed", label: "Final Appraisal Completed" },
  { key: "price_agreed", label: "Price Agreed" },
  { key: "deal_finalized", label: "Deal Finalized" },
  { key: "title_ownership_verified", label: "Title / Ownership Verified" },
  { key: "check_request_submitted", label: "Check Request Submitted" },
  { key: "purchase_complete", label: "Purchased" },
  { key: "dead_lead", label: "Dead Deal" },
  { key: "manager_approval_inspection", label: "MAI (Manager Approval Inspection)" },
  { key: "partial", label: "Abandoned" },
];

export const getStatusLabel = (dbStatus: string): string =>
  ALL_STATUS_OPTIONS.find(s => s.key === dbStatus)?.label || dbStatus;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_bdc: "BDC",
  sales: "Salesperson",
  internet_manager: "Internet Manager",
  used_car_manager: "Used Car Manager",
  new_car_manager: "New Car Manager",
  gsm_gm: "GSM",
  gm: "General Manager",
  receptionist: "Receptionist",
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  drivers_license_front: "Driver's License (Front)",
  drivers_license_back: "Driver's License (Back)",
  registration: "Registration",
  title_inquiry: "Title Inquiry",
  title: "Title",
  payoff_verification: "Payoff Verification",
  appraisal: "Appraisal",
  carfax: "Carfax",
  window_sticker: "Window Sticker",
};

export const PAGE_SIZE = 20;

// ── Shared Types ──
export interface Submission {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  state: string | null;
  plate: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_trim: string | null;
  mileage: string | null;
  overall_condition: string | null;
  next_step: string | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  loan_status: string | null;
  exterior_color: string | null;
  drivetrain: string | null;
  modifications: string | null;
  exterior_damage: string[] | null;
  windshield_damage: string | null;
  moonroof: string | null;
  interior_damage: string[] | null;
  tech_issues: string[] | null;
  engine_issues: string[] | null;
  mechanical_issues: string[] | null;
  drivable: string | null;
  accidents: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  progress_status: string;
  offered_price: number | null;
  estimated_offer_high: number | null;
  acv_value: number | null;
  appraised_by: string | null;
  check_request_done: boolean;
  appraisal_finalized: boolean;
  appraisal_finalized_at: string | null;
  appraisal_finalized_by: string | null;
  internal_notes: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
  appointment_date: string | null;
  appointment_set: boolean;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  lead_source: string;
  store_location_id: string | null;
  is_hot_lead: boolean;
  loan_company?: string | null;
  loan_balance?: string | null;
  loan_payment?: string | null;
  loan_payoff_amount?: number | null;
  loan_payoff_verified?: boolean;
  loan_payoff_updated_at?: string | null;
  estimated_equity?: number | null;
  review_requested?: boolean;
  review_requested_at?: string | null;
  bb_tradein_avg?: number | null;
  bb_wholesale_avg?: number | null;
  bb_retail_avg?: number | null;
  bb_value_tiers?: Record<string, Record<string, number>> | string | null;
}

export type SubmissionPipelineState = Pick<Submission, "progress_status" | "appointment_set" | "offered_price" | "estimated_offer_high">;

export const submissionHasOffer = (sub: Pick<Submission, "offered_price" | "estimated_offer_high">) =>
  (sub.offered_price != null && sub.offered_price > 0) || (sub.estimated_offer_high != null && sub.estimated_offer_high > 0);

/** Accepted + downstream status or appointment set */
export const isAcceptedWithAppointment = (sub: SubmissionPipelineState) =>
  (!!sub.offered_price && sub.offered_price > 0 && Boolean(sub.appointment_set)) ||
  ACCEPTED_WITH_APPOINTMENT_STATUSES.includes(sub.progress_status as any);

/** Has offered_price (accepted) but no appointment yet */
export const isAcceptedWithoutAppointment = (sub: SubmissionPipelineState) =>
  !!sub.offered_price && sub.offered_price > 0 &&
  !isAcceptedWithAppointment(sub);

/** Has an estimate but customer hasn't accepted yet (no offered_price) */
export const isOfferPendingSubmission = (sub: SubmissionPipelineState) =>
  !sub.offered_price &&
  sub.estimated_offer_high != null && sub.estimated_offer_high > 0;

/** Staff manually adjusted the offered_price to differ from the system estimate */
export const isOfferUpdatedByStaff = (sub: Pick<Submission, "offered_price" | "estimated_offer_high">) =>
  !!sub.offered_price && sub.offered_price > 0 &&
  !!sub.estimated_offer_high && sub.estimated_offer_high > 0 &&
  sub.offered_price !== sub.estimated_offer_high;

export interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface Appointment {
  id: string;
  submission_token: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  preferred_time: string;
  vehicle_info: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  store_location: string | null;
}

export const APPT_TIME_SLOTS_WEEKDAY = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM",
];

export const APPT_TIME_SLOTS_FRISSAT = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM",
];

export const getTimeSlotsForDate = (dateStr: string) => {
  if (!dateStr) return APPT_TIME_SLOTS_WEEKDAY;
  const day = new Date(dateStr + "T12:00:00").getDay();
  if (day === 0) return [];
  if (day === 5 || day === 6) return APPT_TIME_SLOTS_FRISSAT;
  return APPT_TIME_SLOTS_WEEKDAY;
};

// ── Role Labels (canonical) ──
// Single source of truth for how we display user roles across the admin.
// Keys are the DB enum values; values are the short labels used in
// dropdowns, badges, toasts, and the audit trail.
//
// Role hierarchy (least → most access):
//   sales_bdc → used_car_manager / new_car_manager → gsm_gm → admin → platform_admin
//
// Note: used_car_manager and new_car_manager sit at the same tier —
// they differ only in which department they report to. Permission
// checks should treat them identically everywhere.
export const ROLE_LABELS_FULL: Record<string, string> = {
  sales_bdc: "BDC",
  sales: "Sales",
  internet_manager: "Internet Mgr",
  used_car_manager: "UCM",
  new_car_manager: "NCM",
  gsm_gm: "GSM",
  gm: "GM",
  admin: "Admin",
  platform_admin: "Super Admin",
  inspector: "Inspector",
  appraiser: "Appraiser",
  receptionist: "Reception",
};

// Longer, more descriptive labels used in onboarding and staff management
// where there's room for the full title.
export const ROLE_LABELS_LONG: Record<string, string> = {
  sales_bdc: "BDC Representative",
  sales: "Salesperson",
  internet_manager: "Internet Manager",
  used_car_manager: "Used Car Manager",
  new_car_manager: "New Car Manager",
  gsm_gm: "General Sales Manager",
  gm: "General Manager",
  admin: "Admin",
  platform_admin: "Super Admin",
  inspector: "Inspector",
  appraiser: "Appraiser",
  receptionist: "Receptionist",
};

// Roles that sit at the "sales floor" tier — individual contributors
// working leads. BDC focuses on appointment-setting + declined-offer
// objection handling + escalation; Sales owns the customer through
// the deal. Both see read-only pricing (see PRICING_VIEW_ROLES).
export const SALES_FLOOR_ROLES = ["sales_bdc", "sales"] as const;

// Roles that sit at the "manager" tier — they get full pricing edit,
// queue access, and the appraisal tool. gm is included because every
// manager-tier permission still applies (GMs don't lose approval
// rights just because they also see the executive HUD).
export const MANAGER_ROLES = [
  "used_car_manager",
  "new_car_manager",
  "gsm_gm",
  "gm",
] as const;

// Roles allowed to EDIT pricing — cost basis, overrides, waterfall.
// Strict superset of MANAGER_ROLES + admin.
export const PRICING_ROLES = ["admin", ...MANAGER_ROLES] as const;

// Roles allowed to VIEW pricing information (book values, ACV, market
// comps) — read-only for the sales floor, full access for managers.
// Keeps the sales team able to quote customers without leaking the
// margin math they don't need to see edited or overridden.
export const PRICING_VIEW_ROLES = [
  ...SALES_FLOOR_ROLES,
  ...PRICING_ROLES,
  "appraiser",
] as const;

// Roles allowed to approve the highest-stakes statuses (deal finalized,
// check request submitted, purchase complete). GM-tier only.
export const APPROVAL_ROLES = ["admin", "gsm_gm", "gm"] as const;

// Roles allowed to see the executive HUD: conversion rates, lead source
// mix, employee performance, floor-plan holding costs. Owner-adjacent
// by design — GSMs and below stay focused on their deals, not the
// P&L dashboard.
export const EXECUTIVE_HUD_ROLES = ["admin", "gm", "platform_admin"] as const;

// Roles allowed to edit the DEALER's offer model — how aggressive the
// offer is vs. book, recon buffers, promo bonuses, payment timing.
// This is the dealer's own tuning knob, not the subscription-pricing
// model (which is platform-admin only via tenant.dealership_id check).
export const OFFER_MODEL_EDIT_ROLES = ["admin", "gsm_gm", "gm"] as const;

// Roles allowed to access the check-in kiosk workflow. Receptionist
// stops here — they check customers in and see today's appointments,
// nothing else.
export const CHECKIN_ROLES = [
  "admin",
  "receptionist",
  "inspector",
  "sales_bdc",
  "sales",
  "internet_manager",
  "used_car_manager",
  "new_car_manager",
  "gsm_gm",
  "gm",
] as const;

// Internet Manager sits at a sub-manager tier — they coordinate BDC +
// sales but don't edit pricing / offer model / configuration. Gives
// them the lead pipeline, appointment queue, and per-rep performance
// for internet leads.
export const INTERNET_MANAGER_ROLES = ["internet_manager"] as const;

export const isManagerRole = (role: string | null | undefined): boolean =>
  !!role && (MANAGER_ROLES as readonly string[]).includes(role);

export const isPricingRole = (role: string | null | undefined): boolean =>
  !!role && (PRICING_ROLES as readonly string[]).includes(role);

export const isApprovalRole = (role: string | null | undefined): boolean =>
  !!role && (APPROVAL_ROLES as readonly string[]).includes(role);

export const isSalesFloorRole = (role: string | null | undefined): boolean =>
  !!role && (SALES_FLOOR_ROLES as readonly string[]).includes(role);

export const isBDCRole = (role: string | null | undefined): boolean =>
  role === "sales_bdc";

export const isSalesRole = (role: string | null | undefined): boolean =>
  role === "sales";

export const canViewPricing = (role: string | null | undefined): boolean =>
  !!role && (PRICING_VIEW_ROLES as readonly string[]).includes(role);

export const canEditPricing = (role: string | null | undefined): boolean =>
  isPricingRole(role);

export const canViewExecutiveHUD = (role: string | null | undefined): boolean =>
  !!role && (EXECUTIVE_HUD_ROLES as readonly string[]).includes(role);

export const canEditOfferModel = (role: string | null | undefined): boolean =>
  !!role && (OFFER_MODEL_EDIT_ROLES as readonly string[]).includes(role);

export const canAccessCheckIn = (role: string | null | undefined): boolean =>
  !!role && (CHECKIN_ROLES as readonly string[]).includes(role);

export const isReceptionistRole = (role: string | null | undefined): boolean =>
  role === "receptionist";

// Roles that actively work individual leads — call them, text them,
// book their inspection, escalate to a manager. Wider than the sales
// floor because internet_manager is hands-on by design (they bounce
// between managing the BDC team and working leads themselves per
// user direction).
export const LEAD_WORKING_ROLES = [
  ...SALES_FLOOR_ROLES,
  "internet_manager",
] as const;

export const canWorkLeads = (role: string | null | undefined): boolean =>
  !!role && (LEAD_WORKING_ROLES as readonly string[]).includes(role);

export const isInternetManagerRole = (role: string | null | undefined): boolean =>
  role === "internet_manager";

export const getRoleLabel = (role: string | null | undefined, variant: "short" | "long" = "short"): string => {
  if (!role) return "Unknown";
  const map = variant === "long" ? ROLE_LABELS_LONG : ROLE_LABELS;
  return map[role] || role.replace(/_/g, " ");
};
