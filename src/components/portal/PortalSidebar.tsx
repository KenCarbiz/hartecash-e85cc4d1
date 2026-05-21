import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home, Car, Tag, Activity, MessageCircle, FileText, BarChart3,
  CreditCard, Truck, Settings, ChevronLeft, ChevronRight,
  Menu, X, Bell, MessageSquare, Upload, HelpCircle, Bot, ShieldCheck, Lock,
  type LucideIcon,
} from "lucide-react";
import harteLogo from "@/assets/harte-logo.png";
import { AccountMenu } from "./AccountMenu";

/* ─────────────────────────────────────────────────────────────────
   PortalSidebar — premium customer-portal navigation.
   • Desktop: fixed, 260px expanded ↔ 88px icon-only, animated.
   • Mobile : slide-in drawer triggered by <PortalMobileTopBar />.
   Matches the soft-white / light-gray / indigo accent of the
   existing /portal-preview dashboard.
   ──────────────────────────────────────────────────────────────── */

export type NavKey =
  | "dashboard" | "vehicles" | "offers" | "activity" | "messages"
  | "documents" | "analytics" | "payments" | "pickup" | "settings";

type NavItem = {
  key: NavKey;
  label: string;
  Icon: LucideIcon;
  badge?: number | string;
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", Icon: Home },
  { key: "vehicles",  label: "Vehicles",  Icon: Car },
  { key: "offers",    label: "Offers",    Icon: Tag, badge: 1 },
  { key: "activity",  label: "Activity",  Icon: Activity },
  { key: "messages",  label: "Messages",  Icon: MessageCircle, badge: 3 },
  { key: "documents", label: "Documents", Icon: FileText },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "payments",  label: "Payment Center",    Icon: CreditCard },
  { key: "pickup",    label: "Pickup Scheduling", Icon: Truck },
  { key: "settings",  label: "Settings",  Icon: Settings },
];

type Customer = { name: string; initials: string; dealer: string; email: string };

/* ── shared nav button ─────────────────────────────────────────── */
const NavButton = ({
  item, active, collapsed, onClick,
}: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void }) => {
  const { Icon, label, badge } = item;
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 text-left w-full ${
        active
          ? "bg-[#EEF0FF] text-[#4F46E5] font-semibold shadow-[0_1px_2px_rgba(79,70,229,0.08)]"
          : "text-[#53627A] hover:bg-[#F4F6FA] hover:text-[#06194A]"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {active && !collapsed && (
        <motion.span
          layoutId="nav-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-[#4F46E5]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative shrink-0">
        <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.25 : 1.8} />
        {badge && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-bold grid place-items-center ring-2 ring-white">
            {badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#EF4444] text-white text-[10px] font-bold grid place-items-center">
              {badge}
            </span>
          )}
        </>
      )}
      {/* collapsed tooltip */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#06194A] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          {label}
        </span>
      )}
    </button>
  );
};

/* ── support module (replaces duplicated profile) ─────────────── */
const SupportModule = ({ collapsed }: { collapsed: boolean }) => {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          title="Contact Support"
          className="w-11 h-11 rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] text-white grid place-items-center transition-colors shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)]"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <Lock className="w-3 h-3 text-[#8893A8]" />
          <ShieldCheck className="w-3 h-3 text-[#8893A8]" />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-1 space-y-2">
      <div className="rounded-2xl border border-[#E6EAF0] bg-gradient-to-b from-white to-[#FAFBFE] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[#06194A]">Need Help?</div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#EEF0FF] text-[#4F46E5] text-[10px] font-semibold">
            <Bot className="w-3 h-3" />
            AI
          </span>
        </div>
        <p className="text-xs text-[#53627A] mt-1.5 mb-3 leading-snug">
          Our team is here every step of the way.
        </p>
        <button className="w-full rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] active:scale-[0.98] text-white text-xs font-semibold py-2.5 inline-flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)]">
          <MessageCircle className="w-3.5 h-3.5" />
          Live Chat
        </button>
      </div>

      {/* trust bar */}
      <div className="flex items-center justify-center gap-3 px-2 py-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8893A8]">
          <ShieldCheck className="w-3 h-3 text-[#16A34A]" />
          SOC 2
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8893A8]">
          <Lock className="w-3 h-3 text-[#4F46E5]" />
          Encrypted
        </span>
      </div>
    </div>
  );
};

/* ── mobile support footer (compact) ───────────────────────────── */
const MobileSupportFooter = () => (
  <div className="px-4 pt-3 pb-5 border-t border-[#E6EAF0] bg-[#FAFBFE]">
    <div className="flex items-center gap-2 mb-3">
      <div className="text-xs font-semibold text-[#06194A]">Need Help?</div>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#EEF0FF] text-[#4F46E5] text-[10px] font-semibold">
        <Bot className="w-3 h-3" />
        AI
      </span>
    </div>
    <button className="w-full rounded-xl bg-[#4F46E5] hover:bg-[#3F37CC] active:scale-[0.98] text-white text-xs font-semibold py-2.5 inline-flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)]">
      <MessageCircle className="w-3.5 h-3.5" />
      Live Chat
    </button>
    <div className="flex items-center justify-center gap-3 mt-3">
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8893A8]">
        <ShieldCheck className="w-3 h-3 text-[#16A34A]" />
        SOC 2
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8893A8]">
        <Lock className="w-3 h-3 text-[#4F46E5]" />
        Encrypted
      </span>
    </div>
  </div>
);

