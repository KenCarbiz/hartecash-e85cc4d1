import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Inbox, CalendarDays, Users, SlidersHorizontal, Settings, Bell,
  ListChecks, MessageSquareQuote, BarChart3, Send, ShieldCheck,
  Car, Wrench, Rocket, ScrollText, Gauge, Camera, Network, MapPin, Search, Shield,
  Megaphone, Gift, Link2, Target, FileText, Phone, Palette, Activity,
  TrendingUp, Mic, LineChart, Flame, RotateCcw, Clock, Tag, Receipt, LogIn,
} from "lucide-react";
import type { Submission } from "@/lib/adminConstants";

interface AdminCommandPaletteProps {
  onNavigate: (section: string) => void;
  onViewSubmission?: (sub: Submission) => void;
  submissions: Submission[];
  allowedSections?: string[] | null;
}

// Aligned to the post-audit sidebar (May 2026). Hub keys ("communications",
// "branding", "capture-inspection", "marketing", "performance",
// "integrations", "bdc-hub") are surfaced as the primary entry; legacy
// keys are appended at the bottom under "Direct Links" so power users
// can still search by the old names without polluting the main groups.
const SECTION_MAP: { key: string; label: string; icon: React.ElementType; group: string }[] = [
  // ── Queues ──
  { key: "submissions", label: "All Leads", icon: Inbox, group: "Queues" },
  { key: "appraiser-queue", label: "Appraiser Queue", icon: RotateCcw, group: "Queues" },
  { key: "accepted-appts", label: "Appointments", icon: CalendarDays, group: "Queues" },
  { key: "bdc-hub", label: "BDC Queue", icon: Flame, group: "Queues" },

  // ── Lane Tools ──
  { key: "inspection-checkin", label: "Inspection Check-In", icon: LogIn, group: "Lane Tools" },
  { key: "service-quick-entry", label: "Service Quick Entry", icon: Wrench, group: "Lane Tools" },

  // ── My ──
  { key: "my-lead-link", label: "My Lead Link", icon: Link2, group: "My" },
  { key: "my-availability", label: "My Availability", icon: Clock, group: "My" },
  { key: "my-referrals", label: "My Referrals", icon: Gift, group: "My" },

  // ── Grow ──
  { key: "equity-mining", label: "Equity Mining", icon: TrendingUp, group: "Grow" },
  { key: "voice-ai", label: "Voice AI", icon: Mic, group: "Grow" },

  // ── Measure ──
  { key: "performance", label: "Performance", icon: LineChart, group: "Measure" },
  { key: "reports", label: "Reports & Export", icon: Send, group: "Measure" },

  // ── Setup · Dealer ──
  { key: "branding", label: "Branding", icon: Palette, group: "Setup · Dealer" },
  { key: "communications", label: "Communications", icon: Phone, group: "Setup · Dealer" },
  { key: "capture-inspection", label: "Capture & Inspection", icon: FileText, group: "Setup · Dealer" },
  { key: "locations", label: "Locations", icon: MapPin, group: "Setup · Dealer" },
  { key: "offer-settings", label: "Pricing Rules", icon: SlidersHorizontal, group: "Setup · Dealer" },

  // ── Setup · Process ──
  { key: "marketing", label: "Marketing", icon: Megaphone, group: "Setup · Process" },
  { key: "embed-toolkit", label: "Website Embed", icon: Wrench, group: "Setup · Process" },

  // ── Integrations (enterprise) ──
  { key: "integrations", label: "Integrations", icon: Activity, group: "Integrations" },

  // ── Account ──
  { key: "staff", label: "Staff & Permissions", icon: Users, group: "Account" },
  { key: "onboarding", label: "Onboarding Wizard", icon: Rocket, group: "Account" },
  { key: "system-settings", label: "System Settings", icon: Settings, group: "Account" },
  { key: "image-inventory", label: "Vehicle Image Cache", icon: Car, group: "Account" },

  // ── Platform (super admin) ──
  { key: "tenants", label: "Dealer Tenants", icon: Network, group: "Platform" },
  { key: "prospect-demo", label: "Prospect Demo", icon: Target, group: "Platform" },
  { key: "pricing-model", label: "SaaS Pricing", icon: Tag, group: "Platform" },
  { key: "platform-billing", label: "Platform & Billing", icon: Receipt, group: "Platform" },
  { key: "changelog", label: "Platform Updates", icon: ScrollText, group: "Platform" },

  // ── Direct links to the underlying tabs (legacy + power-user) ──
  // These all route into a hub on the right tab via AdminSectionRenderer.
  { key: "channels", label: "Channels", icon: Phone, group: "Direct Links" },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Direct Links" },
  { key: "compliance", label: "Compliance", icon: ShieldCheck, group: "Direct Links" },
  { key: "site-config", label: "Identity", icon: Settings, group: "Direct Links" },
  { key: "appearance", label: "Appearance", icon: Palette, group: "Direct Links" },
  { key: "landing-flow", label: "Landing Flow", icon: ListChecks, group: "Direct Links" },
  { key: "form-config", label: "Lead Form", icon: ListChecks, group: "Direct Links" },
  { key: "inspection-config", label: "Inspection Sheet", icon: Shield, group: "Direct Links" },
  { key: "photo-config", label: "Photo Requirements", icon: Camera, group: "Direct Links" },
  { key: "depth-policies", label: "Inspection Standards", icon: Gauge, group: "Direct Links" },
  { key: "promotions", label: "Promotions", icon: Megaphone, group: "Direct Links" },
  { key: "referrals", label: "Referral Program", icon: Gift, group: "Direct Links" },
  { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote, group: "Direct Links" },
  { key: "executive", label: "Performance KPIs", icon: BarChart3, group: "Direct Links" },
  { key: "gm-hud", label: "GM HUD", icon: BarChart3, group: "Direct Links" },
];

const AdminCommandPalette = ({ onNavigate, onViewSubmission, submissions, allowedSections }: AdminCommandPaletteProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filteredSections = useMemo(
    () => allowedSections === null
      ? SECTION_MAP
      : SECTION_MAP.filter((s) => allowedSections?.includes(s.key)),
    [allowedSections]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search sections or leads…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Sections">
          {filteredSections.map((s) => {
            const Icon = s.icon;
            return (
              <CommandItem
                key={s.key}
                onSelect={() => { onNavigate(s.key); setOpen(false); }}
              >
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{s.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{s.group}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {submissions.length > 0 && (
          <CommandGroup heading="Recent Leads">
            {submissions.slice(0, 8).map((sub) => (
              <CommandItem
                key={sub.id}
                onSelect={() => {
                  onViewSubmission?.(sub);
                  setOpen(false);
                }}
              >
                <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {sub.name || "Unknown"} — {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default AdminCommandPalette;
