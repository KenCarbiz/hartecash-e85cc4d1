import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Car, Tag, MessageCircle, FileText, Truck, CreditCard, CheckCircle2, Clock,
  ArrowRight, Zap, Sparkles, Lightbulb, ShieldCheck, CalendarDays, PhoneCall,
  ChevronRight, Activity as ActivityIcon, Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fmt, PORTAL_MOCK } from "../portalMock";
import { usePortalData } from "../PortalDataContext";
import {
  PortalPageShell, Card, SectionLabel, StatusPill, PrimaryButton, SecondaryButton,
} from "../PortalPageShell";
import { SlideOver } from "../SlideOver";
import type { NavKey } from "../PortalSidebar";

/* ActivityPage — premium live transaction tracking.
   Progress header + smart guidance + interactive timeline
   with contextual drawers and workflow cards. */

type NavTarget = Extract<NavKey, "offers" | "documents" | "messages" | "pickup" | "payments" | "vehicles">;
type Props = { onNavigate?: (k: NavTarget) => void };

const FILTERS = ["All", "Offers", "Documents", "Messages", "Pickup", "Payments"] as const;
type Filter = typeof FILTERS[number];

type ActivityItem = (typeof PORTAL_MOCK.activity)[number];

const TYPE_MAP: Record<string, {
  Icon: LucideIcon; tint: string; ring: string; cat: Filter;
  /* humanized description that overrides the mock copy when present */
  rich?: string;
  nav?: NavTarget;
}> = {
  submission: {
    Icon: Car, tint: "bg-[#EEF0FF] text-[#4F46E5]", ring: "ring-[#C7D2FE]", cat: "All",
    rich: "Your vehicle details were sent to your acquisition specialist for review.",
    nav: "vehicles",
  },
  offer: {
    Icon: Tag, tint: "bg-[#E6F7F1] text-[#0E9F6E]", ring: "ring-[#A7E8CF]", cat: "Offers",
    rich: "Your valuation was calculated using local market demand, condition analysis, and regional resale data.",
    nav: "offers",
  },
  messages: {
    Icon: MessageCircle, tint: "bg-[#FEF3E2] text-[#B45309]", ring: "ring-[#FBD49A]", cat: "Messages",
    rich: "Your acquisition specialist sent a message about your vehicle.",
    nav: "messages",
  },
  documents: {
    Icon: FileText, tint: "bg-[#EEF0FF] text-[#4F46E5]", ring: "ring-[#C7D2FE]", cat: "Documents",
    rich: "Your title and registration are currently under review by the dealership.",
    nav: "documents",
  },
  pickup: {
    Icon: Truck, tint: "bg-[#F4F6FA] text-[#53627A]", ring: "ring-[#E6EAF0]", cat: "Pickup",
    rich: "Schedule a pickup window once you've accepted your firm offer.",
    nav: "pickup",
  },
  payments: {
    Icon: CreditCard, tint: "bg-[#F4F6FA] text-[#53627A]", ring: "ring-[#E6EAF0]", cat: "Payments",
    rich: "Payment will release automatically after pickup is confirmed by your dealer.",
    nav: "payments",
  },
};

/* ────────────────────────────────────────────────────────────────
   Progress header
   ──────────────────────────────────────────────────────────────── */

type MilestoneState = "done" | "pending" | "future";
const MILESTONES: { key: string; label: string; state: MilestoneState }[] = [
  { key: "offer",     label: "Offer Generated",    state: "done" },
  { key: "documents", label: "Documents Uploaded", state: "done" },
  { key: "pickup",    label: "Pickup",             state: "pending" },
  { key: "payment",   label: "Payment",            state: "future" },
];

const milestoneTone: Record<MilestoneState, { dot: string; text: string; chip: string; Icon: LucideIcon }> = {
  done:    { dot: "bg-[#16A34A]",    text: "text-[#06194A]", chip: "bg-[#E8F8EE] text-[#0F7A3E]", Icon: CheckCircle2 },
  pending: { dot: "bg-[#F59E0B]",    text: "text-[#06194A]", chip: "bg-[#FEF3E2] text-[#B45309]", Icon: Clock },
  future:  { dot: "bg-[#CBD5E1]",    text: "text-[#8893A8]", chip: "bg-[#F4F6FA] text-[#8893A8]", Icon: Circle },
};

