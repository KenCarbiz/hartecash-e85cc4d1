/**
 * Availability Center (Admin V2) — premium redesign of "My Availability".
 *
 * V2-only: the classic /admin page (MyAvailability.tsx) is untouched.
 *
 * REAL, persisted today (unchanged backend): cell phone, Do-Not-Disturb,
 * and quiet-hours (start/end/tz) — all saved through the existing
 * `set_my_call_availability` RPC against user_roles. Those controls are
 * fully wired and backwards compatible.
 *
 * PREVIEW (marked with a "Soon" chip): separate SMS/email channels, the
 * 7-day shift grid, call-routing rules, the per-event notification
 * matrix, connected devices, and the connection-test panel. These have
 * no column or API yet, so they are interactive UI scaffolding (local
 * state only) that future integrations can plug into — they do not
 * pretend to persist server-side.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Phone, MessageSquare, Mail, Clock, Moon, Sun, Coffee, Users,
  Plane, CalendarDays, Smartphone, Activity, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { PageShell, Card, SectionLabel, Pill, PrimaryButton } from "./theme";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain — no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SoonChip = () => <Pill tone="gray">Soon</Pill>;

const trimTime = (t?: string | null) => (t ? t.slice(0, 5) : "");
const formatPhoneInput = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length > 0) return `(${d}`;
  return "";
};

/** Status presets. "available" → DND off; all others → DND on (hard
 *  block) with the reason shown locally until status presets get a
 *  backing column. */
type StatusKey = "available" | "lunch" | "meeting" | "off" | "vacation" | "dnd";
const STATUS: Record<StatusKey, { label: string; icon: typeof Sun; tone: "green" | "amber" | "red"; blocks: boolean; sub: string }> = {
  available: { label: "Available", icon: Sun, tone: "green", blocks: false, sub: "Receiving calls and text messages" },
  lunch: { label: "Lunch Break", icon: Coffee, tone: "amber", blocks: true, sub: "Calls paused while you're on lunch" },
  meeting: { label: "In a Meeting", icon: Users, tone: "amber", blocks: true, sub: "Calls paused during your meeting" },
  off: { label: "Off Today", icon: CalendarDays, tone: "red", blocks: true, sub: "Not taking calls today" },
  vacation: { label: "Vacation", icon: Plane, tone: "red", blocks: true, sub: "Out of office" },
  dnd: { label: "Do Not Disturb", icon: Moon, tone: "red", blocks: true, sub: "Calls are temporarily blocked" },
};

