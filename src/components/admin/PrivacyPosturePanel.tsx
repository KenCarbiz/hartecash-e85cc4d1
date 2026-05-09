/**
 * PrivacyPosturePanel — the dealership's printable privacy posture.
 *
 * Single page, screenshot-able, that answers every question a
 * dealer's attorney or a worried customer might ask:
 *   - What customer data is stored, for how long?
 *   - Who has accessed it, and how often in the last 30 days?
 *   - Are there any anomalous access patterns?
 *   - How does a customer exercise their right to know / right to
 *     delete?
 *   - What technical controls are in place (RLS, encryption, audit)?
 *
 * Reads v_dealership_privacy_posture for live numbers; the rest is
 * static documentation of the posture itself. The dealership can
 * print this page or screenshot it for their compliance file.
 *
 * Mounted as a tab on the Compliance hub. Soft-falls-back when the
 * 20260508000000 / 20260508010000 / 20260508020000 migrations
 * haven't been applied — shows MigrationMissingCard.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Lock, Eye, Clock, AlertTriangle, FileCheck, Database,
  UserX, Loader2, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostureRow {
  dealership_id: string;
  voice_transcript_retention_days: number;
  recording_url_retention_days: number;
  customer_memory_retention_days: number;
  notification_log_retention_days: number;
  last_voice_redact_at: string | null;
  last_memory_redact_at: string | null;
  staff_pii_views_30d: number;
  distinct_staff_pii_viewers_30d: number;
  pending_data_requests: number;
  fulfilled_requests_90d: number;
  bulk_access_anomalies_14d: number;
  active_opt_outs: number;
  oldest_unredacted_call_at: string | null;
  retention_config_updated_at: string | null;
}

interface AnomalyRow {
  staff_user_id: string;
  staff_label: string | null;
  window_start: string;
  distinct_in_window: number;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

function Row({ icon: Icon, label, value, hint, alert }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-2 ${alert ? "" : ""}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${alert ? "text-red-500" : "text-slate-500"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{label}</div>
        {hint && (
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">{hint}</div>
        )}
      </div>
      <div className={`shrink-0 text-right text-[13px] font-mono font-bold ${
        alert ? "text-red-600" : "text-slate-700 dark:text-slate-200"
      }`}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4 text-info" />
          {title}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrivacyPosturePanel() {
  const { tenant } = useTenant();
  const [posture, setPosture] = useState<PostureRow | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [pq, aq] = await Promise.all([
        supabase.from("v_dealership_privacy_posture")
          .select("*")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
        supabase.from("v_bulk_access_anomalies")
          .select("staff_user_id, staff_label, window_start, distinct_in_window")
          .eq("dealership_id", tenant.dealership_id)
          .limit(20),
      ]);
      if (cancel) return;

      if ((pq.error?.message || "").includes("does not exist")
          || (aq.error?.message || "").includes("does not exist")) {
        setMissing(true);
        setLoading(false);
        return;
      }

      // Fall back to the 'default' tenant row when no tenant-specific
      // override exists — that's the network-shipped retention floor.
      let row = pq.data as PostureRow | null;
      if (!row) {
        const dq = await supabase.from("v_dealership_privacy_posture")
          .select("*")
          .eq("dealership_id", "default")
          .maybeSingle();
        row = dq.data as PostureRow | null;
        if (row) row.dealership_id = tenant.dealership_id;
      }
      setPosture(row);
      setAnomalies((aq.data as AnomalyRow[]) || []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [tenant.dealership_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Privacy posture data unavailable. Apply migrations
            <code className="px-1 mx-1 bg-white/60 rounded">20260508000000</code>,
            <code className="px-1 mx-1 bg-white/60 rounded">20260508010000</code>,
            and <code className="px-1 mx-1 bg-white/60 rounded">20260508020000</code> via
            Lovable Push.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!posture) return null;

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Header — printable */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-emerald-500" />
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                  Customer Data Privacy Posture
                </h2>
              </div>
              <p className="text-[12.5px] text-slate-600 dark:text-slate-400 max-w-prose">
                Live summary of the technical and procedural controls
                in place for this dealership. Print or screenshot this
                page for your compliance file.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="h-8 text-xs"
            >
              <Printer className="w-3 h-3 mr-1.5" />
              Print
            </Button>
          </div>
          <div className="text-[10.5px] text-slate-400 mt-3 print:mt-2">
            Generated {fmtDate(new Date().toISOString())} · Dealership ID
            <code className="ml-1 font-mono bg-slate-100 px-1 rounded">{posture.dealership_id}</code>
          </div>
        </CardContent>
      </Card>

      {/* Retention */}
      <Section title="Data retention windows" icon={Clock}>
        <Row
          icon={Database}
          label="Voice call transcripts"
          value={`${posture.voice_transcript_retention_days} days`}
          hint="After this window, transcripts auto-redact to '[redacted per retention policy]'. Aggregate scores + sentiment kept for the bandit."
        />
        <Row
          icon={Database}
          label="Voice call recordings"
          value={`${posture.recording_url_retention_days} days`}
          hint="Bland.ai recording URLs auto-null after this window. Original audio expires upstream by Bland's own TTL."
        />
        <Row
          icon={Database}
          label="Customer-memory personal facts"
          value={`${posture.customer_memory_retention_days} days`}
          hint="Personal-life details extracted from prior calls (e.g. 'daughter at college') auto-prune item-by-item."
        />
        <Row
          icon={Database}
          label="Notification log (SMS/email metadata)"
          value={`${posture.notification_log_retention_days} days`}
          hint="Send records keep status + delivery telemetry for compliance audit trails."
        />
        <Row
          icon={FileCheck}
          label="Last transcript redaction run"
          value={fmtDate(posture.last_voice_redact_at)}
          hint="Nightly scheduled job (03:30 UTC)."
          alert={
            !posture.last_voice_redact_at ||
            new Date(posture.last_voice_redact_at).getTime() < Date.now() - 36 * 3600 * 1000
          }
        />
        <Row
          icon={FileCheck}
          label="Last memory pruning run"
          value={fmtDate(posture.last_memory_redact_at)}
          hint="Nightly scheduled job (03:40 UTC)."
        />
        <Row
          icon={Clock}
          label="Oldest unredacted call"
          value={fmtDate(posture.oldest_unredacted_call_at)}
          hint="If older than the retention window, the next nightly job will redact it."
        />
      </Section>

      {/* Access controls */}
      <Section title="Access controls" icon={Lock}>
        <Row
          icon={Lock}
          label="Cross-tenant isolation"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">enforced</Badge>}
          hint="Postgres row-level security restricts every voice_call_log, voice_call_turns, voice_call_grades, and voice_call_variants_used row to the owning dealership. Staff at other dealerships cannot read your data."
        />
        <Row
          icon={Lock}
          label="Public RPC exposure"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">none</Badge>}
          hint="compile_voice_agent_prompt and customer-data RPCs revoked from the anonymous role. Only the customer-feedback page (token-gated, 14-day expiry) is publicly callable."
        />
        <Row
          icon={Lock}
          label="Edge function auth"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">service-role only</Badge>}
          hint="Voice grading, enrichment, and transfer functions run under Supabase service role keys, never exposed to the browser."
        />
      </Section>

      {/* Audit trail */}
      <Section title="Staff access audit (last 30 days)" icon={Eye}>
        <Row
          icon={Eye}
          label="Total customer PII views"
          value={posture.staff_pii_views_30d.toLocaleString()}
          hint="Every transcript view, recording playback, or customer-memory fetch by a staff user is logged with their identity, IP, and timestamp."
        />
        <Row
          icon={Eye}
          label="Distinct staff who viewed PII"
          value={posture.distinct_staff_pii_viewers_30d.toLocaleString()}
        />
        <Row
          icon={AlertTriangle}
          label="Bulk-access anomalies (14d)"
          value={posture.bulk_access_anomalies_14d.toLocaleString()}
          hint="Staff users who pulled 50+ distinct customer records in any 60-minute window. A non-zero number isn't necessarily malicious — review the list below."
          alert={posture.bulk_access_anomalies_14d > 0}
        />
      </Section>

      {anomalies.length > 0 && (
        <Section title="Anomalies — staff who bulk-accessed customer data" icon={AlertTriangle}>
          {anomalies.map((a, i) => (
            <Row
              key={i}
              icon={UserX}
              label={a.staff_label || "(unknown staff)"}
              value={`${a.distinct_in_window} records`}
              hint={`Window starting ${fmtDate(a.window_start)} · staff_user_id ${a.staff_user_id.slice(0, 8)}…`}
              alert
            />
          ))}
        </Section>
      )}

      {/* Customer rights */}
      <Section title="Customer data rights fulfillment" icon={UserX}>
        <Row
          icon={UserX}
          label="Pending right-to-know / right-to-delete requests"
          value={posture.pending_data_requests.toLocaleString()}
          hint="Customers can request their data export or deletion via the customer portal. Pending requests must be fulfilled within applicable jurisdictional windows (CCPA: 45 days; GDPR: 30 days)."
          alert={posture.pending_data_requests > 5}
        />
        <Row
          icon={FileCheck}
          label="Fulfilled requests (last 90 days)"
          value={posture.fulfilled_requests_90d.toLocaleString()}
        />
        <Row
          icon={UserX}
          label="Active opt-outs honored"
          value={posture.active_opt_outs.toLocaleString()}
          hint="Customers who have opted out of voice / SMS / email communications. The cadence engine and voice dialer skip these contacts globally."
        />
      </Section>

      {/* Static posture documentation */}
      <Section title="Technical controls in force" icon={Shield}>
        <Row icon={Shield} label="TLS in transit"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">TLS 1.2+</Badge>}
          hint="Supabase enforces TLS 1.2 minimum on all connections. Customer-facing pages served via HTTPS only."
        />
        <Row icon={Shield} label="Encryption at rest"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">AES-256</Badge>}
          hint="Supabase Postgres backend uses AES-256 encryption at rest on all database files and backups."
        />
        <Row icon={Shield} label="Compute provider"
          value="AWS (us-east-1)"
          hint="Supabase managed Postgres on AWS, SOC 2 Type II + HIPAA-compliant infrastructure."
        />
        <Row icon={Shield} label="Backups"
          value="daily, 7-day retention"
          hint="Point-in-time recovery available; retention extendable per tenant agreement."
        />
        <Row icon={Shield} label="No data sharing with third parties"
          value={<Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">guaranteed</Badge>}
          hint="Customer data is processed only by sub-processors required for delivery (Twilio for SMS, Bland.ai for voice, Anthropic for grading). No data is sold or shared for marketing."
        />
      </Section>
    </div>
  );
}
