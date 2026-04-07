export type ArchitectureType =
  | "single_store"
  | "single_store_secondary"
  | "multi_location"
  | "dealer_group"
  | "enterprise";

export interface LocationEntry {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  websiteUrl: string;
  oem_brands: string[];
  locationType: string;
  corporateLogoUrl: string;
  corporateLogoDarkUrl: string;
  locationLogoUrl: string;
  locationLogoDarkUrl: string;
  oem_logo_urls: string[];
  scrapedData: Record<string, any> | null;
}

export interface WizardState {
  // Step 1
  architecture: ArchitectureType | null;
  // Step 2
  displayName: string;
  slug: string;
  customDomain: string;
  planTier: string;
  bdcModel: string;
  locationCount: number;
  offerLogicApproverRole: string;
  // Step 3 — corporate
  websiteUrl: string;
  scrapedData: Record<string, any> | null;
  corporateLogoUrl: string;
  corporateLogoDarkUrl: string;
  // Step 4 — locations
  locations: LocationEntry[];
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  architecture: null,
  displayName: "",
  slug: "",
  customDomain: "",
  planTier: "standard",
  bdcModel: "no_bdc",
  locationCount: 1,
  offerLogicApproverRole: "gsm_gm",
  websiteUrl: "",
  scrapedData: null,
  corporateLogoUrl: "",
  corporateLogoDarkUrl: "",
  locations: [],
};

export function createLocationEntry(index: number): LocationEntry {
  return {
    id: `loc_${Date.now()}_${index}`,
    name: "",
    city: "",
    state: "CT",
    address: "",
    phone: "",
    email: "",
    websiteUrl: "",
    oem_brands: [],
    locationType: index === 0 ? "primary" : "sister_store",
    corporateLogoUrl: "",
    corporateLogoDarkUrl: "",
    locationLogoUrl: "",
    locationLogoDarkUrl: "",
    oem_logo_urls: [],
    scrapedData: null,
  };
}

export function architectureToplanTier(arch: ArchitectureType): string {
  switch (arch) {
    case "single_store":
    case "single_store_secondary":
      return "standard";
    case "multi_location":
      return "multi_store";
    case "dealer_group":
      return "group";
    case "enterprise":
      return "enterprise";
  }
}

export function architectureToDbValue(arch: ArchitectureType): string {
  switch (arch) {
    case "single_store":
    case "single_store_secondary":
      return "single_store";
    case "multi_location":
      return "multi_location";
    case "dealer_group":
    case "enterprise":
      return "dealer_group";
  }
}
