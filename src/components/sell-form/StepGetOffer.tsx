import type { VehicleInfo } from "./types";

interface Props {
  vehicleInfo: VehicleInfo | null;
}

const StepGetOffer = ({ vehicleInfo }: Props) => (
  <div className="text-center py-6">
    <div className="text-5xl mb-4">🚗</div>
    <h3 className="text-xl font-bold text-card-foreground mb-2">
      Ready to Get Your Offer!
    </h3>
    <p className="text-muted-foreground text-sm mb-6">
      Click below and we'll have your personalized cash offer ready in minutes.
    </p>
    {vehicleInfo && (
      <p className="text-base font-semibold text-card-foreground mb-4">
        {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
      </p>
    )}
  </div>
);

export default StepGetOffer;
