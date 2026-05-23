import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Paperclip, Phone, Mail, ChevronLeft, Search, Upload, ShieldCheck,
  FileText, Camera, Receipt, ClipboardList, CheckCircle2, Clock, Truck,
  DollarSign, BadgeCheck, Lock, Star, Zap,
  PhoneCall, AlertTriangle, Eye, Sparkles, Image as ImageIcon,
} from "lucide-react";
import { fmt } from "../portalMock";
import { usePortalData } from "../PortalDataContext";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

// ── Types ────────────────────────────────────────────────────────────────────
type MsgKind = "text" | "system" | "file";
type Msg = {
  id: string;
  who: "you" | "dealer" | "system";
  kind: MsgKind;
  text?: string;
  time: string;
  read?: "delivered" | "seen";
  seenAgo?: string;
  system?: { icon: any; tone: "indigo" | "green" | "amber" | "blue"; title: string };
  file?: { name: string; type: "pdf" | "image"; size: string; status: "uploading" | "review" | "approved" };
};

const INITIAL_THREADS: Record<string, Msg[]> = {
  liberty: [
    { id: "m1", who: "dealer", kind: "text", text: "Hi Alex — your RAV4 looks great. I'm Marcus, your acquisition specialist. I'll personally walk you through every step.", time: "10:02 AM" },
    { id: "m2", who: "system", kind: "system", time: "10:04 AM", system: { icon: CheckCircle2, tone: "green", title: "Documents approved — Registration & Title" } },
    { id: "m3", who: "you", kind: "text", text: "Thanks Marcus! Anything else you need from me?", time: "10:05 AM", read: "seen", seenAgo: "2m ago" },
    { id: "m4", who: "dealer", kind: "text", text: "Just confirming your mileage matches the photos. Looks perfect. Issuing your firm offer now.", time: "10:08 AM" },
    { id: "m5", who: "system", kind: "system", time: "10:09 AM", system: { icon: DollarSign, tone: "indigo", title: "Firm offer issued — $20,150" } },
    { id: "m6", who: "dealer", kind: "text", text: "We're excited to make this happen for you. Let me know if you have any questions at all.", time: "2m ago" },
  ],
  support: [{ id: "s1", who: "dealer", kind: "text", text: "Anything else we can help with?", time: "1h ago" }],
  pickup:  [{ id: "p1", who: "dealer", kind: "text", text: "Please confirm a pickup window that works best for you.", time: "3h ago" }],
};

// Quick reply intelligence by stage
const QUICK_REPLIES = {
  preOffer:  ["Can I negotiate?", "How long is my offer valid?", "Explain the mileage adjustment", "Can I upload more photos?"],
  postOffer: ["When can pickup happen?", "How fast is payment sent?", "Can I update my mileage?", "What happens during pickup?"],
  postPickup:["Has payment been released?", "Download my bill of sale", "When will ACH clear?"],
};

const ATTACH_SHORTCUTS = [
  { icon: FileText,      label: "Upload Title",        accent: "#4F46E5" },
  { icon: Camera,        label: "Damage Photo",        accent: "#7C3AED" },
  { icon: ClipboardList, label: "Registration",        accent: "#0EA5E9" },
  { icon: Receipt,       label: "Bill of Sale",        accent: "#16A34A" },
];

const TRUST_BADGES = [
  { icon: BadgeCheck, label: "Verified Dealer" },
  { icon: ShieldCheck, label: "Licensed Buyer" },
  { icon: Lock,        label: "End-to-End Encrypted" },
  { icon: Star,        label: "BBB Accredited" },
];

// ── Subcomponents ────────────────────────────────────────────────────────────

const TypingDots = () => (
  <div className="inline-flex items-center gap-1">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-[#8893A8]"
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
      />
    ))}
  </div>
);

