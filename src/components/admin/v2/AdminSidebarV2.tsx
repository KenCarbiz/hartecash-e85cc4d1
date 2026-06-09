/**
 * Admin V2 sidebar — sleek, minimal, light.
 *
 * Renders the V2 navigation model (adminNavV2.ts) which mirrors every
 * classic-admin section key, so no left-bar links are lost. Self-
 * contained (no shadcn Sidebar) for full control of the minimal look:
 * white canvas, hairline borders, purple active state with a left
 * accent bar. Responsive — static rail on desktop, slide-over drawer
 * on mobile.
 */
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  buildNavGroups, pinnedItems,
  type NavFlags, type NavItem,
} from "./adminNavV2";

interface Props extends NavFlags {
  activeKey: string;
  onSelect: (key: string) => void;
  brandName?: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const Badge = ({ value, tone }: { value: number; tone?: "purple" | "red" }) => (
  <span
    className={cn(
      "ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
      tone === "red" ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#EEF0FF] text-[#6D28D9]",
    )}
  >
    {value}
  </span>
);

const Row = ({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-[#F3F0FF] font-semibold text-[#6D28D9]"
          : "text-[#3B4763] hover:bg-[#F4F6FA]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#6D28D9]" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#6D28D9]" : "text-[#7A879C]")} />
      <span className="flex-1 truncate text-left">{item.label}</span>
      {!!item.badge && item.badge > 0 && <Badge value={item.badge} tone={item.badgeTone} />}
    </button>
  );
};

const AdminSidebarV2 = (props: Props) => {
  const { activeKey, onSelect, brandName, mobileOpen, onMobileClose } = props;
  const navigate = useNavigate();
  const groups = buildNavGroups(props);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handle = (item: NavItem) => {
    if (item.href) navigate(item.href);
    else onSelect(item.key);
    onMobileClose();
  };

  const rail = (
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-[13px] font-bold text-white">
            {(brandName || "A").charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <div className="max-w-[150px] truncate text-[13px] font-semibold text-[#06194A]">
              {brandName || "Autocurb"}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#7A879C]">
              Admin · V2
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-md p-1 text-[#7A879C] hover:bg-[#F4F6FA] md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pinned landing surfaces (Command Center, Analytics) */}
      <div className="space-y-0.5 px-3 pb-2">
        {pinnedItems.map((item) => (
          <Row
            key={item.key}
            item={item}
            active={activeKey === item.key}
            onClick={() => handle(item)}
          />
        ))}
      </div>

      {/* Groups */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.label];
          const hasActive = group.items.some((i) => i.key === activeKey);
          return (
            <div key={group.label} className="pt-2">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((p) => ({ ...p, [group.label]: !p[group.label] }))
                }
                className="flex w-full items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9AA6BC] transition-colors hover:text-[#6D28D9]"
              >
                <span className="flex items-center gap-1.5">
                  {group.label}
                  {isCollapsed && hasActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6D28D9]" />
                  )}
                </span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")}
                />
              </button>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <Row
                      key={item.key}
                      item={item}
                      active={activeKey === item.key}
                      onClick={() => handle(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#E6EAF0] px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#9AA6BC]">
          Powered by Autocurb.io
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-[248px] shrink-0 border-r border-[#E6EAF0] md:block">
        {rail}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#06194A]/40" onClick={onMobileClose} />
          <div className="absolute inset-y-0 left-0 w-[270px] border-r border-[#E6EAF0] shadow-2xl">
            {rail}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSidebarV2;
