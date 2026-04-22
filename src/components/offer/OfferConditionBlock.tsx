import React from "react";
import { CheckCircle, AlertTriangle, Search, Info, Car, Gauge, Palette, Wrench, Key, Wind, Cigarette, CircleDot, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { InlineEdit } from "@/components/offer/InlineEdit";

/* ─── Edit option lists ─── */
const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "rough", label: "Rough" },
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const ACCIDENT_OPTIONS = [
  { value: "0", label: "None" },
  { value: "1", label: "1 Accident" },
  { value: "2", label: "2 Accidents" },
  { value: "3+", label: "3+ Accidents" },
];

const WINDSHIELD_OPTIONS = [
  { value: "none", label: "None" },
  { value: "chipped", label: "Chipped" },
  { value: "cracked", label: "Cracked" },
  { value: "chipped_and_cracked", label: "Chipped & Cracked" },
];

const KEY_OPTIONS = [
  { value: "2+", label: "2+ Keys" },
  { value: "1", label: "1 Key" },
  { value: "0", label: "No Keys" },
];

const TIRE_OPTIONS = [
  { value: "None", label: "None" },
  { value: "1", label: "1 Tire" },
  { value: "2", label: "2 Tires" },
  { value: "3", label: "3 Tires" },
  { value: "4", label: "4 Tires" },
];

const EXTERIOR_DAMAGE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "dents", label: "Dents" },
  { value: "scratches", label: "Scratches" },
  { value: "rust", label: "Rust" },
  { value: "paint_damage", label: "Paint Damage" },
  { value: "body_panel", label: "Body Panel" },
];

const INTERIOR_DAMAGE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "stains", label: "Stains" },
  { value: "tears", label: "Tears" },
  { value: "burns", label: "Burns" },
  { value: "odor", label: "Odor" },
];

const MECHANICAL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "transmission", label: "Transmission" },
  { value: "brakes", label: "Brakes" },
  { value: "suspension", label: "Suspension" },
  { value: "exhaust", label: "Exhaust" },
];

const ENGINE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "check_engine", label: "Check Engine Light" },
  { value: "oil_leak", label: "Oil Leak" },
  { value: "overheating", label: "Overheating" },
  { value: "noise", label: "Unusual Noise" },
];

const TECH_OPTIONS = [
  { value: "none", label: "None" },
  { value: "radio", label: "Radio/Speakers" },
  { value: "ac", label: "A/C or Heat" },
  { value: "navigation", label: "Navigation" },
  { value: "cameras", label: "Cameras" },
];

export interface ConditionItem {
  label: string;
  status: "good" | "warn";
  icon: React.ReactNode;
  field?: string;
  editType?: "select" | "multi-select";
  editOptions?: { value: string; label: string }[];
  editValue?: string;
  multiEditValue?: string[];
}

export interface ConditionData {
  accidents: string | null;
  drivable: string | null;
  exterior_damage: string[] | null;
  interior_damage: string[] | null;
  mechanical_issues: string[] | null;
  engine_issues: string[] | null;
  tech_issues: string[] | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  windshield_damage: string | null;
  modifications: string | null;
  bb_class_name?: string | null;
  bb_drivetrain?: string | null;
  bb_transmission?: string | null;
  bb_engine?: string | null;
}

