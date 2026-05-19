import { useEffect, useState } from "react";
import { Sparkles, Camera, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import MotoStickyFooter from "../MotoStickyFooter";
import MotoVehicleHero from "../MotoVehicleHero";
import SaveOfferButton from "@/components/offer/SaveOfferButton";
import type { MotoFlowState } from "../types";
import { calculateAndPersistOffer } from "../motoSubmission";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const MotoStepOffer = ({
  state,
  onNext,
}: {
  state: MotoFlowState;
  onNext: (next: Partial<MotoFlowState>) => void;
}) => {
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const [computing, setComputing] = useState(true);
  const [low, setLow] = useState<number | null>(state.offer.low);
  const [high, setHigh] = useState<number | null>(state.offer.high);
  const [firm, setFirm] = useState<number | null>(state.offer.firm);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // If we already have a firm number (e.g. user came back from
      // photos), skip the calculation/persist.
      if (state.submissionToken && (state.offer.firm || state.offer.low)) {
        setComputing(false);
        return;
      }
      try {
        const result = await calculateAndPersistOffer(state, tenant.dealership_id);
        if (cancelled) return;
        setLow(result.estimate?.low ?? null);
        setHigh(result.estimate?.high ?? null);
        setFirm(result.firm);
        onNext({
          submissionId: result.submissionId,
          submissionToken: result.submissionToken,
          offer: {
            low: result.estimate?.low ?? null,
            high: result.estimate?.high ?? null,
            firm: result.firm,
            aiBumped: false,
          },
        });
      } catch (e) {
        toast({
          title: "Couldn't generate your offer",
          description: (e as Error)?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setComputing(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // We only want this to run once on entry to the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = () => onNext({ step: "schedule" });
  const decline = () => onNext({ declined: true, step: "photos" });

  return (
    <>
      <MotoVehicleHero bb={state.bbVehicle} color={state.color} mileage={state.mileage} />
      <MotoCard>
        {computing ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-[hsl(var(--cta-offer))]" />
            <p className="mt-3 text-sm text-zinc-600">Calculating your offer…</p>
          </div>
        ) : firm ? (
          <>
            <p className="text-center text-xs uppercase tracking-wide text-zinc-500">Your Firm Offer</p>
            <p className="mt-1 text-center text-4xl font-bold text-zinc-900">{usd(firm)}</p>
            {low && high && (low !== firm || high !== firm) ? (
              <p className="mt-1 text-center text-xs text-zinc-500">
                Range: {usd(low)} – {usd(high)}
              </p>
            ) : null}
            <p className="mt-3 text-center text-xs text-zinc-500">
              Valid for 7 days, subject to a quick verification at the dealership.
            </p>
          </>
        ) : low && high ? (
          <>
            <p className="text-center text-xs uppercase tracking-wide text-zinc-500">
              Estimated Trade-in Value
            </p>
            <p className="mt-1 text-center text-3xl font-bold text-zinc-900">
              {usd(low)} – {usd(high)}
            </p>
            <p className="mt-3 text-center text-xs text-zinc-500">
              Upload a few photos to lock in a firm offer.
            </p>
          </>
        ) : (
          <>
            <p className="text-center text-sm font-medium text-zinc-900">
              We need a few photos to price this one.
            </p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              Upload your vehicle and we'll come back with a firm offer in minutes.
            </p>
          </>
        )}
      </MotoCard>
      {!computing && (
        <MotoStickyFooter>
          {firm ? (
            <div className="space-y-2">
              <MotoPrimaryButton onClick={accept}>Accept &amp; Schedule Inspection</MotoPrimaryButton>
              {state.submissionToken && (
                <SaveOfferButton
                  token={state.submissionToken}
                  vehicleStr={[state.bbVehicle?.year, state.bbVehicle?.make, state.bbVehicle?.model]
                    .filter(Boolean)
                    .join(" ")}
                  customerName={`${state.contact.firstName} ${state.contact.lastName}`.trim()}
                  customerEmail={state.contact.email}
                  customerPhone={state.contact.phone}
                  guaranteeDays={Number(config.price_guarantee_days) || 8}
                  dealershipName={config.dealership_name}
                />
              )}
              <button
                type="button"
                onClick={decline}
                className="w-full rounded-md border border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Think it should be higher? Try AI Photo Appraisal
              </button>
            </div>
          ) : (
            <MotoPrimaryButton onClick={() => onNext({ step: "photos" })}>
              Start AI Photo Appraisal
            </MotoPrimaryButton>
          )}
        </MotoStickyFooter>
      )}
    </>
  );
};

export default MotoStepOffer;
