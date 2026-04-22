import { Car, CheckCircle } from "lucide-react";
import type { BBVehicle, VehicleInfo } from "./types";

interface Props {
  vehicleInfo?: VehicleInfo | null;
  bbVehicle?: BBVehicle | null;
}

const VehicleSummaryBar = ({ vehicleInfo, bbVehicle }: Props) => {
  const display = bbVehicle
    ? { year: bbVehicle.year, make: bbVehicle.make, model: bbVehicle.model }
    : vehicleInfo;

  if (!display) return null;

  const specs = bbVehicle
    ? [
        bbVehicle.series,
        bbVehicle.drivetrain,
        bbVehicle.engine,
        bbVehicle.transmission,
      ].filter(Boolean)
    : [];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-5 rounded-lg bg-primary/5 border border-primary/15">
      <Car className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-card-foreground truncate">
            {display.year} {display.make} {display.model}
          </span>
          {bbVehicle && (
            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
          )}
        </div>
        {specs.length > 0 && (
          <p className="text-[11px] text-muted-foreground truncate">
            {specs.join(" • ")}
          </p>
        )}
      </div>
      {bbVehicle?.class_name && (
        <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
          {bbVehicle.class_name}
        </span>
      )}
    </div>
  );
};

export default VehicleSummaryBar;
