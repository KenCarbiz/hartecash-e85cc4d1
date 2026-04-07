import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin } from "lucide-react";
import type { WizardState } from "./types";

const PLAN_LABELS: Record<string, string> = {
  standard: "Standard — $1,995/mo",
  multi_store: "Multi-Store — $3,495/mo",
  group: "Group — $5,995/mo",
  enterprise: "Enterprise — Custom",
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

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold">Review & Launch</h3>

      <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-1">
        <Field label="Dealership ID" value={dealershipId} />
        <Field label="Display Name" value={state.displayName} />
        {state.customDomain && <Field label="Custom Domain" value={state.customDomain} />}
        <Field label="Plan" value={PLAN_LABELS[state.planTier] || state.planTier} />
        <Field label="Architecture" value={state.architecture?.replace(/_/g, " ") || ""} />
        <Field label="BDC Model" value={state.bdcModel.replace(/_/g, " ")} />
        <Field label="Offer Logic Approver" value={state.offerLogicApproverRole === "admin" ? "Dealership Admin" : "GSM / General Manager"} />
        <Field label="Data Source" value={state.scrapedData ? `AI-scraped from ${state.websiteUrl}` : "Defaults only"} />
      </div>

      {/* Locations summary */}
      {state.locations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Locations ({state.locations.length})</h4>
          <div className="space-y-1.5">
            {state.locations.map((loc, i) => (
              <div key={loc.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2 border border-border">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-medium flex-1">{loc.name || `Location ${i + 1}`}</span>
                {loc.oem_brands.length > 0 && (
                  <span className="text-muted-foreground truncate max-w-[40%]">
                    {loc.oem_brands.join(", ")}
                  </span>
                )}
                {loc.scrapedData && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
              </div>
            ))}
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
