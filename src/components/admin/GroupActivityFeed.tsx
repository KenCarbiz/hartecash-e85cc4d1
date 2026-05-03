import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Power, PowerOff, ArrowRightLeft, FileSearch } from "lucide-react";

type FeedEntry = {
  ts: string;
  kind: "activated" | "deactivated" | "detached" | "exported";
  dealership_id: string;
  detail: string;
};

interface Props {
  dealerGroupId: string;
  /** Map dealership_id → display_name for friendly labels. */
  dealershipNames: Map<string, string>;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  if (dt < 60_000) return "just now";
  const mins = Math.floor(dt / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iconFor(k: FeedEntry["kind"]) {
  switch (k) {
    case "activated":   return <Power className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />;
    case "deactivated": return <PowerOff className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />;
    case "detached":    return <ArrowRightLeft className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />;
    case "exported":    return <FileSearch className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />;
  }
}

/**
 * Recent activity inside a dealer group — rooftop activations,
 * deactivations, detaches, and data-egress exports. Surfaces what
 * the group's CFO + IT need to know without giving them direct
 * SQL access.
 *
 * Reads from:
 *   - rooftop_activations (activated_at + deactivated_at)
 *   - rooftop_detach_log (performed_at)
 *   - data_egress_log (created_at) — scoped to the group's
 *     dealership_ids
 *
 * Limited to the last 30 entries combined; group admins who need
 * deeper history can filter the underlying tables directly via
 * super-admin tools.
 */
const GroupActivityFeed = ({ dealerGroupId, dealershipNames }: Props) => {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const dealershipIds = Array.from(dealershipNames.keys());

      const [acts, detaches, exports] = await Promise.all([
        supabase
          .from("rooftop_activations")
          .select("id, dealership_id, status, activated_at, deactivated_at, deactivation_reason")
          .eq("dealer_group_id", dealerGroupId)
          .order("activated_at", { ascending: false })
          .limit(50),
        supabase
          .from("rooftop_detach_log")
          .select("dealership_id, from_dealer_group_id, to_dealer_group_id, performed_at, reason, performed_by_email")
          .or(`from_dealer_group_id.eq.${dealerGroupId},to_dealer_group_id.eq.${dealerGroupId}`)
          .order("performed_at", { ascending: false })
          .limit(50),
        dealershipIds.length > 0
          ? supabase
              .from("data_egress_log")
              .select("dealership_id, created_at, export_kind, table_names, row_counts, exported_by_email")
              .in("dealership_id", dealershipIds)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const out: FeedEntry[] = [];

      for (const a of (acts.data as any[]) ?? []) {
        out.push({
          ts: a.activated_at,
          kind: "activated",
          dealership_id: a.dealership_id,
          detail: `Pilot started`,
        });
        if (a.deactivated_at) {
          out.push({
            ts: a.deactivated_at,
            kind: "deactivated",
            dealership_id: a.dealership_id,
            detail: a.deactivation_reason
              ? `Deactivated · ${a.deactivation_reason}`
              : "Deactivated",
          });
        }
      }

      for (const d of (detaches.data as any[]) ?? []) {
        const direction = d.from_dealer_group_id === dealerGroupId ? "out" : "in";
        out.push({
          ts: d.performed_at,
          kind: "detached",
          dealership_id: d.dealership_id,
          detail: `${direction === "out" ? "Detached out" : "Joined"} · ${d.reason}${d.performed_by_email ? ` · by ${d.performed_by_email}` : ""}`,
        });
      }

      for (const e of (exports.data as any[]) ?? []) {
        const total = Object.values((e.row_counts ?? {}) as Record<string, number>).reduce(
          (s: number, n: number) => s + n,
          0,
        );
        out.push({
          ts: e.created_at,
          kind: "exported",
          dealership_id: e.dealership_id,
          detail: `${e.export_kind.toUpperCase()} export · ${total.toLocaleString()} rows · ${e.table_names.length} tables${e.exported_by_email ? ` · by ${e.exported_by_email}` : ""}`,
        });
      }

      // Sort and trim.
      out.sort((a, b) => (a.ts > b.ts ? -1 : 1));
      setEntries(out.slice(0, 30));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealerGroupId, dealershipNames]);

  return (
    <div className="border border-border rounded-xl bg-card">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Recent activity</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Activations, deactivations, detaches, and data exports across this group.
        </p>
      </div>
      {loading && (
        <div className="divide-y divide-border" aria-busy="true" aria-label="Loading group activity">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-2.5 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && entries.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No activity yet.
        </div>
      )}
      {!loading && entries.length > 0 && (
        <ol className="divide-y divide-border">
          {entries.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="px-5 py-2.5 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                {iconFor(e.kind)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{dealershipNames.get(e.dealership_id) || e.dealership_id}</span>{" "}
                  <span className="text-muted-foreground">— {e.detail}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {relativeTime(e.ts)} · <span className="font-mono">{e.dealership_id}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default GroupActivityFeed;
