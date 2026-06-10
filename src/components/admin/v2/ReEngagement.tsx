/**
 * Re-engagement (Admin V2) — returning-customer / saved-offer engine, v1.
 *
 * Operationalizes the deep-dive insight that ~89% of cash-offer deals
 * close AFTER the 7-day offer expiry (64% around week 3): surfaces every
 * outstanding offer bucketed by expiry, with one-click "resume link" and
 * "resend offer" so the dealer can work expiring + recently-expired
 * offers — the warmest re-acquisition targets.
 *
 * Zero-migration: reads existing submissions with an offered price,
 * derives the 7-day expiry client-side, reuses the real customer portal
 * resume link (/my-submission/:token) and the existing send-notification
 * (customer_offer_ready) resend. The deeper engine — verified-identity
 * resume/OTP, an automated 90-day journey, and widget "welcome back" —
 * is the next increment (needs migrations + edge functions / cron).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Copy, Send, Clock, CalendarX, TrendingUp, DollarSign, ExternalLink, Sparkles, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantBaseUrl } from "@/hooks/useTenantBaseUrl";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { getStatusLabel } from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill, StatCard } from "./theme";

type Db = ReturnType<typeof useAdminDashboard>;

const OFFER_WINDOW = 7; // days an offer is "valid"
const REENGAGE_WINDOW = 90; // days an expired offer is still worth chasing

interface OfferRow {
  id: string;
  token: string | null;
  name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  offered_price: number | null;
  progress_status: string;
  status_updated_at: string | null;
  created_at: string;
}

type Bucket = "expiring" | "active" | "expired" | "stale";

const dayMs = 86_400_000;
const offerDate = (r: OfferRow) => new Date(r.status_updated_at || r.created_at);
const daysLeftOf = (r: OfferRow) => Math.floor((offerDate(r).getTime() + OFFER_WINDOW * dayMs - Date.now()) / dayMs);
const bucketOf = (r: OfferRow): Bucket => {
  const d = daysLeftOf(r);
  if (d >= 0 && d <= 3) return "expiring";
  if (d > 3) return "active";
  if (-d <= REENGAGE_WINDOW) return "expired";
  return "stale";
};
const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`);

const ReEngagement = ({ db }: { db: Db }) => {
  const { tenant } = useTenant();
  const tenantBaseUrl = useTenantBaseUrl();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Record<string, "sending" | "sent">>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, token, name, vehicle_year, vehicle_make, vehicle_model, offered_price, progress_status, status_updated_at, created_at")
        .eq("dealership_id", tenant.dealership_id)
        .gt("offered_price", 0)
        .not("progress_status", "in", "(purchase_complete,dead_lead)")
        .order("status_updated_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setRows(((data as unknown) as OfferRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  const groups = useMemo(() => {
    const g: Record<Bucket, OfferRow[]> = { expiring: [], active: [], expired: [], stale: [] };
    for (const r of rows) g[bucketOf(r)].push(r);
    // expired: most-recently-expired first; expiring: soonest first
    g.expired.sort((a, b) => offerDate(b).getTime() - offerDate(a).getTime());
    g.expiring.sort((a, b) => daysLeftOf(a) - daysLeftOf(b));
    return g;
  }, [rows]);

  const kpis = useMemo(() => {
    const pipeline = [...groups.active, ...groups.expiring].reduce((s, r) => s + (r.offered_price || 0), 0);
    return { active: groups.active.length, expiring: groups.expiring.length, expired: groups.expired.length, pipeline };
  }, [groups]);

  const resumeLink = (r: OfferRow) => `${tenantBaseUrl}/my-submission/${r.token}`;
  const copyLink = (r: OfferRow) => {
    navigator.clipboard.writeText(resumeLink(r));
    setCopied(r.id);
    setTimeout(() => setCopied((c) => (c === r.id ? null : c)), 1800);
    db.toast({ title: "Resume link copied" });
  };
  const resend = async (r: OfferRow) => {
    setSending((s) => ({ ...s, [r.id]: "sending" }));
    try {
      const { data, error } = await supabase.functions.invoke<{ error?: string }>("send-notification", {
        body: { trigger_key: "customer_offer_ready", submission_id: r.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSending((s) => ({ ...s, [r.id]: "sent" }));
      db.toast({ title: "Offer link re-sent" });
      setTimeout(() => setSending((s) => { const n = { ...s }; delete n[r.id]; return n; }), 5000);
    } catch (e) {
      setSending((s) => { const n = { ...s }; delete n[r.id]; return n; });
      db.toast({ title: "Couldn't resend", description: (e as Error)?.message, variant: "destructive" });
    }
  };
  const openFile = (r: OfferRow) => {
    const sub = db.submissions.find((s) => s.id === r.id);
    if (sub) db.handleView(sub);
  };

  const SECTIONS: { key: Bucket; label: string; sub: string; tone: "amber" | "red" | "teal" }[] = [
    { key: "expiring", label: "Expiring soon", sub: "Offer still valid — nudge before it lapses", tone: "amber" },
    { key: "expired", label: "Recently expired", sub: "Within 90 days — the warmest re-acquisition window", tone: "red" },
    { key: "active", label: "Active offers", sub: "Plenty of runway left", tone: "teal" },
  ];

  return (
    <PageShell
      title="Re-engagement"
      subtitle="Bring back customers who got an offer — before and after it expires."
    >
      <div className="space-y-4">
        {/* Insight banner */}
        <Card className="flex items-start gap-3 border-0 bg-gradient-to-br from-[#6D28D9] to-[#0D9488] p-5 text-white">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <strong>~89% of cash-offer deals close after the 7-day expiry</strong> (64% around week three).
            An expired offer isn't a dead lead — it's your warmest re-acquisition target. Work the
            <em> Expiring soon</em> and <em>Recently expired</em> lists below.
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Active Offers" value={kpis.active} icon={<TrendingUp className="h-5 w-5" />} tone="teal" />
          <StatCard label="Expiring (≤3 days)" value={kpis.expiring} icon={<Clock className="h-5 w-5" />} tone="amber" />
          <StatCard label="Expired — Buyable" value={kpis.expired} hint="Within 90 days" icon={<CalendarX className="h-5 w-5" />} tone="red" />
          <StatCard label="Open Pipeline" value={money(kpis.pipeline)} hint="Active + expiring offers" icon={<DollarSign className="h-5 w-5" />} tone="green" />
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[#7A879C]">Loading saved offers…</Card>
        ) : (
          SECTIONS.map((sec) => {
            const items = groups[sec.key];
            if (items.length === 0) return null;
            return (
              <Card key={sec.key} className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2"><SectionLabel>{sec.label}</SectionLabel><Pill tone={sec.tone}>{items.length}</Pill></div>
                    <div className="mt-0.5 text-[12px] text-[#7A879C]">{sec.sub}</div>
                  </div>
                </div>
                <div className="divide-y divide-[#F0F2F7] border-t border-[#F0F2F7]">
                  {items.slice(0, 25).map((r) => {
                    const vehicle = [r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
                    const d = daysLeftOf(r);
                    const state = sending[r.id];
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <button onClick={() => openFile(r)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-[13px] font-semibold text-[#06194A]">{r.name || "Customer"}</div>
                          <div className="truncate text-[12px] text-[#7A879C]">{vehicle || "Vehicle"} · {getStatusLabel(r.progress_status)}</div>
                        </button>
                        <span className="text-[13px] font-semibold text-[#0F7A3E]">{r.offered_price ? money(r.offered_price) : "—"}</span>
                        <span className="w-24 text-right text-[12px] font-medium" style={{ color: d < 0 ? "#B91C1C" : d <= 3 ? "#B45309" : "#53627A" }}>
                          {d < 0 ? `Expired ${-d}d` : d === 0 ? "Expires today" : `${d}d left`}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => copyLink(r)} title="Copy resume link" className="inline-flex items-center gap-1 rounded-lg border border-[#E6EAF0] px-2.5 py-1.5 text-[12px] font-semibold text-[#53627A] hover:text-[#6D28D9]">
                            {copied === r.id ? <Check className="h-3.5 w-3.5 text-[#0F7A3E]" /> : <Copy className="h-3.5 w-3.5" />} Link
                          </button>
                          <button onClick={() => resend(r)} disabled={!!state} title="Resend offer email" className="inline-flex items-center gap-1 rounded-lg bg-[#6D28D9] px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-95 disabled:opacity-60">
                            {state === "sent" ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                            {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Resend"}
                          </button>
                          {r.token && (
                            <a href={resumeLink(r)} target="_blank" rel="noreferrer" className="rounded-lg border border-[#E6EAF0] p-1.5 text-[#53627A] hover:text-[#6D28D9]" title="Open customer offer page">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })
        )}

        {!loading && kpis.active + kpis.expiring + kpis.expired === 0 && (
          <Card className="p-10 text-center text-sm text-[#7A879C]">No outstanding offers to re-engage yet.</Card>
        )}

        <p className="px-1 text-[11px] text-[#9AA6BC]">
          Next: verified-identity resume + OTP, an automated 90-day re-engagement journey, and "welcome back" in the
          widget (needs backend). Any marketing SMS/email must run on TCPA/CAN-SPAM consent.
        </p>
      </div>
    </PageShell>
  );
};

export default ReEngagement;
