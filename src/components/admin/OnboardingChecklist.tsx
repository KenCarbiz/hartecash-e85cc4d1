import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CheckCircle, Circle, Image, MapPin, Bell, Building2, Palette, Phone,
  Mail, Globe, FileText, Users, ScanLine
} from "lucide-react";

interface CheckItem {
  key: string;
  label: string;
  icon: React.ElementType;
  done: boolean;
  section?: string; // admin sidebar section key to navigate to
}

interface OnboardingChecklistProps {
  onNavigate?: (section: string) => void;
}

const OnboardingChecklist = ({ onNavigate }: OnboardingChecklistProps) => {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAll();
  }, []);

  const checkAll = async () => {
    // Fetch all data in parallel
    const [configRes, locRes, notifRes, staffRes, accountRes] = await Promise.all([
      supabase.from("site_config").select("dealership_name, logo_url, logo_white_url, favicon_url, phone, email, address, website_url, primary_color, hero_headline").eq("dealership_id", "default").maybeSingle(),
      supabase.from("dealership_locations").select("id").eq("is_active", true),
      supabase.from("notification_settings").select("email_recipients, sms_recipients").eq("dealership_id", "default").maybeSingle(),
      supabase.from("user_roles").select("id"),
      supabase.from("dealer_accounts").select("architecture, bdc_model, plan_tier, start_date").eq("dealership_id", "default").maybeSingle(),
    ]);

    const cfg = configRes.data;
    const locCount = locRes.data?.length || 0;
    const notif = notifRes.data;
    const staffCount = staffRes.data?.length || 0;
    const acct = accountRes.data;

    const checks: CheckItem[] = [
      {
        key: "account",
        label: "Account setup completed",
        icon: Building2,
        done: !!(acct?.architecture && acct?.bdc_model && acct?.start_date),
      },
      {
        key: "branding",
        label: "Dealership name configured",
        icon: FileText,
        done: !!(cfg?.dealership_name && cfg.dealership_name.trim().length > 0),
      },
      {
        key: "logo",
        label: "Logo uploaded",
        icon: Image,
        done: !!(cfg?.logo_url && cfg.logo_url.length > 0),
      },
      {
        key: "logo_white",
        label: "White logo uploaded",
        icon: Image,
        done: !!(cfg?.logo_white_url && cfg.logo_white_url.length > 0),
      },
      {
        key: "favicon",
        label: "Favicon uploaded",
        icon: ScanLine,
        done: !!(cfg?.favicon_url && cfg.favicon_url.length > 0),
      },
      {
        key: "colors",
        label: "Brand colors set",
        icon: Palette,
        done: !!(cfg?.primary_color && cfg.primary_color !== "213 80% 20%"),
      },
      {
        key: "contact_phone",
        label: "Phone number added",
        icon: Phone,
        done: !!(cfg?.phone && cfg.phone.length > 0),
      },
      {
        key: "contact_email",
        label: "Email address added",
        icon: Mail,
        done: !!(cfg?.email && cfg.email.length > 0),
      },
      {
        key: "website",
        label: "Website URL added",
        icon: Globe,
        done: !!(cfg?.website_url && cfg.website_url.length > 0),
      },
      {
        key: "locations",
        label: "At least one location added",
        icon: MapPin,
        done: locCount >= 1,
      },
      {
        key: "notif_email",
        label: "Email notification recipients configured",
        icon: Bell,
        done: !!(notif?.email_recipients && (notif.email_recipients as string[]).length > 0),
      },
      {
        key: "notif_sms",
        label: "SMS notification recipients configured",
        icon: Bell,
        done: !!(notif?.sms_recipients && (notif.sms_recipients as string[]).length > 0),
      },
      {
        key: "staff",
        label: "Staff members added",
        icon: Users,
        done: staffCount >= 2, // at least admin + one other
      },
    ];

    setItems(checks);
    setLoading(false);
  };

  const completedCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            Onboarding Checklist
          </CardTitle>
          <span className="text-xs font-semibold text-muted-foreground">
            {completedCount}/{totalCount} complete
          </span>
        </div>
        <Progress value={pct} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  item.done ? "text-muted-foreground" : "text-card-foreground"
                )}
              >
                {item.done ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                )}
                <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className={cn(item.done && "line-through opacity-60")}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
