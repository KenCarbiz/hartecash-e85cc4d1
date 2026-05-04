import { AlertTriangle, RefreshCw } from "lucide-react";
import GhostScreen, { type GhostScreenKind } from "@/components/landing/GhostScreen";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface PortalSkeletonProps {
  error?: string | null;
  onRetry?: () => void;
  /** Headline displayed above the loader so the customer knows
   *  what's happening — "Finding Vehicle", "Loading Submission",
   *  "Uploading Photos", etc. Defaults to "Loading your submission". */
  headline?: string;
}

/**
 * Site-wide loading skeleton. Renders the dealer-selected ghost-screen
 * variant (admin → Branding → Landing → Ghost Screen). Falls back to
 * "legacy-car" until the dealer's site_config loads.
 */
const PortalSkeleton = ({
  error,
  onRetry,
  headline = "Loading your submission",
}: PortalSkeletonProps = {}) => {
  const { config } = useSiteConfig();

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            We couldn't load your submission
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const kind = (((config as any)?.ghost_screen as GhostScreenKind) ||
    "legacy-car") as GhostScreenKind;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <GhostScreen
        kind={kind}
        accent="#5B6B8A"
        background="transparent"
        headline={headline}
        size="lg"
      />
    </div>
  );
};

export default PortalSkeleton;
