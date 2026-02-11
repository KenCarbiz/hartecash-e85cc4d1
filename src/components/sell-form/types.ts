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
  // Vehicle Condition
  exteriorDamage: string[];
  windshieldDamage: string;
  moonroof: string;
  interiorDamage: string[];
  techIssues: string[];
  engineIssues: string[];
  mechanicalIssues: string[];
  drivable: string;
  overallCondition: string;
  // Vehicle History
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
}

export const initialFormData: FormData = {
  plate: "",
  state: "",
  vin: "",
  mileage: "",
  exteriorColor: "",
  drivetrain: "",
  modifications: "",
  exteriorDamage: [],
  windshieldDamage: "",
  moonroof: "",
  interiorDamage: [],
  techIssues: [],
  engineIssues: [],
  mechanicalIssues: [],
  drivable: "",
  overallCondition: "",
  accidents: "",
  smokedIn: "",
  tiresReplaced: "",
  numKeys: "",
  name: "",
  phone: "",
  email: "",
  zip: "",
  loanStatus: "",
};

export const STEPS = [
  "Vehicle Info",
  "Vehicle Build",
  "Condition",
  "History",
  "Your Details",
  "Get Offer",
];
