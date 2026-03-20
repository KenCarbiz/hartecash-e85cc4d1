import { useEffect, useState } from "react";
import { formatPhone } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, ChevronDown, Plus, X, Mail, Phone, Bell, BellOff, Moon, Loader2 } from "lucide-react";

interface NotificationConfig {
  id?: string;
  dealership_id: string;
  email_recipients: string[];
  sms_recipients: string[];
  notify_new_submission: boolean;
  notify_hot_lead: boolean;
  notify_appointment_booked: boolean;
  notify_photos_uploaded: boolean;
  notify_docs_uploaded: boolean;
  notify_status_change: boolean;
  new_submission_channels: string[];
  hot_lead_channels: string[];
  appointment_channels: string[];
  photos_uploaded_channels: string[];
  docs_uploaded_channels: string[];
  status_change_channels: string[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
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
  new_submission_channels: ["email", "sms"],
  hot_lead_channels: ["email", "sms"],
  appointment_channels: ["email", "sms"],
  photos_uploaded_channels: ["email"],
  docs_uploaded_channels: ["email"],
  status_change_channels: ["email"],
  quiet_hours_enabled: false,
  quiet_hours_start: "21:00",
  quiet_hours_end: "08:00",
};

const TRIGGERS = [
  { key: "new_submission", label: "New Lead Submission", desc: "When a customer submits the sell form", channelKey: "new_submission_channels" },
  { key: "hot_lead", label: "Hot Lead Flagged", desc: "When a submission is flagged as a hot lead by offer rules", channelKey: "hot_lead_channels" },
  { key: "appointment_booked", label: "Appointment Booked", desc: "When a customer schedules a visit", channelKey: "appointment_channels" },
  { key: "photos_uploaded", label: "Photos Uploaded", desc: "When a customer uploads vehicle photos", channelKey: "photos_uploaded_channels" },
  { key: "docs_uploaded", label: "Documents Uploaded", desc: "When a customer uploads documents", channelKey: "docs_uploaded_channels" },
  { key: "status_change", label: "Status Change", desc: "When a submission status is updated", channelKey: "status_change_channels" },
] as const;

export default function NotificationSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<NotificationConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    recipients: true,
    triggers: true,
    quiet: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("dealership_id", "default")
      .maybeSingle();
    if (data) {
      setConfig({
        ...DEFAULTS,
        ...data,
        email_recipients: (data.email_recipients as string[]) || [],
        sms_recipients: (data.sms_recipients as string[]) || [],
        new_submission_channels: (data.new_submission_channels as string[]) || ["email", "sms"],
        hot_lead_channels: (data.hot_lead_channels as string[]) || ["email", "sms"],
        appointment_channels: (data.appointment_channels as string[]) || ["email", "sms"],
        photos_uploaded_channels: (data.photos_uploaded_channels as string[]) || ["email"],
        docs_uploaded_channels: (data.docs_uploaded_channels as string[]) || ["email"],
        status_change_channels: (data.status_change_channels as string[]) || ["email"],
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...config,
      updated_at: new Date().toISOString(),
    };
    delete (payload as any).id;

    const { data: existing } = await supabase
      .from("notification_settings")
      .select("id")
      .eq("dealership_id", "default")
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("notification_settings")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("notification_settings")
        .insert(payload));
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
    const phone = newPhone.trim();
    if (!phone || phone.length < 10) {
      toast({ title: "Invalid phone number", variant: "destructive" });
      return;
    }
    if (config.sms_recipients.includes(phone)) return;
    setConfig(c => ({ ...c, sms_recipients: [...c.sms_recipients, phone] }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      {/* Recipients */}
      <Collapsible open={openSections.recipients} onOpenChange={() => toggle("recipients")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Mail className="w-4 h-4" />
            Recipients
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.recipients ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4 px-1">
          {/* Email recipients */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email Recipients
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {config.email_recipients.map(email => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button onClick={() => removeEmail(email)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {config.email_recipients.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No email recipients configured</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="staff@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEmail()}
                className="max-w-xs text-sm"
              />
              <Button size="sm" variant="outline" onClick={addEmail}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>

          {/* SMS recipients */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> SMS Recipients
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {config.sms_recipients.map(phone => (
                <Badge key={phone} variant="secondary" className="gap-1 pr-1">
                  {phone}
                  <button onClick={() => removePhone(phone)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {config.sms_recipients.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No SMS recipients configured</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="+15551234567"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPhone()}
                className="max-w-xs text-sm"
              />
              <Button size="sm" variant="outline" onClick={addPhone}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Alert Triggers */}
      <Collapsible open={openSections.triggers} onOpenChange={() => toggle("triggers")}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 font-medium">
            <Bell className="w-4 h-4" />
            Alert Triggers
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${openSections.triggers ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          {TRIGGERS.map(trigger => {
            const enabled = (config as any)[`notify_${trigger.key}`] as boolean;
            const channels = (config as any)[trigger.channelKey] as string[];
            return (
              <div
                key={trigger.key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  enabled ? "bg-background border-border" : "bg-muted/30 border-transparent opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleTrigger(trigger.key)}
                  />
                  <div>
                    <p className="text-sm font-medium">{trigger.label}</p>
                    <p className="text-xs text-muted-foreground">{trigger.desc}</p>
                  </div>
                </div>
                {enabled && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => toggleChannel(trigger.channelKey, "email")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        channels.includes("email")
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-transparent"
                      }`}
                    >
                      <Mail className="w-3 h-3" /> Email
                    </button>
                    <button
                      onClick={() => toggleChannel(trigger.channelKey, "sms")}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        channels.includes("sms")
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground border border-transparent"
                      }`}
                    >
                      <Phone className="w-3 h-3" /> SMS
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
            <Switch
              checked={config.quiet_hours_enabled}
              onCheckedChange={v => setConfig(c => ({ ...c, quiet_hours_enabled: v }))}
            />
          </div>
          {config.quiet_hours_enabled && (
            <div className="flex items-center gap-4 pl-1">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  type="time"
                  value={config.quiet_hours_start}
                  onChange={e => setConfig(c => ({ ...c, quiet_hours_start: e.target.value }))}
                  className="w-32 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input
                  type="time"
                  value={config.quiet_hours_end}
                  onChange={e => setConfig(c => ({ ...c, quiet_hours_end: e.target.value }))}
                  className="w-32 text-sm"
                />
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
    </div>
  );
}
