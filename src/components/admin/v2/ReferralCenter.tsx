/**
 * Referral Center (Admin V2) — premium redesign of "My Referrals".
 *
 * V2-only: the classic /admin page (MyReferrals.tsx) is untouched.
 *
 * REAL backend (unchanged): the `referrals` table + staff code/link, QR
 * generation, the send-invite flow (insert + send-transactional-email
 * edge function), and live referral tracking. KPIs, the link hero, quick
 * share, the activity feed, the pipeline cards, and the leaderboard are
 * all driven by real data through the existing APIs.
 *
 * PREVIEW ("Soon" chip): the 5-stage funnel/pipeline columns beyond the
 * two real statuses, milestones/rewards payouts, and the seller/buyer
 * split. These are UI architecture for future features — no new backend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantBaseUrl } from "@/hooks/useTenantBaseUrl";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  Gift, Copy, Send, Users, TrendingUp, CheckCircle2, Percent,
  DollarSign, MessageSquare, Mail, Share2, Trophy, Target, Download,
  Printer, Sparkles, Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton, SecondaryButton,
} from "./theme";

interface Ref {
  id: string;
  referral_code: string;
  referrer_name: string | null;
  referred_name: string | null;
  status: string;
  reward_amount: number;
  created_at: string;
}

const SoonChip = () => <Pill tone="gray">Soon</Pill>;

const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};

const ReferralCenter = ({ staffName, userEmail }: { staffName: string; userEmail?: string }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const tenantBaseUrl = useTenantBaseUrl();
  const [referrals, setReferrals] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffEmail, setStaffEmail] = useState(userEmail || "");
  const [leaders, setLeaders] = useState<{ email: string; sold: number; total: number }[]>([]);
  const qrRef = useRef<HTMLDivElement>(null);

  // Invite form
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (userEmail) return;
    supabase.auth.getSession().then(({ data }) => setStaffEmail(data.session?.user?.email || ""));
  }, [userEmail]);

  const staffCode = `STAFF-${(staffEmail || "unknown").split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
  const referralLink = `${tenantBaseUrl}/?ref=${staffCode}`;

  const fetchMyReferrals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("referrals")
      .select("id, referral_code, referrer_name, referred_name, status, reward_amount, created_at")
      .eq("dealership_id", tenant.dealership_id)
      .eq("referred_by_staff", staffEmail)
      .order("created_at", { ascending: false });
    setReferrals(((data as unknown) as Ref[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (staffEmail) fetchMyReferrals(); }, [tenant.dealership_id, staffEmail]);

  // Ensure the staff's own code exists (preserves the V1 behaviour).
  useEffect(() => {
    if (!staffEmail) return;
    (async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id")
        .eq("referral_code", staffCode)
        .eq("dealership_id", tenant.dealership_id)
        .maybeSingle();
      if (!data) {
        await supabase.from("referrals").insert({
          dealership_id: tenant.dealership_id,
          referral_code: staffCode,
          referrer_name: staffName,
          referrer_email: staffEmail,
          referred_by_staff: staffEmail,
          status: "pending",
          reward_amount: 200,
        } as never);
      }
    })();
  }, [staffEmail, tenant.dealership_id]);

  // Leaderboard — aggregate across the dealership when RLS permits;
  // renders only what the viewer is allowed to see (no fabricated names).
  useEffect(() => {
    if (!tenant.dealership_id) return;
    (async () => {
      const { data } = await supabase
        .from("referrals")
        .select("referred_by_staff, status")
        .eq("dealership_id", tenant.dealership_id);
      const rows = ((data as unknown) as { referred_by_staff: string | null; status: string }[]) || [];
      const map = new Map<string, { sold: number; total: number }>();
      for (const r of rows) {
        const k = r.referred_by_staff || "—";
        const e = map.get(k) || { sold: 0, total: 0 };
        e.total += 1;
        if (r.status === "converted" || r.status === "rewarded") e.sold += 1;
        map.set(k, e);
      }
      setLeaders(
        [...map.entries()]
          .map(([email, v]) => ({ email, ...v }))
          .sort((a, b) => b.sold - a.sold || b.total - a.total)
          .slice(0, 5),
      );
    })();
  }, [tenant.dealership_id, referrals.length]);

  // Exclude the staff's own code row from people-facing views/KPIs.
  const people = useMemo(() => referrals.filter((r) => r.referral_code !== staffCode), [referrals, staffCode]);

  const kpis = useMemo(() => {
    const total = people.length;
    const sold = people.filter((r) => r.status === "converted" || r.status === "rewarded").length;
    const active = people.filter((r) => r.status === "pending").length;
    const revenue = people
      .filter((r) => r.status === "converted" || r.status === "rewarded")
      .reduce((s, r) => s + (r.reward_amount || 0), 0);
    return { total, sold, active, revenue, conversion: total ? Math.round((sold / total) * 100) : 0 };
  }, [people]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: label });
  };

  const smsHref = `sms:?&body=${encodeURIComponent(`Thinking about selling your vehicle? Get a real offer in minutes: ${referralLink}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent("Get a real offer on your vehicle")}&body=${encodeURIComponent(`I had a great experience here — get a no-obligation offer on your car: ${referralLink}`)}`;
  const socialPost = `🚗 Thinking about selling your car? Skip the hassle — get a real, no-obligation cash offer in minutes. Start here: ${referralLink}`;

  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  };

  const handleSendInvite = async () => {
    if (!prospectName.trim() || !prospectEmail.trim()) return;
    setSending(true);
    const inviteCode = generateInviteCode();
    const inviteLink = `${tenantBaseUrl}/?ref=${inviteCode}`;
    await supabase.from("referrals").insert({
      dealership_id: tenant.dealership_id,
      referral_code: inviteCode,
      referrer_name: prospectName,
      referrer_email: prospectEmail,
      referred_by_staff: staffEmail,
      status: "pending",
      reward_amount: 200,
      notes: personalNote || null,
    } as never);
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "referral-invite",
        recipientEmail: prospectEmail,
        idempotencyKey: `staff-referral-${inviteCode}`,
        templateData: {
          customerName: prospectName,
          referralLink: inviteLink,
          rewardAmount: "200",
          dealershipName: tenant.display_name,
          staffName,
          personalNote: personalNote || undefined,
          isStaffInvite: true,
        },
      },
    });
    toast({ title: "Invite sent!", description: `Referral invite sent to ${prospectEmail}` });
    setProspectName(""); setProspectEmail(""); setPersonalNote("");
    setSending(false);
    fetchMyReferrals();
  };

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${staffCode}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const printQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    w.document.write(`<title>${staffCode}</title><div style="font-family:Inter,sans-serif;text-align:center;padding:24px">${new XMLSerializer().serializeToString(svg)}<p style="font-size:14px;color:#06194A;font-weight:600">Scan to sell your vehicle</p></div>`);
    w.document.close(); w.focus(); w.print();
  };

  // Pipeline: real referrals mapped onto stages. Only pending / sold are
  // real statuses today — the middle stages are structural (preview).
  const STAGES = [
    { key: "invited", label: "Invited", real: true },
    { key: "started", label: "Started", real: false },
    { key: "offer", label: "Offer Generated", real: false },
    { key: "appt", label: "Appointment", real: false },
    { key: "sold", label: "Sold", real: true },
  ];
  const stageOf = (r: Ref) => (r.status === "converted" || r.status === "rewarded" ? "sold" : "invited");

  const funnel = [
    { label: "Invited", n: people.length, real: true },
    { label: "Opened", n: null, real: false },
    { label: "Started", n: null, real: false },
    { label: "Offer generated", n: null, real: false },
    { label: "Purchased", n: kpis.sold, real: true },
  ];

  const milestoneTarget = 5;
  const toGo = Math.max(0, milestoneTarget - kpis.sold);

  if (loading) {
    return <div className="p-16 text-center text-sm text-[#9AA6BC]">Loading your referrals…</div>;
  }

  return (
    <PageShell
      title="Referral Center"
      subtitle="Share your link, track conversions, and see how you stack up."
      actions={
        <>
          <SecondaryButton onClick={() => copy(referralLink, "Your referral link is on the clipboard.")}>
            <Copy className="h-4 w-4" /> Copy link
          </SecondaryButton>
          <PrimaryButton onClick={() => document.getElementById("ref-invite")?.scrollIntoView({ behavior: "smooth" })}>
            <Send className="h-4 w-4" /> Send invite
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* ① KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Referrals" value={kpis.total} icon={<Users className="h-5 w-5" />} tone="purple" />
          <StatCard label="Active" value={kpis.active} hint="Pending" icon={<TrendingUp className="h-5 w-5" />} tone="teal" />
          <StatCard label="Vehicles Sold" value={kpis.sold} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <StatCard label="Conversion" value={`${kpis.conversion}%`} icon={<Percent className="h-5 w-5" />} tone="amber" />
          <StatCard
            label="Referral Revenue"
            value={`$${kpis.revenue.toLocaleString()}`}
            hint={<Pill tone="gray">Soon</Pill>}
            icon={<DollarSign className="h-5 w-5" />}
            tone="green"
          />
        </div>

        {/* ② Link hero + ⑨ QR */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <SectionLabel>Your referral link</SectionLabel>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2.5 font-mono text-[13px] text-[#06194A]">
                {referralLink}
              </code>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => copy(referralLink, "Link copied.")}>
                <Copy className="h-4 w-4" /> Copy link
              </PrimaryButton>
              <a href={smsHref}><SecondaryButton><MessageSquare className="h-4 w-4" /> Share by text</SecondaryButton></a>
              <a href={emailHref}><SecondaryButton><Mail className="h-4 w-4" /> Share by email</SecondaryButton></a>
            </div>
          </Card>

          <Card className="flex flex-col items-center p-5">
            <div className="flex w-full items-center justify-between">
              <SectionLabel>QR code</SectionLabel>
            </div>
            <div ref={qrRef} className="mt-3 rounded-xl border border-[#E6EAF0] bg-white p-3">
              <QRCodeSVG value={referralLink} size={132} level="M" includeMargin />
            </div>
            <p className="mt-2 text-center text-[11px] text-[#7A879C]">Scan to sell your vehicle</p>
            <div className="mt-3 flex w-full gap-2">
              <button onClick={downloadQr} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E6EAF0] py-1.5 text-[12px] font-semibold text-[#53627A] hover:text-[#6D28D9]">
                <Download className="h-3.5 w-3.5" /> Save
              </button>
              <button onClick={printQr} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E6EAF0] py-1.5 text-[12px] font-semibold text-[#53627A] hover:text-[#6D28D9]">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </Card>
        </div>

        {/* ③ Quick share */}
        <Card className="p-5">
          <SectionLabel>Quick share</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <QuickShare icon={<MessageSquare className="h-4 w-4" />} title="Text a customer" body="Thinking about selling your vehicle? Get a real offer here." action={<a href={smsHref}><SecondaryButton>Send text</SecondaryButton></a>} />
            <QuickShare icon={<Mail className="h-4 w-4" />} title="Email a customer" body="A personalized invite with your referral link." action={<a href={emailHref}><SecondaryButton>Send email</SecondaryButton></a>} />
            <QuickShare icon={<Share2 className="h-4 w-4" />} title="Social post" body={socialPost} action={<SecondaryButton onClick={() => copy(socialPost, "Social post copied.")}>Copy post</SecondaryButton>} />
          </div>
        </Card>

        {/* ④ Funnel + ⑦ Leaderboard */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Referral funnel</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-4 space-y-2">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#3B4763]">{f.label}</span>
                    <span className={cn(f.real ? "text-[#06194A] font-semibold" : "text-[#9AA6BC]")}>
                      {f.n ?? "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F0F2F7]">
                    <div
                      className={cn("h-full rounded-full", f.real ? "bg-gradient-to-r from-[#6D28D9] to-[#0D9488]" : "bg-[#E6E0F7]")}
                      style={{ width: `${f.real && people.length ? Math.max((Number(f.n) / people.length) * 100, 4) : i === 0 ? 100 : 12}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Leaderboard</SectionLabel>
              <Pill tone="purple"><Trophy className="h-3 w-3" /> Top referrers</Pill>
            </div>
            <div className="mt-3 space-y-1.5">
              {leaders.length === 0 && (
                <p className="py-4 text-center text-[13px] text-[#9AA6BC]">Standings appear as referrals are tracked.</p>
              )}
              {leaders.map((l, i) => {
                const isMe = l.email === staffEmail;
                return (
                  <div key={l.email} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", isMe ? "bg-[#F3F0FF]" : "")}>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold", i === 0 ? "bg-[#FCEFC7] text-[#B45309]" : "bg-[#F0F2F7] text-[#7A879C]")}>{i + 1}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-[#06194A]">
                      {l.email.split("@")[0]}{isMe && " (you)"}
                    </span>
                    <span className="text-[13px] font-semibold text-[#6D28D9]">{l.sold} sold</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ⑤ Pipeline */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Referral pipeline</SectionLabel>
            <Pill tone="gray">Drag-and-drop soon</Pill>
          </div>
          {people.length === 0 ? (
            <EmptyState onCopy={() => copy(referralLink, "Link copied.")} />
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
              {STAGES.map((st) => {
                const cards = people.filter((r) => stageOf(r) === st.key);
                return (
                  <div key={st.key} className="rounded-xl border border-[#F0F2F7] bg-[#FAFBFD] p-2">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#9AA6BC]">{st.label}</span>
                      <span className="text-[11px] font-semibold text-[#7A879C]">{cards.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {!st.real && cards.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[#E6EAF0] px-2 py-3 text-center text-[10px] text-[#C2CAD8]">Soon</div>
                      )}
                      {cards.map((r) => (
                        <div key={r.id} className="rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-2">
                          <div className="truncate text-[12px] font-semibold text-[#06194A]">{r.referrer_name || r.referred_name || "—"}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9AA6BC]">{r.referral_code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ⑥ Activity + ⑧ Milestones */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <SectionLabel>Recent activity</SectionLabel>
            <div className="mt-3 space-y-3">
              {people.length === 0 && <p className="text-[13px] text-[#9AA6BC]">No activity yet — send your first invite below.</p>}
              {people.slice(0, 6).map((r) => {
                const sold = r.status === "converted" || r.status === "rewarded";
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", sold ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#F3F0FF] text-[#6D28D9]")}>
                      {sold ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] text-[#06194A]">
                        <span className="font-semibold">{r.referrer_name || r.referred_name || "A referral"}</span>{" "}
                        {sold ? "purchased a vehicle" : "is in progress"}
                      </div>
                      <div className="text-[11px] text-[#9AA6BC]">{relTime(r.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Milestones</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCEFC7] text-[#B45309]">
                <Target className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[13px] font-semibold text-[#06194A]">
                  {toGo === 0 ? "Milestone reached!" : `${toGo} more sale${toGo === 1 ? "" : "s"} to go`}
                </div>
                <div className="text-[11px] text-[#7A879C]">Potential reward · $250 bonus</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F0F2F7]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]" style={{ width: `${Math.min(100, (kpis.sold / milestoneTarget) * 100)}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#9AA6BC]">
              <Sparkles className="h-3.5 w-3.5" /> Rewards & payouts coming soon
            </div>
          </Card>
        </div>

        {/* ⑩ Referral types (preview) + Send invite (real) */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Referral types</SectionLabel>
            <SoonChip />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E6EAF0] p-4">
              <div className="text-[13px] font-semibold text-[#06194A]">Seller referrals</div>
              <div className="mt-1 text-[12px] text-[#7A879C]">Customers selling a vehicle</div>
              <div className="mt-2 text-[22px] font-bold text-[#06194A]">{kpis.total}</div>
            </div>
            <div className="rounded-xl border border-dashed border-[#E6EAF0] p-4 opacity-70">
              <div className="text-[13px] font-semibold text-[#06194A]">Buyer referrals</div>
              <div className="mt-1 text-[12px] text-[#7A879C]">Customers buying a vehicle</div>
              <div className="mt-2 text-[22px] font-bold text-[#C2CAD8]">—</div>
            </div>
          </div>
        </Card>

        <div id="ref-invite">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#6D28D9]" />
            <span className="text-[14px] font-semibold text-[#06194A]">Send a referral invite</span>
          </div>
          <p className="mt-1 text-[12px] text-[#7A879C]">We'll email them a personalized invite from you.</p>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Their name" value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="min-w-[140px] flex-1" />
              <Input placeholder="Their email" type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} className="min-w-[180px] flex-1" />
            </div>
            <Textarea placeholder='Add a personal note (optional)' value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} rows={3} className="text-sm" />
            <PrimaryButton onClick={handleSendInvite}>
              <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send invite"}
            </PrimaryButton>
          </div>
        </Card>
        </div>
      </div>
    </PageShell>
  );
};

const QuickShare = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) => (
  <div className="flex flex-col rounded-xl border border-[#E6EAF0] bg-[#FAFBFD] p-4">
    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#06194A]">
      <span className="text-[#6D28D9]">{icon}</span> {title}
    </div>
    <p className="mt-2 flex-1 text-[12px] leading-relaxed text-[#53627A] line-clamp-3">{body}</p>
    <div className="mt-3">{action}</div>
  </div>
);

const EmptyState = ({ onCopy }: { onCopy: () => void }) => (
  <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-[#E6EAF0] bg-[#FAFBFD] px-6 py-10 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#6D28D9]">
      <Gift className="h-6 w-6" />
    </span>
    <div className="mt-3 text-[15px] font-bold text-[#06194A]">No referrals yet</div>
    <div className="mt-3 grid max-w-md grid-cols-1 gap-2 text-left text-[13px] text-[#53627A] sm:grid-cols-2">
      {["Copy your referral link", "Send your first invite", "Share your QR code", "Start earning referral credit"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EEF0FF] text-[11px] font-bold text-[#6D28D9]">{i + 1}</span>
          {s}
        </div>
      ))}
    </div>
    <div className="mt-4">
      <PrimaryButton onClick={onCopy}><Copy className="h-4 w-4" /> Copy referral link</PrimaryButton>
    </div>
  </div>
);

export default ReferralCenter;