/* ── desktop sidebar ───────────────────────────────────────────── */
type SidebarProps = {
  active: NavKey;
  onChange: (key: NavKey) => void;
  customer: Customer;
};

export const PortalSidebar = ({ active, onChange, customer }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 88 : 260 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="hidden lg:flex sticky top-0 self-start h-screen flex-col shrink-0 bg-white border-r border-[#E6EAF0] py-5 overflow-hidden"
    >
      {/* logo + collapse */}
      <div className={`flex items-center gap-3 px-4 mb-6 ${collapsed ? "justify-center px-2" : ""}`}>
        <div className="w-11 h-11 rounded-xl bg-white border border-[#E6EAF0] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.08)] grid place-items-center overflow-hidden p-1.5 shrink-0">
          <img src={harteLogo} alt="MOTO(acquire)" className="w-full h-full object-contain" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="leading-tight flex-1 min-w-0"
            >
              <div className="text-[14px] font-extrabold tracking-tight text-[#06194A]">
                MOTO<span className="text-[#4F46E5]">(acquire)</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.24em] text-[#8893A8] font-semibold mt-0.5 truncate">
                {customer.dealer}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-7 -right-3 w-6 h-6 rounded-full bg-white border border-[#E6EAF0] text-[#53627A] hover:text-[#4F46E5] hover:border-[#4F46E5]/40 shadow-[0_2px_6px_-2px_rgba(15,23,42,0.12)] grid place-items-center transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* nav */}
      <nav className={`flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-3" : "px-3"}`}>
        {NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={active === item.key}
            collapsed={collapsed}
            onClick={() => onChange(item.key)}
          />
        ))}
      </nav>

      {/* support only — profile lives in top-right AccountMenu */}
      <div className="mt-auto pb-3 pt-4 px-2">
        <SupportModule collapsed={collapsed} />
      </div>
    </motion.aside>
  );
};

/* ── mobile top bar + drawer ───────────────────────────────────── */
export const PortalMobileTopBar = ({
  active, onChange, customer,
}: SidebarProps) => {
  const [open, setOpen] = useState(false);

  // lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const select = (k: NavKey) => { onChange(k); setOpen(false); };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-white/90 backdrop-blur border-b border-[#E6EAF0]">
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-lg hover:bg-[#F4F6FA] grid place-items-center text-[#06194A] transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#E6EAF0] grid place-items-center overflow-hidden p-1">
            <img src={harteLogo} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="text-[13px] font-extrabold tracking-tight text-[#06194A]">
            MOTO<span className="text-[#4F46E5]">(acquire)</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="Notifications" className="relative w-9 h-9 rounded-lg hover:bg-[#F4F6FA] grid place-items-center text-[#53627A] transition-colors">
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          </button>
          <AccountMenu customer={customer} variant="mobile" onNavigate={(k) => onChange(k as NavKey)} />
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-[#06194A]/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, info) => { if (info.offset.x < -80) setOpen(false); }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[85%] max-w-[340px] bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-[#E6EAF0]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E6EAF0] grid place-items-center overflow-hidden p-1.5">
                    <img src={harteLogo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-extrabold tracking-tight text-[#06194A]">
                      MOTO<span className="text-[#4F46E5]">(acquire)</span>
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.22em] text-[#8893A8] font-semibold mt-0.5">
                      {customer.dealer}
                    </div>
                  </div>
                </div>
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-lg hover:bg-[#F4F6FA] grid place-items-center text-[#53627A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 flex flex-col gap-1 px-3 py-4 overflow-y-auto">
                {NAV.map((item) => (
                  <NavButton
                    key={item.key}
                    item={item}
                    active={active === item.key}
                    collapsed={false}
                    onClick={() => select(item.key)}
                  />
                ))}
              </nav>

              {/* mobile quick actions */}
              <div className="px-4 pt-3 pb-2 border-t border-[#E6EAF0] bg-[#FAFBFE]">
                <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#8893A8] mb-2">
                  Quick Actions
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { Icon: Upload, label: "Upload" },
                    { Icon: Tag, label: "Offer" },
                    { Icon: MessageSquare, label: "Message" },
                  ].map(({ Icon, label }) => (
                    <button
                      key={label}
                      className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-[#E6EAF0] py-3 text-[11px] font-semibold text-[#06194A] hover:border-[#4F46E5]/40 hover:text-[#4F46E5] transition-colors active:scale-[0.97]"
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                      {label}
                    </button>
                  ))}
                </div>
                <UserProfile customer={customer} collapsed={false} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
