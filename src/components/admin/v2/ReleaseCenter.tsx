/**
 * Release Center (Admin V2) — premium redesign of "Platform Updates".
 *
 * Turns the changelog CRUD table into a Linear/Vercel-style release feed:
 * a KPI row, type filters, an expandable release timeline, and a Product
 * Pulse (recently released + coming-soon roadmap).
 *
 * REAL: everything in the feed + KPIs reads the existing
 * `changelog_entries` table (active entries). Editing is preserved — a
 * platform admin can expand "Manage releases" to use the original
 * ChangelogManagement CRUD inline, so no functionality is removed.
 *
 * PREVIEW ("Soon"): product-area filters, per-release detail pages with
 * screenshots/“who benefits”, the coming-soon roadmap, and adoption
 * metrics — there's no backing data for these yet.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Sparkles, Rocket, Wrench, Shield, ChevronDown, Settings2, Clock, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PageShell, Card, SectionLabel, Pill, StatCard, SecondaryButton } from "./theme";

const ChangelogManagement = lazy(() => import("@/components/admin/ChangelogManagement"));

interface Entry {
  id: string;
  entry_date: string;
  title: string;
  description: string | null;
  items: string[];
  tag: string;
  is_active: boolean;
}

type Tag = "feature" | "improvement" | "fix" | "security";
const TAGS: { value: Tag; label: string; tone: "purple" | "teal" | "amber" | "green"; icon: typeof Rocket }[] = [
  { value: "feature", label: "New Feature", tone: "purple", icon: Rocket },
  { value: "improvement", label: "Improvement", tone: "teal", icon: Sparkles },
  { value: "fix", label: "Bug Fix", tone: "amber", icon: Wrench },
  { value: "security", label: "Security", tone: "green", icon: Shield },
];
const tagMeta = (t: string) => TAGS.find((x) => x.value === t) || TAGS[0];

const fmtDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

const ROADMAP = [
  { label: "Acquisition Center", stage: "In Development", eta: "ETA Q3" },
  { label: "Marketing Hub", stage: "Planned", eta: "ETA Q3" },
  { label: "Manager Scorecards", stage: "Research", eta: "ETA Q4" },
];

const ReleaseCenter = ({ canManage }: { canManage: boolean }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Tag | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [manage, setManage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("changelog_entries")
        .select("id, entry_date, title, description, items, tag, is_active")
        .eq("is_active", true)
        .order("entry_date", { ascending: false });
      if (!cancelled) {
        setEntries(((data as unknown) as Entry[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter((e) => {
      const d = new Date(`${e.entry_date}T00:00:00`);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const by = (t: Tag) => entries.filter((e) => e.tag === t).length;
    return { thisMonth, feature: by("feature"), improvement: by("improvement"), fix: by("fix"), security: by("security") };
  }, [entries]);

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.tag === filter)),
    [entries, filter],
  );

  return (
    <PageShell
      title="Release Center"
      subtitle="What's new in AutoCurb — features, improvements and fixes, shipped continuously."
      actions={
        canManage ? (
          <SecondaryButton onClick={() => setManage((v) => !v)}>
            <Settings2 className="h-4 w-4" /> {manage ? "Hide editor" : "Manage releases"}
          </SecondaryButton>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="This Month" value={kpis.thisMonth} hint="Releases" icon={<Rocket className="h-5 w-5" />} tone="purple" />
          <StatCard label="New Features" value={kpis.feature} icon={<Sparkles className="h-5 w-5" />} tone="purple" onClick={() => setFilter("feature")} />
          <StatCard label="Improvements" value={kpis.improvement} icon={<Sparkles className="h-5 w-5" />} tone="teal" onClick={() => setFilter("improvement")} />
          <StatCard label="Bug Fixes" value={kpis.fix} icon={<Wrench className="h-5 w-5" />} tone="amber" onClick={() => setFilter("fix")} />
          <StatCard label="Security" value={kpis.security} icon={<Shield className="h-5 w-5" />} tone="green" onClick={() => setFilter("security")} />
        </div>

        {/* Manage (preserves the original CRUD) */}
        {manage && canManage && (
          <Card className="p-5">
            <SectionLabel>Manage releases</SectionLabel>
            <div className="mt-3">
              <Suspense fallback={<div className="py-8 text-center text-sm text-[#7A879C]">Loading editor…</div>}>
                <ChangelogManagement />
              </Suspense>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Timeline */}
          <div className="lg:col-span-2">
            {/* Type filters (real). Product-area filters are a later add. */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setFilter("all")} className={chip(filter === "all")}>All</button>
              {TAGS.map((t) => (
                <button key={t.value} onClick={() => setFilter(t.value)} className={chip(filter === t.value)}>{t.label}</button>
              ))}
              <Pill tone="gray">Product areas soon</Pill>
            </div>

            {loading ? (
              <Card className="p-8 text-center text-sm text-[#7A879C]">Loading releases…</Card>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-sm text-[#7A879C]">No releases in this view yet.</Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((e) => {
                  const meta = tagMeta(e.tag);
                  const open = expanded[e.id];
                  const Icon = meta.icon;
                  return (
                    <Card key={e.id} className="overflow-hidden">
                      <div className="flex gap-4 p-5">
                        <div className="flex flex-col items-center">
                          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg(meta.tone))}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="mt-2 w-px flex-1 bg-[#F0F2F7]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AA6BC]">{fmtDate(e.entry_date)}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <h3 className="text-[16px] font-bold text-[#06194A]">{e.title}</h3>
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            {e.items.length > 0 && <span className="text-[12px] text-[#7A879C]">{e.items.length} update{e.items.length === 1 ? "" : "s"}</span>}
                          </div>
                          {e.description && <p className="mt-1.5 text-[13px] text-[#53627A]">{e.description}</p>}
                          {e.items.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {(open ? e.items : e.items.slice(0, 3)).map((it, i) => (
                                <li key={i} className="flex items-start gap-2 text-[13px] text-[#3B4763]">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]" />
                                  {it}
                                </li>
                              ))}
                            </ul>
                          )}
                          {e.items.length > 3 && (
                            <button
                              onClick={() => setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline"
                            >
                              {open ? "Show less" : `View details (${e.items.length - 3} more)`}
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Pulse */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#6D28D9]" />
                <SectionLabel>Product Pulse</SectionLabel>
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-[#9AA6BC]">Recently released</div>
              <div className="mt-2 space-y-1.5">
                {entries.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-[13px] text-[#06194A]">
                    <span className="text-[#0F7A3E]">✓</span> <span className="truncate">{e.title}</span>
                  </div>
                ))}
                {entries.length === 0 && <div className="text-[13px] text-[#9AA6BC]">No releases yet.</div>}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-[#6D28D9]" /><SectionLabel>Coming soon</SectionLabel></div>
                <Pill tone="gray">Roadmap</Pill>
              </div>
              <div className="mt-3 space-y-2.5">
                {ROADMAP.map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-[#06194A]">{r.label}</div>
                      <div className="text-[11px] text-[#9AA6BC]">{r.stage}</div>
                    </div>
                    <Pill tone="purple">{r.eta}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

const chip = (active: boolean) =>
  cn(
    "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
    active ? "bg-[#6D28D9] text-white" : "border border-[#E6EAF0] bg-white text-[#53627A] hover:text-[#6D28D9]",
  );

const iconBg = (tone: "purple" | "teal" | "amber" | "green") =>
  ({
    purple: "bg-[#EEF0FF] text-[#6D28D9]",
    teal: "bg-[#E6FAF7] text-[#0F766E]",
    amber: "bg-[#FEF3E2] text-[#B45309]",
    green: "bg-[#E8F8EE] text-[#0F7A3E]",
  }[tone]);

export default ReleaseCenter;