const AvailabilityCenter = ({ userEmail }: { userEmail?: string }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // REAL state (persisted)
  const [phone, setPhone] = useState("");
  const [dnd, setDnd] = useState(false);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [quietTz, setQuietTz] = useState("America/New_York");

  // Local-only status preset (reason). Maps to dnd on save.
  const [status, setStatus] = useState<StatusKey>("available");

  // PREVIEW state (local only)
  const [receiveSms, setReceiveSms] = useState(true);
  const [receiveEmail, setReceiveEmail] = useState(true);
  const [routing, setRouting] = useState("manager");
  const [respectHours, setRespectHours] = useState(true);
  const [emergencyCalls, setEmergencyCalls] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("phone, click_to_dial_dnd, click_to_dial_quiet_start, click_to_dial_quiet_end, click_to_dial_quiet_tz")
        .eq("user_id", u.user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const row = (data || {}) as Record<string, string | boolean | undefined>;
      setPhone(formatPhoneInput((row.phone as string) || ""));
      setDnd(!!row.click_to_dial_dnd);
      setStatus(row.click_to_dial_dnd ? "dnd" : "available");
      setQuietStart(trimTime(row.click_to_dial_quiet_start as string));
      setQuietEnd(trimTime(row.click_to_dial_quiet_end as string));
      setQuietTz((row.click_to_dial_quiet_tz as string) || "America/New_York");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const pickStatus = (key: StatusKey) => {
    setStatus(key);
    setDnd(STATUS[key].blocks);
  };

  const save = async () => {
    if (!!quietStart !== !!quietEnd) {
      toast({
        title: "Quiet hours need both ends",
        description: "Set both start and end, or leave both blank to disable.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_my_call_availability", {
      p_phone: phone.replace(/\D/g, ""),
      p_dnd: dnd,
      p_quiet_start: quietStart || null,
      p_quiet_end: quietEnd || null,
      p_quiet_tz: quietStart && quietEnd ? quietTz : null,
    });
    setSaving(false);
    if (error) {
      const msg = error.message || "";
      const missingFn =
        msg.includes("Could not find the function") ||
        msg.includes("set_my_call_availability") ||
        msg.toLowerCase().includes("schema cache");
      toast({
        title: "Couldn't save",
        description: missingFn
          ? "The set_my_call_availability function isn't deployed in this environment yet. Apply the pending Supabase migration (20260430020000_set_my_call_availability_heal.sql) and refresh the page."
          : msg,
        variant: "destructive",
      });
      return;
    }
    setSavedAt(new Date());
    toast({ title: "Saved" });
  };

  // Derived hero status (real): DND/quiet override the chosen preset label.
  const heroKey: StatusKey = dnd ? (status === "available" ? "dnd" : status) : "available";
  const hero = STATUS[heroKey];
  const HeroIcon = hero.icon;
  const TONE_BG: Record<string, string> = {
    green: "from-[#E8F8EE] to-white border-[#C7EBD4]",
    amber: "from-[#FEF6E7] to-white border-[#F6E2BD]",
    red: "from-[#FEECEC] to-white border-[#F6CECE]",
  };
  const TONE_DOT: Record<string, string> = { green: "#0F7A3E", amber: "#B45309", red: "#B91C1C" };

  const channelEmail = userEmail || "—";
  const lastSaved = useMemo(() => {
    if (!savedAt) return null;
    const mins = Math.round((Date.now() - savedAt.getTime()) / 60000);
    return mins < 1 ? "just now" : `${mins} min ago`;
  }, [savedAt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#9AA6BC]" />
      </div>
    );
  }

  return (
    <PageShell
      title="Availability Center"
      subtitle="Control how customers reach you and what happens when you're away."
      actions={
        <PrimaryButton onClick={save}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
        {/* ① Status hero */}
        <Card className={cn("border bg-gradient-to-br p-6", TONE_BG[hero.tone])}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                <HeroIcon className="h-6 w-6" style={{ color: TONE_DOT[hero.tone] }} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_DOT[hero.tone] }} />
                  <span className="text-[20px] font-bold text-[#06194A]">{hero.label}</span>
                </div>
                <div className="mt-0.5 text-[13px] text-[#53627A]">{hero.sub}</div>
              </div>
            </div>
            {lastSaved && <div className="text-[12px] text-[#7A879C]">Updated {lastSaved}</div>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(STATUS) as StatusKey[]).map((k) => {
              const S = STATUS[k];
              const active = status === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickStatus(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
                    active
                      ? "border-[#6D28D9] bg-[#6D28D9] text-white"
                      : "border-[#E6EAF0] bg-white text-[#3B4763] hover:border-[#6D28D9]/40 hover:text-[#6D28D9]",
                  )}
                >
                  <S.icon className="h-4 w-4" />
                  {S.label}
                </button>
              );
            })}
          </div>
          {status !== "available" && status !== "dnd" && (
            <p className="mt-3 text-[12px] text-[#7A879C]">
              This engages Do Not Disturb. The reason label is shown to you locally — status
              presets sync platform-wide soon.
            </p>
          )}
        </Card>

        {/* ② Communication channels */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ChannelCard
            icon={<Phone className="h-5 w-5" />} title="Calls" active={!dnd}
            toggle={<Switch checked={!dnd} onCheckedChange={(v) => { setDnd(!v); setStatus(v ? "available" : "dnd"); }} />}
          >
            <Field label="Phone">
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              />
            </Field>
            <Meta label="Status" value={phone ? "Click-to-dial ready" : "No number set"} ok={!!phone} />
            <Meta label="Last call" value="—" />
          </ChannelCard>

          <ChannelCard
            icon={<MessageSquare className="h-5 w-5" />} title="Text Messages" soon
            active={receiveSms}
            toggle={<Switch checked={receiveSms} onCheckedChange={setReceiveSms} />}
          >
            <Meta label="Number" value={phone || "—"} />
            <Meta label="Status" value="Not yet routed" />
            <Meta label="Last SMS" value="—" />
          </ChannelCard>

          <ChannelCard
            icon={<Mail className="h-5 w-5" />} title="Email" soon
            active={receiveEmail}
            toggle={<Switch checked={receiveEmail} onCheckedChange={setReceiveEmail} />}
          >
            <Meta label="Address" value={channelEmail} />
            <Meta label="Status" value={userEmail ? "Verified" : "—"} ok={!!userEmail} />
          </ChannelCard>
        </div>

        {/* ③ Schedule + ④ Routing */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Weekly schedule</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-3 divide-y divide-[#F0F2F7] rounded-xl border border-[#F0F2F7]">
              {DAYS.map((d) => (
                <div key={d} className="flex items-center justify-between px-3 py-2 text-[13px]">
                  <span className="font-medium text-[#3B4763]">{d}</span>
                  <span className="text-[#7A879C]">8:00 AM – 6:00 PM</span>
                </div>
              ))}
            </div>

            {/* REAL quiet hours */}
            <div className="mt-4 rounded-xl border border-[#E6EAF0] bg-[#FAFBFD] p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#6D28D9]" />
                <span className="text-[13px] font-semibold text-[#06194A]">Quiet hours</span>
                <Pill tone="green">Live</Pill>
              </div>
              <p className="mt-1 text-[12px] text-[#7A879C]">
                Soft block — refuses dials inside this local-time window (may wrap midnight).
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
                <Field label="Start">
                  <Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
                </Field>
                <Field label="End">
                  <Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
                </Field>
              </div>
              {quietStart && quietEnd && (
                <div className="mt-3 sm:max-w-md">
                  <Field label="Timezone">
                    <Select value={quietTz} onValueChange={setQuietTz}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
              <div className="mt-3 space-y-2">
                <ToggleRow label="Respect working hours" sub="Auto-block dials outside your schedule" checked={respectHours} onChange={setRespectHours} soon />
                <ToggleRow label="Allow emergency manager calls" sub="Managers can still reach you during blocks" checked={emergencyCalls} onChange={setEmergencyCalls} soon />
              </div>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Call routing</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-1 text-[13px] text-[#53627A]">When you're unavailable, send calls to:</div>
            <RadioGroup value={routing} onValueChange={setRouting} className="mt-3 space-y-1.5">
              {[
                { v: "manager", l: "Sales Manager" },
                { v: "bdc", l: "BDC Queue" },
                { v: "backup", l: "Backup user" },
                { v: "voiceai", l: "Voice AI" },
                { v: "voicemail", l: "Voicemail" },
              ].map((o) => (
                <label
                  key={o.v}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                    routing === o.v ? "border-[#6D28D9] bg-[#F3F0FF] text-[#6D28D9]" : "border-[#E6EAF0] text-[#3B4763] hover:border-[#6D28D9]/30",
                  )}
                >
                  <RadioGroupItem value={o.v} />
                  {o.l}
                </label>
              ))}
            </RadioGroup>
            {routing === "backup" && (
              <div className="mt-3">
                <Select disabled>
                  <SelectTrigger><SelectValue placeholder="Select backup teammate (soon)" /></SelectTrigger>
                  <SelectContent />
                </Select>
              </div>
            )}
          </Card>
        </div>

        {/* ⑤ Notification preferences */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Notification preferences</SectionLabel>
            <SoonChip />
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#F0F2F7]">
            <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] gap-2 bg-[#FAFBFD] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA6BC]">
              <span>Event</span><span className="text-center">SMS</span><span className="text-center">Email</span><span className="text-center">Push</span>
            </div>
            {["New Lead", "Appointment Scheduled", "High Equity Opportunity", "AI Voice Escalation"].map((ev) => (
              <NotifRow key={ev} label={ev} />
            ))}
          </div>
        </Card>

        {/* ⑥ Devices + ⑦ Test */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Connected devices</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#E6EAF0] p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#6D28D9]">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#06194A]">
                  This browser <Pill tone="green"><ShieldCheck className="h-3 w-3" /> Active</Pill>
                </div>
                <div className="text-[12px] text-[#7A879C]">Calls · Texts · Push — manage soon</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Connection test</SectionLabel>
              <SoonChip />
            </div>
            <div className="mt-3 space-y-2">
              {[
                { l: "Send test call", i: Phone },
                { l: "Send test SMS", i: MessageSquare },
                { l: "Send test email", i: Mail },
              ].map((t) => (
                <div key={t.l} className="flex items-center justify-between rounded-xl border border-[#E6EAF0] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[#3B4763]">
                    <t.i className="h-4 w-4 text-[#9AA6BC]" /> {t.l}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-[#9AA6BC]">Last: —</span>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E6EAF0] px-2.5 py-1 text-[12px] font-semibold text-[#C2CAD8]"
                      title="Available once diagnostics ship"
                    >
                      <Activity className="h-3.5 w-3.5" /> Run
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

/* ── small building blocks ── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-[11px] font-medium text-[#7A879C]">{label}</Label>
    <div className="mt-1">{children}</div>
  </div>
);

const Meta = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
  <div className="flex items-center justify-between text-[12px]">
    <span className="text-[#9AA6BC]">{label}</span>
    <span className={cn("font-medium", ok ? "text-[#0F7A3E]" : "text-[#3B4763]")}>{value}</span>
  </div>
);

const ChannelCard = ({
  icon, title, soon, active, toggle, children,
}: {
  icon: React.ReactNode; title: string; soon?: boolean; active: boolean;
  toggle: React.ReactNode; children: React.ReactNode;
}) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-[#F3F0FF] text-[#6D28D9]" : "bg-[#F4F6FA] text-[#9AA6BC]")}>
          {icon}
        </span>
        <div>
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#06194A]">
            {title} {soon && <SoonChip />}
          </div>
        </div>
      </div>
      {toggle}
    </div>
    <div className="mt-4 space-y-2.5">{children}</div>
  </Card>
);

const ToggleRow = ({
  label, sub, checked, onChange, soon,
}: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; soon?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#3B4763]">
        {label} {soon && <SoonChip />}
      </div>
      {sub && <div className="text-[11px] text-[#9AA6BC]">{sub}</div>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const NotifRow = ({ label }: { label: string }) => {
  const [s, setS] = useState({ sms: true, email: true, push: false });
  return (
    <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] items-center gap-2 border-t border-[#F0F2F7] px-4 py-2.5">
      <span className="text-[13px] font-medium text-[#3B4763]">{label}</span>
      {(["sms", "email", "push"] as const).map((c) => (
        <div key={c} className="flex justify-center">
          <Switch checked={s[c]} onCheckedChange={(v) => setS((p) => ({ ...p, [c]: v }))} />
        </div>
      ))}
    </div>
  );
};

export default AvailabilityCenter;
