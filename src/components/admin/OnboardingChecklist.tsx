import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle, Circle, Image, MapPin, Bell, Building2, Palette, Phone,
  Mail, Globe, FileText, Users, ScanLine, Clock, Facebook, Star, PenLine, AlertCircle, DollarSign, Shield
} from "lucide-react";

interface CheckItem {
  key: string;
  label: string;
  icon: React.ElementType;
  done: boolean;
  section?: string;
}

interface CheckGroup {
  title: string;
  icon: React.ElementType;
  items: CheckItem[];
}

interface OnboardingChecklistProps {
  onNavigate?: (section: string) => void;
  dealershipId?: string;
}

const OnboardingChecklist = ({ onNavigate, dealershipId: propDealershipId }: OnboardingChecklistProps) => {
  const { tenant } = useTenant();
  const dealershipId = propDealershipId || tenant.dealership_id;
  const [groups, setGroups] = useState<CheckGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sigDealer, setSigDealer] = useState<string | null>(null);
  const [sigStaff, setSigStaff] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  useEffect(() => {
    checkAll();
  }, [dealershipId]);

  const checkAll = async () => {
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
    const onboardingAnswers = (acct as any)?.onboarding_answers as Record<string, string> | null;

    const grouped: CheckGroup[] = [
      {
        title: "Account & Strategy",
        icon: Building2,
        items: [
          { key: "account", label: "Account setup completed", icon: Building2, done: !!(acct?.architecture && acct?.bdc_model && acct?.start_date), section: "onboarding" },
          { key: "acquisition_strategy", label: "Acquisition strategy selected", icon: DollarSign, done: !!(onboardingAnswers?.acquisition_intent?.trim()), section: "onboarding-script" },
        ],
      },
      {
        title: "Branding & Identity",
        icon: Palette,
        items: [
          { key: "branding", label: "Dealership name configured", icon: FileText, done: !!(cfg?.dealership_name && cfg.dealership_name.trim().length > 0), section: "site-config" },
          { key: "logo", label: "Logo uploaded", icon: Image, done: !!(cfg?.logo_url && cfg.logo_url.length > 0), section: "site-config" },
          { key: "logo_white", label: "White logo uploaded", icon: Image, done: !!(cfg?.logo_white_url && cfg.logo_white_url.length > 0), section: "site-config" },
          { key: "favicon", label: "Favicon uploaded", icon: ScanLine, done: !!(cfg?.favicon_url && cfg.favicon_url.length > 0), section: "site-config" },
          { key: "colors", label: "Brand colors set", icon: Palette, done: !!(cfg?.primary_color && cfg.primary_color !== "213 80% 20%"), section: "site-config" },
        ],
      },
      {
        title: "Contact & Presence",
        icon: Globe,
        items: [
          { key: "contact_phone", label: "Phone number added", icon: Phone, done: !!(cfg?.phone && cfg.phone.length > 0), section: "site-config" },
          { key: "contact_email", label: "Email address added", icon: Mail, done: !!(cfg?.email && cfg.email.length > 0), section: "site-config" },
          { key: "website", label: "Website URL added", icon: Globe, done: !!(cfg?.website_url && cfg.website_url.length > 0), section: "site-config" },
          { key: "social", label: "Social media links added", icon: Facebook, done: !!((cfg as any)?.facebook_url || (cfg as any)?.instagram_url), section: "site-config" },
          { key: "google_review", label: "Google review link added", icon: Star, done: !!((cfg as any)?.google_review_url && (cfg as any).google_review_url.length > 0), section: "site-config" },
        ],
      },
      {
        title: "Operations",
        icon: Clock,
        items: [
          { key: "locations", label: "At least one location added", icon: MapPin, done: locCount >= 1, section: "locations" },
          { key: "hours", label: "Business hours configured", icon: Clock, done: !!(cfg?.business_hours && (cfg.business_hours as any[]).length > 0), section: "site-config" },
          { key: "staff", label: "Staff members added", icon: Users, done: staffCount >= 2, section: "staff" },
        ],
      },
      {
        title: "Notifications",
        icon: Bell,
        items: [
          { key: "notif_email", label: "Email recipients configured", icon: Bell, done: !!(notif?.email_recipients && (notif.email_recipients as string[]).length > 0), section: "notifications" },
          { key: "notif_sms", label: "SMS recipients configured", icon: Bell, done: !!(notif?.sms_recipients && (notif.sms_recipients as string[]).length > 0), section: "notifications" },
        ],
      },
    ];

    setGroups(grouped);
    setLoading(false);
  };

  const allItems = groups.flatMap(g => g.items);
  const completedCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) return null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Onboarding Checklist
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">{pct}%</span>
              <span className="text-xs text-muted-foreground">{completedCount}/{totalCount}</span>
            </div>
          </div>
          {/* Premium progress bar */}
          <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: pct === 100
                  ? "hsl(var(--primary))"
                  : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-5">
            {groups.map((group) => {
              const GroupIcon = group.icon;
              const groupDone = group.items.filter(i => i.done).length;
              const groupTotal = group.items.length;
              const allDone = groupDone === groupTotal;

              return (
                <div key={group.title}>
                  <div className="flex items-center gap-2 mb-2">
                    <GroupIcon className={cn("w-3.5 h-3.5", allDone ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-bold uppercase tracking-wider", allDone ? "text-primary" : "text-muted-foreground")}>
                      {group.title}
                    </span>
                    <span className={cn("text-[10px] font-semibold ml-auto px-2 py-0.5 rounded-full",
                      allDone ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {groupDone}/{groupTotal}
                    </span>
                  </div>
                  <div className="space-y-0.5 ml-1">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const clickable = !!item.section && !!onNavigate && !item.done;
                      return (
                        <button
                          key={item.key}
                          onClick={() => clickable && onNavigate?.(item.section!)}
                          disabled={!clickable}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all w-full text-left group",
                            item.done ? "text-muted-foreground" : "text-card-foreground",
                            clickable && "hover:bg-primary/5 cursor-pointer"
                          )}
                        >
                          {item.done ? (
                            <CheckCircle className="w-4.5 h-4.5 shrink-0 text-primary" />
                          ) : (
                            <Circle className="w-4.5 h-4.5 shrink-0 text-muted-foreground/30" />
                          )}
                          <Icon className={cn("w-3.5 h-3.5 shrink-0", item.done ? "text-muted-foreground/50" : "text-muted-foreground")} />
                          <span className={cn("flex-1", item.done && "line-through opacity-50")}>
                            {item.label}
                          </span>
                          {clickable && (
                            <span className="text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                              Complete →
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
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
                  <div className="border rounded-xl p-4 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Dealer Representative</p>
                    <img
                      src={sigDealer}
                      alt="Dealer signature"
                      className="w-full h-[80px] object-contain bg-background rounded"
                    />
                  </div>
                )}
                {sigStaff && (
                  <div className="border rounded-xl p-4 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Onboarding Specialist</p>
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
                  className="text-xs text-primary hover:underline font-medium"
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
                    className="text-xs text-primary hover:underline mt-0.5 font-medium"
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
