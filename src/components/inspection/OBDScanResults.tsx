import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  BatteryCharging,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Timer,
  Cpu,
  WifiOff,
} from "lucide-react";
import OBDScanButton from "@/components/inspection/OBDScanButton";

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                          */
/* ────────────────────────────────────────────────────────────── */

export interface DtcCode {
  code: string;
  description?: string | null;
  severity?: "info" | "low" | "medium" | "high" | "critical" | null;
  pending?: boolean;
  permanent?: boolean;
}

export interface ReadinessMonitor {
  name: string;
  ready: boolean;
  supported?: boolean;
}

export interface VehicleScan {
  id: string;
  submission_id: string;
  created_at: string;
  mil_on: boolean | null;
  dtc_codes: DtcCode[] | null;
  odometer_km: number | null;
  odometer_miles: number | null;
  reported_odometer_miles: number | null;
  readiness_monitors: ReadinessMonitor[] | null;
  battery_voltage: number | null;
  vin: string | null;
  protocol: string | null;
}

interface OBDScanResultsProps {
  submissionId: string;
  showHistory?: boolean;
}

/* ────────────────────────────────────────────────────────────── */
/*  Optional DTC lookup — falls back to raw code if module absent */
/* ────────────────────────────────────────────────────────────── */

type LookupFn = (code: string) => { description?: string | null; severity?: string | null } | undefined;

// Lazily resolved: Vite's import.meta.glob returns modules found at build
// time. If src/lib/obdDtcCodes.ts exists it will be picked up; otherwise
// `lookupDtc` stays null and we show raw DTC codes with no description.
let lookupDtc: LookupFn | null = null;
try {
  const modules = (import.meta as any).glob?.("/src/lib/obdDtcCodes.ts", { eager: true }) as
    | Record<string, { lookupDtc?: LookupFn }>
    | undefined;
  if (modules) {
    const mod = Object.values(modules)[0];
    lookupDtc = mod?.lookupDtc ?? null;
  }
} catch {
  lookupDtc = null;
}

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                        */
/* ────────────────────────────────────────────────────────────── */

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return sameDay ? `Today at ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${time}`;
  } catch {
    return iso;
  }
}

function severityColor(severity?: string | null): string {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "high":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
    case "medium":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "low":
      return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-500 border-yellow-500/30";
    default:
      return "bg-muted/60 text-muted-foreground border-border";
  }
}

function severityRank(severity?: string | null): number {
  switch ((severity || "").toLowerCase()) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}

function enrichDtc(d: DtcCode): DtcCode {
  if (d.description && d.severity) return d;
  const looked = lookupDtc?.(d.code);
  return {
    ...d,
    description: d.description ?? looked?.description ?? null,
    severity: (d.severity ?? (looked?.severity as DtcCode["severity"])) ?? null,
  };
}

/* ────────────────────────────────────────────────────────────── */
/*  Component                                                      */
/* ────────────────────────────────────────────────────────────── */

