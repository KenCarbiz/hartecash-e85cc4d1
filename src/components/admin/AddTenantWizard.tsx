import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, ArrowLeft, X, Rocket, Loader2, CheckCircle2, PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import ArchitectureSelector from "./onboarding/ArchitectureSelector";
import BDCSelector from "./onboarding/BDCSelector";
import TenantDetailsStep from "./onboarding/TenantDetailsStep";
import WebsiteScrapeStep from "./onboarding/WebsiteScrapeStep";
import LocationSetupStep from "./onboarding/LocationSetupStep";
import ReviewLaunchStep from "./onboarding/ReviewLaunchStep";
import {
  DEFAULT_WIZARD_STATE,
  architectureToplanTier,
  architectureToDbValue,
  createLocationEntry,
} from "./onboarding/types";
import type { ArchitectureType, WizardState } from "./onboarding/types";
import type { BDCType } from "./onboarding/BDCSelector";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

type Step = "architecture" | "details" | "bdc" | "scrape" | "locations" | "review" | "creating";

const STEP_LABELS: Record<Step, string> = {
  architecture: "Architecture",
  details: "Details",
  bdc: "Lead Handling",
  scrape: "AI Scan & Branding",
  locations: "Locations",
  review: "Review & Launch",
  creating: "Provisioning…",
};

function getSteps(arch: ArchitectureType | null): Step[] {
  if (!arch) return ["architecture"];
  if (arch === "enterprise") return ["architecture", "details", "bdc", "scrape", "review", "creating"];
  if (arch === "single_store") return ["architecture", "details", "bdc", "scrape", "locations", "review", "creating"];
  // multi + group + secondary all show locations
  return ["architecture", "details", "bdc", "scrape", "locations", "review", "creating"];
}

function getDefaultLocationCount(arch: ArchitectureType): number {
  switch (arch) {
    case "single_store": return 1;
    case "single_store_secondary": return 2;
    case "multi_location": return 3;
    case "dealer_group": return 4;
    case "enterprise": return 1;
  }
}

