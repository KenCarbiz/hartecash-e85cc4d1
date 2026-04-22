import { useState, useEffect, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Settings, TrendingUp, Clock, DollarSign,
  PhoneCall, PhoneOff, CheckCircle, AlertTriangle, Loader2,
  Plus, Pause, Play, ChevronDown, ChevronRight, Megaphone, List,
} from "lucide-react";

/* ── types & defaults ──────────────────────────────── */
interface VoiceAIConfig {
  voice_ai_enabled: boolean; voice_ai_api_key: string;
  voice_ai_from_number: string; voice_ai_transfer_number: string;
  voice_ai_max_bump_amount: number; voice_ai_call_start: string; voice_ai_call_end: string;
  voice_ai_competitor_response_mode: string;
  voice_ai_beat_competitor_amount: number;
}
interface VoiceKPIs { totalCalls: number; connectedRate: number; conversionRate: number; estimatedCost: number; }

const DEFAULT_CONFIG: VoiceAIConfig = {
  voice_ai_enabled: false, voice_ai_api_key: "", voice_ai_from_number: "",
  voice_ai_transfer_number: "", voice_ai_max_bump_amount: 500,
  voice_ai_call_start: "09:00", voice_ai_call_end: "18:00",
  voice_ai_competitor_response_mode: "none",
  voice_ai_beat_competitor_amount: 0,
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

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", target: "", max_calls_per_day: 25 });
  const [callLog, setCallLog] = useState<any[]>([]);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

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
          voice_ai_competitor_response_mode: d.voice_ai_competitor_response_mode || "none",
          voice_ai_beat_competitor_amount: d.voice_ai_beat_competitor_amount ?? 0,
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

      // Fetch campaigns & call log in parallel
      const [campRes, logRes] = await Promise.all([
        (supabase as any).from("voice_campaigns").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }),
        (supabase as any).from("voice_call_log").select("*").eq("dealership_id", dealershipId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (campRes.data) setCampaigns(campRes.data);
      if (logRes.data) setCallLog(logRes.data);

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
          voice_ai_competitor_response_mode: config.voice_ai_competitor_response_mode,
          voice_ai_beat_competitor_amount: config.voice_ai_beat_competitor_amount,
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

  /* ── campaign actions ── */
  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.target) return;
    const { data, error } = await (supabase as any).from("voice_campaigns").insert({
      dealership_id: dealershipId, name: newCampaign.name, target: newCampaign.target,
      max_calls_per_day: newCampaign.max_calls_per_day, status: "draft",
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setCampaigns((prev) => [data, ...prev]);
    setNewCampaign({ name: "", target: "", max_calls_per_day: 25 });
    setShowNewCampaign(false);
    toast({ title: "Campaign created", description: `"${data.name}" is ready to activate.` });
  };

  const toggleCampaignStatus = async (c: any) => {
    const next = c.status === "active" ? "paused" : "active";
    await (supabase as any).from("voice_campaigns").update({ status: next }).eq("id", c.id);
    setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
  };

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    draft: "bg-muted text-muted-foreground border-border",
    completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  const OUTCOME_COLORS: Record<string, string> = {
    accepted: "bg-emerald-500/10 text-emerald-600", appointment_scheduled: "bg-emerald-600/10 text-emerald-700",
    wants_higher_offer: "bg-amber-500/10 text-amber-600", callback_requested: "bg-blue-500/10 text-blue-600",
    not_interested: "bg-muted text-muted-foreground", voicemail_left: "bg-purple-500/10 text-purple-600",
    opted_out: "bg-red-500/10 text-red-600",
  };

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

          {/* Competitor Offer Response */}
          <div className="border-t border-border/30 pt-4 mt-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              When Customer Has a Competing Offer
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="radio" name="competitor_mode" value="none"
                  checked={config.voice_ai_competitor_response_mode === 'none'}
                  onChange={() => setConfig(c => ({...c, voice_ai_competitor_response_mode: 'none'}))} />
                <label className="text-sm">Don't match — let the manager handle it</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="radio" name="competitor_mode" value="match"
                  checked={config.voice_ai_competitor_response_mode === 'match'}
                  onChange={() => setConfig(c => ({...c, voice_ai_competitor_response_mode: 'match'}))} />
                <label className="text-sm">Match their offer — AI says "We'll match that"</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="radio" name="competitor_mode" value="beat"
                  checked={config.voice_ai_competitor_response_mode === 'beat'}
                  onChange={() => setConfig(c => ({...c, voice_ai_competitor_response_mode: 'beat'}))} />
                <div className="flex items-center gap-2">
                  <label className="text-sm">Beat their offer by $</label>
                  <Input
                    type="number"
                    className="w-24 h-8 text-sm"
                    value={config.voice_ai_beat_competitor_amount || ''}
                    onChange={e => setConfig(c => ({...c, voice_ai_beat_competitor_amount: Number(e.target.value) || 0}))}
                    placeholder="200"
                  />
                </div>
              </div>
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

      {/* ── Section A: Campaigns Table ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary"><Megaphone className="w-4 h-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground/90 tracking-tight">Active Campaigns</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage outbound calling campaigns</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewCampaign(true)}><Plus className="w-3.5 h-3.5" />New Campaign</Button>
        </div>
        <div className="p-6">
          {campaigns.length === 0 ? (
            <div className="text-center py-10">
              <Megaphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No campaigns yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowNewCampaign(true)}>Create Campaign</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/40 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Name</th><th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-right py-2 pr-4 font-medium">Calls</th><th className="text-right py-2 pr-4 font-medium">Connected</th>
                  <th className="text-right py-2 pr-4 font-medium">Converted</th><th className="text-left py-2 pr-4 font-medium">Created</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/20 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{c.name}</td>
                    <td className="py-2.5 pr-4"><Badge variant="outline" className={`text-[11px] ${STATUS_COLORS[c.status] ?? ""}`}>{c.status}</Badge></td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{c.total_calls ?? 0}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{c.connected ?? 0}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{c.converted ?? 0}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                    <td className="py-2.5 text-right">
                      {(c.status === "active" || c.status === "paused") && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => toggleCampaignStatus(c)}>
                          {c.status === "active" ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Resume</>}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Campaign Dialog */}
      <Dialog open={showNewCampaign} onOpenChange={setShowNewCampaign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Campaign Name</label>
              <Input placeholder="e.g. April Offer Follow-Up" value={newCampaign.name} onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Target Audience</label>
              <Select value={newCampaign.target} onValueChange={(v) => setNewCampaign((p) => ({ ...p, target: v }))}>
                <SelectTrigger><SelectValue placeholder="Select target..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer_not_accepted_2_14d">Offer Not Accepted (2-14 days)</SelectItem>
                  <SelectItem value="accepted_no_appointment">Accepted No Appointment</SelectItem>
                  <SelectItem value="stale_leads_30d">Stale Leads (30+ days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max Calls Per Day</label>
              <Input type="number" min={1} max={200} value={newCampaign.max_calls_per_day} onChange={(e) => setNewCampaign((p) => ({ ...p, max_calls_per_day: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCampaign(false)}>Cancel</Button>
            <Button onClick={handleCreateCampaign} disabled={!newCampaign.name || !newCampaign.target}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Section B: Recent Call Log ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center gap-3">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600"><List className="w-4 h-4" /></span>
          <div>
            <h3 className="text-sm font-bold text-foreground/90 tracking-tight">Recent Calls</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 30 outbound AI calls</p>
          </div>
        </div>
        <div className="p-6">
          {callLog.length === 0 ? (
            <div className="text-center py-10">
              <PhoneOff className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No calls yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/40 text-xs text-muted-foreground">
                  <th className="w-6" /><th className="text-left py-2 pr-4 font-medium">Customer</th>
                  <th className="text-left py-2 pr-4 font-medium">Vehicle</th><th className="text-left py-2 pr-4 font-medium">Outcome</th>
                  <th className="text-right py-2 pr-4 font-medium">Duration</th><th className="text-left py-2 font-medium">Date</th>
                </tr></thead>
                <tbody>{callLog.map((cl) => {
                  const isOpen = expandedCall === cl.id;
                  return (
                    <Fragment key={cl.id}>
                      <tr className="border-b border-border/20 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedCall(isOpen ? null : cl.id)}>
                        <td className="py-2.5 pr-1 text-muted-foreground">{isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                        <td className="py-2.5 pr-4 font-medium text-foreground">{cl.customer_name ?? "Unknown"}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{cl.vehicle ?? "—"}</td>
                        <td className="py-2.5 pr-4"><Badge variant="secondary" className={`text-[11px] ${OUTCOME_COLORS[cl.outcome] ?? ""}`}>{(cl.outcome ?? "unknown").replace(/_/g, " ")}</Badge></td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground">{cl.duration_seconds ? `${Math.floor(cl.duration_seconds / 60)}:${String(cl.duration_seconds % 60).padStart(2, "0")}` : "—"}</td>
                        <td className="py-2.5 text-muted-foreground">{cl.created_at ? new Date(cl.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border/20">
                          <td colSpan={6} className="px-6 py-3 bg-muted/20">
                            {cl.summary && <p className="text-xs font-medium text-foreground mb-1.5">{cl.summary}</p>}
                            {cl.transcript ? <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{cl.transcript}</p> : <p className="text-xs text-muted-foreground italic">No transcript available</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAICampaigns;
