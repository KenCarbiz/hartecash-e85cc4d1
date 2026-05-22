// useActivityFeed — customer-safe timeline for ActivityPage.
//
// Reads the new `get_submission_activity(_token)` RPC shipped in
// 20260523000100_get_submission_activity_rpc.sql. The RPC unions
// submission lifecycle stamps + appointments + a whitelisted slice
// of activity_log into rows of:
//
//   { id, event_type, title, body, occurred_at, nav_target }
//
// We adapt that into the shape ActivityPage's existing ActivityItem
// type expects ({ id, type, title, time, desc }) so the page swap
// is mechanical.
//
// Mock branch: when token is null (the /portal-preview route) the
// hook resolves to PORTAL_MOCK.activity so the preview keeps
// working unchanged.
//
// Caching: staleTime 30s + refetch on focus. The timeline updates
// whenever the dealer touches the submission (offer adjustments,
// appointment changes, status flips); 30s is a reasonable floor
// before realtime invalidation lands in Phase 2.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_MOCK } from "@/components/portal/portalMock";
import { usePortalToken } from "@/contexts/PortalTokenContext";
import type { DataStatus } from "@/components/portal/PortalDataBoundary";

export interface ActivityEvent {
  id: string;
  // Maps to the page's existing TYPE_MAP keys. The RPC's event_type
  // values are kept in sync with these.
  type:
    | "submission"
    | "offer"
    | "messages"
    | "documents"
    | "pickup"
    | "payments"
    | "photos"
    | "docs"
    | "inspection"
    | "payment"
    | "system";
  title: string;
  /** Relative-time string for display ("3h ago", "May 12 · 9:14 AM"). */
  time: string;
  /** Free-form body text. */
  desc: string;
  /** Optional sub-page key to navigate to on click. */
  navTarget?: string | null;
  /** Raw ISO from the RPC, for sorting / further computation. */
  occurredAt: string | null;
}

interface RpcRow {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  occurred_at: string | null;
  nav_target: string | null;
}

// Human-friendly relative time: "3m ago", "2h ago", "Yesterday",
// "May 12 · 9:14 AM". Falls back to "—" for null timestamps.
function formatRelative(iso: string | null): string {
  if (!iso) return "Pending";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Pending";
  const now = Date.now();
  const diff = now - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2 * 86_400_000) return "Yesterday";
  const d = new Date(t);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function mapEvent(row: RpcRow): ActivityEvent {
  // The RPC's event_type uses values that line up with the page's
  // existing TYPE_MAP (see ActivityPage's TYPE_MAP constant). When
  // an unknown type lands we collapse to "system" so the UI doesn't
  // crash.
  const knownTypes: ActivityEvent["type"][] = [
    "submission", "offer", "messages", "documents", "pickup",
    "payments", "photos", "docs", "inspection", "payment", "system",
  ];
  const type = (knownTypes as string[]).includes(row.event_type)
    ? (row.event_type as ActivityEvent["type"])
    : "system";
  return {
    id: row.id,
    type,
    title: row.title,
    time: formatRelative(row.occurred_at),
    desc: row.body ?? "",
    navTarget: row.nav_target ?? null,
    occurredAt: row.occurred_at,
  };
}

// Convert the page's existing MOCK.activity shape to ActivityEvent[]
// for the demo route.
function mockEvents(): ActivityEvent[] {
  return PORTAL_MOCK.activity.map((a) => ({
    id: String(a.id),
    type: a.type as ActivityEvent["type"],
    title: a.title,
    time: a.time,
    desc: a.desc,
    navTarget: null,
    occurredAt: null,
  }));
}

interface UseActivityFeedResult {
  data: ActivityEvent[] | null;
  status: DataStatus;
  error: Error | null;
  isDemo: boolean;
  refetch: () => void;
}

const STALE_30S = 30_000;

export function useActivityFeed(): UseActivityFeedResult {
  const { token, isDemo } = usePortalToken();

  const query = useQuery({
    queryKey: ["portal", token ?? "demo", "activity"],
    staleTime: STALE_30S,
    refetchOnWindowFocus: !isDemo,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!token) return mockEvents();
      // The new RPC isn't in the generated Supabase types yet — it
      // ships alongside this hook in the same PR. The .rpc() call
      // typechecks as `unknown` until the types regenerate after
      // the migration runs, so we cast through unknown to RpcRow[].
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .rpc("get_submission_activity", { _token: token });
      if (error) throw new Error(error.message);
      return ((data as unknown as RpcRow[] | null) ?? []).map(mapEvent);
    },
  });

  let status: DataStatus;
  if (query.isPending) status = "loading";
  else if (query.isError) status = "error";
  else if (!query.data || query.data.length === 0) status = "empty";
  else status = "ready";

  return {
    data: query.data ?? null,
    status,
    error: query.error as Error | null,
    isDemo,
    refetch: () => { void query.refetch(); },
  };
}
