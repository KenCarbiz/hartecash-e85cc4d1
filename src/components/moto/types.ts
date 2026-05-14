import type { BBVehicle } from "@/components/sell-form/types";

export type MotoStepId =
  | "search"
  | "condition"
  | "trade-or-sell"
  | "ownership"
  | "color"
  | "contact"
  | "offer"
  | "photos"
  | "schedule"
  | "queued";

export type LookupMode = "vin" | "plate" | "ymm";
export type Condition = "excellent" | "good" | "fair" | "poor";
export type TradeOrSell = "trade" | "sell";
export type Ownership = "own" | "finance" | "lease";

export interface MotoFlowState {
  step: MotoStepId;
  lookupMode: LookupMode;
  vin: string;
  plate: string;
  plateState: string;
  ymm: { year: string; make: string; model: string; trim: string };
  bbVehicle: BBVehicle | null;
  mileage: string;
  condition: Condition | null;
  intent: TradeOrSell | null;
  ownership: Ownership | null;
  color: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneVerified: boolean;
    zip: string;
  };
  trackValue: boolean;
  submissionId: string | null;
  submissionToken: string | null;
  offer: {
    low: number | null;
    high: number | null;
    firm: number | null;
    aiBumped: boolean;
  };
  declined: boolean;
}

export const emptyMotoFlowState: MotoFlowState = {
  step: "search",
  lookupMode: "vin",
  vin: "",
  plate: "",
  plateState: "",
  ymm: { year: "", make: "", model: "", trim: "" },
  bbVehicle: null,
  mileage: "",
  condition: null,
  intent: null,
  ownership: null,
  color: "",
  contact: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneVerified: false,
    zip: "",
  },
  trackValue: true,
  submissionId: null,
  submissionToken: null,
  offer: { low: null, high: null, firm: null, aiBumped: false },
  declined: false,
};
