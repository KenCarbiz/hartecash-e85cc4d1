import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Settings, TrendingUp, Clock, DollarSign,
  PhoneCall, PhoneOff, CheckCircle, AlertTriangle, Loader2,
} from "lucide-react";

/* ── types & defaults ──────────────────────────────── */
interface VoiceAIConfig {
  voice_ai_enabled: boolean; voice_ai_api_key: string;
  voice_ai_from_number: string; voice_ai_transfer_number: string;
  voice_ai_max_bump_amount: number; voice_ai_call_start: string; voice_ai_call_end: string;
}
interface VoiceKPIs { totalCalls: number; connectedRate: number; conversionRate: number; estimatedCost: number; }

const DEFAULT_CONFIG: VoiceAIConfig = {
  voice_ai_enabled: false, voice_ai_api_key: "", voice_ai_from_number: "",
  voice_ai_transfer_number: "", voice_ai_max_bump_amount: 500,
  voice_ai_call_start: "09:00", voice_ai_call_end: "18:00",
};

const maskKey = (k: string) => {
  if (!k) return "";
  return k.length <= 8 ? "\u2022".repeat(k.length) : `${k.slice(0, 4)}${"\u2022".repeat(k.length - 8)}${k.slice(-4)}`;
};

/* ── KPI card ──────────────────────────────────────── */

