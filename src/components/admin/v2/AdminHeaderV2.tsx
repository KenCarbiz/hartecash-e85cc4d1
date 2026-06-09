/**
 * Admin V2 top bar — minimal and quiet.
 *
 * A single hairline-bordered row: mobile menu toggle, a command-palette
 * search trigger (⌘K), and a user menu. Deliberately understated so the
 * content area carries the visual weight. Includes a "Classic admin"
 * escape hatch back to V1 during the beta.
 */
import { Menu, Search, LogOut, ArrowLeftRight, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "@/lib/adminConstants";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface Props {
  userName?: string;
  userRole?: string;
  dealerName?: string;
  onLogout: () => void;
  onOpenMobileNav: () => void;
}

const AdminHeaderV2 = ({ userName, userRole, dealerName, onLogout, onOpenMobileNav }: Props) => {
  const navigate = useNavigate();
  const firstName = userName?.split(" ")[0] || "there";
  const initials = (userName || "?")
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const openSearch = () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#E6EAF0] bg-white/85 px-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-[#53627A] hover:bg-[#F4F6FA] md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden flex-col leading-tight sm:flex">
        <span className="text-[13px] font-semibold text-[#06194A]">Hi {firstName} 👋</span>
        {dealerName && <span className="text-[11px] text-[#7A879C]">{dealerName}</span>}
      </div>

      {/* Search trigger */}
      <button
        type="button"
        onClick={openSearch}
        className="ml-auto flex items-center gap-2 rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#7A879C] transition hover:border-[#6D28D9]/30 hover:text-[#6D28D9]"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden rounded border border-[#E6EAF0] bg-white px-1.5 text-[10px] font-medium text-[#9AA6BC] sm:inline">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => navigate("/admin")}
        className="hidden items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2 text-[12px] font-semibold text-[#53627A] transition hover:border-[#6D28D9]/30 hover:text-[#6D28D9] lg:inline-flex"
        title="Switch back to the classic admin"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Classic admin
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-[#F4F6FA]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-[12px] font-bold text-white">
              {initials}
            </span>
            <ChevronDown className="h-4 w-4 text-[#9AA6BC]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-semibold text-[#06194A]">{userName || "Account"}</span>
            {userRole && (
              <span className="text-[11px] font-normal text-[#7A879C]">
                {ROLE_LABELS[userRole] || userRole}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/admin")}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Classic admin
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-[#B91C1C] focus:text-[#B91C1C]">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AdminHeaderV2;
