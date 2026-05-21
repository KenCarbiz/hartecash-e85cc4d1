import { useState } from "react";
import { Send, Paperclip, Smile, Phone, Mail, ChevronLeft, Search, Upload } from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

type Msg = { who: "you" | "dealer"; text: string; time: string; read?: boolean };

const THREADS: Record<string, Msg[]> = {
  liberty: [
    { who: "dealer", text: "Hi Alex — your RAV4 looks great. Confirming a few details now.", time: "10:02 AM" },
    { who: "you",    text: "Thanks! Anything else you need from me?", time: "10:05 AM", read: true },
    { who: "dealer", text: "We're excited to make you a firm offer.", time: "2m ago" },
  ],
  support: [{ who: "dealer", text: "Anything else we can help with?", time: "1h ago" }],
  pickup:  [{ who: "dealer", text: "Please confirm a pickup window.",  time: "3h ago" }],
};

export const MessagesPage = () => {
  const [active, setActive] = useState<string>("liberty");
  const [mobileChat, setMobileChat] = useState(false);
  const [profile, setProfile] = useState(false);
  const [attach, setAttach] = useState(false);

  const conv = MOCK.conversations.find((c) => c.id === active)!;
  const msgs = THREADS[active] ?? [];

  return (
    <PortalPageShell title="Messages" subtitle="Secure communication with your dealer team.">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] min-h-[560px]">
          {/* Conversations list */}
          <aside className={`border-r border-[#E6EAF0] flex flex-col ${mobileChat ? "hidden lg:flex" : "flex"}`}>
            <div className="p-4 border-b border-[#E6EAF0]">
              <div className="flex items-center gap-2 rounded-xl bg-[#F7F8FB] px-3 py-2">
                <Search className="w-4 h-4 text-[#8893A8]" />
                <input placeholder="Search conversations" className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#8893A8]" />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {MOCK.conversations.map((c) => {
                const sel = c.id === active;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => { setActive(c.id); setMobileChat(true); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition border-l-2 ${sel ? "border-[#4F46E5] bg-[#EEF0FF]/40" : "border-transparent hover:bg-[#F7F8FB]"}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-xs font-bold shrink-0">{c.initials}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#06194A] truncate">{c.name}</span>
                          <span className="text-[10px] text-[#8893A8] shrink-0 ml-1">{c.time}</span>
                        </div>
                        <div className="text-[11px] text-[#53627A] truncate">{c.last}</div>
                      </div>
                      {c.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold grid place-items-center shrink-0">{c.unread}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Chat */}
          <section className={`flex flex-col ${!mobileChat ? "hidden lg:flex" : "flex"}`}>
            <header className="flex items-center gap-3 px-4 py-3 border-b border-[#E6EAF0]">
              <button onClick={() => setMobileChat(false)} className="lg:hidden p-2 rounded-lg hover:bg-[#F4F6FA] text-[#53627A]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-xs font-bold">{conv.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#06194A] truncate">{conv.name}</div>
                <div className="text-[11px] text-[#16A34A] font-medium inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Active
                </div>
              </div>
              <button onClick={() => setProfile(true)} className="lg:hidden text-xs font-semibold text-[#4F46E5]">Profile</button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFBFE]">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.who === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
                    m.who === "you" ? "bg-[#4F46E5] text-white" : "bg-white border border-[#E6EAF0] text-[#06194A]"
                  }`}>
                    {m.text}
                    <div className={`text-[10px] mt-1 ${m.who === "you" ? "text-white/70" : "text-[#8893A8]"}`}>
                      {m.time}{m.who === "you" && m.read ? " • Read" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick replies */}
            <div className="px-4 py-2 border-t border-[#E6EAF0] flex items-center gap-2 overflow-x-auto">
              {["Thanks!", "When can I pick up?", "Send me the offer", "Ask a question"].map((q) => (
                <button key={q} className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F4F6FA] hover:bg-[#EEF0FF] hover:text-[#4F46E5] text-[#53627A] transition">
                  {q}
                </button>
              ))}
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-[#E6EAF0] flex items-center gap-2">
              <button onClick={() => setAttach(true)} aria-label="Attach" className="p-2 rounded-lg hover:bg-[#F4F6FA] text-[#53627A]">
                <Paperclip className="w-4 h-4" />
              </button>
              <input placeholder="Type a message…" className="flex-1 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
              <button aria-label="Emoji" className="p-2 rounded-lg hover:bg-[#F4F6FA] text-[#53627A]">
                <Smile className="w-4 h-4" />
              </button>
              <button aria-label="Send" className="rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] text-white p-2.5 transition">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Dealer profile (desktop) */}
          <aside className="hidden lg:flex flex-col border-l border-[#E6EAF0] p-5">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-base font-bold">{conv.initials}</div>
              <div className="text-sm font-semibold text-[#06194A] mt-2">{conv.name}</div>
              <div className="text-[11px] text-[#53627A]">{conv.role}</div>
              <div className="mt-2"><StatusPill tone="green">Verified Dealer</StatusPill></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <SecondaryButton><Phone className="w-4 h-4" /> Call</SecondaryButton>
              <SecondaryButton><Mail className="w-4 h-4" /> Email</SecondaryButton>
            </div>
            <button onClick={() => setProfile(true)} className="mt-3 text-xs font-semibold text-[#4F46E5] hover:underline">
              View full profile →
            </button>
            <div className="mt-6 rounded-2xl bg-[#F7F8FB] p-3 text-[11px] text-[#53627A] leading-snug">
              All messages are encrypted end-to-end. We never share your contact info without permission.
            </div>
          </aside>
        </div>
      </Card>

      {/* Dealer profile slide-over (mobile + "view full profile") */}
      <SlideOver open={profile} onClose={() => setProfile(false)} title={conv.name} subtitle={conv.role}
        footer={<div className="grid grid-cols-2 gap-2"><SecondaryButton><Phone className="w-4 h-4" /> Call</SecondaryButton><PrimaryButton><Mail className="w-4 h-4" /> Email</PrimaryButton></div>}>
        <div className="space-y-3 text-sm">
          <div className="rounded-2xl bg-[#F7F8FB] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Dealership</div>
            <div className="text-[#06194A] font-semibold mt-0.5">{MOCK.customer.dealer}</div>
          </div>
          <div className="rounded-2xl bg-[#F7F8FB] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Response time</div>
            <div className="text-[#06194A] font-semibold mt-0.5">{MOCK.responseTime} average</div>
          </div>
          <div className="rounded-2xl bg-[#F7F8FB] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">Trust</div>
            <div className="text-[#06194A] font-semibold mt-0.5">Verified • 4.9★ from 312 reviews</div>
          </div>
        </div>
      </SlideOver>

      {/* Attach → document drawer */}
      <SlideOver open={attach} onClose={() => setAttach(false)} title="Attach a Document" width="md"
        footer={<PrimaryButton className="w-full">Send Attachment</PrimaryButton>}>
        <button className="w-full border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFE] rounded-2xl p-8 text-center hover:bg-[#EEF0FF] transition">
          <Upload className="w-7 h-7 mx-auto text-[#4F46E5] mb-2" />
          <div className="text-sm font-semibold text-[#06194A]">Drop a file or tap to upload</div>
          <div className="text-[11px] text-[#53627A] mt-1">PDF, JPG, PNG up to 25MB</div>
        </button>
      </SlideOver>
    </PortalPageShell>
  );
};

export default MessagesPage;
