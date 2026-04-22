/**
 * AdminShell — the chrome that wraps EVERY admin page.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  [top header: logo · dealer · KC avatar]                │
 *   ├────────────┬────────────────────────────────────────────┤
 *   │ sidebar    │                                            │
 *   │  Pipeline  │     {children}  ← pipeline page lives here│
 *   │  Acquis.   │                                            │
 *   │  Config    │     (Customer File slide-out opens        │
 *   │  ...       │      OVER this content area, NOT over     │
 *   │            │      the sidebar — keeps navigation       │
 *   │            │      reachable.)                          │
 *   └────────────┴────────────────────────────────────────────┘
 *
 * This is a faithful simplification of AdminSidebar + AdminHeader
 * from the real hartecash codebase — same group ordering, same
 * iconography, same density. Reduced to only the sections a sales
 * manager / salesperson would actually see (role-gated in prod).
 */

const AdminShellIcons = {
  Inbox: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M3 3a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V3zm2 0v6h3l1 2h2l1-2h3V3H5zm0 8v2h10v-2h-2.6l-1 2h-2.8l-1-2H5z"/></svg>,
  Calendar: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M6 2a1 1 0 012 0v1h4V2a1 1 0 112 0v1h1a2 2 0 012 2v11a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2h1V2zm-1 6v8h10V8H5z"/></svg>,
  Users: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M7 8a3 3 0 100-6 3 3 0 000 6zm6 0a2 2 0 100-4 2 2 0 000 4zM1 16a6 6 0 1112 0v1H1v-1zm13 1h5v-1a4 4 0 00-6-3.46c.6.9 1 2 1 3.2V17z"/></svg>,
  Chart: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M3 12h2v5H3v-5zm5-6h2v11H8V6zm5 3h2v8h-2V9zM1 1h1v18H1V1zm18 17H2v1h17v-1z"/></svg>,
  Scan: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M2 3a2 2 0 012-2h3v2H4v3H2V3zm11-2h3a2 2 0 012 2v3h-2V3h-3V1zM2 14h2v3h3v2H4a2 2 0 01-2-2v-3zm14 0h2v3a2 2 0 01-2 2h-3v-2h3v-3zM1 9h18v2H1V9z"/></svg>,
  Zap: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M11 2L3 11h5l-2 7 9-10h-5l1-6z"/></svg>,
  Sliders: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M3 5a2 2 0 114 0H17v2H7a2 2 0 01-4 0H1V5h2zm10 4a2 2 0 114 0h0v2h0a2 2 0 01-4 0H1V9h12zm-10 4a2 2 0 114 0H17v2H7a2 2 0 01-4 0H1v-2h2z"/></svg>,
  Shield: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 1L3 4v6c0 4 3 7 7 9 4-2 7-5 7-9V4l-7-3zm0 4a2 2 0 110 4 2 2 0 010-4zm-3 9c0-1.7 1.3-3 3-3s3 1.3 3 3v1H7v-1z"/></svg>,
  Megaphone: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M2 8v4h2l4 3V5L4 8H2zm10-4v12l6-2V6l-6-2zm-5 10l1 3h2l-1-3H7z"/></svg>,
  Palette: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 1a9 9 0 100 18c1.5 0 2-.9 2-2 0-.6-.3-1-.7-1.3-.5-.4-.6-1-.3-1.5.4-.7 1.2-1.2 2-1.2h2c2 0 4-1.5 4-4 0-4.2-4-7-9-7zm-4 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>,
  Send: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M1 9l18-8-8 18-2-7-8-3z"/></svg>,
  Globe: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 1a9 9 0 100 18 9 9 0 000-18zm-.5 2.1v3.4H6.4a7.1 7.1 0 013.1-3.4zm1 0a7.1 7.1 0 013.1 3.4h-3.1V3.1zM4.4 8.5h3.1v3H4.4a7 7 0 010-3zm4.1 0h3v3h-3v-3zm4 0h3.1a7 7 0 010 3h-3.1v-3zM6.4 13.5h3.1v3.4a7.1 7.1 0 01-3.1-3.4zm4.1 0h3.1a7.1 7.1 0 01-3.1 3.4v-3.4z"/></svg>,
  Settings: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 7a3 3 0 100 6 3 3 0 000-6zm7-1l-2-.3a5.5 5.5 0 00-.5-1.2l1.2-1.6-1.4-1.4-1.6 1.2c-.4-.2-.8-.4-1.2-.5L11 1H9l-.3 2a5.5 5.5 0 00-1.2.5L5.9 2.3 4.5 3.7l1.2 1.6c-.2.4-.4.8-.5 1.2L3 7v2l2 .3c.1.4.3.8.5 1.2l-1.2 1.6 1.4 1.4 1.6-1.2c.4.2.8.4 1.2.5L9 14h2l.3-2c.4-.1.8-.3 1.2-.5l1.6 1.2 1.4-1.4-1.2-1.6c.2-.4.4-.8.5-1.2L17 9V7z"/></svg>,
  Link: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M12 4.5a3.5 3.5 0 015 5l-3 3a3.5 3.5 0 01-5 0 1 1 0 011.4-1.4 1.5 1.5 0 002.2 0l3-3a1.5 1.5 0 00-2.2-2.2l-1 1A1 1 0 0111 5.5l1-1zm-4 4a3.5 3.5 0 015 0 1 1 0 01-1.4 1.4 1.5 1.5 0 00-2.2 0l-3 3a1.5 1.5 0 002.2 2.2l1-1a1 1 0 011.4 1.4l-1 1a3.5 3.5 0 11-5-5l3-3z"/></svg>,
  Award: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 1a6 6 0 00-3.2 11l-.8 6 4-2 4 2-.8-6A6 6 0 0010 1zm0 2a4 4 0 110 8 4 4 0 010-8z"/></svg>,
  Bell: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M10 2a5 5 0 015 5v3l2 3H3l2-3V7a5 5 0 015-5zm-2 13a2 2 0 104 0H8z"/></svg>,
  Menu: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M3 5h14v2H3V5zm0 4h14v2H3V9zm0 4h14v2H3v-2z"/></svg>,
  Panel: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h4V4H4zm6 0v12h6V4h-6z"/></svg>,
  Moon: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M15 12A7 7 0 018 5c0-1.2.3-2.3.8-3.3A8 8 0 1017.3 15H15z"/></svg>,
  Logout: (props) => <svg viewBox="0 0 20 20" fill="currentColor" {...props}><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2v-2h-2v2H4V5h6v2h2V5a2 2 0 00-2-2H4zm10 5l-1.4 1.4L14.2 11H8v2h6.2l-1.6 1.6L14 16l4-4-4-4z"/></svg>,
};

