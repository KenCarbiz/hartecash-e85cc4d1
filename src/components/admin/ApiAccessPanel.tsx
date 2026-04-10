import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { generateApiKey, maskApiKey, API_ENDPOINTS, WEBHOOK_EVENT_TYPES } from "@/lib/apiAccess";
import type { WebhookConfig, WebhookEventType } from "@/lib/apiAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Key, Copy, RefreshCw, Check, Globe, Webhook, Send, Loader2, Shield, Code2, Zap,
} from "lucide-react";

/* ── Premium card shell ────────────────────────────────── */

const PremiumCard = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
    <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center gap-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-foreground/90 tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

/* ── Method badge colour helper ────────────────────────── */

const methodColor = (m: string) => {
  switch (m) {
    case "GET": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "POST": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "PUT": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "DELETE": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    default: return "bg-muted text-muted-foreground";
  }
};

/* ── Main component ────────────────────────────────────── */

const ApiAccessPanel = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const dealershipId = tenant.dealership_id;

  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventType[]>([]);
  const [webhookActive, setWebhookActive] = useState(false);

  /* ── Fetch existing key & webhook config ── */
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("dealer_accounts")
        .select("api_key, webhook_config")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (data) {
        setApiKey((data as any).api_key || "");
        const wc = (data as any).webhook_config as WebhookConfig | null;
        if (wc) {
          setWebhookUrl(wc.url || "");
          setWebhookEvents(wc.events || []);
          setWebhookActive(wc.is_active ?? false);
        }
      }
      setLoading(false);
    };
    fetchConfig();
  }, [dealershipId]);

  /* ── Generate / Regenerate ── */
  const handleRegenerate = async () => {
    setRegenerating(true);
    const newKey = generateApiKey();
    const { error } = await supabase
      .from("dealer_accounts")
      .upsert({ dealership_id: dealershipId, api_key: newKey } as any, { onConflict: "dealership_id" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setApiKey(newKey);
      toast({ title: "API key regenerated", description: "Your new key is ready. Copy it now — it won't be shown in full again." });
    }
    setRegenerating(false);
  };

  /* ── Copy key ── */
  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast({ title: "Copied!", description: "API key copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Save webhook config ── */
  const handleSaveWebhook = async () => {
    setSaving(true);
    const config: WebhookConfig = {
      url: webhookUrl,
      events: webhookEvents,
      is_active: webhookActive,
    };
    const { error } = await supabase
      .from("dealer_accounts")
      .upsert({ dealership_id: dealershipId, webhook_config: config } as any, { onConflict: "dealership_id" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Webhook saved", description: "Your webhook configuration has been updated." });
    }
    setSaving(false);
  };

  /* ── Test webhook ── */
  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast({ title: "No URL", description: "Enter a webhook URL first.", variant: "destructive" });
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          data: { message: "This is a test webhook from HarteCash." },
        }),
      });
      if (res.ok) {
        toast({ title: "Webhook test sent", description: `Received ${res.status} response.` });
      } else {
        toast({ title: "Webhook responded with error", description: `Status: ${res.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Webhook unreachable", description: "Could not connect to the endpoint. Check the URL and try again.", variant: "destructive" });
    }
    setTestingWebhook(false);
  };

  /* ── Toggle event checkbox ── */
  const toggleEvent = (key: WebhookEventType) => {
    setWebhookEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h2 className="text-xl font-bold text-card-foreground tracking-tight flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" />
          API Access
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your API key and webhook integrations for enterprise DMS/CRM connectivity.
        </p>
      </div>

      {/* ── API Key card ── */}
      <PremiumCard icon={Key} title="API Key" description="Authenticate requests to the HarteCash API">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Current Key</Label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-sm tracking-wide">
                <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{apiKey ? maskApiKey(apiKey) : "No key generated"}</span>
              </div>
            </div>
            <div className="flex gap-2 sm:mt-5">
              <Button
                variant="outline"
                size="sm"
                disabled={!apiKey}
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={regenerating}
                onClick={handleRegenerate}
                className="gap-1.5"
              >
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {apiKey ? "Regenerate" : "Generate"}
              </Button>
            </div>
          </div>
          {apiKey && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
              Keep your API key secret. If compromised, regenerate it immediately. The full key is only shown once after generation.
            </p>
          )}
        </div>
      </PremiumCard>

      {/* ── API Endpoints table ── */}
      <PremiumCard icon={Globe} title="Available Endpoints" description="RESTful API endpoints available with your key">
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Method</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Path</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Description</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Scopes</th>
              </tr>
            </thead>
            <tbody>
              {API_ENDPOINTS.map((ep, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${methodColor(ep.method)}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/80">{ep.path}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{ep.description}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {ep.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      {/* ── Webhook Configuration ── */}
      <PremiumCard icon={Webhook} title="Webhook Configuration" description="Receive real-time event notifications at your endpoint">
        <div className="space-y-6">
          {/* URL input */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Webhook Endpoint URL</Label>
            <Input
              placeholder="https://your-crm.com/api/hartecash-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Webhook Active</p>
              <p className="text-xs text-muted-foreground">Enable or disable webhook delivery</p>
            </div>
            <Switch checked={webhookActive} onCheckedChange={setWebhookActive} />
          </div>

          {/* Event type checkboxes */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Event Types</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WEBHOOK_EVENT_TYPES.map((evt) => {
                const isChecked = webhookEvents.includes(evt.key);
                return (
                  <button
                    key={evt.key}
                    type="button"
                    onClick={() => toggleEvent(evt.key)}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                      isChecked
                        ? "border-primary/40 bg-primary/5 shadow-[0_0_12px_rgba(100,160,255,0.08)]"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isChecked ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{evt.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{evt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleSaveWebhook} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Save Webhook Config
            </Button>
            <Button variant="outline" onClick={handleTestWebhook} disabled={testingWebhook || !webhookUrl} className="gap-1.5">
              {testingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Test Event
            </Button>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
};

export default ApiAccessPanel;
