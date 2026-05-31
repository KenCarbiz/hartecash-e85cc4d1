import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User, Bell, Shield, Building2, Lock, ChevronRight, AlertCircle,
  MessageSquare, FileText, Calendar, CreditCard, Tag, X, Mail,
  MapPin, Truck, Home, Star, Eye, ShieldCheck,
} from "lucide-react";
import { usePortalData } from "../PortalDataContext";
import { PortalPageShell, Card, SectionLabel, PrimaryButton, SecondaryButton, StatusPill } from "../PortalPageShell";
import { SlideOver } from "../SlideOver";
import {
  ProfileDrawer, SavedLocationsDrawer, PickupPreferencesDrawer,
  ADDRESS_ICONS, ADDRESS_LABELS, type PickupLocation, type TransactionStage,
} from "../AddressDrawers";

const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <button onClick={onChange} role="switch" aria-checked={on}
    className={`relative w-10 h-6 rounded-full transition ${on ? "bg-[#6D28D9]" : "bg-[#E6EAF0]"}`}>
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
  </button>
);

type Panel =
  | "profile" | "notifications" | "security" | "dealer"
  | "pickupPrefs" | "savedLocations" | "privacy" | null;

const SMS_IMPACTS = [
  { Icon: Tag, label: "Offer changes", desc: "Price adjustments, expiration warnings" },
  { Icon: FileText, label: "Document issues", desc: "Missing or rejected paperwork alerts" },
  { Icon: Calendar, label: "Pickup reminders", desc: "Schedule confirmations and driver updates" },
  { Icon: CreditCard, label: "Payment updates", desc: "Payoff confirmations and fund transfers" },
];

