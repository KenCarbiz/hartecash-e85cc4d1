/**
 * Dealer Network (Admin V2) — premium redesign of "Dealer Tenants".
 *
 * A platform-admin operations center: network KPIs, pill filters, a clean
 * one-row-per-dealer list with a derived health score, a right-hand
 * operations sidebar (Needs Attention + Recent Activity), and a dealer
 * detail slide-over.
 *
 * REAL: the `tenants` list, per-dealer leads-this-month / vehicles-
 * acquired / last-activity (aggregated from `submissions`), and the
 * cross-network recent-activity feed. Health + status are DERIVED from
 * real signals (domain connected, activity recency, lead volume) — the
 * health model the spec asks for, scored on what we can actually
 * measure. The full add/edit/delete CRUD is preserved via the "Manage
 * dealers" toggle, which mounts the original TenantManagement.
 *
 * PREVIEW ("Soon"): SSL/integration status chips, impersonate, and
 * branding-completion — no backing signal yet.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Building2, CircleCheck, UserPlus, UserMinus, Activity as ActivityIcon,
  Globe, Settings2, BarChart3, X, ExternalLink, Rocket, AlertTriangle, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton, SecondaryButton, Loading } from "./theme";

const TenantManagement = lazy(() => import("@/components/admin/TenantManagement"));

interface Tenant {
  id: string;
  dealership_id: string;
  display_name: string;
  custom_domain: string | null;
  subdomain_label: string | null;
  parent_domain: string | null;
  created_at: string;
}
type Metrics = { leads: number; acquired: number; lastActivity: string | null };
type Status = "live" | "onboarding" | "pending" | "inactive";

const STATUS_META: Record<Status, { label: string; tone: "green" | "purple" | "amber" | "gray" }> = {
  live: { label: "Live", tone: "green" },
  onboarding: { label: "Onboarding", tone: "purple" },
  pending: { label: "Pending", tone: "amber" },
  inactive: { label: "Inactive", tone: "gray" },
};

const daysSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity);
const relTime = (iso: string | null) => {
  if (!iso) return "No activity";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
};

/** Derived health from measurable signals. */
const healthOf = (t: Tenant, m: Metrics): number => {
  let score = 0;
  if (t.custom_domain || (t.subdomain_label && t.parent_domain)) score += 30; // domain connected
  const d = daysSince(m.lastActivity);
  if (d <= 7) score += 35;
  else if (d <= 30) score += 22;
  else if (d <= 60) score += 8;
  if (m.leads > 0) score += 20;
  if (m.acquired > 0) score += 15;
  return Math.min(100, score);
};
const statusOf = (t: Tenant, m: Metrics): Status => {
  const hasDomain = !!(t.custom_domain || (t.subdomain_label && t.parent_domain));
  const d = daysSince(m.lastActivity);
  const ageDays = daysSince(t.created_at);
  if (d > 45) return "inactive";
  if (hasDomain && d <= 14) return "live";
  if (ageDays <= 30 && (!hasDomain || d > 14)) return "onboarding";
  return "pending";
};
const healthLabel = (h: number) => (h >= 80 ? "Healthy" : h >= 50 ? "Needs work" : h >= 30 ? "Needs attention" : "Critical");
const healthColor = (h: number) => (h >= 80 ? "#0F7A3E" : h >= 50 ? "#B45309" : h >= 30 ? "#EA580C" : "#B91C1C");

const HealthRing = ({ value, size = 44 }: { value: number; size?: number }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const color = healthColor(value);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F2F7" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{value}%</text>
    </svg>
  );
};

const initials = (name: string) => name.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
const tenantDomain = (t: Tenant) => t.custom_domain || (t.subdomain_label && t.parent_domain ? `${t.subdomain_label}.${t.parent_domain}` : null);

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "onboarding", label: "Onboarding" },
  { key: "pending", label: "Pending" },
  { key: "inactive", label: "Inactive" },
  { key: "attention", label: "Needs Attention" },
];

