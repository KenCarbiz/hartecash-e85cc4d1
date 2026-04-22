import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Globe, Crown, Store, Building2, Network } from "lucide-react";
import type { ArchitectureType, WizardState } from "./types";
import { architectureToplanTier } from "./types";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter — $1,495/mo",
  standard: "Standard — $1,995/mo",
  multi_store: "Multi-Store — $3,495/mo",
  group: "Group — $5,995/mo",
  enterprise: "Enterprise — Custom Pricing",
};

const ARCH_LABELS: Record<ArchitectureType, { label: string; icon: React.ElementType }> = {
  single_store: { label: "Single Store", icon: Store },
  single_store_secondary: { label: "Single + Secondary", icon: Store },
  multi_location: { label: "Multi-Location", icon: Building2 },
  dealer_group: { label: "Dealer Group", icon: Network },
  enterprise: { label: "Enterprise", icon: Crown },
};

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
}

const TenantDetailsStep = ({ state, onChange }: Props) => {
  const arch = state.architecture!;
  const archInfo = ARCH_LABELS[arch];
  const ArchIcon = archInfo.icon;
  const needsLocationCount = ["multi_location", "dealer_group"].includes(arch);
  const isEnterprise = arch === "enterprise";

  const handleNameChange = (name: string) => {
    onChange({ displayName: name });
    const currentSlugFromPrev = state.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
    if (!state.slug || state.slug === currentSlugFromPrev) {
      onChange({
        displayName: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs font-semibold">
          <ArchIcon className="w-3.5 h-3.5" />
          {archInfo.label}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {PLAN_LABELS[state.planTier]}
        </Badge>
      </div>

      {isEnterprise ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center space-y-2">
          <Crown className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-bold text-lg">Enterprise — Custom Build</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Our team will work with you on a custom configuration. Enter the basics below and we'll handle the rest.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {/* Name + Slug */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {arch === "dealer_group" ? "Corporate / Group Name" : "Dealership Name"} *
          </Label>
          <Input
            value={state.displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={arch === "dealer_group" ? "Harte Auto Group" : "Smith Motors"}
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slug / ID *</Label>
            <Input
              value={state.slug}
              onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
              placeholder="smith_motors"
              className="mt-1.5 font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Used as dealership_id</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Domain</Label>
            <Input
              value={state.customDomain}
              onChange={(e) => onChange({ customDomain: e.target.value })}
              placeholder="sellmycar.smithmotors.com"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Location Count — only for multi */}
        {needsLocationCount && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              How many locations?
            </Label>
            <Input
              type="number"
              min={2}
              max={50}
              value={state.locationCount}
              onChange={(e) => onChange({ locationCount: Math.max(2, Number(e.target.value)) })}
              className="mt-1.5 max-w-32"
            />
          </div>
        )}

        {/* Offer Logic Approver */}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Who approves Offer Logic changes?
          </Label>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            When a manager builds or modifies offer logic, this role must approve before it goes live.
          </p>
          <Select
            value={state.offerLogicApproverRole || "gsm_gm"}
            onValueChange={(v) => onChange({ offerLogicApproverRole: v })}
          >
            <SelectTrigger className="mt-1 max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gsm_gm">GSM / General Manager</SelectItem>
              <SelectItem value="admin">Dealership Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* DNS info */}
        {state.customDomain && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-semibold">DNS Setup Required</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>A Record <code className="bg-muted px-1 rounded">@</code> → <code className="bg-muted px-1 rounded">185.158.133.1</code></li>
                  <li>A Record <code className="bg-muted px-1 rounded">www</code> → <code className="bg-muted px-1 rounded">185.158.133.1</code></li>
                  <li>TXT Record <code className="bg-muted px-1 rounded">_lovable</code> → verification value</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantDetailsStep;
