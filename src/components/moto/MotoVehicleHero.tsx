import VehicleImage from "@/components/sell-form/VehicleImage";
import type { BBVehicle } from "@/components/sell-form/types";
import { useVehicleTuner } from "./HeroTuner";

/**
 * Persistent vehicle hero that appears on every step after the
 * search step. Side-profile image + year/make/model/series, VIN,
 * miles, and an "Edit Mileage" link (only shown when an editor is
 * provided). Matches the MotoAcquire screenshot pattern.
 *
 * Size, vertical offset, camera angle, and horizontal flip are
 * driven by the live VehicleTuner config so the dealer can resize
 * and re-orient the car without a deploy.
 */
const MotoVehicleHero = ({
  bb,
  color,
  mileage,
  onEditMileage,
}: {
  bb: BBVehicle | null;
  color: string;
  mileage?: string;
  onEditMileage?: () => void;
}) => {
  const tuner = useVehicleTuner();
  if (!bb) return null;

  const title = [bb.year, bb.make, bb.model, bb.series].filter(Boolean).join(" ");
  const milesNum = Number((mileage || "").replace(/[^\d]/g, ""));

  return (
    <div className="mb-4 text-center" style={{ marginTop: tuner.offsetY }}>
      <div
        className="mx-auto aspect-[16/9] w-full"
        style={{
          maxWidth: tuner.width,
          transform: tuner.flip ? "scaleX(-1)" : undefined,
        }}
      >
        <VehicleImage
          year={bb.year}
          make={bb.make}
          model={bb.model}
          style={bb.style}
          selectedColor={color || "white"}
          uvc={bb.uvc}
          imageAngle={tuner.angle}
          hideColorLabel
          fill
        />
      </div>
      <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">{title}</h1>
      {(bb.vin || milesNum > 0) ? (
        <p className="mt-1 text-sm text-zinc-500">
          {bb.vin}
          {bb.vin && milesNum > 0 ? " • " : ""}
          {milesNum > 0 ? `${milesNum.toLocaleString()} Miles` : ""}
        </p>
      ) : null}
      {onEditMileage ? (
        <button
          type="button"
          onClick={onEditMileage}
          className="mt-1 text-sm font-medium text-[hsl(var(--cta-offer))] underline-offset-2 hover:underline"
        >
          Edit Mileage
        </button>
      ) : null}
    </div>
  );
};

export default MotoVehicleHero;
