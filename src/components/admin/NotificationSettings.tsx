import { useEffect, useState } from "react";
import { formatPhone } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, ChevronDown, Plus, X, Mail, Phone, Bell, BellOff, Moon, Loader2, UserCheck, CalendarCheck, DollarSign, CalendarClock, RefreshCw, Handshake, PartyPopper, TrendingUp, Pencil, Users, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import NotificationTemplateEditor from "./NotificationTemplateEditor";

interface NotificationConfig {
  id?: string;
  dealership_id: string;
  email_recipients: string[];
  sms_recipients: string[];
  // Staff triggers
  notify_new_submission: boolean;
  notify_hot_lead: boolean;
  notify_appointment_booked: boolean;
  notify_photos_uploaded: boolean;
  notify_docs_uploaded: boolean;
  notify_status_change: boolean;
  notify_staff_customer_accepted: boolean;
  notify_staff_deal_completed: boolean;
  notify_abandoned_lead: boolean;
  new_submission_channels: string[];
  hot_lead_channels: string[];
  appointment_channels: string[];
  photos_uploaded_channels: string[];
  docs_uploaded_channels: string[];
  status_change_channels: string[];
  staff_customer_accepted_channels: string[];
  staff_deal_completed_channels: string[];
  abandoned_lead_channels: string[];
  // Customer triggers
  notify_customer_offer_accepted: boolean;
  customer_offer_accepted_channels: string[];
  notify_customer_appointment_booked: boolean;
  customer_appointment_channels: string[];
  notify_customer_offer_ready: boolean;
  customer_offer_ready_channels: string[];
  notify_customer_offer_increased: boolean;
  customer_offer_increased_channels: string[];
  notify_customer_appointment_reminder: boolean;
  customer_appointment_reminder_channels: string[];
  notify_customer_appointment_rescheduled: boolean;
  customer_appointment_rescheduled_channels: string[];
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  // Per-trigger recipients override
  staff_trigger_recipients: Record<string, { emails: string[]; phones: string[] }>;
}

const DEFAULTS: NotificationConfig = {
  dealership_id: "default",
  email_recipients: [],
  sms_recipients: [],
  notify_new_submission: true,
  notify_hot_lead: true,
  notify_appointment_booked: true,
  notify_photos_uploaded: false,
  notify_docs_uploaded: false,
  notify_status_change: false,
  notify_staff_customer_accepted: true,
  notify_staff_deal_completed: true,
  notify_abandoned_lead: true,
  new_submission_channels: ["email", "sms"],
  hot_lead_channels: ["email", "sms"],
  appointment_channels: ["email", "sms"],
  photos_uploaded_channels: ["email"],
  docs_uploaded_channels: ["email"],
  status_change_channels: ["email"],
  staff_customer_accepted_channels: ["email", "sms"],
  staff_deal_completed_channels: ["email"],
  abandoned_lead_channels: ["email", "sms"],
  notify_customer_offer_accepted: true,
  customer_offer_accepted_channels: ["email", "sms"],
  notify_customer_appointment_booked: true,
  customer_appointment_channels: ["email", "sms"],
  notify_customer_offer_ready: true,
  customer_offer_ready_channels: ["email"],
  notify_customer_offer_increased: true,
  customer_offer_increased_channels: ["email"],
  notify_customer_appointment_reminder: true,
  customer_appointment_reminder_channels: ["email", "sms"],
  notify_customer_appointment_rescheduled: true,
  customer_appointment_rescheduled_channels: ["email", "sms"],
  quiet_hours_enabled: false,
  quiet_hours_start: "21:00",
  quiet_hours_end: "08:00",
  quiet_hours_timezone: "America/New_York",
  staff_trigger_recipients: {},
};

