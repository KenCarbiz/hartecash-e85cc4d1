import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck, Loader2, PhoneOff, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/utils";

interface CallRow {
  id: string;
  phone_number: string | null;
  customer_name: string | null;
  status: string | null;
  outcome: string | null;
  consent_verified: boolean | null;
  tcpa_disclosure_given: boolean | null;
  opt_out_requested: boolean | null;
  recording_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface OptOutRow {
  id: string;
  phone: string | null;
  channel: string | null;
  reason: string | null;
  created_at: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * Voice-AI compliance & TCPA audit log. Surfaces what the system
 * tracked at call-time so a dealer admin can verify (or evidence in
 * an audit) that calls were placed only against verified-consent
 * customers, that disclosures were given, and that opt-outs are
 * honored.
 *
 * Read-only. All data comes from voice_call_log + opt_outs and the
 * page query mirrors the existing scoping (RLS allows admins to see
 * their tenant's rows).
 */
const VoiceComplianceLog = () => {
  const { tenant } = useTenant();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [optOuts, setOptOuts] = useState<OptOutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [callRes, optRes] = await Promise.all([
        (supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (k: string, v: string) => {
                order: (c: string, o: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{ data: CallRow[] | null }>;
                };
              };
            };
          };
        })
          .from("voice_call_log")
          .select(
            "id, phone_number, customer_name, status, outcome, consent_verified, tcpa_disclosure_given, opt_out_requested, recording_url, duration_seconds, created_at, metadata",
          )
          .eq("dealership_id", tenant.dealership_id)
          .order("created_at", { ascending: false })
          .limit(100),
        (supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              order: (c: string, o: { ascending: boolean }) => {
                limit: (n: number) => Promise<{ data: OptOutRow[] | null }>;
              };
            };
          };
        })
          .from("opt_outs")
          .select("id, phone, channel, reason, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      setCalls(callRes.data || []);
      setOptOuts((optRes.data || []).filter((r) => r.channel === "phone" || r.channel === "voice" || r.channel === "all"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blocked = calls.filter((c) => {
    const md = c.metadata as { blocked_reason?: string } | null;
    return !!md?.blocked_reason;
  });
  const completed = calls.filter((c) => !blocked.includes(c));
  const compliantCount = completed.filter(
    (c) => c.consent_verified === true && c.tcpa_disclosure_given !== false,
  ).length;
  const recordedCount = completed.filter((c) => !!c.recording_url).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Voice AI compliance
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Last 100 voice calls. Verifies TCPA consent capture, disclosure delivery, and opt-out enforcement. Read-only — actions live in Voice AI Campaigns.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Calls placed</div>
          <div className="text-2xl font-bold mt-1">{completed.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Consent verified</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">{compliantCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Blocked at gate</div>
          <div className={`text-2xl font-bold mt-1 ${blocked.length > 0 ? "text-amber-600" : ""}`}>{blocked.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recordings on file</div>
          <div className="text-2xl font-bold mt-1">{recordedCount}</div>
        </div>
      </div>

      {/* Blocked attempts */}
      {blocked.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-sm">Blocked at consent gate</h4>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
              {blocked.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Calls that were attempted but refused before placement because no TCPA-qualifying consent was on file. These are evidence the system honored consent rules.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1.5 pr-3 font-medium">Customer</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Phone</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Reason</th>
                  <th className="text-left py-1.5 pr-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map((c) => (
                  <tr key={c.id} className="border-t border-amber-500/20">
                    <td className="py-1.5 pr-3">{c.customer_name || "—"}</td>
                    <td className="py-1.5 pr-3 font-mono">{formatPhone(c.phone_number) || "—"}</td>
                    <td className="py-1.5 pr-3">{(c.metadata as { blocked_reason?: string } | null)?.blocked_reason || "—"}</td>
                    <td className="py-1.5 pr-3">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completed calls */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h4 className="font-bold text-sm">Recent calls</h4>
        </div>
        {completed.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No voice calls in the last 100.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Outcome</th>
                  <th className="text-center px-3 py-2 font-medium">Consent</th>
                  <th className="text-center px-3 py-2 font-medium">Disclosure</th>
                  <th className="text-center px-3 py-2 font-medium">Recording</th>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((c) => (
                  <tr key={c.id} className="border-t border-border/40">
                    <td className="px-3 py-2">{c.customer_name || "—"}</td>
                    <td className="px-3 py-2 font-mono">{formatPhone(c.phone_number) || "—"}</td>
                    <td className="px-3 py-2">{c.status || "—"}</td>
                    <td className="px-3 py-2">
                      {c.outcome ? <span className="text-foreground/80">{c.outcome.replace(/_/g, " ")}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.consent_verified ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.tcpa_disclosure_given ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.recording_url ? (
                        <a
                          href={c.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Listen <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Voice opt-outs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <PhoneOff className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-bold text-sm">Voice opt-outs</h4>
          <Badge variant="outline" className="ml-1">{optOuts.length}</Badge>
        </div>
        {optOuts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No phone-channel opt-outs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Channel</th>
                  <th className="text-left px-3 py-2 font-medium">Reason</th>
                  <th className="text-left px-3 py-2 font-medium">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {optOuts.map((r) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="px-3 py-2 font-mono">{formatPhone(r.phone) || "—"}</td>
                    <td className="px-3 py-2">{r.channel}</td>
                    <td className="px-3 py-2">{r.reason || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceComplianceLog;
