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
} from "lucide-react";
import type { Submission } from "@/lib/adminConstants";

interface AdminCommandPaletteProps {
  onNavigate: (section: string) => void;
  onViewSubmission?: (sub: Submission) => void;
  submissions: Submission[];
  allowedSections?: string[] | null;
}

const SECTION_MAP: { key: string; label: string; icon: React.ElementType; group: string }[] = [
  { key: "submissions", label: "All Leads", icon: Inbox, group: "Pipeline" },
  { key: "accepted-appts", label: "Appointments", icon: CalendarDays, group: "Pipeline" },
  { key: "executive", label: "Performance", icon: BarChart3, group: "Pipeline" },
  { key: "offer-settings", label: "Offer Logic", icon: SlidersHorizontal, group: "Configuration" },
  { key: "form-config", label: "Lead Form", icon: ListChecks, group: "Configuration" },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Configuration" },
  { key: "inspection-config", label: "Inspection Sheet", icon: Shield, group: "Configuration" },
  { key: "photo-config", label: "Photo Requirements", icon: Camera, group: "Configuration" },
  { key: "depth-policies", label: "Depth Policies", icon: Gauge, group: "Configuration" },
  { key: "site-config", label: "Branding", icon: Settings, group: "Storefront" },
  { key: "locations", label: "Locations", icon: MapPin, group: "Storefront" },
  { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote, group: "Storefront" },
  { key: "staff", label: "Staff & Permissions", icon: Users, group: "System" },
  { key: "compliance", label: "Compliance", icon: ShieldCheck, group: "System" },
  { key: "reports", label: "Reports & Export", icon: Send, group: "System" },
  { key: "tenants", label: "Dealer Tenants", icon: Network, group: "System" },
  { key: "image-inventory", label: "Vehicle Images", icon: Car, group: "System" },
  { key: "system-settings", label: "System Settings", icon: Wrench, group: "System" },
  { key: "onboarding", label: "Dealer Setup", icon: Rocket, group: "System" },
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
