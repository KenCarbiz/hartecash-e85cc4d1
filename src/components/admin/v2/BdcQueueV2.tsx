/**
 * BDC Queue (Admin V2) — native-V2 shell over the existing sub-panels.
 *
 * The classic BdcQueueHub is a 2-tab wrapper around BDCPriorityQueue and
 * BDCCallsToday. This reimplements the hub shell in the V2 design system
 * (PageShell + V2 segmented tabs) and mounts the SAME sub-panels — so all
 * the priority/cadence call-queue logic is reused verbatim, just framed
 * natively. V2-only; V1 BdcQueueHub untouched.
 */
import { lazy, Suspense, useState } from "react";
import { PhoneCall, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell, Loading } from "./theme";

const BDCPriorityQueue = lazy(() => import("@/components/admin/BDCPriorityQueue"));
const BDCCallsToday = lazy(() => import("@/components/admin/BDCCallsToday"));

const TABS = [
  { key: "priority", label: "Priority", icon: PhoneCall },
  { key: "calls", label: "Calls Today", icon: ListChecks },
] as const;

const BdcQueueV2 = ({
  initialTab = "priority",
  onOpenSubmission,
}: {
  initialTab?: "priority" | "calls";
  onOpenSubmission?: (id: string) => void;
}) => {
  const [tab, setTab] = useState<"priority" | "calls">(initialTab);

  return (
    <PageShell title="BDC Queue" subtitle="Hot leads first, then your scheduled cadence callbacks.">
      <div className="mb-5 inline-flex gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
              tab === t.key ? "bg-[#6D28D9] text-white" : "text-[#53627A] hover:bg-[#F4F6FA]",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<Loading />}>
        {tab === "priority" ? <BDCPriorityQueue onOpenSubmission={onOpenSubmission} /> : <BDCCallsToday />}
      </Suspense>
    </PageShell>
  );
};

export default BdcQueueV2;
