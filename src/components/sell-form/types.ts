export interface VehicleInfo {
  year: string;
  make: string;
  model: string;
}

export interface FormData {
  // Vehicle Info
  plate: string;
  state: string;
  vin: string;
  mileage: string;
  // Vehicle Build
  exteriorColor: string;
  drivetrain: string;
  modifications: string;
  // Condition & History (all on one page)
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
  // Next Steps
  nextStep: string;
}

export const initialFormData: FormData = {
  plate: "",
  state: "",
  vin: "",
  mileage: "",
  exteriorColor: "",
  drivetrain: "",
  modifications: "",
  overallCondition: "",
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
  nextStep: "",
};

export const STEPS = [
  "Vehicle Info",
  "Vehicle Build",
  "Condition & History",
  "Your Details",
  "Get Your Offer",
];
