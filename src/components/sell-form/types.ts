export interface VehicleInfo {
  year: string;
  make: string;
  model: string;
}

// Black Book vehicle data returned from edge function
export interface BBAddDeduct {
  uoc: string;
  name: string;
  auto: string; // "Y" | "N" | "M" | "D"
  avg: number;
  clean: number;
  rough: number;
  xclean: number;
}

export interface BBColor {
  code: string;
  name: string;
  rgb: string;
  hex: string;
}

export interface BBVehicle {
  uvc: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  series: string;
  style: string;
  class_name: string;
  msrp: number;
  price_includes: string;
  // Vehicle specs from BB
  drivetrain: string;
  transmission: string;
  engine: string;
  fuel_type: string;
  // Exterior colors from BB
  exterior_colors: BBColor[];
  // Value adjustments
  mileage_adj: number;
  regional_adj: number;
  base_whole_avg: number;
  add_deduct_list: BBAddDeduct[];
  wholesale: { xclean: number; clean: number; avg: number; rough: number };
  tradein: { clean: number; avg: number; rough: number };
  retail: { xclean: number; clean: number; avg: number; rough: number };
  // New data points
  private_party?: { xclean: number; clean: number; avg: number; rough: number };
  finance_advance?: { xclean: number; clean: number; avg: number; rough: number };
  residual_12?: number;
  residual_24?: number;
  residual_36?: number;
  residual_48?: number;
  recall_count?: number;
  recalls?: { campaign_number: string; component: string; summary: string }[];
}

export interface FormData {
  // Vehicle Info
  plate: string;
  state: string;
  vin: string;
  mileage: string;
  // Black Book data
  bbUvc: string;
  bbSelectedAddDeducts: string[];
  // Vehicle Build
  exteriorColor: string;
  drivetrain: string;
  modifications: string;
  // Condition & History
  overallCondition: string;
  exteriorDamage: string[];
  windshieldDamage: string;
  moonroof: string;
  interiorDamage: string[];
  techIssues: string[];
  engineIssues: string[];
  mechanicalIssues: string[];
  drivable: string;
  accidents: string;
  smokedIn: string;
  tiresReplaced: string;
  numKeys: string;
  // Your Details
  name: string;
  phone: string;
  email: string;
  zip: string;
  loanStatus: string;
  loanCompany: string;
  loanBalance: string;
  loanPayment: string;
  // Next Steps
  nextStep: string;
  // Store assignment
  preferredLocationId: string;
  salespersonName: string;
  // Manual YMM fallback
  manualYear: string;
  manualMake: string;
  manualModel: string;
}

export const initialFormData: FormData = {
  plate: "",
  state: "",
  vin: "",
  mileage: "",
  bbUvc: "",
  bbSelectedAddDeducts: [],
  exteriorColor: "",
  drivetrain: "",
  modifications: "",
  overallCondition: "good",
  exteriorDamage: [],
  windshieldDamage: "",
  moonroof: "",
  interiorDamage: [],
  techIssues: [],
  engineIssues: [],
  mechanicalIssues: [],
  drivable: "",
  accidents: "",
  smokedIn: "",
  tiresReplaced: "",
  numKeys: "",
  name: "",
  phone: "",
  email: "",
  zip: "",
  loanStatus: "",
  loanCompany: "",
  loanBalance: "",
  loanPayment: "",
  nextStep: "",
  preferredLocationId: "",
  salespersonName: "",
  manualYear: "",
  manualMake: "",
  manualModel: "",
};

export const STEPS = [
  "Vehicle Info",
  "Vehicle Build",
  "Condition",
  "History",
  "Finalize",
];