const STAFF_TRIGGERS = [
  { key: "new_submission", label: "New Lead Submission", desc: "When a customer submits the sell form", channelKey: "new_submission_channels", icon: Bell },
  { key: "hot_lead", label: "Hot Lead Flagged", desc: "When a submission is flagged as a hot lead by offer rules", channelKey: "hot_lead_channels", icon: Bell },
  { key: "appointment_booked", label: "Appointment Booked", desc: "When a customer schedules a visit", channelKey: "appointment_channels", icon: CalendarCheck },
  { key: "photos_uploaded", label: "Photos Uploaded", desc: "When a customer uploads vehicle photos", channelKey: "photos_uploaded_channels", icon: Bell },
  { key: "docs_uploaded", label: "Documents Uploaded", desc: "When a customer uploads documents", channelKey: "docs_uploaded_channels", icon: Bell },
  { key: "status_change", label: "Status Change", desc: "When a submission status is updated", channelKey: "status_change_channels", icon: Bell },
  { key: "staff_customer_accepted", label: "Customer Accepted Offer", desc: "Alert staff immediately when a customer clicks 'Accept Offer'", channelKey: "staff_customer_accepted_channels", icon: Handshake },
  { key: "staff_deal_completed", label: "Deal Completed", desc: "When a submission reaches 'Purchase Complete' status", channelKey: "staff_deal_completed_channels", icon: PartyPopper },
  { key: "abandoned_lead", label: "Abandoned Lead Alert", desc: "When a customer provides contact info but leaves before completing the form (checked every 15 min)", channelKey: "abandoned_lead_channels", icon: AlertTriangle },
] as const;

const CUSTOMER_TRIGGERS = [
  { key: "customer_offer_ready", label: "Offer Ready", desc: "Notify customer that their offer is ready with a link to view it (does not include the amount)", channelKey: "customer_offer_ready_channels", icon: DollarSign },
  { key: "customer_offer_increased", label: "Offer Increased", desc: "Notify customer when staff increases their offer before it's been accepted", channelKey: "customer_offer_increased_channels", icon: TrendingUp },
  { key: "customer_offer_accepted", label: "Offer Accepted Confirmation", desc: "Confirm the accepted offer amount, vehicle details, and next steps", channelKey: "customer_offer_accepted_channels", icon: UserCheck },
  { key: "customer_appointment_booked", label: "Appointment Confirmation", desc: "Send appointment date/time, dealership address, accepted offer, and what to bring", channelKey: "customer_appointment_channels", icon: CalendarCheck },
  { key: "customer_appointment_reminder", label: "Appointment Reminder (24hr)", desc: "Remind customer 24 hours before their scheduled inspection with address and what to bring", channelKey: "customer_appointment_reminder_channels", icon: CalendarClock },
  { key: "customer_appointment_rescheduled", label: "Appointment Rescheduled", desc: "Notify customer when their appointment is rescheduled with new date/time and location", channelKey: "customer_appointment_rescheduled_channels", icon: RefreshCw },
] as const;

