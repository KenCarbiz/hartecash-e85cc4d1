import { useEffect } from "react";
import GhostScreen from "@/components/landing/GhostScreen";
import { useGhostScreen } from "@/hooks/useGhostScreen";
import { GhostSyncIndicator } from "@/components/PortalSkeleton";
// Placeholder until ken-thinking.webp ships — see PR description.
import kenThinking from "@/assets/ken-portrait.webp";

interface Props {
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  onComplete?: () => void;
  previewMode?: boolean;
}

const CalculatingOffer = ({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  onComplete,
  previewMode,
}: Props) => {
  const { kind, syncing, ready, stale } = useGhostScreen();
  const vehicleStr = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ");

  useEffect(() => {
    if (previewMode) return;
    const t = setTimeout(() => onComplete?.(), 6000);
    return () => clearTimeout(t);
  }, [previewMode, onComplete]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 relative">
      <img
        src={kenThinking}
        alt=""
        aria-hidden="true"
        className="w-48 md:w-64 object-contain pointer-events-none select-none"
      />
      {ready && (
        <GhostScreen
          kind={kind}
          accent="#5B6B8A"
          background="transparent"
          headline={vehicleStr ? `Pulling info for your ${vehicleStr}` : "Pulling your vehicle info"}
          size="lg"
        />
      )}
      <GhostSyncIndicator syncing={syncing} stale={stale} />
    </div>
  );
};

export default CalculatingOffer;