const TransactionHeader = ({ onOffer }: { onOffer: () => void }) => {
  const MOCK = usePortalData();
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="border-b border-[#E6EAF0] bg-[#FAFBFE] px-4 py-2"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#06194A] truncate">
            {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model} {MOCK.vehicle.trim}
          </div>
          <div className="text-[11px] text-[#53627A] truncate">
            Firm offer accepted · 2 docs remaining
          </div>
        </div>
        <button
          onClick={onOffer}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4F46E5] bg-white border border-[#E0E7FF] rounded-lg px-2.5 py-1.5 hover:bg-[#EEF0FF] transition shrink-0"
        >
          <DollarSign className="w-3.5 h-3.5" /> {fmt(MOCK.firmOffer)}
        </button>
      </div>
    </motion.div>
  );
};

const SystemEvent = ({ msg }: { msg: Msg }) => {
  const tones: Record<string, string> = {
    indigo: "bg-[#EEF0FF] text-[#4F46E5] border-[#C7D2FE]",
    green:  "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
    amber:  "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
    blue:   "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  };
  const Icon = msg.system!.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex justify-center my-1"
    >
      <div className={`inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full border ${tones[msg.system!.tone]}`}>
        <Icon className="w-3.5 h-3.5" />
        {msg.system!.title}
        <span className="text-[10px] font-normal opacity-70">· {msg.time}</span>
      </div>
    </motion.div>
  );
};

