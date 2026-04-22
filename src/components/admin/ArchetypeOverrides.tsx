import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Truck } from "lucide-react";
import type { VehicleArchetype } from "@/lib/vehicleArchetypes";
import { ARCHETYPE_SHAPES } from "@/lib/vehicleArchetypes";

export interface ArchetypeDeductionOverrides {
  [archetype: string]: {
    tires_not_replaced?: number;
    exterior_damage_per_item?: number;
    smoked_in?: number;
  };
}

interface Props {
  value: ArchetypeDeductionOverrides | null;
  onChange: (v: ArchetypeDeductionOverrides) => void;
  defaultAmounts: {
    tires_not_replaced: number;
    exterior_damage_per_item: number;
    smoked_in: number;
  };
}

const OVERRIDE_FIELDS = [
  { key: "tires_not_replaced", label: "Tires Not Replaced", hint: "Trucks/SUVs have larger, more expensive tires" },
  { key: "exterior_damage_per_item", label: "Exterior Damage / Item", hint: "Luxury vehicles cost more per panel to repair" },
  { key: "smoked_in", label: "Smoked In", hint: "Luxury segment has higher detailing costs" },
] as const;

const ARCHETYPES: VehicleArchetype[] = ["sedan", "compact_suv", "midsize_suv", "large_suv", "truck", "van"];

export default function ArchetypeOverrides({ value, onChange, defaultAmounts }: Props) {
  const overrides = value || {};

  const updateField = (archetype: string, field: string, val: number | undefined) => {
    const current = { ...(overrides[archetype] || {}) };
    if (val == null || val === 0) {
      delete (current as any)[field];
    } else {
      (current as any)[field] = val;
    }
    const newOverrides = { ...overrides };
    if (Object.keys(current).length === 0) {
      delete newOverrides[archetype];
    } else {
      newOverrides[archetype] = current;
    }
    onChange(newOverrides);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Override deduction amounts by vehicle type. Leave blank to use the default amount.
        Trucks need higher tire deducts, luxury vehicles need higher body repair deducts.
      </p>
      {ARCHETYPES.map(arch => {
        const shape = ARCHETYPE_SHAPES[arch];
        const archOverride = overrides[arch] || {};
        const hasOverrides = Object.keys(archOverride).length > 0;

        return (
          <Collapsible key={arch}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-card-foreground">{shape.label}</span>
                  {hasOverrides && (
                    <Badge variant="secondary" className="text-[8px]">
                      {Object.keys(archOverride).length} override{Object.keys(archOverride).length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-3 gap-3 px-3 py-2">
                {OVERRIDE_FIELDS.map(field => {
                  const currentVal = (archOverride as any)[field.key];
                  const defaultVal = (defaultAmounts as any)[field.key] || 0;

                  return (
                    <div key={field.key}>
                      <Label className="text-[10px] font-semibold text-muted-foreground">{field.label}</Label>
                      <p className="text-[8px] text-muted-foreground mb-1">{field.hint}</p>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
                        <Input
                          type="number" min={0} step={50}
                          value={currentVal ?? ""}
                          onChange={e => updateField(arch, field.key, e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={`Default: $${defaultVal}`}
                          className="pl-5 h-7 text-[11px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
