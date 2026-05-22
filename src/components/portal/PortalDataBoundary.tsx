// PortalDataBoundary — single wrapper that enforces the
// loading / empty / ready / error contract across every portal page.
//
// Why this exists (from the technical review's P1 #7):
// every portal page currently `.map()`s a static MOCK array
// unconditionally. The moment a hook returns `data === undefined`
// or `data.length === 0` while a network request is in flight, the
// page renders its empty-state copy ("No vehicles", "All caught up")
// for the first 300-1500ms — the "no offers flashes during loading"
// bug. This wrapper makes that pattern structurally impossible:
// pages branch on `status`, never on `data.length === 0`.
//
// Usage:
//
//   const offers = useOffers();
//   return (
//     <PortalDataBoundary
//       status={offers.status}
//       skeleton={<OffersSkeleton />}
//       empty={<EmptyState message="No active offers yet." />}
//       error={offers.error}
//       onRetry={offers.refetch}
//     >
//       <OffersList offers={offers.data} />
//     </PortalDataBoundary>
//   );
//
// The page never has to write "if (isLoading) … else if (error) …"
// branches; it just composes.
import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export type DataStatus = "loading" | "ready" | "empty" | "error";

interface Props {
  status: DataStatus;
  skeleton: ReactNode;
  empty?: ReactNode;
  // Pass the Error from useQuery so we can surface a helpful message.
  error?: Error | null;
  // Optional refetch callback to wire to the "Try again" button.
  onRetry?: () => void;
  children: ReactNode;
}

const PortalDataBoundary = ({
  status,
  skeleton,
  empty,
  error,
  onRetry,
  children,
}: Props) => {
  if (status === "loading") return <>{skeleton}</>;

  if (status === "error") {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3"
      >
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            We couldn't load this section.
          </p>
          <p className="text-xs text-amber-800 leading-relaxed">
            {error?.message || "Something went wrong. Please try again in a moment."}
          </p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (status === "empty") {
    return <>{empty ?? null}</>;
  }

  return <>{children}</>;
};

// Helper that turns a useQuery result + an "is empty" predicate into
// a DataStatus. Hooks return `status` directly, but pages composing
// multiple queries can call this themselves.
export function deriveStatus<T>(
  data: T | undefined,
  isPending: boolean,
  isError: boolean,
  isEmpty: (d: T) => boolean,
): DataStatus {
  if (isPending) return "loading";
  if (isError) return "error";
  if (data && isEmpty(data)) return "empty";
  return "ready";
}

export default PortalDataBoundary;
