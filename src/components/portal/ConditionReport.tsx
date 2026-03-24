import { CheckCircle, AlertTriangle, Search, Car, Palette, CircleDot, Wrench, Settings2, Key, Wind, Cigarette, Info } from "lucide-react";
import { motion } from "framer-motion";

interface ConditionData {
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
}

interface ConditionReportProps {
  condition: ConditionData | null;
  vehicleStr: string;
}

interface ConditionItem {
  label: string;
  status: "good" | "warn";
  icon: React.ReactNode;
}

const ConditionReport = ({ condition, vehicleStr }: ConditionReportProps) => {
  if (!condition) return null;

  const items: ConditionItem[] = [];

  // Accidents
  const accVal = (condition.accidents || "").toLowerCase();
  const noAcc = !condition.accidents || accVal.includes("no") || accVal === "none" || accVal === "0";
  items.push({ label: noAcc ? "Accidents: None" : `Accidents: ${condition.accidents}`, status: noAcc ? "good" : "warn", icon: <Car className="w-3.5 h-3.5" /> });

  // Exterior damage
  const ext = condition.exterior_damage?.filter(v => v !== "none") || [];
  items.push({ label: ext.length === 0 ? "Exterior Damage: None" : `Exterior Damage: ${ext.length} issue${ext.length > 1 ? "s" : ""}`, status: ext.length === 0 ? "good" : "warn", icon: <Palette className="w-3.5 h-3.5" /> });

  // Interior damage
  const int = condition.interior_damage?.filter(v => v !== "none") || [];
  items.push({ label: int.length === 0 ? "Interior Damage: None" : `Interior Damage: ${int.length} issue${int.length > 1 ? "s" : ""}`, status: int.length === 0 ? "good" : "warn", icon: <CircleDot className="w-3.5 h-3.5" /> });

  // Mechanical
  const mech = condition.mechanical_issues?.filter(v => v !== "none") || [];
  items.push({ label: mech.length === 0 ? "Mechanical Issues: None" : `Mechanical Issues: ${mech.length} issue${mech.length > 1 ? "s" : ""}`, status: mech.length === 0 ? "good" : "warn", icon: <Wrench className="w-3.5 h-3.5" /> });

  // Engine
  const eng = condition.engine_issues?.filter(v => v !== "none") || [];
  items.push({ label: eng.length === 0 ? "Engine Issues: None" : `Engine Issues: ${eng.length} issue${eng.length > 1 ? "s" : ""}`, status: eng.length === 0 ? "good" : "warn", icon: <Settings2 className="w-3.5 h-3.5" /> });

  // Tech
  const tech = condition.tech_issues?.filter(v => v !== "none") || [];
  items.push({ label: tech.length === 0 ? "Technology Issues: None" : `Technology Issues: ${tech.length} issue${tech.length > 1 ? "s" : ""}`, status: tech.length === 0 ? "good" : "warn", icon: <Search className="w-3.5 h-3.5" /> });

  // Windshield
  if (condition.windshield_damage !== undefined && condition.windshield_damage !== null) {
    const wVal = condition.windshield_damage.toLowerCase();
    const noW = wVal.includes("none") || wVal === "no" || wVal.includes("no windshield");
    items.push({ label: noW ? "Windshield: No damage" : `Windshield: ${condition.windshield_damage}`, status: noW ? "good" : "warn", icon: <Wind className="w-3.5 h-3.5" /> });
  }

  // Smoked in
  if (condition.smoked_in !== undefined && condition.smoked_in !== null) {
    const sVal = condition.smoked_in.toLowerCase();
    const notSmoked = sVal === "no" || sVal === "not smoked in";
    items.push({ label: notSmoked ? "Smoked In: No" : "Smoked In: Yes", status: notSmoked ? "good" : "warn", icon: <Cigarette className="w-3.5 h-3.5" /> });
  }

  // Drivable
  if (condition.drivable !== undefined && condition.drivable !== null) {
    const dVal = condition.drivable.toLowerCase();
    const isDrivable = dVal === "yes" || dVal === "drivable";
    items.push({ label: isDrivable ? "Drivable: Yes" : "Drivable: No", status: isDrivable ? "good" : "warn", icon: <Car className="w-3.5 h-3.5" /> });
  }

  // Tires
  if (condition.tires_replaced !== undefined && condition.tires_replaced !== null) {
    const tCount = parseInt(condition.tires_replaced) || 0;
    items.push({ label: tCount > 0 ? `Tires Replaced: ${condition.tires_replaced}` : "Tires Replaced: None", status: tCount > 0 ? "good" : "warn", icon: <CircleDot className="w-3.5 h-3.5" /> });
  }

  // Keys
  if (condition.num_keys) {
    const oneOrNone = condition.num_keys === "1" || condition.num_keys === "0";
    items.push({ label: `Keys: ${condition.num_keys} key${condition.num_keys === "1" ? "" : "s"}`, status: oneOrNone ? "warn" : "good", icon: <Key className="w-3.5 h-3.5" /> });
  }

  // Modifications
  if (condition.modifications !== undefined && condition.modifications !== null) {
    const noMods = condition.modifications.toLowerCase() === "none" || condition.modifications.toLowerCase() === "no";
    items.push({ label: noMods ? "Modifications: None" : `Modifications: ${condition.modifications}`, status: noMods ? "good" : "warn", icon: <Settings2 className="w-3.5 h-3.5" /> });
  }

  if (items.length === 0) return null;

  const goodCount = items.filter(c => c.status === "good").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-card-foreground">What's Behind Your Offer</h3>
          </div>
          <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
            {goodCount}/{items.length} clear
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We evaluated your {vehicleStr || "vehicle"} using market data, service records, and the condition details you provided.
        </p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item, i) => {
            const categoryLabel = item.label.includes(":") ? item.label.split(":")[0] + ":" : "";
            const answerPart = item.label.includes(":") ? item.label.split(":").slice(1).join(":").trim() : item.label;

            return (
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
                  <div className="flex items-center gap-1.5">
                    <span className={`shrink-0 ${item.status === "good" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                      {item.icon}
                    </span>
                    <span className="text-sm">
                      <span className="font-medium text-card-foreground">{categoryLabel}</span>{" "}
                      <span className="text-muted-foreground">{answerPart}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <p>Your offer is based on these factors combined with real-time market analytics. Final price confirmed at in-person inspection.</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ConditionReport;
