import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CheckCircle, Circle, Image, MapPin, Bell, Building2, Palette, Phone,
  Mail, Globe, FileText, Users, ScanLine, Clock, Facebook, Star, PenLine, AlertCircle
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
  dealershipId?: string;
}

const OnboardingChecklist = ({ onNavigate, dealershipId: propDealershipId }: OnboardingChecklistProps) => {
  const { tenant } = useTenant();
  const dealershipId = propDealershipId || tenant.dealership_id;
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sigDealer, setSigDealer] = useState<string | null>(null);
  const [sigStaff, setSigStaff] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    checkAll();
  }, [dealershipId]);

  const checkAll = async () => {
    // Fetch all data in parallel
    const [configRes, locRes, notifRes, staffRes, accountRes] = await Promise.all([
      supabase.from("site_config").select("dealership_name, logo_url, logo_white_url, favicon_url, phone, email, address, website_url, primary_color, hero_headline, business_hours, facebook_url, instagram_url, google_review_url").eq("dealership_id", dealershipId).maybeSingle(),
      supabase.from("dealership_locations").select("id").eq("dealership_id", dealershipId).eq("is_active", true),
      supabase.from("notification_settings").select("email_recipients, sms_recipients").eq("dealership_id", dealershipId).maybeSingle(),
      supabase.from("user_roles").select("id"),
      supabase.from("dealer_accounts").select("architecture, bdc_model, plan_tier, start_date, onboarding_signature_dealer, onboarding_signature_staff, onboarding_signed_at, onboarding_answers").eq("dealership_id", dealershipId).maybeSingle(),
    ]);

    const acct = accountRes.data;
    if (acct) {
      setSigDealer((acct as any).onboarding_signature_dealer || null);
      setSigStaff((acct as any).onboarding_signature_staff || null);
      setSignedAt((acct as any).onboarding_signed_at || null);
    }

    const cfg = configRes.data;
    const locCount = locRes.data?.length || 0;
    const notif = notifRes.data;
    const staffCount = staffRes.data?.length || 0;

    const checks: CheckItem[] = [
      {
        key: "account",
        label: "Account setup completed",
        icon: Building2,
        done: !!(acct?.architecture && acct?.bdc_model && acct?.start_date),
        section: "onboarding",
      },
      {
        key: "branding",
        label: "Dealership name configured",
        icon: FileText,
        done: !!(cfg?.dealership_name && cfg.dealership_name.trim().length > 0),
        section: "site-config",
      },
      {
        key: "logo",
        label: "Logo uploaded",
        icon: Image,
        done: !!(cfg?.logo_url && cfg.logo_url.length > 0),
        section: "site-config",
      },
      {
        key: "logo_white",
        label: "White logo uploaded",
        icon: Image,
        done: !!(cfg?.logo_white_url && cfg.logo_white_url.length > 0),
        section: "site-config",
      },
      {
        key: "favicon",
        label: "Favicon uploaded",
        icon: ScanLine,
        done: !!(cfg?.favicon_url && cfg.favicon_url.length > 0),
        section: "site-config",
      },
      {
        key: "colors",
        label: "Brand colors set",
        icon: Palette,
        done: !!(cfg?.primary_color && cfg.primary_color !== "213 80% 20%"),
        section: "site-config",
      },
      {
        key: "contact_phone",
        label: "Phone number added",
        icon: Phone,
        done: !!(cfg?.phone && cfg.phone.length > 0),
        section: "site-config",
      },
      {
        key: "contact_email",
        label: "Email address added",
        icon: Mail,
        done: !!(cfg?.email && cfg.email.length > 0),
        section: "site-config",
      },
      {
        key: "website",
        label: "Website URL added",
        icon: Globe,
        done: !!(cfg?.website_url && cfg.website_url.length > 0),
        section: "site-config",
      },
      {
        key: "locations",
        label: "At least one location added",
        icon: MapPin,
        done: locCount >= 1,
        section: "locations",
      },
      {
        key: "notif_email",
        label: "Email notification recipients configured",
        icon: Bell,
        done: !!(notif?.email_recipients && (notif.email_recipients as string[]).length > 0),
        section: "notifications",
      },
      {
        key: "notif_sms",
        label: "SMS notification recipients configured",
        icon: Bell,
        done: !!(notif?.sms_recipients && (notif.sms_recipients as string[]).length > 0),
        section: "notifications",
      },
      {
        key: "staff",
        label: "Staff members added",
        icon: Users,
        done: staffCount >= 2,
        section: "staff",
      },
      {
        key: "hours",
        label: "Business hours configured",
        icon: Clock,
        done: !!(cfg?.business_hours && (cfg.business_hours as any[]).length > 0),
        section: "site-config",
      },
      {
        key: "social",
        label: "Social media links added",
        icon: Facebook,
        done: !!((cfg as any)?.facebook_url || (cfg as any)?.instagram_url),
        section: "site-config",
      },
      {
        key: "google_review",
        label: "Google review link added",
        icon: Star,
        done: !!((cfg as any)?.google_review_url && (cfg as any).google_review_url.length > 0),
        section: "site-config",
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
    <div className="space-y-6">
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
              const clickable = !!item.section && !!onNavigate && !item.done;
              return (
                <button
                  key={item.key}
                  onClick={() => clickable && onNavigate?.(item.section!)}
                  disabled={!clickable}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors w-full text-left",
                    item.done ? "text-muted-foreground" : "text-card-foreground",
                    clickable && "hover:bg-muted/50 cursor-pointer"
                  )}
                >
                  {item.done ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className={cn("flex-1", item.done && "line-through opacity-60")}>
                    {item.label}
                  </span>
                  {clickable && (
                    <span className="text-[10px] text-primary font-medium">Go →</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Signed Agreement Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" />
            Signed Agreement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signedAt ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                Signed on {new Date(signedAt).toLocaleDateString()} at {new Date(signedAt).toLocaleTimeString()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sigDealer && (
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Dealer Representative</p>
                    <img
                      src={sigDealer}
                      alt="Dealer signature"
                      className="w-full h-[80px] object-contain bg-background rounded"
                    />
                  </div>
                )}
                {sigStaff && (
                  <div className="border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Onboarding Specialist</p>
                    <img
                      src={sigStaff}
                      alt="Staff signature"
                      className="w-full h-[80px] object-contain bg-background rounded"
                    />
                  </div>
                )}
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("onboarding-script")}
                  className="text-xs text-primary hover:underline"
                >
                  View full questionnaire →
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <p>No signatures on file yet.</p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("onboarding-script")}
                    className="text-xs text-primary hover:underline mt-0.5"
                  >
                    Complete onboarding questionnaire →
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingChecklist;
