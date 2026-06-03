import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronRight, User, Bell, CreditCard, Shield, Building2,
  LifeBuoy, Tag, Upload, Calendar, MessageSquare, Repeat, LogOut, X, Check,
} from "lucide-react";
import { SlideOver } from "./SlideOver";
import { CustomerAvatar, useCustomerAvatar } from "./customerAvatar";


/* AccountMenu — premium SaaS account center for the portal.
   Desktop : floating glass dropdown anchored under the trigger.
   Mobile  : full-height bottom sheet that slides up from the bottom.
   Both share the same sections, drawers, and logout confirmation. */

type Customer = {
  name: string;
  email: string;
  initials: string;
  dealer: string;
  phone?: string;
  mailingAddress?: {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

type Props = {
  customer: Customer;
  variant?: "desktop" | "mobile";
  onNavigate?: (k: string) => void;
};

type DrawerKey =
  | "profile" | "notifications" | "payments" | "security"
  | "dealers" | "support" | "offer" | "upload" | "messages"
  | null;

const DRAWER_META: Record<Exclude<DrawerKey, null>, { title: string; subtitle?: string }> = {
  profile:       { title: "My Profile",        subtitle: "Personal details and contact info" },
  notifications: { title: "Notifications",     subtitle: "How we reach you about your deal" },
  payments:      { title: "Payment Methods",   subtitle: "Where your payout will be sent" },
  security:      { title: "Security Settings", subtitle: "Password, 2FA, and active sessions" },
  dealers:       { title: "Connected Dealers", subtitle: "Stores with access to your file" },
  support:       { title: "Support Center",    subtitle: "We're here to help, 7 days a week" },
  offer:         { title: "Current Offer",     subtitle: "Your firm offer and breakdown" },
  upload:        { title: "Upload Documents",  subtitle: "Add registration, title, or ID" },
  messages:      { title: "Messages",          subtitle: "Conversation with your dealer" },
};

const Row = ({
  icon: Icon, label, badge, onClick,
}: { icon: any; label: string; badge?: ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#EEF0FF] transition-colors text-left"
  >
    <span className="w-8 h-8 rounded-lg bg-[#F4F6FA] group-hover:bg-white text-[#6D28D9] grid place-items-center transition-colors">
      <Icon className="w-[16px] h-[16px]" />
    </span>
    <span className="flex-1 text-[13.5px] font-medium text-[#06194A]">{label}</span>
    {badge}
    <ChevronRight className="w-4 h-4 text-[#B6BECC] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
  </button>
);

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-3 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8893A8]">
    {children}
  </div>
);

const Header = ({ customer }: { customer: Customer }) => {
  const avatar = useCustomerAvatar(customer.email);
  return (
  <div className="px-5 pt-5 pb-4">
    <div className="flex items-center gap-3.5">
      <div className="relative">
        <CustomerAvatar
          value={avatar}
          initials={customer.initials}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EEF0FF] to-[#DCE0FF] text-[#6D28D9] grid place-items-center text-[15px] font-bold ring-1 ring-[#E6EAF0]"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] ring-2 ring-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold text-[#06194A] truncate">{customer.name}</div>
        <div className="text-[12px] text-[#53627A] truncate">{customer.email}</div>
        <div className="text-[11px] text-[#8893A8] truncate mt-0.5">{customer.dealer}</div>
      </div>
    </div>
    <div className="mt-3.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#047857] text-[11px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
      Active Transaction
    </div>
  </div>
  );
};

/* Lightweight drawer body content — wired to mock data but presentation-only. */
const DrawerBody = ({ which, customer }: { which: Exclude<DrawerKey, null>; customer: Customer }) => {
  if (which === "profile") {
    const addr = customer.mailingAddress;
    const addrLine = addr
      ? [
          [addr.street, addr.unit].filter(Boolean).join(" "),
          [addr.city, addr.state].filter(Boolean).join(", "),
          addr.zip,
        ].filter(Boolean).join(", ")
      : "";
    const fields: [string, string][] = [
      ["Full name", customer.name],
      ["Email", customer.email],
      ["Phone", customer.phone || "—"],
      ["Address", addrLine || "—"],
    ];
    return (
      <div className="space-y-3">
        {fields.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6EAF0] bg-white">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[#8893A8] font-semibold">{k}</div>
              <div className="text-[13.5px] text-[#06194A] font-medium mt-0.5">{v}</div>
            </div>
            <button className="text-[12.5px] font-semibold text-[#6D28D9] hover:underline">Edit</button>
          </div>
        ))}
      </div>
    );
  }
  if (which === "notifications") {
    const items = [
      ["Offer updates", "Push, Email, SMS", true],
      ["Document requests", "Push, Email", true],
      ["Pickup reminders", "SMS", true],
      ["Marketing emails", "Off", false],
    ] as const;
    return (
      <div className="space-y-2.5">
        {items.map(([label, channel, on]) => (
          <div key={label} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6EAF0] bg-white">
            <div>
              <div className="text-[13.5px] font-semibold text-[#06194A]">{label}</div>
              <div className="text-[12px] text-[#53627A] mt-0.5">{channel}</div>
            </div>
            <span className={`w-10 h-6 rounded-full relative transition-colors ${on ? "bg-[#6D28D9]" : "bg-[#E6EAF0]"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (which === "payments") {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-2xl border border-[#E6EAF0] bg-gradient-to-br from-[#6D28D9] to-[#7C6BFF] text-white">
          <div className="text-[11px] uppercase tracking-wider opacity-80">Primary payout</div>
          <div className="text-[16px] font-bold mt-2">ACH • Chase •••• 4127</div>
          <div className="text-[12px] opacity-80 mt-1">Verified May 11, 2025</div>
        </div>
        <button className="w-full p-3.5 rounded-xl border border-dashed border-[#C7CEDB] text-[#6D28D9] font-semibold text-[13.5px] hover:bg-[#EEF0FF] transition-colors">
          + Add payment method
        </button>
      </div>
    );
  }
  if (which === "security") {
    return (
      <div className="space-y-3">
        {[
          ["Password", "Last changed 32 days ago", "Update"],
          ["Two-factor authentication", "SMS verification enabled", "Manage"],
          ["Active sessions", "1 device — this Mac", "Review"],
        ].map(([t, s, cta]) => (
          <div key={t} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6EAF0]">
            <div>
              <div className="text-[13.5px] font-semibold text-[#06194A]">{t}</div>
              <div className="text-[12px] text-[#53627A] mt-0.5">{s}</div>
            </div>
            <button className="text-[12.5px] font-semibold text-[#6D28D9] hover:underline">{cta}</button>
          </div>
        ))}
      </div>
    );
  }
  if (which === "dealers") {
    return (
      <div className="space-y-3">
        {[
          [customer.dealer, "Acquisition Manager • Active deal"],
          ["Capital Auto Group", "No active deals"],
        ].map(([n, sub]) => (
          <div key={n} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6EAF0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#6D28D9] grid place-items-center font-bold">
                {n.split(" ").map(w => w[0]).slice(0, 2).join("")}
              </div>
              <div>
                <div className="text-[13.5px] font-semibold text-[#06194A]">{n}</div>
                <div className="text-[12px] text-[#53627A] mt-0.5">{sub}</div>
              </div>
            </div>
            <button className="text-[12.5px] font-semibold text-[#6D28D9] hover:underline">Manage</button>
          </div>
        ))}
      </div>
    );
  }
  if (which === "support") {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-[#EEF0FF] border border-[#DCE0FF]">
          <div className="text-[13.5px] font-bold text-[#06194A]">Need a hand?</div>
          <div className="text-[12.5px] text-[#53627A] mt-1">Our team typically replies in under 5 minutes during business hours.</div>
          <button className="mt-3 px-4 py-2 rounded-lg bg-[#6D28D9] text-white text-[13px] font-semibold hover:bg-[#4338CA] transition-colors">Start a chat</button>
        </div>
        {[["Help articles", "Browse common questions"], ["Email support", "help@motoacquire.com"], ["Call us", "(800) 555-0142 • Mon–Sat"]].map(([t, s]) => (
          <div key={t} className="p-3.5 rounded-xl border border-[#E6EAF0]">
            <div className="text-[13.5px] font-semibold text-[#06194A]">{t}</div>
            <div className="text-[12px] text-[#53627A] mt-0.5">{s}</div>
          </div>
        ))}
      </div>
    );
  }
  if (which === "offer") {
    return (
      <div className="space-y-3">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#06194A] to-[#1E2E66] text-white">
          <div className="text-[11px] uppercase tracking-wider opacity-70">Firm offer</div>
          <div className="text-[34px] font-extrabold mt-2 tracking-tight">$20,150</div>
          <div className="text-[12px] opacity-80 mt-1">Valid until May 17, 2025</div>
        </div>
        {[["Vehicle", "2021 Toyota RAV4 XLE"], ["Mileage", "26,540"], ["Payoff", "$0"], ["Net to you", "$20,150"]].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#E6EAF0]">
            <span className="text-[12.5px] text-[#53627A]">{k}</span>
            <span className="text-[13.5px] font-semibold text-[#06194A]">{v}</span>
          </div>
        ))}
      </div>
    );
  }
  if (which === "upload") {
    return (
      <div className="space-y-3">
        <button className="w-full p-6 rounded-2xl border-2 border-dashed border-[#C7CEDB] hover:border-[#6D28D9] hover:bg-[#EEF0FF] transition-colors text-center">
          <Upload className="w-6 h-6 mx-auto text-[#6D28D9]" />
          <div className="mt-2 text-[13.5px] font-semibold text-[#06194A]">Drag files or browse</div>
          <div className="text-[12px] text-[#53627A] mt-0.5">PDF, JPG, PNG up to 10 MB</div>
        </button>
        {[["Payoff Statement", "Needed"], ["Insurance Card", "Needed"]].map(([n, s]) => (
          <div key={n} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6EAF0]">
            <div className="text-[13.5px] font-semibold text-[#06194A]">{n}</div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF7E6] text-[#B45309]">{s}</span>
          </div>
        ))}
      </div>
    );
  }
  if (which === "messages") {
    const msgs = [
      { me: false, t: "Thanks! Your vehicle details look great.", time: "10:02 AM" },
      { me: false, t: "We're excited to make you a firm offer.", time: "10:02 AM" },
      { me: true,  t: "Awesome — what are the next steps?",     time: "10:08 AM" },
      { me: false, t: "Just upload the payoff statement and we'll get pickup scheduled.", time: "10:11 AM" },
    ];
    return (
      <div className="flex flex-col gap-2.5">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${m.me ? "self-end bg-[#6D28D9] text-white rounded-br-md" : "self-start bg-[#F4F6FA] text-[#06194A] rounded-bl-md"}`}>
            {m.t}
            <div className={`text-[10px] mt-1 ${m.me ? "text-white/70" : "text-[#8893A8]"}`}>{m.time}</div>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AccountMenu = ({ customer, variant = "desktop", onNavigate }: Props) => {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const avatar = useCustomerAvatar(customer.email);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const go = (k: string) => { setOpen(false); onNavigate?.(k); };
  const openDrawer = (k: Exclude<DrawerKey, null>) => { setOpen(false); setDrawer(k); };

  const Menu = (
    <div className="flex flex-col">
      <Header customer={customer} />
      <div className="border-t border-[#E6EAF0]" />

      <div className="px-2 pb-2">
        <SectionLabel>Account</SectionLabel>
        <Row icon={User}      label="My Profile"        onClick={() => openDrawer("profile")} />
        <Row icon={Bell}      label="Notifications"     badge={<span className="text-[10px] font-bold text-white bg-[#EF4444] px-1.5 py-0.5 rounded-full">3</span>} onClick={() => openDrawer("notifications")} />
        <Row icon={CreditCard}label="Payment Methods"   onClick={() => openDrawer("payments")} />
        <Row icon={Shield}    label="Security Settings" onClick={() => openDrawer("security")} />
        <Row icon={Building2} label="Connected Dealers" onClick={() => openDrawer("dealers")} />
        <Row icon={LifeBuoy}  label="Support Center"    onClick={() => openDrawer("support")} />
      </div>

      <div className="border-t border-[#E6EAF0]" />
      <div className="px-2 pb-2">
        <SectionLabel>Current Transaction</SectionLabel>
        <Row icon={Tag}            label="Current Offer"      onClick={() => openDrawer("offer")} />
        <Row icon={Upload}         label="Upload Documents"   onClick={() => openDrawer("upload")} />
        <Row icon={Calendar}       label="Schedule Pickup"    onClick={() => go("pickup")} />
        <Row icon={MessageSquare}  label="Messages"           onClick={() => openDrawer("messages")} />
      </div>

      <div className="border-t border-[#E6EAF0]" />
      <div className="px-2 py-2">
        <Row icon={Repeat} label="Switch Account" onClick={() => setOpen(false)} />
        <button
          onClick={() => { setOpen(false); setConfirmLogout(true); }}
          className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#FEF2F2] transition-colors text-left"
        >
          <span className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#DC2626] grid place-items-center">
            <LogOut className="w-[16px] h-[16px]" />
          </span>
          <span className="flex-1 text-[13.5px] font-semibold text-[#DC2626]">Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div ref={wrapRef} className="relative">
        {variant === "desktop" ? (
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-full border border-transparent hover:border-[#E6EAF0] hover:bg-white transition-all"
          >
            <div className="relative">
              <CustomerAvatar
                value={avatar}
                initials={customer.initials}
                className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#6D28D9] grid place-items-center text-xs font-semibold ring-1 ring-transparent hover:ring-[#DCE0FF] transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#F7F8FB]" />
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <div className="text-sm font-semibold text-[#06194A]">{customer.name}</div>
              <div className="text-[11px] text-[#53627A]">{customer.dealer}</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#53627A] transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open account menu"
            className="w-9 h-9 rounded-full"
          >
            <CustomerAvatar
              value={avatar}
              initials={customer.initials}
              className="w-9 h-9 rounded-full bg-[#EEF0FF] text-[#6D28D9] grid place-items-center text-xs font-semibold"
            />
          </button>
        )}

        {/* Desktop floating dropdown */}
        <AnimatePresence>
          {open && variant === "desktop" && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full mt-2 w-[340px] rounded-[20px] bg-white/95 backdrop-blur-xl border border-[#E6EAF0] shadow-[0_20px_50px_-20px_rgba(6,25,74,0.25)] z-[60] overflow-hidden"
            >
              {Menu}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && variant === "mobile" && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[55] bg-[#06194A]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => { if (info.offset.y > 100) setOpen(false); }}
              className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
            >
              <div className="pt-2 pb-1 grid place-items-center">
                <span className="w-10 h-1.5 rounded-full bg-[#E6EAF0]" />
              </div>
              <div className="overflow-y-auto pb-[max(env(safe-area-inset-bottom),12px)]">
                {Menu}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contextual drawers */}
      <SlideOver
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer ? DRAWER_META[drawer].title : ""}
        subtitle={drawer ? DRAWER_META[drawer].subtitle : undefined}
        width="lg"
      >
        {drawer && <DrawerBody which={drawer} customer={customer} />}
      </SlideOver>

      {/* Logout confirmation */}
      <AnimatePresence>
        {confirmLogout && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setConfirmLogout(false)}
              className="fixed inset-0 z-[70] bg-[#06194A]/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="dialog" aria-modal="true"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[92%] max-w-[400px] bg-white rounded-2xl shadow-2xl p-6"
            >
              <div className="w-12 h-12 rounded-full bg-[#FEF2F2] text-[#DC2626] grid place-items-center mb-4">
                <LogOut className="w-5 h-5" />
              </div>
              <h3 className="text-[17px] font-bold text-[#06194A]">Log out of MOTO(acquire)?</h3>
              <p className="text-[13.5px] text-[#53627A] mt-1.5">
                You'll need to sign back in with your email to view your offer and continue your transaction.
              </p>
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#E6EAF0] text-[#06194A] font-semibold text-[13.5px] hover:bg-[#F4F6FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#6D28D9] text-white font-semibold text-[13.5px] hover:bg-[#4338CA] transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Log out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AccountMenu;
