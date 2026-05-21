import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Bell, Shield, Building2, Lock, ChevronRight, AlertCircle,
  MessageSquare, FileText, Calendar, CreditCard, Tag, X, Mail
} from "lucide-react";
import { PORTAL_MOCK as MOCK } from "../portalMock";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";

const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <button onClick={onChange} role="switch" aria-checked={on}
    className={`relative w-10 h-6 rounded-full transition ${on ? "bg-[#4F46E5]" : "bg-[#E6EAF0]"}`}>
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
  </button>
);

type Panel = "profile" | "notifications" | "security" | "dealer" | null;

export const SettingsPage = () => {
  const [panel, setPanel] = useState<Panel>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    sms: true, email: true, push: false,
    offerUpdates: true, docReminders: true, dataShare: false,
  });
  const flip = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const SECTIONS: { key: Panel; Icon: React.ComponentType<{ className?: string }>; title: string; desc: string }[] = [
    { key: "profile",       Icon: User,      title: "Profile",            desc: "Name, contact, avatar" },
    { key: "notifications", Icon: Bell,      title: "Notifications",      desc: "SMS, email, push" },
    { key: "security",      Icon: Shield,    title: "Security",           desc: "Password & 2FA" },
    { key: "dealer",        Icon: Building2, title: "Dealership Connection", desc: "Manager & preferences" },
  ];

  return (
    <PortalPageShell title="Settings" subtitle="Manage your account, notifications, and privacy.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setPanel(s.key)}
            className="text-left bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 hover:border-[#4F46E5]/40 hover:shadow-[0_8px_24px_-12px_rgba(79,70,229,0.25)] transition group">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                <s.Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#06194A]">{s.title}</div>
                <div className="text-[11px] text-[#53627A] mt-0.5">{s.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8893A8] group-hover:text-[#4F46E5] group-hover:translate-x-0.5 transition" />
            </div>
          </button>
        ))}
      </div>

      {/* Privacy / Danger zone */}
      <Card className="p-5 border-[#FECACA]">
        <SectionLabel>Privacy</SectionLabel>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#06194A]">Share usage data to improve dealer matching</div>
            <p className="text-[12px] text-[#53627A] mt-0.5">Helps us recommend higher-value dealers. Off by default.</p>
          </div>
          <Toggle on={prefs.dataShare} onChange={() => flip("dataShare")} />
        </div>
        <hr className="my-4 border-[#FEE2E2]" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#B91C1C]">Delete account</div>
            <p className="text-[12px] text-[#53627A] mt-0.5">Permanently delete your data and acquisition history. This cannot be undone.</p>
          </div>
          <button onClick={() => setDeleteOpen(true)} className="rounded-xl bg-white border border-[#FECACA] text-[#B91C1C] text-sm font-semibold px-4 py-2 hover:bg-[#FEF2F2] transition">
            Delete account
          </button>
        </div>
      </Card>

      {/* Profile */}
      <SlideOver open={panel === "profile"} onClose={() => setPanel(null)} title="Profile" subtitle="Update your contact details"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setPanel(null)} className="flex-1">Cancel</SecondaryButton><PrimaryButton onClick={() => setPanel(null)} className="flex-1">Save Changes</PrimaryButton></div>}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center text-lg font-bold">{MOCK.customer.initials}</div>
          <button className="text-xs font-semibold text-[#4F46E5] hover:underline">Change avatar</button>
        </div>
        {[
          { label: "Full name", value: MOCK.customer.name },
          { label: "Email",     value: MOCK.customer.email },
          { label: "Phone",     value: MOCK.customer.phone },
        ].map((f) => (
          <label key={f.label} className="block mb-3">
            <span className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{f.label}</span>
            <input defaultValue={f.value} className="mt-1 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 outline-none" />
          </label>
        ))}
      </SlideOver>

      {/* Notifications */}
      <SlideOver open={panel === "notifications"} onClose={() => setPanel(null)} title="Notifications"
        subtitle="Choose where and when we reach out"
        footer={<PrimaryButton onClick={() => setPanel(null)} className="w-full">Save Preferences</PrimaryButton>}>
        <div className="space-y-1">
          {[
            { k: "sms" as const,           title: "SMS",                 desc: "Text alerts for offer updates" },
            { k: "email" as const,         title: "Email",               desc: "Receipts, summaries, weekly digest" },
            { k: "push" as const,          title: "Push notifications",  desc: "On-device alerts" },
            { k: "offerUpdates" as const,  title: "Offer updates",       desc: "When your offer changes or expires" },
            { k: "docReminders" as const,  title: "Document reminders",  desc: "Nudges for missing docs" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between py-3 border-b border-[#EEF0F4] last:border-0">
              <div>
                <div className="text-sm font-semibold text-[#06194A]">{row.title}</div>
                <div className="text-[11px] text-[#53627A]">{row.desc}</div>
              </div>
              <Toggle on={prefs[row.k]} onChange={() => flip(row.k)} />
            </div>
          ))}
        </div>
      </SlideOver>

      {/* Security */}
      <SlideOver open={panel === "security"} onClose={() => setPanel(null)} title="Security"
        subtitle="Protect your account">
        <ul className="space-y-2">
          {[
            { Icon: Lock, title: "Change password", desc: "Last updated 32 days ago" },
            { Icon: Shield, title: "Two-factor authentication", desc: "SMS code on sign-in", pill: "On" as const },
            { Icon: User, title: "Trusted devices", desc: "2 active devices" },
          ].map((r) => (
            <li key={r.title}>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#E6EAF0] hover:border-[#4F46E5]/40 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center"><r.Icon className="w-4 h-4" /></div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[#06194A]">{r.title}</div>
                  <div className="text-[11px] text-[#53627A]">{r.desc}</div>
                </div>
                {r.pill && <StatusPill tone="green">{r.pill}</StatusPill>}
                <ChevronRight className="w-4 h-4 text-[#8893A8]" />
              </button>
            </li>
          ))}
        </ul>
      </SlideOver>

      {/* Dealer */}
      <SlideOver open={panel === "dealer"} onClose={() => setPanel(null)} title="Dealership Connection"
        subtitle={MOCK.customer.dealer}>
        <div className="rounded-2xl bg-[#F7F8FB] p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Acquisition Manager</span><span className="font-semibold text-[#06194A]">Jordan Reyes</span></div>
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Preferred contact</span><span className="font-semibold text-[#06194A]">Email + SMS</span></div>
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Response time</span><span className="font-semibold text-[#06194A]">{MOCK.responseTime}</span></div>
        </div>
        <button className="mt-4 text-xs font-semibold text-[#DC2626] hover:underline">Disconnect dealership</button>
      </SlideOver>

      {/* Delete account modal as slide-over */}
      <SlideOver open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account" width="md"
        footer={<div className="flex gap-2"><SecondaryButton onClick={() => setDeleteOpen(false)} className="flex-1">Cancel</SecondaryButton>
          <button onClick={() => setDeleteOpen(false)} className="flex-1 rounded-xl bg-[#DC2626] text-white text-sm font-semibold py-2.5 hover:bg-[#B91C1C] transition">Permanently delete</button></div>}>
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 inline-flex items-start gap-2 text-[12.5px] text-[#B91C1C]">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          This deletes your profile, vehicle submissions, offers, and message history. We can't recover it.
        </div>
        <p className="text-sm text-[#53627A] mt-4">Type <span className="font-semibold text-[#06194A]">DELETE</span> to confirm.</p>
        <input className="mt-2 w-full rounded-xl border border-[#E6EAF0] px-3 py-2.5 text-sm focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 outline-none" />
      </SlideOver>
    </PortalPageShell>
  );
};

export default SettingsPage;
