/**
 * Release Center — V2 surface that replaces the classic "Platform Updates"
 * changelog page for super-admins.
 *
 * Real data: `changelog_entries` table (same query as src/pages/Updates.tsx).
 * Preview-only sections (Roadmap, Adoption) are clearly labelled so we can
 * iterate on real data later without misleading anyone.
 *
 * Wired into AdminDashboardV2 via the `changelog` section key — keeps the
 * existing nav entry and permission gates intact. Authoring controls reuse
 * the existing ChangelogManagement component inside a "Manage entries"
 * dialog so super-admins can still publish without leaving V2.
 */
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  Sparkles, Rocket, Wrench, ShieldCheck, TrendingUp, Search,
  ChevronDown, ChevronRight, Pencil, Compass, BarChart3, Activity,
  Calendar, ExternalLink, type LucideIcon,
} from "lucide-react";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, PageShell, Pill, PrimaryButton, SecondaryButton, SectionLabel, StatCard, V2 } from "./theme";
import { cn } from "@/lib/utils";

const ChangelogManagement = lazy(() => import("@/components/admin/ChangelogManagement"));

interface ChangelogEntry {
  id: string;
  entry_date: string;
  title: string;
  description: string;
  items: string[];
  icon: string;
  tag: "feature" | "improvement" | "fix" | "security" | string;
}

type Tag = "feature" | "improvement" | "fix" | "security";

const TAG_META: Record<Tag, { label: string; tone: "purple" | "teal" | "amber" | "green"; dot: string }> = {
  feature: { label: "New Feature", tone: "purple", dot: "#6D28D9" },
  improvement: { label: "Improvement", tone: "teal", dot: "#0D9488" },
  fix: { label: "Bug Fix", tone: "amber", dot: "#B45309" },
  security: { label: "Security", tone: "green", dot: "#0F7A3E" },
};

const ROADMAP: Array<{ quarter: string; title: string; detail: string; status: "in-progress" | "next" | "research" }> = [
  { quarter: "Q3 2026", title: "AI Chat Copilot — Lead Triage", detail: "Inline assistant on every lead with next-best-action suggestions and one-tap drafted replies.", status: "in-progress" },
  { quarter: "Q3 2026", title: "Lien Payoff Automation", detail: "Direct lender API integrations to auto-pull payoff amounts and good-through dates.", status: "in-progress" },
  { quarter: "Q4 2026", title: "Spanish Translations (Consumer)", detail: "Full ES localisation for /trade, offer, and portal flows. Admin remains English.", status: "next" },
  { quarter: "Q4 2026", title: "Wholesale Marketplace v1", detail: "List passed-on trades directly to vetted wholesale buyers from the appraiser queue.", status: "next" },
  { quarter: "Exploring", title: "Predictive Acquisition Scoring", detail: "Lane-level scoring that forecasts retail gross before the customer arrives.", status: "research" },
];

const ADOPTION_PREVIEW = [
  { feature: "AI Damage Detection", adoption: 0.82, trend: "+12%" },
  { feature: "Voice AI Outreach", adoption: 0.41, trend: "+8%" },
  { feature: "Mobile Inspection PIN", adoption: 0.94, trend: "+3%" },
  { feature: "Slide-to-Accept Offer", adoption: 0.88, trend: "+5%" },
  { feature: "Referral Engine", adoption: 0.27, trend: "+14%" },
];

function getIcon(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>;
  return map[name] || Sparkles;
}