export function buildConditionItems(condition: ConditionData | null): ConditionItem[] {
  const items: ConditionItem[] = [];
  if (!condition) return items;

  // BB-Verified specs
  if (condition.bb_class_name) {
    items.push({ label: `Vehicle Class: ${condition.bb_class_name}`, status: "good", icon: <Car className="w-3.5 h-3.5" /> });
  }
  if (condition.bb_drivetrain) {
    items.push({ label: `Drivetrain: ${condition.bb_drivetrain}`, status: "good", icon: <Settings2 className="w-3.5 h-3.5" /> });
  }
  if (condition.bb_transmission) {
    items.push({ label: `Transmission: ${condition.bb_transmission}`, status: "good", icon: <Settings2 className="w-3.5 h-3.5" /> });
  }
  if (condition.bb_engine) {
    items.push({ label: `Engine: ${condition.bb_engine}`, status: "good", icon: <Gauge className="w-3.5 h-3.5" /> });
  }

  // Accidents
  const accidentsVal = (condition.accidents || "").toLowerCase();
  const noAccidents = !condition.accidents || accidentsVal.includes("no") || accidentsVal === "none" || accidentsVal === "0";
  const accidentDisplay = noAccidents ? "None" : accidentsVal === "1" ? "1" : accidentsVal === "2" ? "2" : accidentsVal === "3+" ? "3+" : condition.accidents;
  items.push({
    label: `Accidents: ${accidentDisplay}`,
    status: noAccidents ? "good" : "warn",
    icon: <Car className="w-3.5 h-3.5" />,
    field: "accidents",
    editType: "select",
    editOptions: ACCIDENT_OPTIONS,
    editValue: condition.accidents || "0",
  });

  // Exterior damage
  const extItems = condition.exterior_damage?.filter(v => v !== "none") || [];
  items.push({
    label: extItems.length === 0 ? "Exterior Damage: None" : `Exterior Damage: ${extItems.length} issue${extItems.length > 1 ? "s" : ""}`,
    status: extItems.length === 0 ? "good" : "warn",
    icon: <Palette className="w-3.5 h-3.5" />,
    field: "exterior_damage",
    editType: "multi-select",
    editOptions: EXTERIOR_DAMAGE_OPTIONS,
    multiEditValue: condition.exterior_damage || [],
  });

  // Interior damage
  const intItems = condition.interior_damage?.filter(v => v !== "none") || [];
  items.push({
    label: intItems.length === 0 ? "Interior Damage: None" : `Interior Damage: ${intItems.length} issue${intItems.length > 1 ? "s" : ""}`,
    status: intItems.length === 0 ? "good" : "warn",
    icon: <CircleDot className="w-3.5 h-3.5" />,
    field: "interior_damage",
    editType: "multi-select",
    editOptions: INTERIOR_DAMAGE_OPTIONS,
    multiEditValue: condition.interior_damage || [],
  });

  // Mechanical issues
  const mechItems = condition.mechanical_issues?.filter(v => v !== "none") || [];
  items.push({
    label: mechItems.length === 0 ? "Mechanical Issues: None" : `Mechanical Issues: ${mechItems.length} issue${mechItems.length > 1 ? "s" : ""}`,
    status: mechItems.length === 0 ? "good" : "warn",
    icon: <Wrench className="w-3.5 h-3.5" />,
    field: "mechanical_issues",
    editType: "multi-select",
    editOptions: MECHANICAL_OPTIONS,
    multiEditValue: condition.mechanical_issues || [],
  });

  // Engine issues
  const engItems = condition.engine_issues?.filter(v => v !== "none") || [];
  items.push({
    label: engItems.length === 0 ? "Engine Issues: None" : `Engine Issues: ${engItems.length} issue${engItems.length > 1 ? "s" : ""}`,
    status: engItems.length === 0 ? "good" : "warn",
    icon: <Settings2 className="w-3.5 h-3.5" />,
    field: "engine_issues",
    editType: "multi-select",
    editOptions: ENGINE_OPTIONS,
    multiEditValue: condition.engine_issues || [],
  });

  // Tech issues
  const techItems = condition.tech_issues?.filter(v => v !== "none") || [];
  items.push({
    label: techItems.length === 0 ? "Technology Issues: None" : `Technology Issues: ${techItems.length} issue${techItems.length > 1 ? "s" : ""}`,
    status: techItems.length === 0 ? "good" : "warn",
    icon: <Search className="w-3.5 h-3.5" />,
    field: "tech_issues",
    editType: "multi-select",
    editOptions: TECH_OPTIONS,
    multiEditValue: condition.tech_issues || [],
  });

  // Windshield
  const windshieldVal = (condition.windshield_damage || "").toLowerCase().trim();
  const hasCrack = windshieldVal.includes("crack") || windshieldVal.includes("major");
  const hasChip = windshieldVal.includes("chip") || windshieldVal.includes("pitting") || windshieldVal.includes("minor");
  const noWindshield = !windshieldVal || windshieldVal === "none" || windshieldVal === "no" || windshieldVal.includes("no damage") || windshieldVal.includes("no windshield") || (!hasCrack && !hasChip);
  const windshieldLabel = noWindshield ? "None" : (hasCrack && hasChip) ? "Chipped & Cracked" : hasCrack ? "Cracked" : hasChip ? "Chipped" : "None";
  if (condition.windshield_damage !== undefined) {
    items.push({
      label: `Windshield Issue: ${windshieldLabel}`,
      status: noWindshield ? "good" : "warn",
      icon: <Wind className="w-3.5 h-3.5" />,
      field: "windshield_damage",
      editType: "select",
      editOptions: WINDSHIELD_OPTIONS,
      editValue: condition.windshield_damage || "none",
    });
  }

  // Smoked in
  const smokedVal = (condition.smoked_in || "").toLowerCase();
  const notSmokedIn = !condition.smoked_in || smokedVal === "no" || smokedVal === "not smoked in";
  if (condition.smoked_in !== undefined) {
    items.push({
      label: notSmokedIn ? "Smoked In: No" : "Smoked In: Yes",
      status: notSmokedIn ? "good" : "warn",
      icon: <Cigarette className="w-3.5 h-3.5" />,
      field: "smoked_in",
      editType: "select",
      editOptions: YES_NO,
      editValue: condition.smoked_in || "no",
    });
  }

  // Drivable
  if (condition.drivable !== undefined) {
    const drivableVal = (condition.drivable || "").toLowerCase();
    const isDrivable = !condition.drivable || drivableVal === "yes" || drivableVal === "drivable";
    items.push({
      label: isDrivable ? "Drivable: Yes" : "Drivable: No",
      status: isDrivable ? "good" : "warn",
      icon: <Car className="w-3.5 h-3.5" />,
      field: "drivable",
      editType: "select",
      editOptions: YES_NO,
      editValue: condition.drivable || "yes",
    });
  }

  // Tires
  if (condition.tires_replaced !== undefined) {
    const tiresVal = (condition.tires_replaced || "").toLowerCase();
    const tiresCount = parseInt(tiresVal) || 0;
    items.push({
      label: tiresCount > 0 ? `Tires Replaced: ${condition.tires_replaced}` : "Tires Replaced: None",
      status: tiresCount > 0 ? "good" : "warn",
      icon: <CircleDot className="w-3.5 h-3.5" />,
      field: "tires_replaced",
      editType: "select",
      editOptions: TIRE_OPTIONS,
      editValue: condition.tires_replaced || "None",
    });
  }

  // Keys
  if (condition.num_keys) {
    const oneKeyOrNone = condition.num_keys === "1" || condition.num_keys === "0";
    items.push({
      label: `Keys: ${condition.num_keys} key${condition.num_keys === "1" ? "" : "s"} available`,
      status: oneKeyOrNone ? "warn" : "good",
      icon: <Key className="w-3.5 h-3.5" />,
      field: "num_keys",
      editType: "select",
      editOptions: KEY_OPTIONS,
      editValue: condition.num_keys,
    });
  }

  // Modifications
  const noMods = !condition.modifications || condition.modifications.toLowerCase() === "none" || condition.modifications.toLowerCase() === "no";
  if (condition.modifications !== undefined) {
    items.push({
      label: noMods ? "Modifications: None" : `Modifications: ${condition.modifications}`,
      status: noMods ? "good" : "warn",
      icon: <Settings2 className="w-3.5 h-3.5" />,
    });
  }

  return items;
}