export const SettingsPage = () => {
  const MOCK = usePortalData();
  const [panel, setPanel] = useState<Panel>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    sms: true, email: true, push: false,
    offerUpdates: true, docReminders: true, dataShare: false,
    marketingEmail: false, thirdPartyShare: false,
  });

  // Local copy of pickup locations so saved-locations drawer can mutate state.
  const [locations, setLocations] = useState<PickupLocation[]>(MOCK.pickupLocations);
  const pickupEnabled = MOCK.dealerCapabilities.pickupEnabled;
  const stage = MOCK.transactionStage as TransactionStage;
  const defaultLocation = locations.find((l) => l.isDefault) ?? locations[0];

  const flip = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const handleSmsToggle = () => {
    if (prefs.sms) setSmsConfirmOpen(true);
    else flip("sms");
  };
  const confirmSmsOff = () => { flip("sms"); setSmsConfirmOpen(false); };

  /* Account + Transaction sections. Each opens its own right-side drawer. */
  type Section = {
    key: Panel;
    Icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
    pill?: { tone: "indigo" | "green" | "gray"; label: string };
    hidden?: boolean;
  };

  const ACCOUNT_SECTIONS: Section[] = [
    { key: "profile",       Icon: User,        title: "Profile",                 desc: "Name, contact, mailing address" },
    { key: "notifications", Icon: Bell,        title: "Notifications",           desc: "SMS, email, push, alerts" },
    { key: "security",      Icon: Shield,      title: "Security",                desc: "Password & two-factor" },
    { key: "privacy",       Icon: ShieldCheck, title: "Privacy & Consent",       desc: "Data sharing & marketing" },
  ];

  const TRANSACTION_SECTIONS: Section[] = [
    {
      key: "pickupPrefs", Icon: Truck, title: "Pickup Preferences",
      desc: pickupEnabled ? "Default window, contactless, notes" : "Dealership drop-off only",
      pill: pickupEnabled
        ? { tone: "indigo", label: "Enabled" }
        : { tone: "gray", label: "Unavailable" },
    },
    {
      key: "savedLocations", Icon: MapPin, title: "Saved Locations",
      desc: pickupEnabled ? `${locations.length} pickup location${locations.length === 1 ? "" : "s"}` : "Pickup not enabled by dealer",
      hidden: false, // Always show, drawer explains state when disabled.
    },
    { key: "dealer", Icon: Building2, title: "Dealership Connection", desc: `${MOCK.customer.dealer}` },
  ];

  const SectionCard = ({ s }: { s: Section }) => (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      onClick={() => setPanel(s.key)}
      className="text-left bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 hover:border-[#6D28D9]/40 hover:shadow-[0_12px_28px_-16px_rgba(79,70,229,0.35)] transition group"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#6D28D9] grid place-items-center">
          <s.Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#06194A]">{s.title}</span>
            {s.pill && <StatusPill tone={s.pill.tone}>{s.pill.label}</StatusPill>}
          </div>
          <div className="text-[11px] text-[#53627A] mt-0.5">{s.desc}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#8893A8] group-hover:text-[#6D28D9] group-hover:translate-x-0.5 transition" />
      </div>
    </motion.button>
  );

  return (
    <PortalPageShell
      title="Account & Transaction Control Center"
      subtitle="Manage your identity, logistics, and how we communicate with you."
    >
      {/* ACCOUNT */}
      <div className="mb-3"><SectionLabel>Account</SectionLabel></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7">
        {ACCOUNT_SECTIONS.map((s) => <SectionCard key={s.title} s={s} />)}
      </div>

      {/* TRANSACTION */}
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Transaction logistics</SectionLabel>
        {!pickupEnabled && (
          <span className="text-[11px] text-[#8893A8]">Pickup gated by dealer onboarding settings</span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {TRANSACTION_SECTIONS.filter((s) => !s.hidden).map((s) => <SectionCard key={s.title} s={s} />)}
      </div>

      {/* Default pickup snapshot card */}
      {pickupEnabled && defaultLocation && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#C7D2FE]/60 bg-gradient-to-br from-[#EEF0FF] via-white to-[#F7F8FB] p-5 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-[#C7D2FE]/60 text-[#6D28D9] grid place-items-center shrink-0">
              {(() => { const Icon = ADDRESS_ICONS[defaultLocation.type]; return <Icon className="w-5 h-5" />; })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-[#4338CA]">Default pickup</span>
                <StatusPill tone="indigo"><Star className="w-3 h-3" /> {ADDRESS_LABELS[defaultLocation.type]}</StatusPill>
                {defaultLocation.verified && <StatusPill tone="green">Verified</StatusPill>}
              </div>
              <div className="mt-1 text-sm font-semibold text-[#06194A]">{defaultLocation.nickname}</div>
              <div className="text-[12.5px] text-[#53627A] mt-0.5">
                {defaultLocation.street}{defaultLocation.unit ? `, ${defaultLocation.unit}` : ""} · {defaultLocation.city}, {defaultLocation.state} {defaultLocation.zip}
              </div>
            </div>
            <button
              onClick={() => setPanel("savedLocations")}
              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6D28D9] hover:underline"
            >
              Manage
            </button>
          </div>
        </motion.div>
      )}

      {!pickupEnabled && (
        <Card className="p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#F4F6FA] text-[#53627A] grid place-items-center">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#06194A]">Dealership drop-off only</div>
              <p className="text-[12.5px] text-[#53627A] mt-0.5 leading-relaxed">
                This dealership currently supports dealership drop-off only. We'll coordinate a location during scheduling.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Danger zone */}
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

      {/* ────── Drawers ────── */}
      <ProfileDrawer open={panel === "profile"} onClose={() => setPanel(null)} />

      <SavedLocationsDrawer
        open={panel === "savedLocations"}
        onClose={() => setPanel(null)}
        locations={locations}
        stage={stage}
        onChange={setLocations}
        pickupEnabled={pickupEnabled}
      />

      <PickupPreferencesDrawer
        open={panel === "pickupPrefs"}
        onClose={() => setPanel(null)}
        pickupEnabled={pickupEnabled}
        defaultLocation={defaultLocation}
      />

      {/* Notifications */}
      <SlideOver open={panel === "notifications"} onClose={() => setPanel(null)} title="Notifications"
        subtitle="Choose where and when we reach out"
        footer={<PrimaryButton onClick={() => { toast.success("Preferences saved"); setPanel(null); }} className="w-full">Save Preferences</PrimaryButton>}>
        <div className="space-y-1">
          {[
            { k: "sms" as const,           title: "SMS",                 desc: "Text alerts for offer updates", onChange: handleSmsToggle },
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
              <Toggle on={prefs[row.k]} onChange={row.onChange ?? (() => flip(row.k))} />
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
              <button className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#E6EAF0] hover:border-[#6D28D9]/40 transition text-left">
                <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#6D28D9] grid place-items-center"><r.Icon className="w-4 h-4" /></div>
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

      {/* Privacy & Consent */}
      <SlideOver open={panel === "privacy"} onClose={() => setPanel(null)} title="Privacy & Consent"
        subtitle="Control how your data is used"
        footer={<PrimaryButton onClick={() => { toast.success("Privacy preferences saved"); setPanel(null); }} className="w-full">Save Preferences</PrimaryButton>}>
        <div className="space-y-1">
          {[
            { k: "dataShare" as const,       title: "Improve dealer matching",  desc: "Anonymous usage to suggest higher-value dealers" },
            { k: "marketingEmail" as const,  title: "Marketing emails",         desc: "Tips, promotions, and updates" },
            { k: "thirdPartyShare" as const, title: "Third-party sharing",      desc: "Share with select partners for better offers" },
          ].map((row) => (
            <div key={row.k} className="flex items-center justify-between py-3 border-b border-[#EEF0F4] last:border-0">
              <div>
                <div className="text-sm font-semibold text-[#06194A]">{row.title}</div>
                <div className="text-[11px] text-[#53627A]">{row.desc}</div>
              </div>
              <Toggle on={prefs[row.k]} onChange={() => flip(row.k)} />
            </div>
          ))}
          <div className="mt-4 rounded-xl bg-[#F7F8FB] border border-[#E6EAF0] p-3 flex items-start gap-2.5">
            <Eye className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-[#53627A] leading-relaxed">
              You can request a full export of your data or revoke consents anytime from this panel.
            </p>
          </div>
        </div>
      </SlideOver>

      {/* Dealer */}
      <SlideOver open={panel === "dealer"} onClose={() => setPanel(null)} title="Dealership Connection"
        subtitle={MOCK.customer.dealer}>
        <div className="rounded-2xl bg-[#F7F8FB] p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Acquisition Manager</span><span className="font-semibold text-[#06194A]">Jordan Reyes</span></div>
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Preferred contact</span><span className="font-semibold text-[#06194A]">Email + SMS</span></div>
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Response time</span><span className="font-semibold text-[#06194A]">{MOCK.responseTime}</span></div>
          <div className="flex items-center justify-between"><span className="text-[#53627A]">Vehicle pickup</span>
            {pickupEnabled
              ? <StatusPill tone="green">Enabled</StatusPill>
              : <StatusPill tone="gray">Drop-off only</StatusPill>}
          </div>
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

      {/* SMS Turn-off confirmation modal */}
      <AnimatePresence>
        {smsConfirmOpen && (
          <>
            <motion.div
              key="sms-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSmsConfirmOpen(false)}
              className="fixed inset-0 z-50 bg-[#06194A]/50 backdrop-blur-md"
            />
            <motion.div
              key="sms-modal"
              role="dialog" aria-modal="true" aria-label="Turn off SMS updates"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FEF3E2] text-[#B45309] grid place-items-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-[17px] font-bold text-[#06194A]">You're turning off SMS updates</h3>
                <p className="text-[12.5px] text-[#53627A] mt-1.5 leading-relaxed">
                  You'll no longer receive text messages about:
                </p>
              </div>
              <div className="px-6 space-y-2.5 pb-2">
                {SMS_IMPACTS.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-xl bg-[#F7F8FB] p-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E6EAF0] text-[#6D28D9] grid place-items-center shrink-0">
                      <item.Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-1">
                      <div className="text-[13px] font-semibold text-[#06194A]">{item.label}</div>
                      <div className="text-[11.5px] text-[#8893A8] mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mx-6 mt-4 mb-2 rounded-xl bg-[#EEF0FF] border border-[#C7D2FE]/40 p-3 flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#6D28D9] mt-0.5 shrink-0" />
                <p className="text-[11.5px] text-[#6D28D9] leading-relaxed">
                  Important transaction notices may still be sent by email.
                </p>
              </div>
              <div className="flex items-center gap-3 px-6 pt-4 pb-6">
                <SecondaryButton onClick={() => setSmsConfirmOpen(false)} className="flex-1">Cancel</SecondaryButton>
                <button
                  onClick={confirmSmsOff}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#DC2626] to-[#B91C1C] hover:opacity-95 active:scale-[0.98] transition shadow-[0_8px_20px_-10px_rgba(220,38,38,0.5)]"
                >
                  Turn Off SMS
                </button>
              </div>
              <button
                onClick={() => setSmsConfirmOpen(false)} aria-label="Close"
                className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-[#F4F6FA] text-[#8893A8] grid place-items-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PortalPageShell>
  );
};

export default SettingsPage;