function monthKey(date: string) {
  const d = new Date(date + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function ReleaseCenter({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState<Tag | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    supabase
      .from("changelog_entries")
      .select("id, entry_date, title, description, items, icon, tag")
      .eq("is_active", true)
      .order("entry_date", { ascending: false })
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setEntries((data as ChangelogEntry[]) || []);
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const kpis = useMemo(() => {
    const inMonth = entries.filter((e) => new Date(e.entry_date) >= startOfMonth);
    const last90 = entries.filter((e) => new Date(e.entry_date) >= ninetyDaysAgo);
    return {
      shippedThisMonth: inMonth.length,
      featuresAllTime: entries.filter((e) => e.tag === "feature").length,
      fixes90: last90.filter((e) => e.tag === "fix").length,
      security90: last90.filter((e) => e.tag === "security").length,
    };
  }, [entries]);

  const pulse = useMemo(() => {
    const last90 = entries.filter((e) => new Date(e.entry_date) >= ninetyDaysAgo);
    const total = Math.max(last90.length, 1);
    const counts: Record<Tag, number> = { feature: 0, improvement: 0, fix: 0, security: 0 };
    last90.forEach((e) => { if (e.tag in counts) counts[e.tag as Tag]++; });
    return (Object.keys(counts) as Tag[]).map((k) => ({
      tag: k, count: counts[k], pct: counts[k] / total,
    }));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (tag !== "all" && e.tag !== tag) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q)
        || e.description.toLowerCase().includes(q)
        || (e.items || []).some((i) => i.toLowerCase().includes(q));
    });
  }, [entries, tag, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, ChangelogEntry[]>();
    filtered.forEach((e) => {
      const k = monthKey(e.entry_date);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <PageShell
      title="Release Center"
      subtitle="What we've shipped, what's next, and how the platform is evolving."
      actions={
        <>
          <SecondaryButton onClick={() => window.open("/admin?section=changelog", "_blank")}>
            <ExternalLink className="h-4 w-4" /> Classic view
          </SecondaryButton>
          {isPlatformAdmin && (
            <PrimaryButton onClick={() => setShowManage(true)}>
              <Pencil className="h-4 w-4" /> Manage entries
            </PrimaryButton>
          )}
        </>
      }
    >
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Shipped this month" value={kpis.shippedThisMonth} icon={<Rocket className="h-5 w-5" />} tone="purple" hint={now.toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
        <StatCard label="Features (all time)" value={kpis.featuresAllTime} icon={<Sparkles className="h-5 w-5" />} tone="teal" hint="Cumulative new capability count" />
        <StatCard label="Fixes (90d)" value={kpis.fixes90} icon={<Wrench className="h-5 w-5" />} tone="amber" hint="Resolved issues, last 90 days" />
        <StatCard label="Security updates (90d)" value={kpis.security90} icon={<ShieldCheck className="h-5 w-5" />} tone="green" hint="Hardening + compliance" />
      </div>

      {/* Product Pulse + Roadmap */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel>Product Pulse</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Where engineering time went (last 90 days)</div>
            </div>
            <Activity className="h-5 w-5 text-[#53627A]" />
          </div>
          <div className="space-y-3">
            {pulse.map((p) => {
              const meta = TAG_META[p.tag];
              return (
                <div key={p.tag}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <div className="flex items-center gap-2 font-medium text-[#06194A]">
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </div>
                    <div className="text-[#53627A] tabular-nums">{p.count} · {Math.round(p.pct * 100)}%</div>
                  </div>
                  <div className="h-2 rounded-full bg-[#F4F6FA] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.pct * 100}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ background: meta.dot }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionLabel>Roadmap</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">What we're building next</div>
            </div>
            <Compass className="h-5 w-5 text-[#53627A]" />
          </div>
          <div className="space-y-3">
            {ROADMAP.slice(0, 4).map((r) => (
              <div key={r.title} className="rounded-xl border border-[#E6EAF0] p-3">
                <div className="flex items-center justify-between mb-1">
                  <Pill tone={r.status === "in-progress" ? "purple" : r.status === "next" ? "teal" : "gray"}>
                    {r.status === "in-progress" ? "In progress" : r.status === "next" ? "Next" : "Exploring"}
                  </Pill>
                  <div className="text-[11px] text-[#53627A]">{r.quarter}</div>
                </div>
                <div className="text-[13px] font-semibold text-[#06194A]">{r.title}</div>
                <div className="text-[12px] text-[#53627A] leading-snug mt-0.5">{r.detail}</div>
              </div>
            ))}
            <div className="text-[11px] text-[#53627A] italic pt-1">Preview — roadmap is curated, not live ticket data.</div>
          </div>
        </Card>
      </div>

      {/* Filters + Timeline */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <SectionLabel>Timeline</SectionLabel>
            <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Every release, grouped by month</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#53627A]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search releases…"
                className="h-9 w-56 rounded-xl border border-[#E6EAF0] bg-white pl-8 pr-3 text-[13px] text-[#06194A] placeholder:text-[#53627A] focus:border-[#6D28D9]/40 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
              {(["all", "feature", "improvement", "fix", "security"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition",
                    tag === t ? "bg-[#06194A] text-white" : "text-[#53627A] hover:text-[#06194A]",
                  )}
                >
                  {t === "all" ? "All" : TAG_META[t as Tag].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-[#F4F6FA] animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E6EAF0] p-10 text-center text-[13px] text-[#53627A]">
            No releases match your filters.
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([mkey, items]) => (
              <div key={mkey}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-3.5 w-3.5 text-[#53627A]" />
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#53627A]">
                    {monthLabel(mkey)}
                  </div>
                  <div className="text-[11px] text-[#53627A]">· {items.length} release{items.length === 1 ? "" : "s"}</div>
                  <div className="flex-1 h-px bg-[#E6EAF0]" />
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[#E6EAF0]" />
                  <div className="space-y-2">
                    {items.map((e) => {
                      const meta = TAG_META[(e.tag as Tag)] || TAG_META.feature;
                      const Icon = getIcon(e.icon);
                      const isOpen = !!expanded[e.id];
                      return (
                        <div key={e.id} className="relative">
                          <div
                            className="absolute -left-[14px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-white"
                            style={{ background: meta.dot }}
                          />
                          <button
                            type="button"
                            onClick={() => setExpanded((s) => ({ ...s, [e.id]: !isOpen }))}
                            className={cn(
                              "w-full text-left rounded-xl border border-[#E6EAF0] bg-white px-4 py-3 transition hover:border-[#6D28D9]/40",
                              isOpen && "border-[#6D28D9]/40 shadow-[0_6px_20px_-12px_rgba(15,23,42,0.18)]",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.dot}14`, color: meta.dot }}>
                                <Icon className="h-4.5 w-4.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Pill tone={meta.tone}>{meta.label}</Pill>
                                  <span className="text-[11px] font-mono text-[#53627A]">
                                    {new Date(e.entry_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                                <div className="mt-1 text-[14px] font-semibold text-[#06194A]">{e.title}</div>
                                <div className="text-[12px] text-[#53627A] leading-snug mt-0.5">{e.description}</div>
                              </div>
                              <div className="text-[#53627A] mt-1">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </div>
                            </div>
                            <AnimatePresence initial={false}>
                              {isOpen && e.items?.length > 0 && (
                                <motion.ul
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22 }}
                                  className="overflow-hidden mt-3 ml-12 space-y-1.5"
                                >
                                  {e.items.map((it, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[12px] text-[#06194A]">
                                      <Sparkles className="h-3 w-3 mt-0.5 shrink-0" style={{ color: meta.dot }} />
                                      <span>{it}</span>
                                    </li>
                                  ))}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Adoption preview */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionLabel>Adoption</SectionLabel>
            <div className="mt-1 text-[15px] font-semibold text-[#06194A]">How dealers are using shipped features</div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="gray">Preview</Pill>
            <BarChart3 className="h-5 w-5 text-[#53627A]" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADOPTION_PREVIEW.map((a) => (
            <div key={a.feature} className="rounded-xl border border-[#E6EAF0] p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[13px] font-semibold text-[#06194A]">{a.feature}</div>
                <div className="text-[11px] font-semibold text-[#0F7A3E] flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> {a.trend}
                </div>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[22px] font-bold tabular-nums text-[#06194A]">{Math.round(a.adoption * 100)}%</div>
                <div className="text-[11px] text-[#53627A]">of active rooftops</div>
              </div>
              <div className="h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${a.adoption * 100}%`, background: V2.purple }} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[#53627A] italic mt-4">
          Preview — adoption metrics are illustrative. Live telemetry rolls out alongside the next analytics release.
        </div>
      </Card>

      {/* Authoring drawer (super-admin only) */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage release entries</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<div className="h-40 rounded-xl bg-muted animate-pulse" />}>
            <ChangelogManagement />
          </Suspense>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
