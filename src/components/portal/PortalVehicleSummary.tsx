import { Car, Gauge, Palette, Settings2, CheckCircle, Pencil, Disc3 } from "lucide-react";
import { motion } from "framer-motion";
import { InlineEdit } from "@/components/offer/InlineEdit";

interface BrakeFindings {
  lf: number | null;
  rf: number | null;
  lr: number | null;
  rr: number | null;
}

interface PortalVehicleSummaryProps {
  vehicleStr: string;
  vin: string | null;
  mileage: string | null;
  exteriorColor: string | null;
  overallCondition: string | null;
  drivetrain: string | null;
  canEdit: boolean;
  brakeDepths?: BrakeFindings | null;
  onFieldUpdate?: (field: string, value: string) => void;
}

const getBrakeLabel = (depth: number) => {
  if (depth <= 3) return { label: "Replace", cls: "text-destructive" };
  if (depth <= 5) return { label: "Fair", cls: "text-amber-600" };
  return { label: "Good", cls: "text-green-600" };
};

const PortalVehicleSummary = ({
  vehicleStr,
  vin,
  mileage,
  exteriorColor,
  overallCondition,
  drivetrain,
  canEdit,
  brakeDepths,
  onFieldUpdate,
}: PortalVehicleSummaryProps) => {
  const hasBrakes = brakeDepths && (brakeDepths.lf != null || brakeDepths.rf != null || brakeDepths.lr != null || brakeDepths.rr != null);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {vin && (
            <div className="flex items-center gap-2.5 sm:col-span-2">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">VIN</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">VIN</p>
                <p className="text-sm font-medium font-mono truncate">{vin.toUpperCase()}</p>
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
          {exteriorColor && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Color</p>
                <p className="text-sm font-medium">{exteriorColor}</p>
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
          {overallCondition && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Condition</p>
                <p className="text-sm font-medium capitalize">{overallCondition}</p>
              </div>
            </div>
          )}
        </div>

        {/* Brake Pad Findings */}
        {hasBrakes && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Disc3 className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-card-foreground">Brake Pad Inspection</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["Left Front", brakeDepths!.lf],
                ["Right Front", brakeDepths!.rf],
                ["Left Rear", brakeDepths!.lr],
                ["Right Rear", brakeDepths!.rr],
              ] as [string, number | null][]).map(([label, depth]) => {
                if (depth == null) return null;
                const status = getBrakeLabel(depth);
                return (
                  <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className={`text-sm font-bold ${status.cls}`}>
                      {depth}/32" · {status.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PortalVehicleSummary;
