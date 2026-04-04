import { CheckCircle } from "lucide-react";
import type { BBVehicle } from "./types";

interface Props {
  vehicle: BBVehicle;
}

const BBVehicleCard = ({ vehicle }: Props) => {
  const detectedOptions = vehicle.add_deduct_list?.filter(o => o.auto !== "N") || [];
  const availableAddOns = vehicle.add_deduct_list?.filter(o => o.auto === "N") || [];

  return (
    <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-xl space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-success" />
        <span className="text-sm font-bold text-card-foreground">Vehicle Verified</span>
      </div>

      <div>
        <p className="text-lg font-bold text-card-foreground">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        {(vehicle.series || vehicle.style) && (
          <p className="text-sm text-muted-foreground">
            {vehicle.series}{vehicle.series && vehicle.style ? " • " : ""}{vehicle.style}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {vehicle.engine && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm">
            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="text-muted-foreground">Engine</span>
            <span className="ml-auto font-medium text-card-foreground truncate">{vehicle.engine}</span>
          </div>
        )}
        {vehicle.transmission && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm">
            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="text-muted-foreground">Trans</span>
            <span className="ml-auto font-medium text-card-foreground truncate">{vehicle.transmission}</span>
          </div>
        )}
        {vehicle.drivetrain && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm">
            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="text-muted-foreground">Drivetrain</span>
            <span className="ml-auto font-medium text-card-foreground">{vehicle.drivetrain}</span>
          </div>
        )}
        {vehicle.fuel_type && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm">
            <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="text-muted-foreground">Fuel</span>
            <span className="ml-auto font-medium text-card-foreground">{vehicle.fuel_type}</span>
          </div>
        )}
      </div>

      {vehicle.class_name && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {vehicle.class_name}
          </span>
          {vehicle.msrp ? (
            <span className="text-[11px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
              Original MSRP ${vehicle.msrp.toLocaleString()}
            </span>
          ) : null}
        </div>
      )}

      {detectedOptions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
            Factory Options Detected ({detectedOptions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {detectedOptions.slice(0, 8).map((opt) => (
              <span
                key={opt.uoc}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 border border-primary/20 text-primary"
              >
                <CheckCircle className="w-3 h-3" />
                {opt.name}
              </span>
            ))}
            {detectedOptions.length > 8 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] text-muted-foreground">
                +{detectedOptions.length - 8} more
              </span>
            )}
          </div>
          {availableAddOns.length > 0 && (
            <details className="mt-2">
              <summary className="text-[11px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors">
                View {availableAddOns.length} available add-ons
              </summary>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {availableAddOns.map((opt) => (
                  <span
                    key={opt.uoc}
                    className="px-2 py-0.5 rounded-full text-[11px] bg-muted border border-border text-muted-foreground"
                  >
                    {opt.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic">
        Powertrain & specs auto-verified — you won't need to enter these.
      </p>
    </div>
  );
};

export default BBVehicleCard;
