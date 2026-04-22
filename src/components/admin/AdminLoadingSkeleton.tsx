import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminLoadingSkeletonProps {
  /** Number of KPI cards to show (default 4) */
  cards?: number;
  /** Number of table rows to show (default 6) */
  rows?: number;
  /** Whether to show the analytics/chart section (default true) */
  showChart?: boolean;
  /** Whether to show the table section (default true) */
  showTable?: boolean;
}

const AdminLoadingSkeleton = ({
  cards = 4,
  rows = 6,
  showChart = true,
  showTable = true,
}: AdminLoadingSkeletonProps) => {
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowMessage(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 animate-pulse" />
              <Skeleton className="h-4 w-4 rounded animate-pulse" />
            </div>
            <Skeleton className="h-8 w-16 animate-pulse" />
            <Skeleton className="h-2.5 w-28 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Analytics skeleton */}
      {showChart && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Skeleton className="h-3 w-36 animate-pulse" />
          <div className="flex items-center gap-8">
            <Skeleton className="h-[120px] w-[120px] rounded-full shrink-0 animate-pulse" />
            <div className="flex-1 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-28 animate-pulse" />
                  <Skeleton className="h-6 flex-1 rounded-full animate-pulse" />
                  <Skeleton className="h-3 w-8 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table skeleton */}
      {showTable && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex gap-3">
            <Skeleton className="h-9 w-48 animate-pulse" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-9 w-9 rounded animate-pulse" />
              <Skeleton className="h-9 w-20 animate-pulse" />
            </div>
          </div>
          {/* Quick filter chips */}
          <div className="px-4 pt-3 pb-1 flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-6 w-16 rounded-full animate-pulse" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
              <Skeleton className="h-3.5 w-20 animate-pulse" />
              <Skeleton className="h-3.5 w-28 animate-pulse" />
              <Skeleton className="h-3.5 w-36 hidden md:block animate-pulse" />
              <Skeleton className="h-3.5 w-32 hidden lg:block animate-pulse" />
              <Skeleton className="h-5 w-14 rounded-full ml-auto animate-pulse" />
              <Skeleton className="h-7 w-36 rounded animate-pulse" />
              <Skeleton className="h-3.5 w-8 animate-pulse" />
              <Skeleton className="h-8 w-8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Slow-loading hint */}
      {showSlowMessage && (
        <p className="text-center text-xs text-muted-foreground animate-in fade-in duration-500">
          Still loading? Check your connection or try refreshing the page.
        </p>
      )}
    </div>
  );
};

export default AdminLoadingSkeleton;
