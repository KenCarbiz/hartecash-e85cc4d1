import ghostCar from "@/assets/ghost-loader.png";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface PortalSkeletonProps {
  error?: string | null;
  onRetry?: () => void;
}

const PortalSkeleton = ({ error, onRetry }: PortalSkeletonProps = {}) => {
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">We couldn't load your submission</h2>
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative mx-auto mb-4 w-[320px] h-[200px]">
          <img
            src={ghostCar}
            alt=""
            className="w-full h-full object-contain"
            style={{ animation: "car-bounce 1.2s ease-in-out infinite" }}
          />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 200">
            <style>{`
              @keyframes car-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
              @keyframes road-scroll { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }
            `}</style>
            <line
              x1="0" y1="170" x2="320" y2="170"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              strokeDasharray="12 8"
              opacity="0.4"
              style={{ animation: "road-scroll 0.6s linear infinite" }}
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading your submission...</p>
      </div>
    </div>
  );
};

export default PortalSkeleton;
