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
  { key: "inspected", label: "Inspection / Final Appraisal", dbKeys: ["inspection_scheduled", "inspection_completed", "appraisal_completed"], icon: ClipboardList },
  { key: "price_agreed", label: "Deal Finalized", dbKeys: ["manager_approval", "price_agreed"], icon: Handshake },
  { key: "docs_title", label: "Paperwork Completed", dbKeys: ["title_verified", "ownership_verified"], icon: BadgeCheck },
  { key: "purchase_complete", label: "Purchased", dbKeys: ["purchase_complete"], icon: Trophy },
  { key: "dead_lead", label: "Dead Lead", dbKeys: ["dead_lead"], icon: XCircle },
];

export const PROGRESS_STAGES_ACCEPTED: ProgressStage[] = [
  { key: "new", label: "New Lead", dbKeys: ["new"], icon: UserPlus },
  { key: "contacted", label: "Offer Accepted", dbKeys: ["contacted"], icon: CheckCircle },
  { key: "inspected", label: "Inspection / Final Appraisal", dbKeys: ["inspection_scheduled", "inspection_completed", "appraisal_completed"], icon: ClipboardList },
  { key: "price_agreed", label: "Deal Finalized", dbKeys: ["manager_approval", "price_agreed"], icon: Handshake },
  { key: "docs_title", label: "Paperwork Completed", dbKeys: ["title_verified", "ownership_verified"], icon: BadgeCheck },
  { key: "purchase_complete", label: "Purchased", dbKeys: ["purchase_complete"], icon: Trophy },
  { key: "dead_lead", label: "Dead Lead", dbKeys: ["dead_lead"], icon: XCircle },
];

export const PROGRESS_STAGES = PROGRESS_STAGES_NOT_ACCEPTED;

export const getProgressStages = (sub: { offered_price?: number | null; progress_status: string }) => {
  const ACCEPTED_STATUSES = ['contacted', 'inspection_scheduled', 'inspection_completed', 'appraisal_completed', 'manager_approval', 'price_agreed', 'title_verified', 'ownership_verified', 'purchase_complete'];
  const isAccepted = !!sub.offered_price || ACCEPTED_STATUSES.includes(sub.progress_status);
  return isAccepted ? PROGRESS_STAGES_ACCEPTED : PROGRESS_STAGES_NOT_ACCEPTED;
};

export const getStageIndex = (dbStatus: string): number => {
  const idx = PROGRESS_STAGES.findIndex(s => s.dbKeys.includes(dbStatus));
  return idx >= 0 ? idx : 0;
};

export const ALL_STATUS_OPTIONS = [
  { key: "partial", label: "Abandoned" },
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Contacted" },
  { key: "inspection_scheduled", label: "Inspection Scheduled" },
  { key: "inspection_completed", label: "Inspection Completed" },
  { key: "appraisal_completed", label: "Appraisal Completed" },
  { key: "manager_approval", label: "Manager Approval" },
  { key: "price_agreed", label: "Price Agreed" },
  { key: "title_verified", label: "Title Verified" },
  { key: "ownership_verified", label: "Ownership Verified" },
  { key: "purchase_complete", label: "Purchased" },
  { key: "dead_lead", label: "Dead Lead" },
];

export const getStatusLabel = (dbStatus: string): string =>
  ALL_STATUS_OPTIONS.find(s => s.key === dbStatus)?.label || dbStatus;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_bdc: "Sales / BDC",
  used_car_manager: "Used Car Manager",
  gsm_gm: "GSM / GM",
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
  review_requested?: boolean;
  review_requested_at?: string | null;
}

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
