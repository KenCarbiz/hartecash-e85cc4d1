import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import GhostScreen from "@/components/landing/GhostScreen";
import { useGhostScreen } from "@/hooks/useGhostScreen";

interface PortalSkeletonProps {
  error?: string | null;
  onRetry?: () => void;
  headline?: string;
}

/**
 * Site-wide loading skeleton. Renders the dealer-selected ghost-screen
 * variant (admin → Branding → Landing → Ghost Screen). Force-fetches
 * the live value on mount via useGhostScreen so a stale cache never
 * serves the wrong loader; surfaces a small sync chip while the
 * fresh value is in flight or when it differs from the cached value.
 */
const PortalSkeleton = ({
  error,
  onRetry,
  headline = "Loading your submission",
}: PortalSkeletonProps = {}) => {
  const { kind, syncing, ready, stale } = useGhostScreen();

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative">
      {ready && (
        <GhostScreen
          kind={kind}
          accent="#5B6B8A"
          background="transparent"
          headline={headline}
          size="lg"
        />
      )}
      <GhostSyncIndicator syncing={syncing} stale={stale} />
    </div>
  );
};

/** Tiny chip in the bottom-right showing whether the loader variant
 *  has been confirmed against the live site_config row. Hidden by
 *  default once everything matches; visible while syncing or when
 *  the cached pick disagrees with what's in the DB. */
export const GhostSyncIndicator = ({
  syncing,
  stale,
}: {
  syncing: boolean;
  stale: boolean;
}) => {
  if (!syncing && !stale) return null;
  return (
    <div
      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-card/80 backdrop-blur border border-border text-[10px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <RotateCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing loader…" : "Updating loader…"}
    </div>
  );
};

export default PortalSkeleton;
