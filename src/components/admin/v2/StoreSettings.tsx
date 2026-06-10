/**
 * Store Settings hub (Admin V2) — centralizes Branding, Communications,
 * Capture & Inspection, and Pricing Rules into one searchable hub with
 * sub-tabs (objective #7). Each tab mounts the EXISTING editor component
 * unchanged, so all real functionality is preserved — this is chrome +
 * consolidation, not a reimplementation.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import {
  Palette, Phone, FileText, Settings as SettingsIcon, Search, ArrowLeft, ArrowRight,
} from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { cn } from "@/lib/utils";
import { PageShell, Card, SectionLabel, Pill, Loading } from "./theme";

const BrandingHub = lazy(() => import("@/components/admin/BrandingHub"));
const CommunicationsHub = lazy(() => import("@/components/admin/CommunicationsHub"));
const CaptureInspectionHub = lazy(() => import("@/components/admin/CaptureInspectionHub"));
const OfferSettings = lazy(() => import("@/components/admin/OfferSettings"));

type Db = ReturnType<typeof useAdminDashboard>;
type TabKey = "branding" | "communications" | "capture" | "pricing";

const CATEGORIES: {
  key: TabKey; label: string; icon: typeof Palette; desc: string; areas: string[];
}[] = [
  { key: "branding", label: "Branding", icon: Palette, desc: "Logo, colors, identity, appearance and landing pages.", areas: ["Identity", "Logo", "Colors", "Appearance", "Theme", "Landing page", "Header"] },
  { key: "communications", label: "Communications", icon: Phone, desc: "Channels, notification templates, and TCPA / consent compliance.", areas: ["Channels", "SMS", "Email", "Notifications", "Templates", "Compliance", "Consent", "TCPA", "Opt-out"] },
  { key: "capture", label: "Capture & Inspection", icon: FileText, desc: "Lead form, inspection sheet, photo & document requirements, standards.", areas: ["Lead form", "Inspection sheet", "Photos", "Documents", "Standards", "Depth policy"] },
  { key: "pricing", label: "Pricing Rules", icon: SettingsIcon, desc: "Offer logic, approvals, and how cash offers are calculated.", areas: ["Offer logic", "Pricing", "Approvals", "Margins", "Black Book", "Cash offer"] },
];

const StoreSettings = ({ db }: { db: Db }) => {
  const [tab, setTab] = useState<TabKey | null>(null);
  const [search, setSearch] = useState("");

  const showTenantViewLog = db.tenant.dealership_id === "default" && db.canManageAccess;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.areas.some((a) => a.toLowerCase().includes(q)),
    );
  }, [search]);

  const active = CATEGORIES.find((c) => c.key === tab);

  const editor = (k: TabKey) => {
    switch (k) {
      case "branding":
        return <BrandingHub initialTab="identity" userRole={db.userRole} canManageAccess={db.canManageAccess} focusField={undefined} />;
      case "communications":
        return <CommunicationsHub initialTab="channels" canManageChannels={db.canManageAccess} showTenantViewLog={showTenantViewLog} />;
      case "capture":
        return <CaptureInspectionHub initialTab="lead-form" />;
      case "pricing":
        return <OfferSettings userId={db.userId || undefined} userRole={db.userRole} />;
    }
  };

  return (
    <PageShell
      title="Store Settings"
      subtitle="Everything that configures your store — branding, communications, capture and pricing — in one place."
    >
      {/* Sub-tab bar */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
        <button onClick={() => setTab(null)} className={chip(tab === null)}>Overview</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setTab(c.key)} className={cn(chip(tab === c.key), "inline-flex items-center gap-1.5")}>
            <c.icon className="h-4 w-4" /> {c.label}
          </button>
        ))}
      </div>

      {tab === null ? (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA6BC]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings (e.g. logo, SMS, photos, offer)…"
              className="w-full rounded-xl border border-[#E6EAF0] bg-white py-2.5 pl-9 pr-3 text-[13px] text-[#06194A] outline-none focus:border-[#6D28D9]/40"
            />
          </div>

          {/* Category cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((c) => (
              <button
                key={c.key}
                onClick={() => setTab(c.key)}
                className="flex items-start gap-4 rounded-2xl border border-[#E6EAF0] bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#6D28D9]/30 hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#6D28D9]"><c.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[15px] font-bold text-[#06194A]">{c.label}<ArrowRight className="h-3.5 w-3.5 text-[#C9B8F0]" /></div>
                  <p className="mt-1 text-[13px] text-[#53627A]">{c.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.areas.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-md bg-[#F4F6FA] px-2 py-0.5 text-[11px] font-medium text-[#7A879C]">{a}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <Card className="p-8 text-center text-sm text-[#7A879C] sm:col-span-2">No settings match “{search}”.</Card>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button onClick={() => setTab(null)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> All settings
          </button>
          {active && (
            <div className="flex items-center gap-2">
              <SectionLabel>{active.label}</SectionLabel>
              <Pill tone="green">Live</Pill>
            </div>
          )}
          <Suspense fallback={<Loading />}>
            {tab && editor(tab)}
          </Suspense>
        </div>
      )}
    </PageShell>
  );
};

const chip = (active: boolean) =>
  cn("rounded-lg px-3 py-2 text-[13px] font-semibold transition", active ? "bg-[#6D28D9] text-white" : "text-[#53627A] hover:bg-[#F4F6FA]");

export default StoreSettings;
