import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditStats {
  total: number;
  today: number;
  last_7_days: number;
  last_30_days: number;
  missed_count: number;
  generated_at: string;
}

interface MissedRow {
  inbound_id: string;
  from_phone: string;
  to_phone: string;
  body: string;
  submission_id: string | null;
  dealership_id: string | null;
  received_at: string;
}

/**
 * SmsOptOutsPanel — TCPA compliance dashboard.
 *
 * Surfaces:
 *  - sms_opt_outs counts (today / 7d / 30d / total)
 *  - "Missed STOP" alerts: inbound messages whose body matches
 *    the opt-out patterns the webhook recognizes, but for which
 *    no row was created in sms_opt_outs. These represent compliance
 *    risk and warrant a human review.
 */
const SmsOptOutsPanel = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [missed, setMissed] = useState<MissedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: a, error: aErr }, { data: m, error: mErr }] = await Promise.all([
        supabase.rpc("sms_opt_out_audit"),
        supabase.rpc("sms_opt_out_missed_alerts", { p_days: 30 }),
      ]);
      if (aErr) throw aErr;
      if (mErr) throw mErr;
      setStats(a as unknown as AuditStats);
      setMissed((m as unknown as MissedRow[]) || []);
    } catch (e: any) {
      toast({ title: "Failed to load audit", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hasAlerts = (stats?.missed_count ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-card-foreground">
            SMS Opt-Outs
          </h3>
          <p className="text-xs text-muted-foreground">
            TCPA compliance — opt-out activity and missed STOP detection.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Today" value={stats?.today} />
        <StatCard label="Last 7 days" value={stats?.last_7_days} />
        <StatCard label="Last 30 days" value={stats?.last_30_days} />
        <StatCard label="All time" value={stats?.total} />
        <StatCard
          label="Missed STOPs"
          value={stats?.missed_count}
          tone={hasAlerts ? "danger" : "ok"}
        />
      </div>

      <Card className={hasAlerts ? "border-destructive/50" : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {hasAlerts ? (
              <>
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Missed opt-out alerts
                <Badge variant="destructive" className="ml-1">{missed.length}</Badge>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                No missed opt-outs in the last 30 days
              </>
            )}
          </CardTitle>
        </CardHeader>
        {missed.length > 0 && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              These inbound messages look like opt-out requests but did not
              produce an <code className="text-[11px]">sms_opt_outs</code> row.
              Review and add to the suppression list manually if needed.
            </p>
            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Received</TableHead>
                    <TableHead className="w-[140px]">From</TableHead>
                    <TableHead>Body</TableHead>
                    <TableHead className="w-[120px]">Submission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missed.map((r) => (
                    <TableRow key={r.inbound_id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.received_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.from_phone}</TableCell>
                      <TableCell className="text-xs">{r.body}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {r.submission_id ? r.submission_id.slice(0, 8) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

const StatCard = ({
  label, value, tone = "default",
}: { label: string; value: number | undefined; tone?: "default" | "danger" | "ok" }) => {
  const valueClass =
    tone === "danger" && (value ?? 0) > 0
      ? "text-destructive"
      : tone === "ok" && (value ?? 0) === 0
        ? "text-emerald-500"
        : "text-card-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${valueClass}`}>
          {value ?? "—"}
        </div>
      </CardContent>
    </Card>
  );
};

export default SmsOptOutsPanel;
