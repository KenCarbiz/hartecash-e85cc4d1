import { Camera, MapPin } from "lucide-react";
import type { FormData, VehicleInfo } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  vehicleInfo: VehicleInfo | null;
}

const StepGetOffer = ({ formData, update, vehicleInfo }: Props) => (
  <div className="py-4">
    <div className="text-center mb-6">
      <div className="text-5xl mb-3">🎉</div>
      <h3 className="text-xl font-bold text-card-foreground mb-1">
        You're Almost There!
      </h3>
      {vehicleInfo && (
        <p className="text-base font-semibold text-card-foreground">
          {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
        </p>
      )}
      <p className="text-muted-foreground text-sm mt-2">
        Choose how you'd like to proceed to finalize your offer.
      </p>
    </div>

    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => update("nextStep", "photos")}
        className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
          formData.nextStep === "photos"
            ? "border-accent bg-accent/10"
            : "border-input bg-background hover:border-muted-foreground/30"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            formData.nextStep === "photos" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          }`}>
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-base font-bold block ${
              formData.nextStep === "photos" ? "text-accent" : "text-card-foreground"
            }`}>
              Take a Few Photos
            </span>
            <span className="text-sm text-muted-foreground mt-1 block leading-relaxed">
              We'll guide you through a quick series of photos to help us appraise your car. Fastest way to get your cash offer.
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => update("nextStep", "visit")}
        className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
          formData.nextStep === "visit"
            ? "border-accent bg-accent/10"
            : "border-input bg-background hover:border-muted-foreground/30"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
            formData.nextStep === "visit" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          }`}>
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <span className={`text-base font-bold block ${
              formData.nextStep === "visit" ? "text-accent" : "text-card-foreground"
            }`}>
              Visit Us In Person
            </span>
            <span className="text-sm text-muted-foreground mt-1 block leading-relaxed">
              Schedule a time to finish the appraisal at our location. We'll handle everything on the spot.
            </span>
          </div>
        </div>
      </button>
    </div>
  </div>
);

export default StepGetOffer;
