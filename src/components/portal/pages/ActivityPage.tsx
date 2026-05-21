import { useState } from "react";
import { Car, Tag, MessageCircle, FileText, Truck, CreditCard, CheckCircle2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, StatusPill, PrimaryButton, SecondaryButton } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

const FILTERS = ["All", "Offers", "Documents", "Messages", "Pickup", "Payments"] as const;
type Filter = typeof FILTERS[number];

const TYPE_MAP: Record<string, { Icon: LucideIcon; tint: string; ring: string; cat: Filter }> = {
  submission: { Icon: Car,           tint: "bg-[#EEF0FF] text-[#4F46E5]", ring: "ring-[#C7D2FE]", cat: "All" },
  offer:      { Icon: Tag,           tint: "bg-[#E6F7F1] text-[#0E9F6E]", ring: "ring-[#A7E8CF]", cat: "Offers" },
  messages:   { Icon: MessageCircle, tint: "bg-[#FEF3E2] text-[#F59E0B]", ring: "ring-[#FBD49A]", cat: "Messages" },
  documents:  { Icon: FileText,      tint: "bg-[#EEF0FF] text-[#4F46E5]", ring: "ring-[#C7D2FE]", cat: "Documents" },
  pickup:     { Icon: Truck,         tint: "bg-[#F4F6FA] text-[#53627A]", ring: "ring-[#E6EAF0]", cat: "Pickup" },
  payments:   { Icon: CreditCard,    tint: "bg-[#F4F6FA] text-[#53627A]", ring: "ring-[#E6EAF0]", cat: "Payments" },
};

export const ActivityPage = () => {
  const [filter, setFilter] = useState<Filter>("All");
  const [open, setOpen] = useState<typeof MOCK.activity[number] | null>(null);

  const items = MOCK.activity.filter((a) => {
    if (filter === "All") return true;
    return TYPE_MAP[a.type]?.cat === filter;
  });

  return (
    <PortalPageShell title="Activity" subtitle="Every step of your acquisition in one timeline.">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
              filter === f
                ? "bg-[#4F46E5] text-white shadow-[0_4px_12px_-4px_rgba(79,70,229,0.45)]"
                : "bg-white border border-[#E6EAF0] text-[#53627A] hover:text-[#4F46E5] hover:border-[#4F46E5]/40"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <SectionLabel>Transaction Timeline</SectionLabel>
        <ol className="mt-5 relative">
          <span className="absolute left-[19px] top-1 bottom-1 w-px bg-[#EEF0F4]" aria-hidden />
          {items.map((a) => {
            const cfg = TYPE_MAP[a.type] ?? TYPE_MAP.submission;
            const { Icon } = cfg;
            const pending = a.time === "Pending";
            return (
              <li key={a.id} className="relative pl-12 pb-5 last:pb-0">
                <span className={`absolute left-0 top-0 w-10 h-10 rounded-full grid place-items-center ring-2 ring-white ${cfg.tint}`}>
                  {pending ? <Clock className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" />}
                </span>
                <button onClick={() => setOpen(a)} className="w-full text-left rounded-xl p-3 -ml-1 hover:bg-[#F7F8FB] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#06194A]">{a.title}</div>
                      <div className="text-[12.5px] text-[#53627A] mt-0.5">{a.desc}</div>
                    </div>
                    {pending
                      ? <StatusPill tone="orange">Pending</StatusPill>
                      : <span className="text-[11px] text-[#8893A8] whitespace-nowrap font-medium pt-0.5">{a.time}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </Card>

      <SlideOver open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""} subtitle={open?.time}
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setOpen(null)} className="flex-1">Close</SecondaryButton><PrimaryButton className="flex-1">View Details</PrimaryButton></div>}>
        {open && (
          <>
            <div className="rounded-2xl bg-[#F7F8FB] border border-[#E6EAF0] p-4 inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
              <span className="text-sm font-semibold text-[#06194A]">{open.title}</span>
            </div>
            <p className="text-sm text-[#53627A] mt-4 leading-relaxed">{open.desc}</p>
            <p className="text-[12px] text-[#8893A8] mt-3">Event ID: ACT-{String(open.id).padStart(5, "0")}</p>
          </>
        )}
      </SlideOver>
    </PortalPageShell>
  );
};

export default ActivityPage;