export default function OBDScanResults({ submissionId, showHistory = false }: OBDScanResultsProps) {
  const [scan, setScan] = useState<VehicleScan | null>(null);
  const [history, setHistory] = useState<VehicleScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submissionMeta, setSubmissionMeta] = useState<{ token: string; vehicleStr: string } | null>(null);

  const fetchScan = useCallback(async () => {
    if (!submissionId) return;
    try {
      const limit = showHistory ? 10 : 1;
      const { data, error } = await (supabase as any)
        .from("vehicle_scans")
        .select("*")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data || []) as VehicleScan[];
      setScan(rows[0] ?? null);
      setHistory(rows);
    } catch {
      setScan(null);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [submissionId, showHistory]);

  useEffect(() => {
    setLoading(true);
    fetchScan();
  }, [fetchScan]);

  // Fetch minimal submission metadata (token + vehicle string) so the empty
  // state can launch an OBD scan QR without additional props.
  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("submissions")
          .select("token, vehicle_year, vehicle_make, vehicle_model")
          .eq("id", submissionId)
          .maybeSingle();
        if (!cancelled && data) {
          const vehicleStr = `${data.vehicle_year || ""} ${data.vehicle_make || ""} ${data.vehicle_model || ""}`.trim();
          setSubmissionMeta({ token: data.token || submissionId, vehicleStr });
        }
      } catch {
        /* noop */
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  // Realtime subscription — auto-update on new scans
  useEffect(() => {
    if (!submissionId) return;
    const channel = (supabase as any)
      .channel(`vehicle_scans:${submissionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicle_scans",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => {
          fetchScan();
        },
      )
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(channel); } catch { /* noop */ }
    };
  }, [submissionId, fetchScan]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/80 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/40 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (!scan) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-card to-muted/10 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shrink-0">
            <Cpu className="w-7 h-7 text-primary/70" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
              OBD-II Diagnostic Scan
              <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">Premium</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              No scan on file. Plug in the OBDLink MX+ and capture live diagnostics for this vehicle.
            </p>
          </div>
          <div className="shrink-0">
            <OBDScanButton
              submissionId={submissionId}
              submissionToken={submissionMeta?.token || submissionId}
              vehicleStr={submissionMeta?.vehicleStr || ""}
              variant="compact"
              label="Start OBD Scan"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Render full card ── */

  const dtcs: DtcCode[] = Array.isArray(scan.dtc_codes) ? scan.dtc_codes.map(enrichDtc) : [];
  dtcs.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const severityBreakdown = dtcs.reduce<Record<string, number>>((acc, d) => {
    const key = (d.severity || "info").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const milOn = scan.mil_on === true;

  const monitors: ReadinessMonitor[] = Array.isArray(scan.readiness_monitors) ? scan.readiness_monitors : [];
  const supportedMonitors = monitors.filter((m) => m.supported !== false);
  const readyCount = supportedMonitors.filter((m) => m.ready).length;
  const totalMonitors = supportedMonitors.length;

  const obdMiles = scan.odometer_miles ?? (scan.odometer_km ? Math.round(scan.odometer_km * 0.621371) : null);
  const reportedMiles = scan.reported_odometer_miles ?? null;
  const hasOdoCheck = obdMiles != null && reportedMiles != null;
  const odoDiff = hasOdoCheck ? Math.abs(obdMiles - reportedMiles) : 0;
  const odoMatch = hasOdoCheck && odoDiff <= Math.max(50, reportedMiles * 0.005);

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden print:shadow-none">
      {/* ── Gradient header ── */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3.5 border-b border-border/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 shrink-0">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-card-foreground tracking-tight flex items-center gap-2">
              OBD-II Scan
              <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider">Live Diagnostics</Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Timer className="w-3 h-3" />
              {formatDate(scan.created_at)}
              {scan.protocol && <span className="text-muted-foreground/60">· {scan.protocol}</span>}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={() => { setRefreshing(true); fetchScan(); }}
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {/* ── MIL Status (hero) ── */}
        <div
          className={`relative rounded-2xl border-2 p-4 overflow-hidden ${
            milOn
              ? "border-red-500/40 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent"
              : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 ${
                milOn
                  ? "bg-red-500/20 border border-red-500/30 animate-pulse"
                  : "bg-emerald-500/20 border border-emerald-500/30"
              }`}
            >
              {milOn ? (
                <AlertTriangle className="w-7 h-7 text-red-500" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Malfunction Indicator Lamp
              </p>
              <p
                className={`text-xl font-black tracking-tight ${
                  milOn ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {milOn ? "CHECK ENGINE ON" : "NO ACTIVE FAULTS"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {milOn
                  ? `Vehicle is reporting ${dtcs.length} diagnostic trouble code${dtcs.length === 1 ? "" : "s"}.`
                  : "Engine management system is operating within normal parameters."}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatTile
            icon={Wrench}
            label="DTCs"
            value={String(dtcs.length)}
            accent={dtcs.length > 0 ? "warn" : "ok"}
          />
          <StatTile
            icon={ShieldCheck}
            label="Readiness"
            value={totalMonitors > 0 ? `${readyCount}/${totalMonitors}` : "—"}
            accent={totalMonitors > 0 && readyCount === totalMonitors ? "ok" : totalMonitors > 0 ? "warn" : "neutral"}
          />
          <StatTile
            icon={BatteryCharging}
            label="Battery"
            value={scan.battery_voltage != null ? `${scan.battery_voltage.toFixed(1)}V` : "—"}
            accent={
              scan.battery_voltage == null
                ? "neutral"
                : scan.battery_voltage >= 12.4
                ? "ok"
                : scan.battery_voltage >= 11.8
                ? "warn"
                : "bad"
            }
          />
          <StatTile
            icon={Gauge}
            label="Odometer"
            value={obdMiles != null ? `${obdMiles.toLocaleString()}mi` : "—"}
            accent={hasOdoCheck ? (odoMatch ? "ok" : "bad") : "neutral"}
          />
        </div>

        {/* ── DTC severity breakdown ── */}
        {dtcs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Diagnostic Trouble Codes
              </p>
              <div className="flex items-center gap-1.5">
                {Object.entries(severityBreakdown).map(([key, n]) => (
                  <span
                    key={key}
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${severityColor(key)}`}
                  >
                    {n} {key}
                  </span>
                ))}
              </div>
            </div>
            <ul className="space-y-1.5">
              {dtcs.slice(0, 8).map((dtc, i) => (
                <li
                  key={`${dtc.code}-${i}`}
                  className="flex items-start gap-3 px-3 py-2 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-colors"
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    severityRank(dtc.severity) >= 3 ? "bg-red-500" :
                    severityRank(dtc.severity) === 2 ? "bg-amber-500" :
                    severityRank(dtc.severity) === 1 ? "bg-yellow-500" : "bg-muted-foreground/40"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-card-foreground">{dtc.code}</span>
                      {dtc.pending && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">Pending</Badge>
                      )}
                      {dtc.permanent && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">Permanent</Badge>
                      )}
                      {dtc.severity && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityColor(dtc.severity)}`}>
                          {dtc.severity}
                        </span>
                      )}
                    </div>
                    {dtc.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{dtc.description}</p>
                    )}
                  </div>
                </li>
              ))}
              {dtcs.length > 8 && (
                <li className="text-[11px] text-muted-foreground italic pl-5">
                  +{dtcs.length - 8} more code{dtcs.length - 8 === 1 ? "" : "s"}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* ── Odometer verification ── */}
        {hasOdoCheck && (
          <div
            className={`rounded-xl border p-3 ${
              odoMatch
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Gauge className={`w-3.5 h-3.5 ${odoMatch ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} />
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Odometer Verification
              </p>
              {odoMatch ? (
                <Badge className="ml-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] uppercase font-bold">
                  Verified
                </Badge>
              ) : (
                <Badge className="ml-auto bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 text-[9px] uppercase font-bold">
                  Mismatch
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reported</p>
                <p className="font-bold tabular-nums">{reportedMiles?.toLocaleString()} mi</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">OBD Read</p>
                <p className="font-bold tabular-nums">{obdMiles?.toLocaleString()} mi</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Delta</p>
                <p className={`font-bold tabular-nums ${odoMatch ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {odoDiff > 0 ? "±" : ""}{odoDiff.toLocaleString()} mi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Readiness monitors ── */}
        {monitors.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              {readyCount === totalMonitors ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              )}
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Readiness Monitors
              </p>
              <span className="ml-auto text-[10px] font-bold text-card-foreground tabular-nums">
                {readyCount} / {totalMonitors} ready
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {monitors.map((m) => (
                <span
                  key={m.name}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                    m.supported === false
                      ? "bg-muted/40 text-muted-foreground/60 border-border/40 line-through"
                      : m.ready
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  }`}
                >
                  {m.ready && m.supported !== false && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── History (optional) ── */}
        {showHistory && history.length > 1 && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">
              Scan History ({history.length})
            </p>
            <ul className="space-y-1">
              {history.slice(1).map((h) => (
                <li key={h.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {h.mil_on ? (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                    {formatDate(h.created_at)}
                  </span>
                  <span className="tabular-nums">
                    {Array.isArray(h.dtc_codes) ? h.dtc_codes.length : 0} DTC
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {scan.protocol === null && scan.mil_on === null && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-2">
            <WifiOff className="w-3 h-3" />
            Partial scan — some ECU data may be unavailable.
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  StatTile                                                       */
/* ────────────────────────────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: "ok" | "warn" | "bad" | "neutral";
}) {
  const accentStyles = {
    ok: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    bad: "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400",
    neutral: "border-border/60 bg-card/60 text-card-foreground",
  }[accent];
  return (
    <div className={`rounded-xl border p-2.5 ${accentStyles}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 opacity-70" />
        <span className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-80">{label}</span>
      </div>
      <p className="text-base font-black tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
