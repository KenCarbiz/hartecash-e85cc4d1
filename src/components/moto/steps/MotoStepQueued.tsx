import { Mail, Phone } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import MotoCard from "../MotoCard";
import MotoVehicleHero from "../MotoVehicleHero";
import type { MotoFlowState } from "../types";

const MotoStepQueued = ({ state }: { state: MotoFlowState }) => {
  const { config } = useSiteConfig();
  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard>
        <div className="py-6 text-center">
          <h2 className="text-xl font-bold text-zinc-900">An appraiser will be in touch</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Your vehicle is in our appraisal queue. We'll reach out within one business day
            with a personalized offer.
          </p>
          <div className="mt-5 space-y-2 text-sm text-zinc-700">
            {config.phone ? (
              <a
                href={`tel:${config.phone}`}
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-200 py-2 hover:bg-zinc-50"
              >
                <Phone className="h-4 w-4" /> {config.phone}
              </a>
            ) : null}
            {config.email ? (
              <a
                href={`mailto:${config.email}`}
                className="flex items-center justify-center gap-2 rounded-md border border-zinc-200 py-2 hover:bg-zinc-50"
              >
                <Mail className="h-4 w-4" /> {config.email}
              </a>
            ) : null}
          </div>
        </div>
      </MotoCard>
    </>
  );
};

export default MotoStepQueued;