const ACCENT: Record<string, string> = {
  primary: "bg-primary/10 text-primary", emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400", blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};
const KPICard = ({ icon: Icon, label, value, accent = "primary" }: { icon: React.ElementType; label: string; value: string; accent?: string }) => (
  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-5 flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${ACCENT[accent] ?? ACCENT.primary}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
  </div>
);

/* ── main component ────────────────────────────────── */

const VoiceAICampaigns = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const dealershipId = tenant.dealership_id;

  const [config, setConfig] = useState<VoiceAIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [kpis, setKpis] = useState<VoiceKPIs>({
    totalCalls: 0,
    connectedRate: 0,
    conversionRate: 0,
    estimatedCost: 0,
  });

  /* ── fetch config + KPIs on mount ── */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch dealer config
      const { data: dealer } = await (supabase as any)
        .from("dealer_accounts")
        .select("*")
        .eq("dealership_id", dealershipId)
        .maybeSingle();

      if (dealer) {
        const d = dealer as any;
        setConfig({
          voice_ai_enabled: !!d.voice_ai_enabled,
          voice_ai_api_key: d.voice_ai_api_key || "",
          voice_ai_from_number: d.voice_ai_from_number || "",
          voice_ai_transfer_number: d.voice_ai_transfer_number || "",
          voice_ai_max_bump_amount: d.voice_ai_max_bump_amount ?? 500,
          voice_ai_call_start: d.voice_ai_call_start || "09:00",
          voice_ai_call_end: d.voice_ai_call_end || "18:00",
        });
      }

      // Fetch aggregate KPIs from voice_call_log (parallel)
      const base = (supabase as any).from("voice_call_log");
      const [r1, r2, r3] = await Promise.all([
        base.select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId),
        base.select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId).eq("status", "completed"),
        base.select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId).in("outcome", ["accepted", "appointment_scheduled"]),
      ]);
      const total = r1.count ?? 0;
      const connected = r2.count ?? 0;
      const converted = r3.count ?? 0;
      setKpis({
        totalCalls: total,
        connectedRate: total > 0 ? Math.round((connected / total) * 100) : 0,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
        estimatedCost: parseFloat((total * 0.09 * 3).toFixed(2)),
      });

      setLoading(false);
    };

    fetchData();
  }, [dealershipId]);

  /* ── save config ── */
  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("dealer_accounts")
      .upsert(
        {
          dealership_id: dealershipId,
          voice_ai_enabled: config.voice_ai_enabled,
          voice_ai_api_key: config.voice_ai_api_key || null,
          voice_ai_from_number: config.voice_ai_from_number || null,
          voice_ai_transfer_number: config.voice_ai_transfer_number || null,
          voice_ai_max_bump_amount: config.voice_ai_max_bump_amount,
          voice_ai_call_start: config.voice_ai_call_start,
          voice_ai_call_end: config.voice_ai_call_end,
        },
        { onConflict: "dealership_id" },
      );

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuration saved", description: "Voice AI settings updated successfully." });
    }
  };

  const updateConfig = <K extends keyof VoiceAIConfig>(key: K, value: VoiceAIConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  /* ── loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading Voice AI configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
          <Phone className="w-4.5 h-4.5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Voice AI Campaigns</h2>
          <p className="text-sm text-muted-foreground">Automated outbound calls powered by Bland.ai</p>
        </div>
      </div>

      {/* ── Missing API Key Banner ── */}
      {!config.voice_ai_api_key && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Connect your Bland.ai API key to start making AI calls.
          </p>
        </div>
      )}

      {/* ── Configuration Card ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
            <Settings className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground/90 tracking-tight">Configuration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Bland.ai connection and calling rules</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Enable Voice AI */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Voice AI</p>
              <p className="text-xs text-muted-foreground">Allow automated outbound calls to leads</p>
            </div>
            <Switch
              checked={config.voice_ai_enabled}
              onCheckedChange={(v) => updateConfig("voice_ai_enabled", v)}
            />
          </div>

          <div className="border-t border-border/40" />

          {/* Bland.ai API Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Bland.ai API Key</label>
            <div className="flex gap-2">
              <Input
                type={revealKey ? "text" : "password"}
                placeholder="sk-bland-..."
                value={revealKey ? config.voice_ai_api_key : maskKey(config.voice_ai_api_key)}
                onChange={(e) => updateConfig("voice_ai_api_key", e.target.value)}
                onFocus={() => setRevealKey(true)}
                onBlur={() => setRevealKey(false)}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" className="shrink-0">
                Test
              </Button>
            </div>
          </div>

          {/* Caller ID / From Number */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Caller ID / From Number</label>
            <Input
              placeholder="+1 (555) 000-0000"
              value={config.voice_ai_from_number}
              onChange={(e) => updateConfig("voice_ai_from_number", e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Transfer to (live person) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Transfer to (live person)</label>
            <Input
              placeholder="+1 (555) 000-0000"
              value={config.voice_ai_transfer_number}
              onChange={(e) => updateConfig("voice_ai_transfer_number", e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Max Offer Bump */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Max Offer Bump</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                min={0}
                step={50}
                value={config.voice_ai_max_bump_amount}
                onChange={(e) => updateConfig("voice_ai_max_bump_amount", Number(e.target.value))}
                className="pl-7 text-sm"
              />
            </div>
          </div>

          {/* Calling Hours */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Calling Hours</label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={config.voice_ai_call_start}
                onChange={(e) => updateConfig("voice_ai_call_start", e.target.value)}
                className="text-sm w-36"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={config.voice_ai_call_end}
                onChange={(e) => updateConfig("voice_ai_call_end", e.target.value)}
                className="text-sm w-36"
              />
              <Clock className="w-4 h-4 text-muted-foreground ml-1" />
            </div>
          </div>

          <div className="border-t border-border/40 pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={PhoneCall} label="Total Calls" value={kpis.totalCalls.toLocaleString()} accent="blue" />
        <KPICard icon={CheckCircle} label="Connected Rate" value={`${kpis.connectedRate}%`} accent="emerald" />
        <KPICard icon={TrendingUp} label="Conversion Rate" value={`${kpis.conversionRate}%`} accent="primary" />
        <KPICard icon={DollarSign} label="Est. Cost" value={`$${kpis.estimatedCost.toLocaleString()}`} accent="amber" />
      </div>

      {/* Part 2 will add: campaigns table + call log */}
    </div>
  );
};

export default VoiceAICampaigns;