interface OfferConditionBlockProps {
  conditionItems: ConditionItem[];
  vehicleStr: string;
  canEdit: boolean;
  saving: boolean;
  onFieldUpdate: (field: string, value: string | string[]) => void;
}

const OfferConditionBlock = ({ conditionItems, vehicleStr, canEdit, saving, onFieldUpdate }: OfferConditionBlockProps) => {
  const goodCount = conditionItems.filter(c => c.status === "good").length;
  const totalCount = conditionItems.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header with score bar */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-card-foreground">What's Behind Your Offer</h3>
          </div>
          <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
            {goodCount}/{totalCount} clear
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We evaluated your {vehicleStr || "vehicle"} using market data, service records, and the condition details you provided.
          {canEdit && <span className="text-primary font-medium"> Click any item to correct it — your offer updates instantly.</span>}
        </p>
      </div>

      {/* Condition items grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {conditionItems.map((item, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                item.status === "good"
                  ? "bg-success/5 border border-success/15"
                  : "bg-amber-500/5 border border-amber-500/15"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  item.status === "good" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600"
                }`}>
                  {item.status === "good" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const categoryLabel = item.label.includes(":") ? item.label.split(":")[0] + ":" : "";
                    const answerPart = item.label.includes(":") ? item.label.split(":").slice(1).join(":").trim() : item.label;
                    
                    if (canEdit && item.field && item.editType === "select") {
                      return (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className={`shrink-0 ${item.status === "good" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                            {item.icon}
                          </span>
                          <span className="font-medium text-card-foreground whitespace-nowrap">{categoryLabel}</span>
                          <InlineEdit
                            value={answerPart}
                            onSave={(val) => onFieldUpdate(item.field!, val)}
                            type="select"
                            options={item.editOptions!}
                            label={item.field}
                            className="text-sm"
                          />
                        </div>
                      );
                    }
                    if (canEdit && item.field && item.editType === "multi-select") {
                      return (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className={`shrink-0 ${item.status === "good" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                            {item.icon}
                          </span>
                          <span className="font-medium text-card-foreground whitespace-nowrap">{categoryLabel}</span>
                          <InlineEdit
                            value=""
                            onSave={() => {}}
                            type="multi-select"
                            options={item.editOptions!}
                            multiValue={item.multiEditValue}
                            onMultiSave={(vals) => onFieldUpdate(item.field!, vals)}
                            label={item.field}
                            className="text-sm"
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={`shrink-0 ${item.status === "good" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                          {item.icon}
                        </span>
                        <span className="text-sm">
                          <span className="font-medium text-card-foreground">{categoryLabel}</span>{" "}
                          <span className="text-muted-foreground">{answerPart}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {saving && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Updating your offer…
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>Your offer is based on these factors combined with real-time market analytics. Final price confirmed at in-person inspection.</p>
        </div>
      </div>
    </motion.div>
  );
};

export default OfferConditionBlock;