const sidebarGroups = [
  {
    label: "Pipeline",
    items: [
      { key: "submissions",       label: "All Leads",          icon: "Inbox",   badge: "4",   active: true },
      { key: "accepted-appts",    label: "Appointments",       icon: "Calendar", badge: "2" },
      { key: "appraiser-queue",   label: "Appraiser Queue",    icon: "Users",   badge: "1", badgeTone: "red" },
      { key: "executive",         label: "Performance",        icon: "Chart" },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { key: "inspection-checkin", label: "Inspection Check-In", icon: "Scan" },
      { key: "service-quick-entry", label: "Service Quick Entry", icon: "Zap" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { key: "offer-settings",   label: "Offer Logic",         icon: "Sliders" },
      { key: "inspection-config", label: "Inspection Sheet",   icon: "Shield" },
      { key: "promotions",       label: "Promotions",          icon: "Megaphone" },
      { key: "notifications",    label: "Notifications",       icon: "Bell" },
    ],
  },
  {
    label: "Storefront",
    items: [
      { key: "site-config",      label: "Branding",            icon: "Palette" },
      { key: "rooftop-websites", label: "Rooftop Websites",    icon: "Globe" },
    ],
  },
  {
    label: "My Tools",
    items: [
      { key: "my-lead-link",     label: "My Lead Link",        icon: "Link" },
      { key: "my-referrals",     label: "My Referrals",        icon: "Award" },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "reports",          label: "Reports & Export",    icon: "Send" },
      { key: "compliance",       label: "Compliance",          icon: "Shield" },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "staff",            label: "Staff & Permissions", icon: "Users" },
      { key: "system-settings",  label: "System Settings",     icon: "Settings" },
    ],
  },
];