const FileBubble = ({ msg }: { msg: Msg }) => {
  const f = msg.file!;
  const isImg = f.type === "image";
  const statusTone =
    f.status === "approved" ? "text-[#16A34A]" :
    f.status === "review"   ? "text-[#B45309]" : "text-[#4F46E5]";
  return (
    <div className={`flex ${msg.who === "you" ? "justify-end" : "justify-start"}`}>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-[78%] rounded-2xl border border-[#E6EAF0] bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl grid place-items-center ${isImg ? "bg-[#EEF0FF] text-[#4F46E5]" : "bg-[#FEF3C7] text-[#B45309]"}`}>
            {isImg ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#06194A] truncate">{f.name}</div>
            <div className="text-[11px] text-[#8893A8]">{f.size}</div>
          </div>
        </div>
        {f.status === "uploading" ? (
          <div className="mt-2 h-1 rounded-full bg-[#F4F6FA] overflow-hidden">
            <motion.div className="h-full bg-[#4F46E5]" initial={{ width: "10%" }} animate={{ width: "100%" }} transition={{ duration: 1.4 }} />
          </div>
        ) : (
          <div className={`mt-2 text-[11px] font-semibold inline-flex items-center gap-1 ${statusTone}`}>
            {f.status === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {f.status === "approved" ? "Approved by dealer" : "Under review"}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const MessageBubble = ({ msg }: { msg: Msg }) => {
  if (msg.kind === "system") return <SystemEvent msg={msg} />;
  if (msg.kind === "file")   return <FileBubble msg={msg} />;
  const isYou = msg.who === "you";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isYou ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        isYou
          ? "bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white"
          : "bg-white border border-[#E6EAF0] text-[#06194A]"
      }`}>
        {msg.text}
        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isYou ? "text-white/75 justify-end" : "text-[#8893A8]"}`}>
          <span>{msg.time}</span>
          {isYou && msg.read === "seen" && <><span>·</span><Eye className="w-2.5 h-2.5" /> Seen {msg.seenAgo}</>}
          {isYou && msg.read === "delivered" && <><span>·</span> Delivered</>}
        </div>
      </div>
    </motion.div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

export const MessagesPage = () => {
  const MOCK = usePortalData();
  const [active, setActive] = useState<string>("liberty");
  const [mobileChat, setMobileChat] = useState(false);
  const [profile, setProfile] = useState(false);
  const [attach, setAttach] = useState(false);
  const [offerDrawer, setOfferDrawer] = useState(false);
  const [supportDrawer, setSupportDrawer] = useState<null | "callback" | "escalate">(null);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState<Record<string, Msg[]>>(INITIAL_THREADS);
  const [dealerTyping, setDealerTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Track every setTimeout this component schedules so we can clear
  // them on unmount or thread switch. Without this, the 1200/3800ms
  // dealer-reply chain (sendText) and the 1600/2800/3400ms upload
  // chain (sendAttachment) keep firing setState after the user
  // navigates away → React warning + state corruption in dev,
  // memory leaks + ghost updates in prod.
  const pendingTimers = useRef<number[]>([]);
  const queueTimer = (cb: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      // Drop the id from the queue as it fires so the array doesn't
      // grow unbounded across the session.
      pendingTimers.current = pendingTimers.current.filter((x) => x !== id);
      cb();
    }, ms);
    pendingTimers.current.push(id);
    return id;
  };
  const clearAllTimers = () => {
    pendingTimers.current.forEach((id) => clearTimeout(id));
    pendingTimers.current = [];
  };
  useEffect(() => () => clearAllTimers(), []);

  // Selected conversation. find() can return undefined when `active`
  // points at a stale id (e.g., the active thread got archived in
  // another tab). Without a guard the non-null assertion throws on
  // the next `.name` deref. Fall back to the first conversation so
  // the rest of the render is always safe — callers can switch to
  // a different thread via the sidebar.
  const conv =
    MOCK.conversations.find((c) => c.id === active) ?? MOCK.conversations[0];
  const msgs = threads[active] ?? [];

  // Periodic dealer typing simulation on liberty thread
  useEffect(() => {
    if (active !== "liberty") return;
    const id = setInterval(() => {
      setDealerTyping(true);
      const offId = window.setTimeout(() => setDealerTyping(false), 2600);
      pendingTimers.current.push(offId);
    }, 14000);
    return () => clearInterval(id);
  }, [active]);

  // Auto-scroll on new messages / typing
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, dealerTyping, active]);

  // Auto-grow textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [draft]);

  const sendText = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    const newMsg: Msg = {
      id: `u-${Date.now()}`, who: "you", kind: "text", text: t,
      time: "Just now", read: "delivered",
    };
    setThreads((p) => ({ ...p, [active]: [...(p[active] ?? []), newMsg] }));
    setDraft("");
    // Optimistic seen + dealer typing reply — both timers tracked
    // in pendingTimers so they cancel on unmount.
    queueTimer(() => {
      setThreads((p) => ({
        ...p,
        [active]: (p[active] ?? []).map((m) => m.id === newMsg.id ? { ...m, read: "seen", seenAgo: "just now" } : m),
      }));
      setDealerTyping(true);
    }, 1200);
    queueTimer(() => {
      setDealerTyping(false);
      const reply: Msg = {
        id: `d-${Date.now()}`, who: "dealer", kind: "text",
        text: "Got it — I'm on it. I'll follow up here as soon as I have an update.",
        time: "Just now",
      };
      setThreads((p) => ({ ...p, [active]: [...(p[active] ?? []), reply] }));
    }, 3800);
  };

  const sendAttachment = (label: string) => {
    const isImg = /photo|damage/i.test(label);
    const fileMsg: Msg = {
      id: `f-${Date.now()}`, who: "you", kind: "file", time: "Just now",
      file: { name: `${label}.${isImg ? "jpg" : "pdf"}`, type: isImg ? "image" : "pdf", size: isImg ? "2.4 MB" : "184 KB", status: "uploading" },
    };
    setThreads((p) => ({ ...p, [active]: [...(p[active] ?? []), fileMsg] }));
    setAttach(false);
    queueTimer(() => {
      setThreads((p) => ({
        ...p,
        [active]: (p[active] ?? []).map((m) => m.id === fileMsg.id && m.file ? { ...m, file: { ...m.file, status: "review" } } : m),
      }));
    }, 1600);
    queueTimer(() => {
      const sysMsg: Msg = {
        id: `sys-${Date.now()}`, who: "system", kind: "system", time: "Just now",
        system: { icon: CheckCircle2, tone: "green", title: `${label} received — under review` },
      };
      setThreads((p) => ({ ...p, [active]: [...(p[active] ?? []), sysMsg] }));
    }, 2400);
  };

  // Stage-aware quick replies (firm offer issued but pickup pending → postOffer)
  const quickReplies = useMemo(() => QUICK_REPLIES.postOffer.slice(0, 3), []);

  return (
    <PortalPageShell title="Messages" subtitle="Your direct line to your acquisition specialist.">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_300px] min-h-[640px]">
          {/* ── Conversations list ────────────────────────────────────── */}
          <aside className={`border-r border-[#E6EAF0] flex flex-col bg-white ${mobileChat ? "hidden lg:flex" : "flex"}`}>
            <div className="p-4 border-b border-[#E6EAF0]">
              <div className="flex items-center gap-2 rounded-xl bg-[#F7F8FB] px-3 py-2 ring-1 ring-transparent focus-within:ring-[#4F46E5]/30 focus-within:bg-white transition">
                <Search className="w-4 h-4 text-[#8893A8]" />
                <input placeholder="Search conversations" className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#8893A8]" />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {MOCK.conversations.map((c) => {
                const sel = c.id === active;
                const online = c.id === "liberty";
                const typing = c.id === "liberty" && dealerTyping;
                return (
                  <li key={c.id}>
                    <motion.button
                      whileHover={{ x: 2 }}
                      onClick={() => { setActive(c.id); setMobileChat(true); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition border-l-2 relative ${
                        sel ? "border-[#4F46E5] bg-gradient-to-r from-[#EEF0FF]/70 to-transparent" : "border-transparent hover:bg-[#F7F8FB]"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center text-xs font-bold ring-2 ring-white shadow-[0_2px_6px_rgba(79,70,229,0.15)]">{c.initials}</div>
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#16A34A] ring-2 ring-white">
                            <span className="absolute inset-0 rounded-full bg-[#16A34A] animate-ping opacity-60" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#06194A] truncate">{c.name}</span>
                          <span className="text-[10px] text-[#8893A8] shrink-0 ml-1">{c.time}</span>
                        </div>
                        <div className="text-[11px] truncate mt-0.5">
                          {typing ? (
                            <span className="inline-flex items-center gap-1.5 text-[#4F46E5] font-semibold">
                              <TypingDots /> typing…
                            </span>
                          ) : (
                            <span className="text-[#53627A]">{c.last}</span>
                          )}
                        </div>
                      </div>
                      {c.unread > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}
                          className="min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-[10px] font-bold grid place-items-center shrink-0 shadow-[0_2px_6px_rgba(79,70,229,0.35)]"
                        >{c.unread}</motion.span>
                      )}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            <div className="p-3 border-t border-[#E6EAF0]">
              <div className="rounded-xl bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] p-3 text-[11px] text-[#4F46E5] flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">All messages end-to-end encrypted</span>
              </div>
            </div>
          </aside>

          {/* ── Chat ─────────────────────────────────────────────────── */}
          <section className={`flex flex-col ${!mobileChat ? "hidden lg:flex" : "flex"}`}>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EAF0] bg-white">
              <button onClick={() => setMobileChat(false)} className="lg:hidden p-2 rounded-lg hover:bg-[#F4F6FA] text-[#53627A]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center text-xs font-bold">{conv.initials}</div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#16A34A] ring-2 ring-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#06194A] truncate flex items-center gap-1.5">
                  {conv.name} <BadgeCheck className="w-3.5 h-3.5 text-[#4F46E5]" />
                </div>
                <div className="text-[11px] text-[#16A34A] font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Online · Replies in ~5 min
                </div>
              </div>
              <button onClick={() => setProfile(true)} className="lg:hidden text-xs font-semibold text-[#4F46E5]">Profile</button>
            </header>

            <TransactionHeader onOffer={() => setOfferDrawer(true)} />

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gradient-to-b from-[#FAFBFE] to-white">
              <AnimatePresence initial={false}>
                {msgs.map((m) => <MessageBubble key={m.id} msg={m} />)}
              </AnimatePresence>
              <AnimatePresence>
                {dealerTyping && active === "liberty" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-[#E6EAF0] px-3.5 py-2.5 text-[12px] text-[#53627A] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <span className="font-semibold text-[#06194A]">{conv.name}</span>
                      <span>is typing</span>
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick replies */}
            <div className="px-4 py-2 border-t border-[#E6EAF0] flex items-center gap-2 overflow-x-auto bg-white/60">
              <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => sendText(q)}
                  className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F4F6FA] hover:bg-[#EEF0FF] hover:text-[#4F46E5] text-[#53627A] transition border border-transparent hover:border-[#C7D2FE]"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-[#E6EAF0] bg-white/80 backdrop-blur">
              <div className="flex items-end gap-2 rounded-2xl border border-[#E6EAF0] bg-white p-2 focus-within:border-[#4F46E5] focus-within:ring-4 focus-within:ring-[#4F46E5]/15 transition">
                <button onClick={() => setAttach(true)} aria-label="Attach" className="p-2 rounded-lg hover:bg-[#F4F6FA] text-[#53627A] transition">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  rows={1}
                  placeholder="Message your acquisition specialist…"
                  className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-[#8893A8] max-h-[140px]"
                />
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => sendText()}
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className={`rounded-xl p-2.5 transition text-white ${
                    draft.trim()
                      ? "bg-gradient-to-br from-[#4F46E5] to-[#6366F1] shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:from-[#4338CA] hover:to-[#4F46E5]"
                      : "bg-[#C7D2FE]"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
              <div className="mt-1.5 text-[10px] text-[#8893A8] flex items-center gap-1.5 px-1">
                <Lock className="w-3 h-3" /> Encrypted · Press Enter to send · Shift+Enter for new line
              </div>
            </div>
          </section>

          {/* ── Advisor profile (desktop) — compact ──────────────────── */}
          <aside className="hidden lg:flex flex-col border-l border-[#E6EAF0] bg-white">
            {/* Specialist identity */}
            <div className="p-4 text-center border-b border-[#E6EAF0]">
              <div className="relative w-14 h-14 mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#4F46E5] grid place-items-center text-base font-bold ring-2 ring-white shadow-[0_4px_14px_rgba(79,70,229,0.15)]">
                  {conv.initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#16A34A] ring-2 ring-white" />
              </div>
              <div className="text-[13.5px] font-semibold text-[#06194A] mt-2 inline-flex items-center gap-1 justify-center">
                Marcus Chen <BadgeCheck className="w-3.5 h-3.5 text-[#4F46E5]" />
              </div>
              <div className="text-[11px] text-[#53627A]">Acquisition Specialist</div>
              <div className="text-[11px] text-[#8893A8]">{conv.name}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Active · Replies in ~5 min
              </div>
              <button
                onClick={() => setProfile(true)}
                className="block mx-auto mt-2 text-[11px] font-semibold text-[#4F46E5] hover:underline"
              >
                View specialist details
              </button>
            </div>

            {/* Transaction summary */}
            <div className="p-4 border-b border-[#E6EAF0]">
              <div className="text-[10px] uppercase tracking-wide text-[#8893A8] font-semibold mb-2">Your transaction</div>
              <dl className="space-y-1.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#53627A]">Vehicle</dt>
                  <dd className="font-semibold text-[#06194A] text-right truncate">
                    {MOCK.vehicle.year} {MOCK.vehicle.make} {MOCK.vehicle.model}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#53627A]">Firm Offer</dt>
                  <dd className="font-bold text-[#06194A]">{fmt(MOCK.firmOffer)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#53627A]">Status</dt>
                  <dd className="font-semibold text-[#16A34A]">Offer Accepted</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#53627A]">Documents</dt>
                  <dd className="font-semibold text-[#B45309]">2 remaining</dd>
                </div>
              </dl>
            </div>

            {/* Quick actions */}
            <div className="p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-[#8893A8] font-semibold mb-1 px-1">Quick actions</div>
              <button onClick={() => setOfferDrawer(true)} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-[#06194A] hover:bg-[#F4F6FA] transition">
                <DollarSign className="w-4 h-4 text-[#16A34A]" /> View Offer
              </button>
              <button onClick={() => setAttach(true)} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-[#06194A] hover:bg-[#F4F6FA] transition">
                <Upload className="w-4 h-4 text-[#4F46E5]" /> Upload Document
              </button>
              <button className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-[#06194A] hover:bg-[#F4F6FA] transition">
                <Truck className="w-4 h-4 text-[#4F46E5]" /> Schedule Pickup
              </button>
              <button onClick={() => setSupportDrawer("callback")} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-[#06194A] hover:bg-[#F4F6FA] transition">
                <PhoneCall className="w-4 h-4 text-[#4F46E5]" /> Request Callback
              </button>
            </div>

            {/* Footer: secondary Call/Email + trust line */}
            <div className="mt-auto border-t border-[#E6EAF0]">
              <div className="grid grid-cols-2 gap-2 p-3">
                <button className="inline-flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#53627A] hover:text-[#4F46E5] py-1.5 rounded-lg hover:bg-[#F4F6FA] transition">
                  <Phone className="w-3.5 h-3.5" /> Call
                </button>
                <button className="inline-flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#53627A] hover:text-[#4F46E5] py-1.5 rounded-lg hover:bg-[#F4F6FA] transition">
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
              <div className="px-4 pb-3 text-[10.5px] text-[#8893A8] inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Secure dealer conversation
              </div>
            </div>
          </aside>
        </div>
      </Card>

      {/* ── Drawers ─────────────────────────────────────────────────── */}

      {/* Advisor profile (mobile / "view full") */}
      <SlideOver open={profile} onClose={() => setProfile(false)} title="Marcus Chen" subtitle={`Senior Acquisition Specialist · ${conv.name}`}
        footer={<div className="grid grid-cols-2 gap-2"><SecondaryButton><Phone className="w-4 h-4" /> Call</SecondaryButton><PrimaryButton><Mail className="w-4 h-4" /> Email</PrimaryButton></div>}>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#F7F8FB] p-3"><div className="text-[10px] uppercase text-[#8893A8] font-semibold">Experience</div><div className="text-[#06194A] font-semibold mt-0.5">8 years</div></div>
            <div className="rounded-2xl bg-[#F7F8FB] p-3"><div className="text-[10px] uppercase text-[#8893A8] font-semibold">Response</div><div className="text-[#06194A] font-semibold mt-0.5">~5 min</div></div>
            <div className="rounded-2xl bg-[#F7F8FB] p-3"><div className="text-[10px] uppercase text-[#8893A8] font-semibold">Rating</div><div className="text-[#06194A] font-semibold mt-0.5">4.9 ★</div></div>
            <div className="rounded-2xl bg-[#F7F8FB] p-3"><div className="text-[10px] uppercase text-[#8893A8] font-semibold">Status</div><div className="text-[#16A34A] font-semibold mt-0.5">Active now</div></div>
          </div>
          <div className="rounded-2xl bg-[#F7F8FB] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold mb-2">Trust & security</div>
            <div className="grid grid-cols-2 gap-1.5">
              {TRUST_BADGES.map((b) => { const Icon = b.icon; return (
                <div key={b.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#06194A]"><Icon className="w-3.5 h-3.5 text-[#16A34A]" /> {b.label}</div>
              );})}
            </div>
          </div>
        </div>
      </SlideOver>

      {/* Attach — smart shortcuts */}
      <SlideOver open={attach} onClose={() => setAttach(false)} title="Attach a Document" subtitle="Tap a shortcut or drop a file" width="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {ATTACH_SHORTCUTS.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.label} onClick={() => sendAttachment(s.label)}
                  className="rounded-2xl border border-[#E6EAF0] bg-white p-3 text-left hover:border-[#C7D2FE] hover:bg-[#FAFBFE] transition group">
                  <div className="w-9 h-9 rounded-xl grid place-items-center mb-2" style={{ background: `${s.accent}15`, color: s.accent }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-[#06194A]">{s.label}</div>
                  <div className="text-[10px] text-[#8893A8] mt-0.5">Tap to upload</div>
                </button>
              );
            })}
          </div>
          <button onClick={() => sendAttachment("Document")} className="w-full border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFE] rounded-2xl p-6 text-center hover:bg-[#EEF0FF] transition">
            <Upload className="w-6 h-6 mx-auto text-[#4F46E5] mb-2" />
            <div className="text-sm font-semibold text-[#06194A]">Drop a file or tap to upload</div>
            <div className="text-[11px] text-[#53627A] mt-1">PDF, JPG, PNG up to 25MB · Encrypted upload</div>
          </button>
        </div>
      </SlideOver>

      {/* Offer details */}
      <SlideOver open={offerDrawer} onClose={() => setOfferDrawer(false)} title="Offer Details" subtitle={`${MOCK.vehicle.year} ${MOCK.vehicle.make} ${MOCK.vehicle.model}`} width="md">
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#F5F3FF] p-4 text-center">
            <div className="text-[11px] uppercase tracking-wide text-[#4F46E5] font-semibold">Current firm offer</div>
            <div className="text-3xl font-bold text-[#06194A] mt-1">{fmt(MOCK.firmOffer)}</div>
            <div className="text-[11px] text-[#53627A] mt-1">Valid until {MOCK.offerExpires}</div>
          </div>
          <div className="rounded-2xl bg-[#F7F8FB] p-4 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-[#53627A]">Range</span><span className="font-semibold text-[#06194A]">{fmt(MOCK.range.low)} – {fmt(MOCK.range.high)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-[#53627A]">Demand</span><span className="font-semibold text-[#16A34A]">{MOCK.marketDemand}</span></div>
            <div className="flex justify-between text-xs"><span className="text-[#53627A]">Payoff</span><span className="font-semibold text-[#06194A]">{fmt(MOCK.payment.payoff)}</span></div>
            <div className="flex justify-between text-xs pt-2 border-t border-[#E6EAF0]"><span className="text-[#06194A] font-semibold">Net to you</span><span className="font-bold text-[#16A34A]">{fmt(MOCK.payment.netPayout)}</span></div>
          </div>
        </div>
      </SlideOver>

      {/* Support drawers */}
      <SlideOver open={supportDrawer === "callback"} onClose={() => setSupportDrawer(null)} title="Request a Callback" subtitle="We'll call you back within 10 minutes" width="md"
        footer={<PrimaryButton className="w-full" onClick={() => setSupportDrawer(null)}>Request Callback</PrimaryButton>}>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-[#F7F8FB] p-4">
            <div className="text-[11px] uppercase text-[#8893A8] font-semibold">We'll call</div>
            <div className="text-[#06194A] font-semibold mt-0.5">{MOCK.customer.phone}</div>
          </div>
          <textarea rows={4} placeholder="Optional: what would you like to discuss?" className="w-full rounded-xl border border-[#E6EAF0] bg-white p-3 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </div>
      </SlideOver>

      <SlideOver open={supportDrawer === "escalate"} onClose={() => setSupportDrawer(null)} title="Escalate to a Manager" subtitle="A senior team member will take over your file" width="md"
        footer={<PrimaryButton className="w-full" onClick={() => setSupportDrawer(null)}>Send Escalation</PrimaryButton>}>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] p-4 text-[12px] text-[#92400E]">
            Escalating notifies the dealership manager. Your specialist remains your point of contact unless reassigned.
          </div>
          <textarea rows={5} placeholder="What's the issue?" className="w-full rounded-xl border border-[#E6EAF0] bg-white p-3 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
        </div>
      </SlideOver>
    </PortalPageShell>
  );
};

export default MessagesPage;