const AddTenantWizard = ({ onClose, onCreated }: Props) => {
  const [step, setStep] = useState<Step>("architecture");
  const [state, setState] = useState<WizardState>({ ...DEFAULT_WIZARD_STATE });
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; steps?: string[]; error?: string } | null>(null);

  const steps = getSteps(state.architecture);
  const currentIdx = steps.indexOf(step);
  const canGoBack = currentIdx > 0 && step !== "creating";

  const update = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const handleArchSelect = (arch: ArchitectureType) => {
    const planTier = architectureToplanTier(arch);
    const count = getDefaultLocationCount(arch);
    const locations = Array.from({ length: count }, (_, i) => createLocationEntry(i));
    update({ architecture: arch, planTier, locationCount: count, locations });
  };

  // After scrape, auto-populate locations if scraped data contains them
  const handleScrapeComplete = () => {
    const sd = state.scrapedData;
    if (!sd) return;

    // Auto-populate first location from corporate data
    if (state.locations.length > 0) {
      const updatedLocations = [...state.locations];
      const first = updatedLocations[0];
      if (!first.name && sd.dealership_name) first.name = sd.dealership_name;
      if (!first.phone && sd.phone) first.phone = sd.phone;
      if (!first.email && sd.email) first.email = sd.email;
      if (!first.address && sd.address) first.address = sd.address;
      if (first.oem_brands.length === 0 && sd.oem_brands?.length) first.oem_brands = sd.oem_brands;
      // Try to extract city/state from address
      if (!first.city && sd.address) {
        const parts = sd.address.split(",").map((s: string) => s.trim());
        if (parts.length >= 2) {
          first.city = parts[parts.length - 2] || first.city;
          const stateZip = parts[parts.length - 1]?.split(" ");
          if (stateZip?.[0]?.length === 2) first.state = stateZip[0];
        }
      }

      // If scrape found multiple locations, add them
      if (sd.locations?.length > 1 && updatedLocations.length < sd.locations.length) {
        sd.locations.slice(1).forEach((loc: any, idx: number) => {
          const entry = createLocationEntry(updatedLocations.length);
          entry.name = loc.name || "";
          entry.address = loc.address || "";
          entry.phone = loc.phone || "";
          entry.email = loc.email || "";
          if (loc.brands) {
            entry.oem_brands = loc.brands.split(",").map((b: string) => b.trim()).filter(Boolean);
          }
          if (loc.city_state_zip) {
            const parts = loc.city_state_zip.split(",").map((s: string) => s.trim());
            if (parts.length >= 1) entry.city = parts[0];
            if (parts.length >= 2) {
              const stateZip = parts[1].split(" ");
              if (stateZip[0]?.length === 2) entry.state = stateZip[0];
            }
          }
          updatedLocations.push(entry);
        });
      }

      update({ locations: updatedLocations, locationCount: updatedLocations.length });
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "architecture":
        return !!state.architecture;
      case "details":
        return !!(state.displayName.trim() && state.slug.trim());
      case "bdc":
        return !!state.bdcModel;
      case "scrape":
        return true; // optional
      case "locations":
        return (
          state.locations.length > 0 &&
          state.locations.every((l) =>
            l.name.trim() &&
            l.city.trim() &&
            !!l.locationType &&
            // If a rooftop opted into its own URL, it must have a non-empty slug
            (!l.ownRooftopSite || !!l.rooftopSlug.trim()),
          )
        );
      case "review":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    // When leaving scrape step, auto-populate locations
    if (step === "scrape" && state.scrapedData) {
      handleScrapeComplete();
    }
    const nextIdx = currentIdx + 1;
    if (nextIdx < steps.length) {
      setStep(steps[nextIdx]);
    }
  };

  const goBack = () => {
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setStep("creating");
    setResult(null);

    const dealershipId = state.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "new_dealer";

    try {
      const { data, error } = await supabase.functions.invoke("onboard-tenant", {
        body: {
          dealership_id: dealershipId,
          slug: state.slug,
          display_name: state.displayName,
          custom_domain: state.customDomain || null,
          plan_tier: state.planTier,
          architecture: architectureToDbValue(state.architecture!),
          bdc_model: state.bdcModel,
          offer_logic_approver_role: state.offerLogicApproverRole || "gsm_gm",
          scraped_data: state.scrapedData || null,
          locations: state.locations.map((loc) => ({
            name: loc.name,
            city: loc.city,
            state: loc.state,
            address: loc.address,
            phone: loc.phone,
            email: loc.email,
            oem_brands: loc.oem_brands,
            location_type: loc.locationType,
            corporate_logo_url: loc.corporateLogoUrl || state.corporateLogoUrl || null,
            corporate_logo_dark_url: loc.corporateLogoDarkUrl || state.corporateLogoDarkUrl || null,
            logo_url: loc.locationLogoUrl || null,
            logo_white_url: loc.locationLogoDarkUrl || null,
            oem_logo_urls: loc.oem_logo_urls,
            // Rooftop-site options — edge function uses these to create additional tenant rows
            own_rooftop_site: loc.ownRooftopSite || false,
            rooftop_slug: loc.rooftopSlug || null,
            rooftop_custom_domain: loc.rooftopCustomDomain || null,
            rooftop_landing_template: loc.rooftopLandingTemplate || null,
          })),
          corporate_logo_url: state.corporateLogoUrl || null,
          corporate_logo_dark_url: state.corporateLogoDarkUrl || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ success: true, steps: data.steps });
      toast.success(`${state.displayName} onboarded successfully!`);
    } catch (e: any) {
      setResult({ success: false, error: e.message });
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const visibleSteps = steps.filter((s) => s !== "creating");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-card-foreground">Add New Tenant</h2>
              <p className="text-xs text-muted-foreground">
                {STEP_LABELS[step]} {step !== "creating" && `— Step ${currentIdx + 1} of ${visibleSteps.length}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={creating}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Step progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {visibleSteps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= visibleSteps.indexOf(step === "creating" ? "review" : step) ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* STEP: ARCHITECTURE */}
          {step === "architecture" && (
            <ArchitectureSelector
              selected={state.architecture}
              onSelect={(arch) => {
                handleArchSelect(arch);
                setTimeout(() => setStep("details"), 300);
              }}
            />
          )}

          {/* STEP: DETAILS */}
          {step === "details" && (
            <TenantDetailsStep state={state} onChange={update} />
          )}

          {/* STEP: BDC */}
          {step === "bdc" && (
            <BDCSelector
              selected={state.bdcModel as BDCType}
              onSelect={(bdc) => {
                update({ bdcModel: bdc });
                setTimeout(() => goNext(), 300);
              }}
            />
          )}

          {/* STEP: SCRAPE */}
          {step === "scrape" && (
            <WebsiteScrapeStep state={state} onChange={update} />
          )}

          {/* STEP: LOCATIONS */}
          {step === "locations" && (
            <LocationSetupStep state={state} onChange={update} />
          )}

          {/* STEP: REVIEW */}
          {step === "review" && (
            <ReviewLaunchStep state={state} />
          )}

          {/* STEP: CREATING */}
          {step === "creating" && (
            <div className="py-10">
              {creating && (
                <div className="text-center space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Provisioning tenant…</p>
                </div>
              )}
              {result?.success && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <PartyPopper className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">All Set!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {state.displayName} has been onboarded with {state.locations.length} location{state.locations.length !== 1 ? "s" : ""}.
                  </p>
                  {result.steps && (
                    <div className="bg-muted/30 border rounded-xl p-4 text-left max-w-sm mx-auto space-y-1">
                      {result.steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button onClick={() => { onCreated(); onClose(); }} className="gap-1.5 mt-2">
                    Done
                  </Button>
                </div>
              )}
              {result && !result.success && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-xl font-bold">Error</h3>
                  <p className="text-sm text-destructive">{result.error}</p>
                  <Button variant="outline" onClick={() => setStep("review")}>
                    Back to Review
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        {step !== "creating" && step !== "architecture" && (
          <div className="flex items-center justify-between px-6 pb-6">
            <Button variant="ghost" onClick={goBack} disabled={!canGoBack} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            <div className="flex gap-2">
              {step === "scrape" && !state.scrapedData && (
                <Button variant="outline" onClick={goNext} className="text-xs">
                  Skip — Use Defaults
                </Button>
              )}
              {step === "review" ? (
                <Button
                  onClick={handleCreate}
                  disabled={!canProceed()}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Rocket className="w-3.5 h-3.5" /> Launch Tenant
                </Button>
              ) : step === "bdc" ? (
                // BDC auto-advances on click, but show Next as fallback
                <Button onClick={goNext} disabled={!canProceed()} className="gap-1.5">
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button onClick={goNext} disabled={!canProceed()} className="gap-1.5">
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddTenantWizard;