const DealerNetwork = ({
  onSetupDealer,
  onNavigate,
}: {
  onSetupDealer: (dealershipId: string, displayName: string) => void;
  onNavigate: (key: string) => void;
}) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Record<string, Metrics>>({});
  const [recent, setRecent] = useState<{ id: string; name: string; dealer: string; at: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
      const ts = (data || []) as Tenant[];
      if (cancelled) return;
      setTenants(ts);
      setLoading(false);

      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();
      const nameById = new Map(ts.map((t) => [t.dealership_id, t.display_name]));

      const results = await Promise.all(
        ts.map(async (t) => {
          const [leadsR, acqR, lastR] = await Promise.all([
            supabase.from("submissions").select("id", { count: "exact", head: true }).eq("dealership_id", t.dealership_id).gte("created_at", iso),
            supabase.from("submissions").select("id", { count: "exact", head: true }).eq("dealership_id", t.dealership_id).eq("progress_status", "purchase_complete"),
            supabase.from("submissions").select("created_at").eq("dealership_id", t.dealership_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          ]);
          return [t.dealership_id, { leads: leadsR.count || 0, acquired: acqR.count || 0, lastActivity: (lastR.data as { created_at?: string } | null)?.created_at || null }] as const;
        }),
      );
      if (cancelled) return;
      setMetrics(Object.fromEntries(results));

      const { data: rec } = await supabase
        .from("submissions")
        .select("id, name, dealership_id, created_at, progress_status")
        .order("created_at", { ascending: false })
        .limit(10);
      if (cancelled) return;
      setRecent(((rec as { id: string; name: string | null; dealership_id: string; created_at: string; progress_status: string }[]) || []).map((r) => ({
        id: r.id, name: r.name || "New lead", dealer: nameById.get(r.dealership_id) || r.dealership_id, at: r.created_at, status: r.progress_status,
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    return tenants.map((t) => {
      const m = metrics[t.dealership_id] || { leads: 0, acquired: 0, lastActivity: null };
      const health = healthOf(t, m);
      return { t, m, health, status: statusOf(t, m) };
    });
  }, [tenants, metrics]);

  const counts = useMemo(() => {
    const c = { total: rows.length, live: 0, onboarding: 0, pending: 0, inactive: 0, healthAvg: 0 };
    let hsum = 0;
    for (const r of rows) { c[r.status] += 1; hsum += r.health; }
    c.healthAvg = rows.length ? Math.round(hsum / rows.length) : 0;
    return c;
  }, [rows]);

  const needsAttention = useMemo(() => rows.filter((r) => r.health < 50 || r.status === "inactive").slice(0, 5), [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter === "attention") r = r.filter((x) => x.health < 50 || x.status === "inactive");
    else if (filter !== "all") r = r.filter((x) => x.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((x) => x.t.display_name.toLowerCase().includes(q) || (tenantDomain(x.t) || "").toLowerCase().includes(q) || x.t.dealership_id.toLowerCase().includes(q));
    }
    return r;
  }, [rows, filter, search]);

  return (
    <PageShell
      title="Dealer Network"
      subtitle="Manage dealership organizations and monitor network health across the AutoCurb platform."
      actions={
        <>
          <SecondaryButton onClick={() => setManage((v) => !v)}>
            <Settings2 className="h-4 w-4" /> {manage ? "Hide manager" : "Manage dealers"}
          </SecondaryButton>
          <PrimaryButton onClick={() => setManage(true)}>
            <Plus className="h-4 w-4" /> Add Dealer
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Dealers" value={counts.total} icon={<Building2 className="h-5 w-5" />} tone="purple" />
          <StatCard label="Active Dealers" value={counts.live} icon={<CircleCheck className="h-5 w-5" />} tone="green" />
          <StatCard label="Onboarding" value={counts.onboarding} icon={<UserPlus className="h-5 w-5" />} tone="amber" />
          <StatCard label="Inactive" value={counts.inactive} icon={<UserMinus className="h-5 w-5" />} tone="gray" />
          <StatCard label="Network Health" value={`${counts.healthAvg}%`} hint={healthLabel(counts.healthAvg)} icon={<ActivityIcon className="h-5 w-5" />} tone="teal" />
        </div>

        {manage && (
          <Card className="p-5">
            <SectionLabel>Manage dealers</SectionLabel>
            <div className="mt-3">
              <Suspense fallback={<Loading label="Loading manager…" />}>
                <TenantManagement onSetupDealer={(id) => onSetupDealer(id, tenants.find((t) => t.dealership_id === id)?.display_name || id)} />
              </Suspense>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* List */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA6BC]" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dealers…"
                  className="w-full rounded-xl border border-[#E6EAF0] bg-white py-2 pl-9 pr-3 text-[13px] text-[#06194A] outline-none focus:border-[#6D28D9]/40"
                />
              </div>
              {FILTERS.map((f) => {
                const n = f.key === "all" ? rows.length : f.key === "attention" ? needsAttention.length : counts[f.key as "live" | "onboarding" | "pending" | "inactive"];
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", filter === f.key ? "bg-[#6D28D9] text-white" : "border border-[#E6EAF0] bg-white text-[#53627A] hover:text-[#6D28D9]")}>
                    {f.label} {n != null && <span className="opacity-70">({n})</span>}
                  </button>
                );
              })}
            </div>

            <Card className="overflow-hidden">
              <div className="hidden grid-cols-[2fr_1fr_1.1fr_1.1fr_0.9fr] gap-3 border-b border-[#F0F2F7] bg-[#FAFBFD] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#9AA6BC] lg:grid">
                <span>Dealer</span><span>Status</span><span>Health</span><span>Key metrics</span><span className="text-right">Activity</span>
              </div>
              {loading ? (
                <Loading label="Loading dealer network…" className="px-5" />
              ) : filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#7A879C]">No dealers match this view.</div>
              ) : (
                <div className="divide-y divide-[#F0F2F7]">
                  {filtered.map(({ t, m, health, status }) => {
                    const sm = STATUS_META[status];
                    return (
                      <button key={t.id} onClick={() => setSelected(t)} className="grid w-full grid-cols-1 gap-3 px-5 py-4 text-left transition hover:bg-[#F8FAFC] lg:grid-cols-[2fr_1fr_1.1fr_1.1fr_0.9fr] lg:items-center">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-[13px] font-bold text-white">{initials(t.display_name)}</span>
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold text-[#06194A]">{t.display_name}</div>
                            <div className="truncate text-[12px] text-[#7A879C]">{tenantDomain(t) || t.dealership_id}</div>
                          </div>
                        </div>
                        <div><Pill tone={sm.tone}>{sm.label}</Pill></div>
                        <div className="flex items-center gap-2"><HealthRing value={health} /><span className="text-[12px] font-medium" style={{ color: healthColor(health) }}>{healthLabel(health)}</span></div>
                        <div className="text-[13px]"><div className="font-semibold text-[#06194A]">{m.leads} <span className="font-normal text-[#7A879C]">leads</span></div><div className="text-[#53627A]">{m.acquired} acquired</div></div>
                        <div className="flex items-center justify-between lg:justify-end lg:text-right"><span className="text-[12px] text-[#7A879C]">{relTime(m.lastActivity)}</span></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Operations sidebar */}
          <div className="space-y-4">
            <Card className="p-5">
              <SectionLabel>Needs attention</SectionLabel>
              <div className="mt-3 space-y-2">
                {needsAttention.length === 0 && <p className="text-[13px] text-[#9AA6BC]">All dealers healthy. 🎉</p>}
                {needsAttention.map(({ t, health, status }) => (
                  <button key={t.id} onClick={() => setSelected(t)} className="flex w-full items-center gap-2.5 rounded-xl border border-[#F0F2F7] px-3 py-2.5 text-left transition hover:border-[#6D28D9]/30">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${healthColor(health)}1a`, color: healthColor(health) }}>
                      {status === "inactive" ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[#06194A]">{t.display_name}</div><div className="truncate text-[11px] text-[#7A879C]">{tenantDomain(t) ? healthLabel(health) : "Domain not connected"}</div></div>
                    <Pill tone="amber">Action</Pill>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel>Recent activity</SectionLabel>
              <div className="mt-3 space-y-3">
                {recent.length === 0 && <p className="text-[13px] text-[#9AA6BC]">No recent activity.</p>}
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3F0FF] text-[#6D28D9]"><ActivityIcon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-[#06194A]">{r.dealer}</div><div className="truncate text-[11px] text-[#7A879C]">{r.name}</div></div>
                    <span className="shrink-0 text-[11px] text-[#9AA6BC]">{relTime(r.at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <DealerDrawer
          tenant={selected}
          metrics={metrics[selected.dealership_id] || { leads: 0, acquired: 0, lastActivity: null }}
          onClose={() => setSelected(null)}
          onSetup={() => { onSetupDealer(selected.dealership_id, selected.display_name); setSelected(null); }}
          onManage={() => { setManage(true); setSelected(null); }}
          onAnalytics={() => { onNavigate("analytics-v2"); setSelected(null); }}
        />
      )}
    </PageShell>
  );
};

const DealerDrawer = ({
  tenant, metrics, onClose, onSetup, onManage, onAnalytics,
}: {
  tenant: Tenant; metrics: Metrics; onClose: () => void; onSetup: () => void; onManage: () => void; onAnalytics: () => void;
}) => {
  const health = healthOf(tenant, metrics);
  const status = statusOf(tenant, metrics);
  const domain = tenantDomain(tenant);
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-[#06194A]/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-auto bg-[#F4F6FA] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E6EAF0] bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-[13px] font-bold text-white">{initials(tenant.display_name)}</span>
            <div><div className="text-[15px] font-bold text-[#06194A]">{tenant.display_name}</div><div className="text-[12px] text-[#7A879C]">{tenant.dealership_id}</div></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#7A879C] hover:bg-[#F4F6FA]"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          <Card className="flex items-center gap-4 p-5">
            <HealthRing value={health} size={64} />
            <div><div className="text-[13px] font-semibold" style={{ color: healthColor(health) }}>{healthLabel(health)}</div><div className="mt-0.5"><Pill tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Pill></div></div>
          </Card>

          <Card className="p-5">
            <SectionLabel>Organization</SectionLabel>
            <div className="mt-3 space-y-2.5 text-[13px]">
              <Row label="Domain" value={domain || "Not connected"} ok={!!domain} link={domain ? `https://${domain}` : undefined} />
              <Row label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
              <Row label="SSL" value="—" soon />
              <Row label="Branding" value="—" soon />
            </div>
          </Card>

          <Card className="p-5">
            <SectionLabel>Usage snapshot</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Snap label="Leads (mo)" value={metrics.leads} />
              <Snap label="Acquired" value={metrics.acquired} />
              <Snap label="Last active" value={relTime(metrics.lastActivity)} small />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionLabel>Integrations</SectionLabel><Pill tone="gray">Soon</Pill></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["Twilio", "Email", "Black Book", "Google Reviews", "AI Voice"].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#F0F2F7] px-3 py-2 text-[12px] text-[#53627A]"><span>{i}</span><span className="h-2 w-2 rounded-full bg-[#D7DCE5]" /></div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {domain && <a href={`https://${domain}`} target="_blank" rel="noreferrer"><SecondaryButton className="w-full"><ExternalLink className="h-4 w-4" /> Open site</SecondaryButton></a>}
            <SecondaryButton className="w-full" onClick={onAnalytics}><BarChart3 className="h-4 w-4" /> Analytics</SecondaryButton>
            <SecondaryButton className="w-full" onClick={onSetup}><Rocket className="h-4 w-4" /> Setup / Onboard</SecondaryButton>
            <PrimaryButton className="w-full" onClick={onManage}><Settings2 className="h-4 w-4" /> Manage</PrimaryButton>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-[#9AA6BC]"><Globe className="h-3.5 w-3.5" /> Impersonate &amp; disable arrive with the manager controls.</p>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, ok, soon, link }: { label: string; value: string; ok?: boolean; soon?: boolean; link?: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-[#9AA6BC]">{label}</span>
    {link ? (
      <a href={link} target="_blank" rel="noreferrer" className="font-medium text-[#6D28D9] hover:underline">{value}</a>
    ) : (
      <span className={cn("font-medium", ok ? "text-[#0F7A3E]" : soon ? "text-[#C2CAD8]" : "text-[#06194A]")}>{value}{soon && " (soon)"}</span>
    )}
  </div>
);
const Snap = ({ label, value, small }: { label: string; value: string | number; small?: boolean }) => (
  <div className="rounded-xl bg-[#F8FAFC] p-3 text-center">
    <div className={cn("font-bold text-[#06194A]", small ? "text-[12px]" : "text-[20px]")}>{value}</div>
    <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[#9AA6BC]">{label}</div>
  </div>
);

export default DealerNetwork;