export default function NotificationSettings() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const [config, setConfig] = useState<NotificationConfig>({ ...DEFAULTS, dealership_id: dealershipId });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<{ key: string; label: string } | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    recipients: true,
    triggers: true,
    customer: true,
    quiet: false,
  });

  useEffect(() => {
    fetchSettings();
  }, [dealershipId]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setConfig({
        ...DEFAULTS,
        ...data,
        email_recipients: (d.email_recipients as string[]) || [],
        sms_recipients: (d.sms_recipients as string[]) || [],
        new_submission_channels: (d.new_submission_channels as string[]) || ["email", "sms"],
        hot_lead_channels: (d.hot_lead_channels as string[]) || ["email", "sms"],
        appointment_channels: (d.appointment_channels as string[]) || ["email", "sms"],
        photos_uploaded_channels: (d.photos_uploaded_channels as string[]) || ["email"],
        docs_uploaded_channels: (d.docs_uploaded_channels as string[]) || ["email"],
        status_change_channels: (d.status_change_channels as string[]) || ["email"],
        staff_customer_accepted_channels: (d.staff_customer_accepted_channels as string[]) || ["email", "sms"],
        staff_deal_completed_channels: (d.staff_deal_completed_channels as string[]) || ["email"],
        notify_staff_customer_accepted: d.notify_staff_customer_accepted ?? true,
        notify_staff_deal_completed: d.notify_staff_deal_completed ?? true,
        notify_customer_offer_accepted: d.notify_customer_offer_accepted ?? true,
        customer_offer_accepted_channels: (d.customer_offer_accepted_channels as string[]) || ["email", "sms"],
        notify_customer_appointment_booked: d.notify_customer_appointment_booked ?? true,
        customer_appointment_channels: (d.customer_appointment_channels as string[]) || ["email", "sms"],
        notify_customer_offer_ready: d.notify_customer_offer_ready ?? true,
        customer_offer_ready_channels: (d.customer_offer_ready_channels as string[]) || ["email"],
        notify_customer_offer_increased: d.notify_customer_offer_increased ?? true,
        customer_offer_increased_channels: (d.customer_offer_increased_channels as string[]) || ["email"],
        notify_customer_appointment_reminder: d.notify_customer_appointment_reminder ?? true,
        customer_appointment_reminder_channels: (d.customer_appointment_reminder_channels as string[]) || ["email", "sms"],
        notify_customer_appointment_rescheduled: d.notify_customer_appointment_rescheduled ?? true,
        customer_appointment_rescheduled_channels: (d.customer_appointment_rescheduled_channels as string[]) || ["email", "sms"],
        staff_trigger_recipients: (d.staff_trigger_recipients as Record<string, { emails: string[]; phones: string[] }>) || {},
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...config, dealership_id: dealershipId, updated_at: new Date().toISOString() };
    delete (payload as any).id;

    const { data: existing } = await supabase
      .from("notification_settings")
      .select("id")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from("notification_settings").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("notification_settings").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Notification settings updated." });
    }
  };

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    if (config.email_recipients.includes(email)) return;
    setConfig(c => ({ ...c, email_recipients: [...c.email_recipients, email] }));
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    setConfig(c => ({ ...c, email_recipients: c.email_recipients.filter(e => e !== email) }));
  };

  const addPhone = () => {
    const digits = newPhone.trim().replace(/\D/g, "");
    if (digits.length < 10) {
      toast({ title: "Invalid phone number", variant: "destructive" });
      return;
    }
    const formatted = formatPhone(digits);
    if (config.sms_recipients.some(p => p.replace(/\D/g, "") === digits)) return;
    setConfig(c => ({ ...c, sms_recipients: [...c.sms_recipients, formatted] }));
    setNewPhone("");
  };

  const removePhone = (phone: string) => {
    setConfig(c => ({ ...c, sms_recipients: c.sms_recipients.filter(p => p !== phone) }));
  };

  const toggleTrigger = (key: string) => {
    setConfig(c => ({ ...c, [`notify_${key}`]: !(c as any)[`notify_${key}`] }));
  };

  const toggleChannel = (channelKey: string, channel: string) => {
    setConfig(c => {
      const current = (c as any)[channelKey] as string[];
      const next = current.includes(channel)
        ? current.filter(ch => ch !== channel)
        : [...current, channel];
      return { ...c, [channelKey]: next };
    });
  };

  const toggle = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const getTriggerRecipients = (triggerKey: string) => {
    return config.staff_trigger_recipients[triggerKey] || null;
  };

  const toggleTriggerEmailRecipient = (triggerKey: string, email: string) => {
    setConfig(c => {
      const current = c.staff_trigger_recipients[triggerKey] || { emails: [...c.email_recipients], phones: [...c.sms_recipients] };
      const emails = current.emails.includes(email)
        ? current.emails.filter(e => e !== email)
        : [...current.emails, email];
      return {
        ...c,
        staff_trigger_recipients: {
          ...c.staff_trigger_recipients,
          [triggerKey]: { ...current, emails },
        },
      };
    });
  };

  const toggleTriggerSmsRecipient = (triggerKey: string, phone: string) => {
    setConfig(c => {
      const current = c.staff_trigger_recipients[triggerKey] || { emails: [...c.email_recipients], phones: [...c.sms_recipients] };
      const phones = current.phones.includes(phone)
        ? current.phones.filter(p => p !== phone)
        : [...current.phones, phone];
      return {
        ...c,
        staff_trigger_recipients: {
          ...c.staff_trigger_recipients,
          [triggerKey]: { ...current, phones },
        },
      };
    });
  };

  const resetTriggerRecipients = (triggerKey: string) => {
    setConfig(c => {
      const { [triggerKey]: _, ...rest } = c.staff_trigger_recipients;
      return { ...c, staff_trigger_recipients: rest };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderChannelButtons = (channelKey: string, channels: string[]) => (
    <div className="flex gap-1.5 shrink-0">
      <button
        onClick={() => toggleChannel(channelKey, "email")}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          channels.includes("email")
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-muted text-muted-foreground border border-transparent"
        }`}
      >
        <Mail className="w-3 h-3" /> Email
      </button>
      <button
        onClick={() => toggleChannel(channelKey, "sms")}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          channels.includes("sms")
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-muted text-muted-foreground border border-transparent"
        }`}
      >
        <Phone className="w-3 h-3" /> SMS
      </button>
    </div>
  );

  const renderRecipientSelector = (triggerKey: string, enabled: boolean) => {
    if (!enabled) return null;
    const isStaff = STAFF_TRIGGERS.some(t => t.key === triggerKey);
    if (!isStaff) return null;

    const override = getTriggerRecipients(triggerKey);
    const hasOverride = override !== null;
    const activeEmails = hasOverride ? override.emails : config.email_recipients;
    const activePhones = hasOverride ? override.phones : config.sms_recipients;
    const totalRecipients = activeEmails.length + activePhones.length;
    const globalTotal = config.email_recipients.length + config.sms_recipients.length;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              hasOverride
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Select who receives this notification"
          >
            <Users className="w-3 h-3" />
            {hasOverride ? `${totalRecipients}` : `All (${globalTotal})`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recipients</p>
              {hasOverride && (
                <button
                  onClick={() => resetTriggerRecipients(triggerKey)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset to all
                </button>
              )}
            </div>

            {config.email_recipients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
                {config.email_recipients.map(email => (
                  <label key={email} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={activeEmails.includes(email)}
                      onCheckedChange={() => toggleTriggerEmailRecipient(triggerKey, email)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{email}</span>
                  </label>
                ))}
              </div>
            )}

            {config.sms_recipients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> SMS</p>
                {config.sms_recipients.map(phone => (
                  <label key={phone} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={activePhones.includes(phone)}
                      onCheckedChange={() => toggleTriggerSmsRecipient(triggerKey, phone)}
                      className="h-3.5 w-3.5"
                    />
                    <span>{formatPhone(phone) || phone}</span>
                  </label>
                ))}
              </div>
            )}

            {config.email_recipients.length === 0 && config.sms_recipients.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Add recipients in the Staff Recipients section above first.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderTriggerRow = (trigger: { key: string; label: string; desc: string; channelKey: string; icon: any }) => {
    const enabled = (config as any)[`notify_${trigger.key}`] as boolean;
    const channels = (config as any)[trigger.channelKey] as string[];
    const Icon = trigger.icon;
    return (
      <div
        key={trigger.key}
        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          enabled ? "bg-background border-border" : "bg-muted/30 border-transparent opacity-60"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Switch checked={enabled} onCheckedChange={() => toggleTrigger(trigger.key)} />
          <div className="flex items-start gap-2 min-w-0">
            <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{trigger.label}</p>
              <p className="text-xs text-muted-foreground">{trigger.desc}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled && (
            <button
              onClick={() => setEditingTemplate({ key: trigger.key, label: trigger.label })}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit message templates"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {renderRecipientSelector(trigger.key, enabled)}
          {enabled && renderChannelButtons(trigger.channelKey, channels)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Notification Settings</h2>
          <p className="text-sm text-muted-foreground">Configure who gets alerted and when</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </div>

      {/* Staff Recipients */}
      <Collapsible open={openSections.recipients} onOpenChange={() => toggle("recipients")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Mail className="w-4 h-4" />
            Staff Recipients
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.recipients ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4 px-1">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email Recipients
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {config.email_recipients.map(email => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button onClick={() => removeEmail(email)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {config.email_recipients.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No email recipients configured</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input placeholder="staff@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && addEmail()} className="max-w-xs text-sm" />
              <Button size="sm" variant="outline" onClick={addEmail}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> SMS Recipients
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {config.sms_recipients.map(phone => (
                <Badge key={phone} variant="secondary" className="gap-1 pr-1">
                  {formatPhone(phone) || phone}
                  <button onClick={() => removePhone(phone)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {config.sms_recipients.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No SMS recipients configured</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input placeholder="(555) 123-4567" value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && addPhone()} className="max-w-xs text-sm" />
              <Button size="sm" variant="outline" onClick={addPhone}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Staff Alert Triggers */}
      <Collapsible open={openSections.triggers} onOpenChange={() => toggle("triggers")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Bell className="w-4 h-4" />
            Staff Alert Triggers
            <Badge variant="outline" className="text-[10px] ml-1">{STAFF_TRIGGERS.length}</Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.triggers ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          <p className="text-xs text-muted-foreground mb-2">
            These alerts are sent to your configured staff recipients above.
          </p>
          {STAFF_TRIGGERS.map(trigger => renderTriggerRow(trigger))}
        </CollapsibleContent>
      </Collapsible>

      {/* Customer Notifications */}
      <Collapsible open={openSections.customer} onOpenChange={() => toggle("customer")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <UserCheck className="w-4 h-4" />
            Customer Notifications
            <Badge variant="outline" className="text-[10px] ml-1">{CUSTOMER_TRIGGERS.length}</Badge>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.customer ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          <p className="text-xs text-muted-foreground mb-2">
            These are sent directly to the customer's email/phone on file when the event occurs.
          </p>
          {CUSTOMER_TRIGGERS.map(trigger => renderTriggerRow(trigger))}
        </CollapsibleContent>
      </Collapsible>

      {/* Quiet Hours */}
      <Collapsible open={openSections.quiet} onOpenChange={() => toggle("quiet")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Moon className="w-4 h-4" />
            Quiet Hours
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.quiet ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 px-1 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Quiet Hours</p>
              <p className="text-xs text-muted-foreground">Suppress SMS notifications during off-hours (emails still queue)</p>
            </div>
            <Switch checked={config.quiet_hours_enabled} onCheckedChange={v => setConfig(c => ({ ...c, quiet_hours_enabled: v }))} />
          </div>
          {config.quiet_hours_enabled && (
            <div className="flex flex-wrap items-start gap-4 pl-1">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input type="time" value={config.quiet_hours_start} onChange={e => setConfig(c => ({ ...c, quiet_hours_start: e.target.value }))} className="w-32 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input type="time" value={config.quiet_hours_end} onChange={e => setConfig(c => ({ ...c, quiet_hours_end: e.target.value }))} className="w-32 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Timezone</Label>
                <select
                  value={config.quiet_hours_timezone}
                  onChange={e => setConfig(c => ({ ...c, quiet_hours_timezone: e.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Phoenix">Arizona (Phoenix)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="America/Anchorage">Alaska (Anchorage)</option>
                  <option value="Pacific/Honolulu">Hawaii (Honolulu)</option>
                </select>
              </div>
              <div className="mt-5">
                <Badge variant="outline" className="text-xs">
                  <BellOff className="w-3 h-3 mr-1" />
                  {config.quiet_hours_start} – {config.quiet_hours_end}
                </Badge>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Template Editor Dialog */}
      <NotificationTemplateEditor
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        triggerKey={editingTemplate?.key ?? ""}
        triggerLabel={editingTemplate?.label ?? ""}
      />
    </div>
  );
}
