import { Car, Gauge, Palette, Settings2, CheckCircle, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { InlineEdit } from "@/components/offer/InlineEdit";

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "rough", label: "Rough" },
];

interface PortalVehicleSummaryProps {
  vehicleStr: string;
  vin: string | null;
  mileage: string | null;
  exteriorColor: string | null;
  overallCondition: string | null;
  drivetrain: string | null;
  canEdit: boolean;
  onFieldUpdate?: (field: string, value: string) => void;
}

const PortalVehicleSummary = ({
  vehicleStr,
  vin,
  mileage,
  exteriorColor,
  overallCondition,
  drivetrain,
  canEdit,
  onFieldUpdate,
}: PortalVehicleSummaryProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-card-foreground">Vehicle Summary</h3>
          </div>
          {canEdit && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Click to edit
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        {vehicleStr && (
          <p className="text-lg font-bold text-card-foreground mb-3">{vehicleStr}</p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {vin && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">VIN</span>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">VIN</p>
                <p className="text-sm font-medium font-mono">{vin.toUpperCase()}</p>
              </div>
            </div>
          )}
          {(mileage || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mileage</p>
                {canEdit && onFieldUpdate ? (
                  <InlineEdit
                    value={mileage ? Number(mileage).toLocaleString() : "—"}
                    onSave={(val) => onFieldUpdate("mileage", val.replace(/[^0-9]/g, ""))}
                    label="mileage"
                    className="text-sm font-medium"
                  />
                ) : (
                  <p className="text-sm font-medium">{mileage ? `${Number(mileage).toLocaleString()} mi` : "—"}</p>
                )}
              </div>
            </div>
          )}
          {(exteriorColor || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</p>
                {canEdit && onFieldUpdate ? (
                  <InlineEdit
                    value={exteriorColor || "—"}
                    onSave={(val) => onFieldUpdate("exterior_color", val)}
                    label="color"
                    className="text-sm font-medium"
                  />
                ) : (
                  <p className="text-sm font-medium">{exteriorColor || "—"}</p>
                )}
              </div>
            </div>
          )}
          {drivetrain && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Powertrain</p>
                <p className="text-sm font-medium capitalize">{drivetrain}</p>
              </div>
            </div>
          )}
          {(overallCondition || canEdit) && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Condition</p>
                {canEdit && onFieldUpdate ? (
                  <InlineEdit
                    value={overallCondition || "good"}
                    onSave={(val) => onFieldUpdate("overall_condition", val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    label="condition"
                    className="text-sm font-medium capitalize"
                  />
                ) : (
                  <p className="text-sm font-medium capitalize">{overallCondition || "—"}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PortalVehicleSummary;
