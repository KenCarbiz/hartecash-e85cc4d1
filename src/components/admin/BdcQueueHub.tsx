import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const BDCPriorityQueue = React.lazy(() => import("./BDCPriorityQueue"));
const BDCCallsToday = React.lazy(() => import("./BDCCallsToday"));

interface BdcQueueHubProps {
  /** Deep-link tab. "bdc-queue" → priority, "bdc-calls" → calls today.
   *  "bdc-hub" defaults to priority. */
  initialTab?: "priority" | "calls";
  /** Routed up to AdminSectionRenderer so a Priority-Queue row click
   *  still jumps to the submission inside the All Leads section. */
  onOpenSubmission?: (id: string) => void;
}

/**
 * BDC queue hub — one page, two tabs:
 *
 *   - Priority    — high-intent / hot leads waiting for a touch
 *   - Calls Today — cadence-queued follow-ups due today
 *
 * Same audience (BDC reps), same data domain (lead follow-ups). Two
 * sidebar entries fragmented the workflow — merging keeps them one
 * click apart and makes role-based gating simpler downstream.
 */
const BdcQueueHub = ({
  initialTab = "priority",
  onOpenSubmission,
}: BdcQueueHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">BDC Queue</h2>
        <p className="text-sm text-muted-foreground">
          Hot leads first, then your scheduled cadence callbacks.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="priority">Priority</TabsTrigger>
          <TabsTrigger value="calls">Calls Today</TabsTrigger>
        </TabsList>

        <TabsContent value="priority" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <BDCPriorityQueue onOpenSubmission={onOpenSubmission} />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="calls" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <BDCCallsToday />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BdcQueueHub;
