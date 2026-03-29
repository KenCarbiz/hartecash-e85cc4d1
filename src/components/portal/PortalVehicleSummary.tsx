import { Car, Gauge, Palette, Settings2, CheckCircle, Pencil, Disc3, Shield } from "lucide-react";
import { formatGrade } from "@/lib/formatGrade";
import { motion } from "framer-motion";
import { InlineEdit } from "@/components/offer/InlineEdit";

interface DepthFindings {
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
  inspectorGrade?: string | null;
  brakeDepths?: DepthFindings | null;
  tireDepths?: DepthFindings | null;
  onFieldUpdate?: (field: string, value: string) => void;
}

const getStatusLabel = (depth: number, type: "brake" | "tire") => {
  if (depth <= 3) return { label: "Replace", cls: "text-destructive" };
  if (depth <= 5) return { label: "Fair", cls: "text-amber-600" };
  return { label: "Good", cls: "text-green-600" };
};

const DepthGrid = ({ depths, type, title }: { depths: DepthFindings; type: "brake" | "tire"; title: string }) => {
  const hasData = depths.lf != null || depths.rf != null || depths.lr != null || depths.rr != null;
  if (!hasData) return null;

  const unit = type === "brake" ? '"' : '/32"';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {type === "brake" ? (
          <Disc3 className="w-4 h-4 text-primary" />
        ) : (
          <Gauge className="w-4 h-4 text-primary" />
        )}
        <p className="text-xs font-semibold text-card-foreground">{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["Left Front", depths.lf],
          ["Right Front", depths.rf],
          ["Left Rear", depths.lr],
          ["Right Rear", depths.rr],
        ] as [string, number | null][]).map(([label, depth]) => {
          if (depth == null) return null;
          const status = getStatusLabel(depth, type);
          return (
            <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={`text-sm font-bold ${status.cls}`}>
                {depth}/32{unit === '"' ? '"' : ''} · {status.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PortalVehicleSummary = ({
  vehicleStr,
  vin,
  mileage,
  exteriorColor,
  overallCondition,
  drivetrain,
  canEdit,
  inspectorGrade,
  brakeDepths,
  tireDepths,
  onFieldUpdate,
}: PortalVehicleSummaryProps) => {
  const hasBrakes = brakeDepths && (brakeDepths.lf != null || brakeDepths.rf != null || brakeDepths.lr != null || brakeDepths.rr != null);
  const hasTires = tireDepths && (tireDepths.lf != null || tireDepths.rf != null || tireDepths.lr != null || tireDepths.rr != null);

  const displayGrade = inspectorGrade || overallCondition;
  const isInspectorVerified = !!inspectorGrade;

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
          {displayGrade && (
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isInspectorVerified ? "bg-primary/10" : "bg-muted"
              }`}>
                {isInspectorVerified ? (
                  <Shield className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {isInspectorVerified ? "Final Grade" : "Condition"}
                </p>
                <p className={`text-sm font-bold ${isInspectorVerified ? "text-primary" : ""}`}>
                  {formatGrade(displayGrade)}
                </p>
                {isInspectorVerified && (
                  <p className="text-[9px] text-muted-foreground">Verified by inspector</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tire & Brake Inspection Findings */}
        {(hasTires || hasBrakes) && (
          <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
            {hasTires && tireDepths && (
              <DepthGrid depths={tireDepths} type="tire" title="Tire Tread Inspection" />
            )}
            {hasBrakes && brakeDepths && (
              <DepthGrid depths={brakeDepths} type="brake" title="Brake Pad Inspection" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PortalVehicleSummary;
