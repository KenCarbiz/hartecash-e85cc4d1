/**
 * My Business (Admin V2) — the employee's personal business hub.
 *
 * Consolidates the former "My Lead Link" and "My Referrals" into one
 * revenue-focused module with sub-tabs: Overview, Marketing Kit,
 * Pipeline, Activity, Performance, Rewards, Settings.
 *
 * REAL backend (unchanged APIs): the rep lead link (/trade?rep=) + the
 * staff referral link/code, assigned-lead count, the `referrals` table
 * (KPIs, pipeline, activity, leaderboard), QR, share, send-invite
 * (insert + send-transactional-email), and the rewards summary via the
 * new get_my_rewards RPC (with a labelled preview when not yet applied).
 *
 * PREVIEW ("Soon" chip): cross-source attribution beyond referrals/lead
 * link, business-card/flyer generators, branded /slug pages, contest
 * rewards, and the manager program dashboard — UI architecture for
 * future increments, not pretending to persist.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantBaseUrl } from "@/hooks/useTenantBaseUrl";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  LayoutGrid, Megaphone, KanbanSquare, Activity as ActivityIcon, BarChart3,
  Trophy, Settings as SettingsIcon, Copy, Send, MessageSquare, Mail, Share2,
  Download, Printer, ExternalLink, Users, TrendingUp, CheckCircle2, Percent,
  DollarSign, Gift, Target, Sparkles, Clock, Link2, CreditCard,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton, SecondaryButton,
} from "./theme";
import { useMyRewards, type RewardRule } from "./useMyRewards";

interface Ref {
  id: string;
  referral_code: string;
  referrer_name: string | null;
  referred_name: string | null;
  status: string;
  reward_amount: number;
  created_at: string;
}

type TabKey = "overview" | "marketing" | "pipeline" | "activity" | "performance" | "rewards" | "settings";
const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "marketing", label: "Marketing Kit", icon: Megaphone },
  { key: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { key: "activity", label: "Activity", icon: ActivityIcon },
  { key: "performance", label: "Performance", icon: BarChart3 },
  { key: "rewards", label: "Rewards", icon: Trophy },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const SoonChip = () => <Pill tone="gray">Soon</Pill>;

const DEFAULT_RULES: RewardRule[] = [
  { event_type: "vehicle_acquired", reward_type: "flat", amount: 250, config: {} },
  { event_type: "referral_purchase", reward_type: "flat", amount: 100, config: {} },
  { event_type: "offer_generated", reward_type: "flat", amount: 25, config: {} },
];
const EVENT_LABEL: Record<string, string> = {
  vehicle_acquired: "Vehicle acquired",
  referral_purchase: "Referral purchase",
  offer_generated: "Offer generated",
};
const eventLabel = (e: string) => EVENT_LABEL[e] || e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const relTime = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};
const money = (n: number) => `$${(n || 0).toLocaleString()}`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const MyBusiness = ({ staffName, userEmail }: { staffName: string; userEmail?: string }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const tenantBaseUrl = useTenantBaseUrl();
  const { data: rewards } = useMyRewards(tenant.dealership_id);

  const [tab, setTab] = useState<TabKey>("overview");
  const [staffEmail, setStaffEmail] = useState(userEmail || "");
  const [referrals, setReferrals] = useState<Ref[]>([]);
  const [assignedCount, setAssignedCount] = useState(0);
  const [leaders, setLeaders] = useState<{ email: string; sold: number }[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (userEmail) return;
    supabase.auth.getSession().then(({ data }) => setStaffEmail(data.session?.user?.email || ""));
  }, [userEmail]);

  const repCode = staffEmail ? staffEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const staffCode = `STAFF-${(staffEmail || "unknown").split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
  const referralLink = `${tenantBaseUrl}/?ref=${staffCode}`;
  const leadLink = `${tenantBaseUrl}/trade?rep=${repCode}`;

  const fetchReferrals = async () => {
    const { data } = await supabase
      .from("referrals")
      .select("id, referral_code, referrer_name, referred_name, status, reward_amount, created_at")
      .eq("dealership_id", tenant.dealership_id)
      .eq("referred_by_staff", staffEmail)
      .order("created_at", { ascending: false });
    setReferrals(((data as unknown) as Ref[]) || []);
  };

  // fetchReferrals is recreated each render by design; re-run only on tenant/email.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (staffEmail) fetchReferrals(); }, [tenant.dealership_id, staffEmail]);

  useEffect(() => {
    if (!repCode) return;
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", tenant.dealership_id)
      .eq("assigned_rep_email", repCode)
      .then(({ count }) => setAssignedCount(count || 0));
  }, [repCode, tenant.dealership_id]);

  // Ensure the staff's own referral code exists (preserves V1 behaviour).
  useEffect(() => {
    if (!staffEmail) return;
    (async () => {
      const { data } = await supabase
        .from("referrals").select("id")
        .eq("referral_code", staffCode).eq("dealership_id", tenant.dealership_id).maybeSingle();
      if (!data) {
        await supabase.from("referrals").insert({
          dealership_id: tenant.dealership_id, referral_code: staffCode,
          referrer_name: staffName, referrer_email: staffEmail,
          referred_by_staff: staffEmail, status: "pending", reward_amount: 200,
        } as never);
      }
    })();
    // staffCode/staffName derive from staffEmail; re-run only on identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffEmail, tenant.dealership_id]);

  useEffect(() => {
    if (!tenant.dealership_id) return;
    supabase.from("referrals").select("referred_by_staff, status").eq("dealership_id", tenant.dealership_id).then(({ data }) => {
      const rows = ((data as unknown) as { referred_by_staff: string | null; status: string }[]) || [];
      const m = new Map<string, number>();
      for (const r of rows) {
        if (r.status === "converted" || r.status === "rewarded") m.set(r.referred_by_staff || "—", (m.get(r.referred_by_staff || "—") || 0) + 1);
      }
      setLeaders([...m.entries()].map(([email, sold]) => ({ email, sold })).sort((a, b) => b.sold - a.sold).slice(0, 5));
    });
  }, [tenant.dealership_id, referrals.length]);

  const people = useMemo(() => referrals.filter((r) => r.referral_code !== staffCode), [referrals, staffCode]);

  const k = useMemo(() => {
    const sold = people.filter((r) => r.status === "converted" || r.status === "rewarded").length;
    const prospects = people.length + assignedCount;
    return { prospects, sold, conversion: pct(sold, prospects || people.length) };
  }, [people, assignedCount]);

  const rewardsReal = !!rewards;
  const rules = rewards?.rules?.length ? rewards.rules : DEFAULT_RULES;
  const tier = rewards?.tier ?? "Bronze";
  const acquisitions = rewards?.acquisitions ?? k.sold;
  const earned = (rewards?.paid_lifetime ?? 0) + (rewards?.pending ?? 0) + (rewards?.approved ?? 0);

  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!", description: label }); };
  const smsHref = `sms:?&body=${encodeURIComponent(`Thinking about selling your vehicle? Get a real offer in minutes: ${referralLink}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent("Get a real offer on your vehicle")}&body=${encodeURIComponent(`Get a no-obligation offer on your car: ${referralLink}`)}`;
  const socialPost = `🚗 Thinking about selling your car? Get a real, no-obligation cash offer in minutes: ${referralLink}`;

  const generateCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
  const sendInvite = async () => {
    if (!prospectName.trim() || !prospectEmail.trim()) return;
    setSending(true);
    const code = generateCode();
    await supabase.from("referrals").insert({
      dealership_id: tenant.dealership_id, referral_code: code, referrer_name: prospectName,
      referrer_email: prospectEmail, referred_by_staff: staffEmail, status: "pending",
      reward_amount: 200, notes: personalNote || null,
    } as never);
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "referral-invite", recipientEmail: prospectEmail, idempotencyKey: `staff-referral-${code}`,
        templateData: { customerName: prospectName, referralLink: `${tenantBaseUrl}/?ref=${code}`, rewardAmount: "200", dealershipName: tenant.display_name, staffName, personalNote: personalNote || undefined, isStaffInvite: true },
      },
    });
    toast({ title: "Invite sent!", description: `Sent to ${prospectEmail}` });
    setProspectName(""); setProspectEmail(""); setPersonalNote(""); setSending(false); fetchReferrals();
  };

  const qrSvg = () => qrRef.current?.querySelector("svg");
  const downloadQr = () => {
    const svg = qrSvg(); if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    const a = document.createElement("a"); a.href = url; a.download = `${staffCode}-qr.svg`; a.click(); URL.revokeObjectURL(url);
  };
  const printQr = () => {
    const svg = qrSvg(); if (!svg) return;
    const w = window.open("", "_blank", "width=420,height=520"); if (!w) return;
    w.document.write(`<title>${staffCode}</title><div style="font-family:Inter,sans-serif;text-align:center;padding:24px">${new XMLSerializer().serializeToString(svg)}<p style="font-size:14px;color:#06194A;font-weight:600">Scan to sell your vehicle</p></div>`);
    w.document.close(); w.focus(); w.print();
  };

  const initials = (staffName || repCode || "?").split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();

  return (
    <PageShell
      title="My Business"
      subtitle="Your personal business inside the dealership — generate opportunities, track conversions, earn rewards."
      actions={
        <>
          <SecondaryButton onClick={() => copy(referralLink, "Referral link copied.")}>
            <Copy className="h-4 w-4" /> Copy link
          </SecondaryButton>
          <PrimaryButton onClick={() => { setTab("marketing"); }}>
            <Megaphone className="h-4 w-4" /> Marketing kit
          </PrimaryButton>
        </>
      }
    >
      {/* Tab bar */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#E6EAF0] bg-white p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
                active ? "bg-[#6D28D9] text-white" : "text-[#53627A] hover:bg-[#F4F6FA]",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Prospects Generated" value={k.prospects} hint="Referrals + assigned leads" icon={<Users className="h-5 w-5" />} tone="purple" />
            <StatCard label="Vehicles Acquired" value={k.sold} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <StatCard label="Conversion" value={`${k.conversion}%`} icon={<Percent className="h-5 w-5" />} tone="amber" />
            <StatCard label="Rewards Earned" value={money(earned)} hint={rewardsReal ? undefined : <Pill tone="gray">Preview</Pill>} icon={<DollarSign className="h-5 w-5" />} tone="teal" />
            <StatCard label="Offers Created" value="—" hint={<Pill tone="gray">Soon</Pill>} icon={<TrendingUp className="h-5 w-5" />} tone="gray" />
            <StatCard label="Inventory Value Added" value="—" hint={<Pill tone="gray">Soon</Pill>} icon={<DollarSign className="h-5 w-5" />} tone="gray" />
            <StatCard label="Current Tier" value={tier} hint={rewardsReal ? `${rewards?.to_next_tier ?? 0} to ${rewards?.next_tier ?? "max"}` : <Pill tone="gray">Preview</Pill>} icon={<Trophy className="h-5 w-5" />} tone="purple" />
            <StatCard label="Pending Rewards" value={money(rewards?.pending ?? 0)} hint={rewardsReal ? undefined : <Pill tone="gray">Preview</Pill>} icon={<Gift className="h-5 w-5" />} tone="amber" />
          </div>

          {/* Personal brand */}
          <Card className="p-6">
            <SectionLabel>My personal brand</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-[18px] font-bold text-white">{initials}</span>
              <div className="flex-1 min-w-[200px]">
                <div className="text-[18px] font-bold text-[#06194A]">{staffName || repCode || "Your name"}</div>
                <div className="text-[13px] text-[#53627A]">Vehicle Acquisition Specialist · {tenant.display_name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#6D28D9]">
                  <Link2 className="h-3.5 w-3.5" /> {referralLink.replace(/^https?:\/\//, "")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => copy(referralLink, "Link copied.")}><Copy className="h-4 w-4" /> Copy</SecondaryButton>
                <a href={leadLink} target="_blank" rel="noreferrer"><SecondaryButton><ExternalLink className="h-4 w-4" /> Public page</SecondaryButton></a>
                <SecondaryButton onClick={() => setTab("marketing")}><Share2 className="h-4 w-4" /> Share</SecondaryButton>
              </div>
            </div>
          </Card>

          {/* Recent activity peek */}
          <Card className="p-5">
            <SectionLabel>Recent activity</SectionLabel>
            <div className="mt-3 space-y-3">
              {people.length === 0 && <p className="text-[13px] text-[#9AA6BC]">No activity yet — open the Marketing Kit to share your link.</p>}
              {people.slice(0, 4).map((r) => {
                const sold = r.status === "converted" || r.status === "rewarded";
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", sold ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#F3F0FF] text-[#6D28D9]")}>{sold ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}</span>
                    <div className="flex-1"><span className="text-[13px] text-[#06194A]"><span className="font-semibold">{r.referrer_name || r.referred_name || "A referral"}</span> {sold ? "purchased a vehicle" : "is in progress"}</span><div className="text-[11px] text-[#9AA6BC]">{relTime(r.created_at)}</div></div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── MARKETING KIT ── */}
      {tab === "marketing" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-2">
              <SectionLabel>My links</SectionLabel>
              <LinkRow label="Personal referral link" value={referralLink} onCopy={() => copy(referralLink, "Referral link copied.")} />
              <LinkRow label="Lead capture link" value={leadLink} onCopy={() => copy(leadLink, "Lead link copied.")} />
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={smsHref}><SecondaryButton><MessageSquare className="h-4 w-4" /> Share by text</SecondaryButton></a>
                <a href={emailHref}><SecondaryButton><Mail className="h-4 w-4" /> Share by email</SecondaryButton></a>
                <SecondaryButton onClick={() => copy(socialPost, "Social post copied.")}><Share2 className="h-4 w-4" /> Copy social post</SecondaryButton>
              </div>
            </Card>
            <Card className="flex flex-col items-center p-5">
              <SectionLabel>QR code</SectionLabel>
              <div ref={qrRef} className="mt-3 rounded-xl border border-[#E6EAF0] bg-white p-3"><QRCodeSVG value={referralLink} size={128} level="M" includeMargin /></div>
              <p className="mt-2 text-center text-[11px] text-[#7A879C]">Scan to sell your vehicle</p>
              <div className="mt-3 flex w-full gap-2">
                <button onClick={downloadQr} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E6EAF0] py-1.5 text-[12px] font-semibold text-[#53627A] hover:text-[#6D28D9]"><Download className="h-3.5 w-3.5" /> Save</button>
                <button onClick={printQr} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E6EAF0] py-1.5 text-[12px] font-semibold text-[#53627A] hover:text-[#6D28D9]"><Printer className="h-3.5 w-3.5" /> Print</button>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <SectionLabel>One-click templates</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Template icon={<MessageSquare className="h-4 w-4" />} title="SMS" body="Thinking about selling your vehicle? Get a real offer here." action={<a href={smsHref}><SecondaryButton>Send text</SecondaryButton></a>} />
              <Template icon={<Mail className="h-4 w-4" />} title="Email" body="A personalized invite with your referral link." action={<a href={emailHref}><SecondaryButton>Send email</SecondaryButton></a>} />
              <Template icon={<Share2 className="h-4 w-4" />} title="Social post" body={socialPost} action={<SecondaryButton onClick={() => copy(socialPost, "Copied.")}>Copy post</SecondaryButton>} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionLabel>Print materials</SectionLabel><SoonChip /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {["Business card", "Flyer", "Facebook cover", "Showroom sign"].map((m) => (
                <div key={m} className="rounded-xl border border-dashed border-[#E6EAF0] px-3 py-5 text-center text-[12px] font-semibold text-[#C2CAD8]">{m}</div>
              ))}
            </div>
          </Card>

          <SendInvite {...{ prospectName, setProspectName, prospectEmail, setProspectEmail, personalNote, setPersonalNote, sending, sendInvite }} />
        </div>
      )}

      {/* ── PIPELINE ── */}
      {tab === "pipeline" && (
        <Card className="p-5">
          <div className="flex items-center justify-between"><SectionLabel>Prospect pipeline</SectionLabel><Pill tone="gray">Drag-and-drop soon</Pill></div>
          {people.length === 0 ? (
            <p className="mt-6 text-center text-[13px] text-[#9AA6BC]">No prospects yet — share your link from the Marketing Kit.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { key: "visitor", label: "Visitor", real: true },
                { key: "started", label: "Started", real: false },
                { key: "offer", label: "Offer", real: false },
                { key: "appt", label: "Appointment", real: false },
                { key: "sold", label: "Acquired", real: true },
              ].map((st) => {
                const cards = people.filter((r) => (r.status === "converted" || r.status === "rewarded" ? "sold" : "visitor") === st.key);
                return (
                  <div key={st.key} className="rounded-xl border border-[#F0F2F7] bg-[#FAFBFD] p-2">
                    <div className="mb-2 flex items-center justify-between px-1"><span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA6BC]">{st.label}</span><span className="text-[11px] font-semibold text-[#7A879C]">{cards.length}</span></div>
                    <div className="space-y-1.5">
                      {!st.real && cards.length === 0 && <div className="rounded-lg border border-dashed border-[#E6EAF0] px-2 py-3 text-center text-[10px] text-[#C2CAD8]">Soon</div>}
                      {cards.map((r) => (
                        <div key={r.id} className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-2">
                          <div className="truncate text-[12px] font-semibold text-[#06194A]">{r.referrer_name || r.referred_name || "—"}</div>
                          <div className="mt-0.5 flex items-center justify-between"><span className="font-mono text-[10px] text-[#9AA6BC]">{r.referral_code}</span><Pill tone="purple">Referral</Pill></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── ACTIVITY ── */}
      {tab === "activity" && (
        <Card className="p-5">
          <SectionLabel>Activity feed</SectionLabel>
          <div className="mt-3 space-y-3">
            {people.length === 0 && <p className="text-[13px] text-[#9AA6BC]">No activity yet.</p>}
            {people.map((r) => {
              const sold = r.status === "converted" || r.status === "rewarded";
              return (
                <div key={r.id} className="flex items-center gap-3 border-b border-[#F0F2F7] pb-3 last:border-0">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", sold ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#F3F0FF] text-[#6D28D9]")}>{sold ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}</span>
                  <div className="flex-1"><span className="text-[13px] text-[#06194A]"><span className="font-semibold">{r.referrer_name || r.referred_name || "A referral"}</span> {sold ? "purchased a vehicle" : "is in progress"}</span><div className="text-[11px] text-[#9AA6BC]">{relTime(r.created_at)}</div></div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── PERFORMANCE ── */}
      {tab === "performance" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4"><SectionLabel>Source analytics</SectionLabel><div className="mt-1 text-[15px] font-semibold text-[#06194A]">Opportunity generation by channel</div></div>
          <div className="overflow-x-auto border-t border-[#F0F2F7]">
            <div className="min-w-[440px]">
            <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-2 bg-[#FAFBFD] px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA6BC]"><span>Source</span><span className="text-right">Volume</span><span className="text-right">Acquired</span><span className="text-right">Conv.</span></div>
            <SourceRow name="Referral" volume={people.length} acquired={k.sold} />
            <SourceRow name="Lead Link" volume={assignedCount} acquired={null} />
            {["SMS", "Email", "Facebook", "QR", "Marketplace"].map((s) => <SourceRow key={s} name={s} volume={null} acquired={null} soon />)}
            </div>
          </div>
        </Card>
      )}

      {/* ── REWARDS ── */}
      {tab === "rewards" && (
        <div className="space-y-4">
          {!rewardsReal && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FEF3E2] bg-[#FFFBF3] px-4 py-2.5 text-[12px] text-[#B45309]">
              <Sparkles className="h-4 w-4 shrink-0" /> Program preview — your dealer's reward rules go live once the rewards engine is enabled.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Current Tier" value={tier} hint={`${rewards?.to_next_tier ?? Math.max(0, 3 - acquisitions)} to ${rewards?.next_tier ?? "Silver"}`} icon={<Trophy className="h-5 w-5" />} tone="purple" />
            <StatCard label="Pending" value={money(rewards?.pending ?? 0)} icon={<Clock className="h-5 w-5" />} tone="amber" />
            <StatCard label="Approved" value={money(rewards?.approved ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} tone="teal" />
            <StatCard label="Paid (lifetime)" value={money(rewards?.paid_lifetime ?? 0)} icon={<CreditCard className="h-5 w-5" />} tone="green" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionLabel>Tier progress</SectionLabel>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCEFC7] text-[#B45309]"><Target className="h-5 w-5" /></span>
                <div><div className="text-[13px] font-semibold text-[#06194A]">{acquisitions} acquisition{acquisitions === 1 ? "" : "s"}</div><div className="text-[11px] text-[#7A879C]">{rewards?.next_tier ? `${rewards.to_next_tier} more to ${rewards.next_tier}` : "Keep acquiring to climb tiers"}</div></div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F0F2F7]"><div className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]" style={{ width: `${Math.min(100, (acquisitions / 11) * 100)}%` }} /></div>
              <div className="mt-2 flex justify-between text-[10px] text-[#9AA6BC]"><span>Bronze</span><span>Silver · 3</span><span>Gold · 6</span><span>Platinum · 11</span></div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between"><SectionLabel>Reward rules</SectionLabel>{!rewardsReal && <SoonChip />}</div>
              <div className="mt-3 divide-y divide-[#F0F2F7]">
                {rules.map((r) => (
                  <div key={r.event_type} className="flex items-center justify-between py-2.5 text-[13px]"><span className="text-[#3B4763]">{eventLabel(r.event_type)}</span><span className="font-semibold text-[#0F7A3E]">{money(r.amount)}{r.reward_type !== "flat" ? ` · ${r.reward_type}` : ""}</span></div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between"><SectionLabel>Leaderboard</SectionLabel><Pill tone="purple"><Trophy className="h-3 w-3" /> Top acquirers</Pill></div>
            <div className="mt-3 space-y-1.5">
              {leaders.length === 0 && <p className="py-4 text-center text-[13px] text-[#9AA6BC]">Standings appear as referrals convert.</p>}
              {leaders.map((l, i) => {
                const me = l.email === staffEmail;
                return (
                  <div key={l.email} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", me && "bg-[#F3F0FF]")}>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", i === 0 ? "bg-[#FCEFC7] text-[#B45309]" : "bg-[#F0F2F7] text-[#7A879C]")}>{i + 1}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-[#06194A]">{l.email.split("@")[0]}{me && " (you)"}</span>
                    <span className="text-[13px] font-semibold text-[#6D28D9]">{l.sold} sold</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === "settings" && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionLabel>Identity</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReadField label="Name" value={staffName || "—"} />
              <ReadField label="Email" value={staffEmail || "—"} />
              <ReadField label="Store" value={tenant.display_name} />
              <ReadField label="Personal link" value={referralLink} />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[#9AA6BC]"><Sparkles className="h-3.5 w-3.5" /> Editable title, photo and a branded /you URL are coming soon.</p>
          </Card>
        </div>
      )}
    </PageShell>
  );
};

/* ── helpers ── */
const LinkRow = ({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) => (
  <div className="mt-3">
    <div className="text-[11px] font-medium text-[#7A879C]">{label}</div>
    <div className="mt-1 flex items-center gap-2">
      <code className="flex-1 truncate rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2 font-mono text-[12px] text-[#06194A]">{value}</code>
      <button onClick={onCopy} className="rounded-lg border border-[#E6EAF0] px-2.5 py-2 text-[#53627A] hover:text-[#6D28D9]"><Copy className="h-4 w-4" /></button>
    </div>
  </div>
);

const Template = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) => (
  <div className="flex flex-col rounded-xl border border-[#E6EAF0] bg-[#FAFBFD] p-4">
    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#06194A]"><span className="text-[#6D28D9]">{icon}</span> {title}</div>
    <p className="mt-2 flex-1 text-[12px] leading-relaxed text-[#53627A] line-clamp-3">{body}</p>
    <div className="mt-3">{action}</div>
  </div>
);

const SourceRow = ({ name, volume, acquired, soon }: { name: string; volume: number | null; acquired: number | null; soon?: boolean }) => (
  <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] items-center gap-2 border-t border-[#F0F2F7] px-5 py-3 text-[13px]">
    <span className="flex items-center gap-1.5 font-semibold text-[#06194A]">{name}{soon && <SoonChip />}</span>
    <span className="text-right text-[#3B4763]">{volume ?? "—"}</span>
    <span className="text-right text-[#3B4763]">{acquired ?? "—"}</span>
    <span className="text-right font-semibold text-[#6D28D9]">{volume != null && acquired != null && volume > 0 ? `${pct(acquired, volume)}%` : "—"}</span>
  </div>
);

const ReadField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[11px] font-medium text-[#7A879C]">{label}</div>
    <div className="mt-1 truncate rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#06194A]">{value}</div>
  </div>
);

const SendInvite = ({
  prospectName, setProspectName, prospectEmail, setProspectEmail, personalNote, setPersonalNote, sending, sendInvite,
}: {
  prospectName: string; setProspectName: (v: string) => void; prospectEmail: string; setProspectEmail: (v: string) => void;
  personalNote: string; setPersonalNote: (v: string) => void; sending: boolean; sendInvite: () => void;
}) => (
  <Card className="p-5">
    <div className="flex items-center gap-2"><Send className="h-4 w-4 text-[#6D28D9]" /><span className="text-[14px] font-semibold text-[#06194A]">Send a referral invite</span></div>
    <p className="mt-1 text-[12px] text-[#7A879C]">We'll email them a personalized invite from you.</p>
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Their name" value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="min-w-[140px] flex-1" />
        <Input placeholder="Their email" type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} className="min-w-[180px] flex-1" />
      </div>
      <Textarea placeholder="Add a personal note (optional)" value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={3} className="text-sm" />
      <PrimaryButton onClick={sendInvite}><Send className="h-4 w-4" /> {sending ? "Sending…" : "Send invite"}</PrimaryButton>
    </div>
  </Card>
);

export default MyBusiness;
