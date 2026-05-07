import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, RotateCw, AlertCircle, CheckCircle2 } from "lucide-react";

type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  received_at: string;
  processed_at: string | null;
  summary: string | null;
};

/**
 * Operational tool for the Stripe webhook pipeline. Lists the most
 * recent stripe_events rows with a Replay button on any row whose
 * processed_at is NULL — i.e. the webhook handler errored before
 * finishing.
 *
 * The replay calls billing-replay-event which re-fetches the live
 * Stripe event and re-runs the same upsert logic the live webhook
 * would have run. Idempotent: replay is safe even on already-
 * processed events.
 *
 * Visibility: super-admin only — wired into Platform sidebar group
 * via AdminSidebar + AdminSectionRenderer.
 */
const StripeWebhookReprocessor = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unprocessed">("unprocessed");
  const [replaying, setReplaying] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("stripe_events")
      .select("id, type, livemode, received_at, processed_at, summary")
      .order("received_at", { ascending: false })
      .limit(50);
    if (filter === "unprocessed") q = q.is("processed_at", null);
    const { data, error } = await q;
    if (error) {
      toast({ title: "Couldn't load events", description: error.message, variant: "destructive" });
      setEvents([]);
    } else {
      setEvents((data as StripeEvent[]) ?? []);
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { void reload(); }, [reload]);

  const replay = async (eventId: string) => {
    setReplaying(eventId);
    try {
      const { data, error } = await supabase.functions.invoke("billing-replay-event", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      const result = data as { replayed?: boolean; error?: string; type?: string };
      if (result.replayed) {
        toast({
          title: "Replayed successfully",
          description: `${result.type ?? "event"} processed and stripe_events row marked done.`,
        });
      } else {
        toast({
          title: "Replay returned an error",
          description: result.error ?? "unknown",
          variant: "destructive",
        });
      }
      await reload();
    } catch (e) {
      toast({
        title: "Replay failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setReplaying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Stripe Webhook Events</h2>
          <p className="text-sm text-muted-foreground">
            Recent webhook deliveries. Replay any row whose handler didn't finish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              className={`px-3 py-1.5 ${filter === "unprocessed" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/40"}`}
              onClick={() => setFilter("unprocessed")}
            >
              Unprocessed
            </button>
            <button
              className={`px-3 py-1.5 ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted/40"}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={reload} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {loading && (
          <div className="px-5 py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            {filter === "unprocessed"
              ? "No unprocessed events. Stripe webhook is healthy."
              : "No events recorded yet. Once Stripe starts sending traffic, deliveries will appear here."}
          </div>
        )}
        {!loading && events.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Event</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-left px-3 py-2.5 font-medium">Received</th>
                <th className="text-right px-5 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20">
                  <td className="px-5 py-2.5">
                    <div className="font-medium font-mono text-[11px]">{e.id}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {e.type}
                      {!e.livemode && (
                        <Badge variant="outline" className="ml-2 text-micro">test mode</Badge>
                      )}
                    </div>
                    {e.summary && (
                      <div className="text-micro text-muted-foreground/70 mt-1 truncate max-w-md">
                        {e.summary}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.processed_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        processed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">
                        <AlertCircle className="w-3 h-3" />
                        unprocessed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(e.received_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => replay(e.id)}
                      disabled={replaying === e.id}
                    >
                      {replaying === e.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                          Replay
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Replay re-fetches the event from Stripe and re-runs the upsert. Idempotent — safe to replay even on already-processed events.
      </p>
    </div>
  );
};

export default StripeWebhookReprocessor;