const ProgressHeader = ({ percent }: { percent: number }) => (
  <Card className="p-5 sm:p-6 mb-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <SectionLabel>Vehicle Acquisition Progress</SectionLabel>
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#06194A] mt-1">
          You're <span className="text-[#4F46E5]">{percent}% complete</span>
        </h2>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#EEF0FF] text-[#4F46E5]">
        <ActivityIcon className="w-3.5 h-3.5" /> Live tracking
      </span>
    </div>

    {/* Progress bar */}
    <div className="mt-4 h-2.5 rounded-full bg-[#F4F6FA] overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${percent}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="h-full bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#7C3AED] rounded-full shadow-[0_0_12px_rgba(79,70,229,0.5)]"
      />
    </div>

    {/* Milestones */}
    <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
      {MILESTONES.map((m, i) => {
        const t = milestoneTone[m.state];
        return (
          <motion.li
            key={m.key}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 + i * 0.07 }}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAFBFE] border border-[#EEF0F4]"
          >
            <span className={`relative w-7 h-7 rounded-lg grid place-items-center ${t.chip}`}>
              <t.Icon className="w-3.5 h-3.5" />
              {m.state === "pending" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${t.dot}`} />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${t.dot}`} />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <div className={`text-[12.5px] font-semibold truncate ${t.text}`}>{m.label}</div>
              <div className="text-[10.5px] uppercase tracking-wide font-semibold text-[#8893A8]">
                {m.state === "done" ? "Complete" : m.state === "pending" ? "In progress" : "Up next"}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  </Card>
);

/* ────────────────────────────────────────────────────────────────
   Smart guidance banner
   ──────────────────────────────────────────────────────────────── */

const SmartGuidanceBanner = ({
  tone, Icon, title, description, ctaLabel, onCta,
}: { tone: "indigo" | "orange" | "green"; Icon: LucideIcon; title: string; description: string; ctaLabel: string; onCta: () => void }) => {
  const tones = {
    indigo: { bg: "from-[#EEF0FF] to-white", border: "border-[#C7D2FE]", icon: "bg-white text-[#4F46E5]", btn: "bg-[#4F46E5] hover:bg-[#4338CA] text-white" },
    orange: { bg: "from-[#FEF3E2] to-white", border: "border-[#FCD9A8]", icon: "bg-white text-[#B45309]", btn: "bg-[#B45309] hover:bg-[#92400E] text-white" },
    green:  { bg: "from-[#E8F8EE] to-white", border: "border-[#BBE5C6]", icon: "bg-white text-[#0F7A3E]", btn: "bg-[#0F7A3E] hover:bg-[#0B5C2F] text-white" },
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className={`mb-5 rounded-2xl border ${tones.border} bg-gradient-to-r ${tones.bg} p-3.5 sm:p-4 flex items-start sm:items-center gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${tones.icon} shadow-sm`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-[#06194A]">{title}</div>
        <div className="text-[12px] text-[#53627A] mt-0.5">{description}</div>
      </div>
      <button
        onClick={onCta}
        className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3.5 py-2 rounded-xl transition ${tones.btn}`}
      >
        {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

/* ────────────────────────────────────────────────────────────────
   Insight chip strip
   ──────────────────────────────────────────────────────────────── */

const InsightChip = ({ Icon, text }: { Icon: LucideIcon; text: string }) => (
  <div className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#53627A] bg-white border border-[#E6EAF0] px-2.5 py-1.5 rounded-full">
    <Icon className="w-3.5 h-3.5 text-[#4F46E5]" /> {text}
  </div>
);

/* ────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────── */

export const ActivityPage = ({ onNavigate }: Props) => {
  const MOCK = usePortalData();
  const [filter, setFilter] = useState<Filter>("All");
  const [open, setOpen] = useState<ActivityItem | null>(null);

  /* Filter counts shown inside chips */
  const counts = useMemo(() => {
    const map: Partial<Record<Filter, number>> = { All: MOCK.activity.length };
    for (const a of MOCK.activity) {
      const cat = TYPE_MAP[a.type]?.cat;
      if (cat && cat !== "All") map[cat] = (map[cat] ?? 0) + 1;
    }
    return map;
  }, []);

  const items = useMemo(
    () => MOCK.activity.filter((a) => filter === "All" || TYPE_MAP[a.type]?.cat === filter),
    [filter]
  );

  const pendingItem = items.find((a) => a.time === "Pending");
  const completed = MOCK.activity.filter((a) => a.time !== "Pending").length;
  const percent = Math.round((completed / MOCK.activity.length) * 100);

  /* Find primary unread conversation for message events */
  const dealer = MOCK.conversations[0];

  const go = (k: NavTarget) => onNavigate?.(k);

  return (
    <PortalPageShell
      title="Activity"
      subtitle="A live view of every step in your acquisition."
    >
      {/* Progress + intelligence header */}
      <ProgressHeader percent={percent} />

      {/* Smart next-step recommendation */}
      <SmartGuidanceBanner
        tone="orange" Icon={Lightbulb}
        title="Recommended next step"
        description="Schedule your pickup to complete the transaction. Most pickups happen within 24 hours."
        ctaLabel="Schedule pickup" onCta={() => go("pickup")}
      />

      {/* Insight chip strip */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <InsightChip Icon={Zap} text={`Response time: ${MOCK.responseTime} — faster than average`} />
        <InsightChip Icon={Clock} text="Most pickups scheduled within 24 hrs of acceptance" />
        <InsightChip Icon={Truck} text="Average payout: 2 hrs after pickup confirmation" />
      </div>

      {/* Filter pills with counts */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = counts[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`group relative text-xs font-semibold pl-3 pr-2.5 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5 active:scale-[0.97] ${
                active
                  ? "bg-[#4F46E5] text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.6)]"
                  : "bg-white border border-[#E6EAF0] text-[#53627A] hover:text-[#4F46E5] hover:border-[#4F46E5]/40 hover:shadow-[0_6px_14px_-10px_rgba(79,70,229,0.4)]"
              }`}
            >
              {f}
              <span className={`text-[10.5px] font-bold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center ${
                active ? "bg-white/20 text-white" : "bg-[#F4F6FA] text-[#53627A] group-hover:bg-[#EEF0FF] group-hover:text-[#4F46E5]"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionLabel>Transaction Timeline</SectionLabel>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#53627A]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A]" />
            </span>
            Live updates
          </span>
        </div>

        <ol className="mt-5 relative">
          {/* Animated rail */}
          <span className="absolute left-[19px] top-1 bottom-1 w-px bg-[#EEF0F4]" aria-hidden />
          <motion.span
            initial={{ scaleY: 0 }} animate={{ scaleY: percent / 100 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ transformOrigin: "top" }}
            className="absolute left-[19px] top-1 bottom-1 w-px bg-gradient-to-b from-[#4F46E5] to-[#7C3AED]"
            aria-hidden
          />

          <AnimatePresence mode="popLayout">
            {items.map((a, i) => {
              const cfg = TYPE_MAP[a.type] ?? TYPE_MAP.submission;
              const { Icon } = cfg;
              const pending = a.time === "Pending";
              return (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="relative pl-12 pb-4 last:pb-0"
                >
                  <span className={`absolute left-0 top-1 w-10 h-10 rounded-full grid place-items-center ring-2 ring-white shadow-sm ${cfg.tint} ${pending ? "" : ""}`}>
                    {pending ? <Clock className="w-[18px] h-[18px]" /> : <Icon className="w-[18px] h-[18px]" />}
                    {pending && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                      </span>
                    )}
                  </span>

                  <button
                    onClick={() => setOpen(a)}
                    className={`group w-full text-left rounded-xl p-3 -ml-1 transition-all hover:bg-[#F7F8FB] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.25)] ${pending ? "" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`text-sm font-semibold ${pending ? "text-[#06194A]" : "text-[#06194A]"}`}>
                            {a.title}
                          </div>
                          {a.type === "messages" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF3E2] text-[#B45309]">
                              {dealer.unread} unread
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
                          {cfg.rich ?? a.desc}
                        </div>

                        {/* Message preview with avatar */}
                        {a.type === "messages" && (
                          <div className="mt-2.5 flex items-center gap-2 p-2 rounded-lg bg-white border border-[#EEF0F4] max-w-md">
                            <span className="w-7 h-7 rounded-full bg-[#EEF0FF] text-[#4F46E5] text-[10.5px] font-bold grid place-items-center shrink-0">
                              {dealer.initials}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold text-[#06194A] truncate">{dealer.name}</div>
                              <div className="text-[11.5px] text-[#53627A] truncate">"{dealer.last}"</div>
                            </div>
                          </div>
                        )}

                        {/* Pending CTAs */}
                        {pending && (
                          <div className="mt-2.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); cfg.nav && go(cfg.nav); }}
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4F46E5] hover:text-[#4338CA] px-2.5 py-1.5 rounded-lg bg-[#EEF0FF] hover:bg-[#E0E4FF] transition"
                            >
                              {a.type === "pickup" ? "Schedule pickup" : a.type === "payments" ? "Track payment" : "Take action"}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {pending
                          ? <StatusPill tone="orange">Pending</StatusPill>
                          : <span className="text-[11px] text-[#8893A8] whitespace-nowrap font-medium pt-0.5">{a.time}</span>}
                        <ChevronRight className="w-4 h-4 text-[#B6BECC] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </Card>

      {/* Workflow cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
          <Card className="p-5 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] transition-shadow">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#FEF3E2] text-[#B45309] grid place-items-center shrink-0">
                <Truck className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>Pickup Scheduling</SectionLabel>
                  <StatusPill tone="orange">Pending</StatusPill>
                </div>
                <h3 className="text-[15px] font-bold text-[#06194A] mt-1">Lock in a pickup window</h3>
                <p className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
                  Most customers schedule pickup within 24 hours of accepting their offer. Choose a time that works for you.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => go("pickup")} className="group px-4 py-2 text-[13px]">
                    <CalendarDays className="w-4 h-4" /> Schedule Pickup
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </PrimaryButton>
                  <SecondaryButton onClick={() => go("messages")} className="px-3 py-2 text-[13px]">
                    <PhoneCall className="w-4 h-4" /> Contact Coordinator
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
          <Card className="p-5 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] transition-shadow">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#E8F8EE] text-[#0F7A3E] grid place-items-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>Payment Processing</SectionLabel>
                  <StatusPill tone="orange">Pending</StatusPill>
                </div>
                <h3 className="text-[15px] font-bold text-[#06194A] mt-1">{fmt(MOCK.payment.netPayout)} ready for payout</h3>
                <p className="text-[12.5px] text-[#53627A] mt-1 leading-relaxed">
                  Funds release automatically within <strong className="text-[#06194A]">2 hours</strong> of confirmed pickup, sent via {MOCK.payment.method.split("•")[0].trim()}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => go("payments")} className="group px-4 py-2 text-[13px]">
                    Track Payment
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </PrimaryButton>
                  <SecondaryButton onClick={() => go("payments")} className="px-3 py-2 text-[13px]">
                    <ShieldCheck className="w-4 h-4" /> Payment Method
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Contextual drawer */}
      <SlideOver
        open={!!open} onClose={() => setOpen(null)}
        title={open?.title ?? ""} subtitle={open?.time}
        width="md"
        footer={
          open && (
            <div className="flex gap-2">
              <SecondaryButton onClick={() => setOpen(null)} className="flex-1">Close</SecondaryButton>
              <PrimaryButton
                className="flex-1"
                onClick={() => {
                  const cfg = TYPE_MAP[open.type];
                  setOpen(null);
                  if (cfg?.nav) go(cfg.nav);
                  else toast.success("Opening details");
                }}
              >
                {(() => {
                  if (!open) return "View Details";
                  if (open.type === "pickup")    return "Schedule";
                  if (open.type === "payments")  return "Track Payment";
                  if (open.type === "messages")  return "Open Conversation";
                  if (open.type === "offer")     return "View Offer";
                  if (open.type === "documents") return "Open Documents";
                  return "View Details";
                })()}
                <ArrowRight className="w-4 h-4" />
              </PrimaryButton>
            </div>
          )
        }
      >
        {open && (() => {
          const cfg = TYPE_MAP[open.type] ?? TYPE_MAP.submission;
          const pending = open.time === "Pending";
          return (
            <div className="space-y-4">
              <div className={`rounded-2xl p-4 flex items-center gap-3 ${pending ? "bg-[#FEF3E2] border border-[#FCD9A8]" : "bg-[#F7F8FB] border border-[#E6EAF0]"}`}>
                <span className={`w-10 h-10 rounded-xl grid place-items-center ${cfg.tint}`}>
                  {pending ? <Clock className="w-[18px] h-[18px]" /> : <cfg.Icon className="w-[18px] h-[18px]" />}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#06194A] truncate">{open.title}</div>
                  <div className="text-[11.5px] text-[#53627A]">{open.time}</div>
                </div>
                {!pending && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F8EE] text-[#0F7A3E]">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </span>
                )}
              </div>

              <p className="text-sm text-[#53627A] leading-relaxed">{cfg.rich ?? open.desc}</p>

              {open.type === "offer" && (
                <div className="rounded-2xl border border-[#E6EAF0] p-4">
                  <SectionLabel>Offer Snapshot</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wide text-[#8893A8] font-semibold">Range</div>
                      <div className="text-[14px] font-bold text-[#06194A]">{fmt(MOCK.range.low)} – {fmt(MOCK.range.high)}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wide text-[#8893A8] font-semibold">Firm offer</div>
                      <div className="text-[14px] font-bold text-[#0F7A3E]">{fmt(MOCK.firmOffer)}</div>
                    </div>
                  </div>
                </div>
              )}

              {open.type === "documents" && (
                <ul className="space-y-1.5">
                  {MOCK.docs.map((d) => (
                    <li key={d.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFBFE] border border-[#EEF0F4]">
                      <div className="text-[13px] font-medium text-[#06194A]">{d.name}</div>
                      <StatusPill tone={d.status === "Approved" ? "green" : d.status === "Under Review" ? "orange" : "gray"}>{d.status}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}

              {open.type === "messages" && (
                <div className="rounded-2xl border border-[#E6EAF0] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] text-[11px] font-bold grid place-items-center">{dealer.initials}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#06194A]">{dealer.name}</div>
                      <div className="text-[11px] text-[#8893A8]">{dealer.role}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[#53627A] leading-relaxed">"{MOCK.dealerMessage}"</p>
                </div>
              )}

              {open.type === "pickup" && (
                <div className="rounded-2xl border border-[#FCD9A8] bg-[#FEF8EE] p-4">
                  <div className="text-[13px] font-semibold text-[#06194A]">What happens next</div>
                  <ol className="mt-2 space-y-1.5 text-[12.5px] text-[#53627A]">
                    <li>1. Pick a 30-minute pickup window.</li>
                    <li>2. We'll confirm the appointment by text.</li>
                    <li>3. Hand over keys & paperwork on the day.</li>
                  </ol>
                </div>
              )}

              {open.type === "payments" && (
                <div className="rounded-2xl border border-[#BBE5C6] bg-[#F0FBF4] p-4">
                  <div className="text-[10.5px] uppercase tracking-wide text-[#0F7A3E] font-semibold">Estimated payout</div>
                  <div className="text-[20px] font-extrabold text-[#0F7A3E] mt-0.5">{fmt(MOCK.payment.netPayout)}</div>
                  <div className="text-[11.5px] text-[#53627A] mt-1">{MOCK.payment.method}</div>
                </div>
              )}

              <p className="text-[11px] text-[#8893A8]">Event ID: ACT-{String(open.id).padStart(5, "0")}</p>
            </div>
          );
        })()}
      </SlideOver>
    </PortalPageShell>
  );
};

export default ActivityPage;
