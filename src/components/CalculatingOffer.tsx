import { useEffect } from "react";
import GhostScreen, { type GhostScreenKind } from "@/components/landing/GhostScreen";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Props {
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  onComplete?: () => void;
  previewMode?: boolean;
}

/**
 * Shown while we pull vehicle data after the customer enters a VIN /
 * plate. Renders the dealer-selected ghost-screen variant configured
 * in admin → Branding → Landing → Ghost Screen.
 */
const CalculatingOffer = ({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  onComplete,
  previewMode,
}: Props) => {
  const { config } = useSiteConfig();
  const vehicleStr = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ");

  useEffect(() => {
    if (previewMode) return;
    const t = setTimeout(() => onComplete?.(), 6000);
    return () => clearTimeout(t);
  }, [previewMode, onComplete]);

  const kind = (((config as any)?.ghost_screen as GhostScreenKind) ||
    "legacy-car") as GhostScreenKind;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <GhostScreen
        kind={kind}
        accent="#5B6B8A"
        background="transparent"
        headline={vehicleStr ? `Pulling info for your ${vehicleStr}` : "Pulling your vehicle info"}
        size="lg"
      />
    </div>
  );
};

export default CalculatingOffer;
