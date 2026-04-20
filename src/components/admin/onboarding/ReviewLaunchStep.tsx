import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin, Store, Phone, Building2, Bot, Shield, Globe } from "lucide-react";
import type { WizardState } from "./types";

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard — $1,995/mo",
  multi_store: "Multi-Store — $3,495/mo",
  group: "Group — $5,995/mo",
  enterprise: "Enterprise — Custom",
};

const ARCH_LABELS: Record<string, string> = {
  single_store: "Single Store",
  single_store_secondary: "Single Store + Secondary",
  multi_location: "Multi-Location",
  dealer_group: "Dealer Group",
  enterprise: "Enterprise",
};

const BDC_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  no_bdc: { label: "No BDC", icon: Store },
  single_bdc: { label: "Single BDC", icon: Phone },
  multi_bdc: { label: "Multi-Location BDC", icon: Building2 },
  ai_bdc: { label: "AI BDC", icon: Bot },
};

interface Props {
  state: WizardState;
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground max-w-[55%] text-right truncate">{value}</span>
    </div>
  );
}

const ReviewLaunchStep = ({ state }: Props) => {
  const dealershipId = state.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "new_dealer";
  const bdcInfo = BDC_LABELS[state.bdcModel] || BDC_LABELS.no_bdc;
  const BDCIcon = bdcInfo.icon;

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold">Review & Launch</h3>

      {/* Tenant details */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-1">
        <Field label="Dealership ID" value={dealershipId} />
        <Field label="Display Name" value={state.displayName} />
        {state.customDomain && <Field label="Custom Domain" value={state.customDomain} />}
        <Field label="Plan" value={PLAN_LABELS[state.planTier] || state.planTier} />
        <Field label="Architecture" value={ARCH_LABELS[state.architecture || ""] || (state.architecture?.replace(/_/g, " ") || "")} />
        <Field label="Data Source" value={state.scrapedData ? `AI-scraped from ${state.websiteUrl}` : "Defaults only"} />
      </div>

      {/* BDC + Approver cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lead Handling</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BDCIcon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-card-foreground">{bdcInfo.label}</span>
          </div>
        </div>
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Offer Logic Approver</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-card-foreground">
              {state.offerLogicApproverRole === "admin" ? "Dealership Admin" : "GSM / GM"}
            </span>
          </div>
        </div>
      </div>

      {/* Locations summary */}
      {state.locations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Locations ({state.locations.length})</h4>
          <div className="space-y-1.5">
            {state.locations.map((loc, i) => (
              <div key={loc.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{loc.name || `Location ${i + 1}`}</span>
                  {loc.city && <span className="text-muted-foreground ml-1.5">— {loc.city}, {loc.state}</span>}
                </div>
                {loc.oem_brands.length > 0 && (
                  <span className="text-muted-foreground truncate max-w-[30%] hidden sm:inline">
                    {loc.oem_brands.join(", ")}
                  </span>
                )}
                {loc.scrapedData && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rooftop websites — additional tenant rows that will be created */}
      {state.locations.some((l) => l.ownRooftopSite) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-primary" />
            Rooftop Websites ({state.locations.filter((l) => l.ownRooftopSite).length})
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Each gets its own URL but shares this group's admin, leads, and staff.
          </p>
          <div className="space-y-1.5">
            {state.locations
              .filter((l) => l.ownRooftopSite)
              .map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg px-3 py-2 border border-primary/20"
                >
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{loc.name}</div>
                    <div className="text-muted-foreground font-mono text-[10px] truncate">
                      {loc.rooftopSlug}.autocurb.io
                      {loc.rooftopCustomDomain && <span> · {loc.rooftopCustomDomain}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {loc.rooftopLandingTemplate || "group default"}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Corporate logos preview */}
      {(state.corporateLogoUrl || state.corporateLogoDarkUrl) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Corporate Logos</h4>
          <div className="flex gap-4">
            {state.corporateLogoUrl && (
              <div className="border rounded-lg p-2 bg-background">
                <img src={state.corporateLogoUrl} alt="Light logo" className="h-8 object-contain" />
              </div>
            )}
            {state.corporateLogoDarkUrl && (
              <div className="border rounded-lg p-2 bg-foreground/90">
                <img src={state.corporateLogoDarkUrl} alt="Dark logo" className="h-8 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">The following will be created:</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "tenant", "dealer_account", "site_config", "form_config", "offer_settings",
            "notification_settings", "inspection_config", "photo_config", "locations",
            "notification_templates",
          ].map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewLaunchStep;