function AdminShellSidebar({ collapsed }) {
  const Icon = ({ name, className }) => {
    const Cmp = AdminShellIcons[name] || AdminShellIcons.Inbox;
    return <Cmp className={className} />;
  };

  return (
    <aside
      className={`shrink-0 h-full bg-white border-r border-slate-200 flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Scrollable groups */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sidebarGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-4 pb-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => (
                <li key={item.key}>
                  <button
                    className={`w-full group flex items-center gap-2.5 rounded-md text-[13px] font-medium transition ${
                      collapsed ? "justify-center h-9" : "px-2.5 h-9"
                    } ${
                      item.active
                        ? "bg-[#003b80] text-white hover:bg-[#003b80]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      name={item.icon}
                      className={`w-4 h-4 shrink-0 ${
                        item.active ? "text-white" : "text-slate-500 group-hover:text-slate-700"
                      }`}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
                              item.badgeTone === "red"
                                ? "bg-red-500 text-white"
                                : item.active
                                ? "bg-white/20 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — user chip */}
      {!collapsed ? (
        <div className="border-t border-slate-100 p-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-[11px] font-bold flex items-center justify-center">KC</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-slate-800 truncate">Ken Carbiz</div>
            <div className="text-[10.5px] text-slate-500 truncate">Sales Manager</div>
          </div>
          <button className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700" title="Sign out">
            <AdminShellIcons.Logout className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="border-t border-slate-100 p-2 flex justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-[11px] font-bold flex items-center justify-center">KC</div>
        </div>
      )}
    </aside>
  );
}

function AdminShellHeader({ onToggleSidebar, dealerName = "Hartford Toyota" }) {
  return (
    <header className="shrink-0 h-12 bg-gradient-to-r from-[#003b80] via-[#004a9c] to-[#0057b8] text-white shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)]" />
      <div className="relative h-full px-3 flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
          aria-label="Toggle Sidebar"
        >
          <AdminShellIcons.Panel className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center text-[#003b80] text-[12px] font-black tracking-tight">AC</div>
          <span className="font-display text-[15px] leading-none">AutoCurb<span className="text-white/60 text-[12px] font-normal ml-1">Admin</span></span>
        </div>
        <div className="hidden md:block h-5 w-px bg-white/15 mx-1" />
        <div className="hidden md:block text-[12.5px] text-white/85 truncate">{dealerName}</div>

        <div className="flex-1" />

        {/* Right side: quick search, bell, dark, user */}
        <div className="hidden lg:flex items-center gap-2 text-[12px] text-white/80 bg-white/10 hover:bg-white/15 rounded-md px-2.5 h-7 min-w-[220px] cursor-text transition">
          <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 20 20" fill="currentColor"><path d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.7 3.7l4.8 4.8a1 1 0 01-1.4 1.4l-4.8-4.8A6 6 0 012 8z"/></svg>
          <span className="text-white/55">Search leads, VINs, customers…</span>
          <kbd className="ml-auto text-[10px] text-white/50 bg-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </div>
        <button className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition relative">
          <AdminShellIcons.Bell className="w-3.5 h-3.5" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
        <button className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition">
          <AdminShellIcons.Moon className="w-3.5 h-3.5" />
        </button>
        <div className="h-5 w-px bg-white/15 mx-1" />
        <div className="flex items-center gap-2">
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-[12px] font-semibold">Ken</div>
            <div className="text-[10px] text-white/60">Sales Manager</div>
          </div>
          <div className="w-7 h-7 rounded-full bg-white/15 text-white text-[11px] font-bold flex items-center justify-center">KC</div>
        </div>
      </div>
    </header>
  );
}

/**
 * AdminShell — wraps its children in the admin chrome.
 *
 * Props:
 *   children       — the page content (pipeline, settings, etc.)
 *   overlay        — React node rendered on top of the content area
 *                    ONLY (not over the sidebar). Use this for the
 *                    Customer File slide-out so the sales manager
 *                    can still reach the nav while reviewing a lead.
 */
function AdminShell({ children, overlay }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
      <AdminShellHeader onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="flex-1 flex min-h-0 relative">
        <AdminShellSidebar collapsed={collapsed} />
        {/* Content area — relative so the overlay is clipped to it */}
        <main className="flex-1 overflow-y-auto relative">
          {children}
          {overlay}
        </main>
      </div>
    </div>
  );
}

window.AdminShell = AdminShell;
