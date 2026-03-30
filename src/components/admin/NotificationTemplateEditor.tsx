import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATES, PLACEHOLDER_VARS, type TemplateDefaults } from "@/lib/notificationDefaults";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, RotateCcw, Loader2, ChevronDown, Info, Mail, Phone, Eye, EyeOff } from "lucide-react";

const SAMPLE_DATA: Record<string, string> = {
  "{{customer_name}}": "Sarah Johnson",
  "{{vehicle}}": "2021 Toyota Camry",
  "{{mileage}}": "34,200",
  "{{offer_amount}}": "$18,500",
  "{{portal_link}}": "https://hartecash.lovable.app/offer/abc123",
  "{{appointment_date}}": "January 15, 2026",
  "{{appointment_time}}": "10:30 AM",
  "{{location}}": "Harte Auto — Hartford, CT",
  "{{dealership_name}}": "Harte Auto Group",
  "{{status}}": "Offer Made",
  "{{guarantee_days}}": "8",
};

function replaceSampleData(text: string): string {
  let result = text;
  for (const [key, val] of Object.entries(SAMPLE_DATA)) {
    result = result.split(key).join(val);
  }
  return result;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerKey: string;
  triggerLabel: string;
}

export default function NotificationTemplateEditor({ open, onOpenChange, triggerKey, triggerLabel }: Props) {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const defaults = DEFAULT_TEMPLATES[triggerKey];

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsBody, setSmsBody] = useState("");

  const [savedEmailSubject, setSavedEmailSubject] = useState<string | null>(null);
  const [savedEmailBody, setSavedEmailBody] = useState<string | null>(null);
  const [savedSmsBody, setSavedSmsBody] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open && defaults) {
      loadCustomTemplates();
    }
  }, [open, triggerKey]);

  const loadCustomTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_templates")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("trigger_key", triggerKey);

    const emailRow = data?.find((r: any) => r.channel === "email");
    const smsRow = data?.find((r: any) => r.channel === "sms");

    const eSubj = emailRow?.subject ?? null;
    const eBody = emailRow?.body ?? null;
    const sBody = smsRow?.body ?? null;

    setSavedEmailSubject(eSubj);
    setSavedEmailBody(eBody);
    setSavedSmsBody(sBody);

    setEmailSubject(eSubj ?? defaults.email_subject);
    setEmailBody(eBody ?? defaults.email_body);
    setSmsBody(sBody ?? defaults.sms_body);

    setLoading(false);
  };

  const isEmailCustom = emailSubject !== defaults?.email_subject || emailBody !== defaults?.email_body;
  const isSmsCustom = smsBody !== defaults?.sms_body;

  const handleSave = async () => {
    setSaving(true);

    // Save email template
    if (isEmailCustom) {
      await supabase
        .from("notification_templates")
        .upsert(
          {
            trigger_key: triggerKey,
            channel: "email",
            subject: emailSubject,
            body: emailBody,
            dealership_id: dealershipId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "trigger_key,channel,dealership_id" }
        );
    } else {
      // Remove custom override
      await supabase
        .from("notification_templates")
        .delete()
        .eq("trigger_key", triggerKey)
        .eq("channel", "email")
        .eq("dealership_id", dealershipId);
    }

    // Save SMS template
    if (isSmsCustom) {
      await supabase
        .from("notification_templates")
        .upsert(
          {
            trigger_key: triggerKey,
            channel: "sms",
            subject: null,
            body: smsBody,
            dealership_id: dealershipId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "trigger_key,channel,dealership_id" }
        );
    } else {
      await supabase
        .from("notification_templates")
        .delete()
        .eq("trigger_key", triggerKey)
        .eq("channel", "sms")
        .eq("dealership_id", "default");
    }

    setSaving(false);
    toast({ title: "Saved", description: `Templates for "${triggerLabel}" updated.` });
    onOpenChange(false);
  };

  const resetEmail = () => {
    if (!defaults) return;
    setEmailSubject(defaults.email_subject);
    setEmailBody(defaults.email_body);
  };

  const resetSms = () => {
    if (!defaults) return;
    setSmsBody(defaults.sms_body);
  };

  if (!defaults) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Message Templates</DialogTitle>
          <DialogDescription>{triggerLabel}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Available Variables */}
            <Collapsible open={showVars} onOpenChange={setShowVars}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Info className="w-3.5 h-3.5" />
                Available placeholders
                <ChevronDown className={`w-3 h-3 transition-transform ${showVars ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDER_VARS.map(v => (
                    <Badge key={v.key} variant="outline" className="text-[10px] font-mono cursor-help" title={v.desc}>
                      {v.key}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Preview Toggle */}
            <div className="flex items-center justify-end">
              <Button
                variant={showPreview ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs h-7 gap-1.5"
              >
                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>

            <Tabs defaultValue="email" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                  {isEmailCustom && <Badge className="text-[9px] px-1 py-0 h-4 bg-accent text-accent-foreground">Custom</Badge>}
                </TabsTrigger>
                <TabsTrigger value="sms" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  SMS
                  {isSmsCustom && <Badge className="text-[9px] px-1 py-0 h-4 bg-accent text-accent-foreground">Custom</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="space-y-3 mt-3">
                {showPreview ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Preview</span>
                        <Badge variant="outline" className="text-[9px]">Sample Data</Badge>
                      </div>
                      <div className="rounded-md bg-background border border-border overflow-hidden">
                        <div className="bg-primary text-primary-foreground px-4 py-3 text-center">
                          <p className="font-semibold text-sm">{replaceSampleData(emailSubject)}</p>
                        </div>
                        <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap">
                          {replaceSampleData(emailBody)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Subject Line</Label>
                      {isEmailCustom && (
                        <Button variant="ghost" size="sm" onClick={resetEmail} className="text-xs h-7 gap-1 text-muted-foreground">
                          <RotateCcw className="w-3 h-3" /> Reset to default
                        </Button>
                      )}
                    </div>
                    <Input
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Email subject..."
                      className="text-sm"
                    />
                    <div>
                      <Label className="text-sm font-medium">Email Body</Label>
                      <Textarea
                        value={emailBody}
                        onChange={e => setEmailBody(e.target.value)}
                        placeholder="Email body..."
                        className="mt-1.5 text-sm min-h-[180px] font-mono"
                      />
                    </div>
                    {isEmailCustom && (
                      <p className="text-[11px] text-muted-foreground italic">
                        ✏️ Customized — differs from the default template
                      </p>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="sms" className="space-y-3 mt-3">
                {showPreview ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span>SMS Preview</span>
                        <Badge variant="outline" className="text-[9px]">Sample Data</Badge>
                      </div>
                      <div className="max-w-xs mx-auto">
                        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm leading-relaxed">
                          {replaceSampleData(smsBody)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 text-center">
                          {replaceSampleData(smsBody).length} characters
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">SMS Message</Label>
                      {isSmsCustom && (
                        <Button variant="ghost" size="sm" onClick={resetSms} className="text-xs h-7 gap-1 text-muted-foreground">
                          <RotateCcw className="w-3 h-3" /> Reset to default
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={smsBody}
                      onChange={e => setSmsBody(e.target.value)}
                      placeholder="SMS message..."
                      className="text-sm min-h-[100px] font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        {smsBody.length} characters
                        {smsBody.length > 160 && " (may be split into multiple SMS segments)"}
                      </p>
                      {isSmsCustom && (
                        <p className="text-[11px] text-muted-foreground italic">✏️ Customized</p>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save Templates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
