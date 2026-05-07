import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, Save, ChevronDown, Mic, Bot, MessageSquare, BookOpen, Sparkles,
} from "lucide-react";

/**
 * Voice AI Training cabinet editor — admin tab under Communications.
 *
 * Four sub-tabs match the four migrations cabinet tables:
 *   Persona   — who the AI is, mission, hard rules
 *   Phases    — openings/middles/closings keyed by call_type
 *   Signals   — customer phrases → recommended posture + responses
 *   Intel     — citable industry + competitor facts the AI quotes
 *
 * Same per-tenant override pattern as the objection playbook:
 * default rows seed the network; tenant rows on the same key override
 * defaults. Save writes upserts on (dealership_id, key) so editing a
 * default row creates a tenant-scoped override; further edits on that
 * same row update in place. Network defaults stay untouched.
 *
 * Soft-falls-back when migration 20260507130000 hasn't applied — each
 * sub-tab shows an in-context message pointing at the migration.
 */

interface PersonaRow {
  id: string;
  dealership_id: string;
  persona_name: string;
  voice_rules: string;
  mission_block: string;
  success_criteria: string;
  hard_constraints: string[];
  greeting_style: string | null;
  signoff_style: string | null;
  ai_disclosure_line: string | null;
  is_active: boolean;
}

interface PhaseRow {
  id: string;
  dealership_id: string;
  phase_key: string;
  call_type: string;
  phase_position: string;
  variant_label: string;
  content: string;
  signal_keywords: string[];
  use_when: string | null;
  advances_to: string | null;
  is_active: boolean;
  sort_order: number;
}

interface SignalRow {
  id: string;
  dealership_id: string;
  signal_key: string;
  signal_phrases: string[];
  customer_state: string;
  recommended_posture: string;
  response_variants: string[];
  do_not_say: string[];
  hand_off_to_human: boolean;
  is_active: boolean;
  sort_order: number;
}

interface IntelRow {
  id: string;
  dealership_id: string;
  scope: string;
  topic: string;
  short_claim: string;
  citable_number: string | null;
  evidence_url: string | null;
  use_when: string | null;
  is_active: boolean;
  sort_order: number;
}

const VoiceAgentTrainingEditor = () => {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <Bot className="w-4 h-4 text-info" />
            Voice AI Training
          </h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Four layers compile into the voice agent's prompt at call-start.
            Edits create a tenant-specific override; network defaults stay intact for any card you don't customize.
            Use the <code className="px-1 rounded bg-muted text-foreground">compile_voice_agent_prompt</code> RPC
            to preview the full block your provider will inject.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="persona" className="w-full">
        <TabsList>
          <TabsTrigger value="persona"><Bot className="w-3.5 h-3.5 mr-1.5" />Persona</TabsTrigger>
          <TabsTrigger value="phases"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Conversation Phases</TabsTrigger>
          <TabsTrigger value="signals"><Sparkles className="w-3.5 h-3.5 mr-1.5" />Customer Signals</TabsTrigger>
          <TabsTrigger value="intel"><BookOpen className="w-3.5 h-3.5 mr-1.5" />Industry Intel</TabsTrigger>
        </TabsList>

        <TabsContent value="persona" className="pt-4"><PersonaEditor /></TabsContent>
        <TabsContent value="phases" className="pt-4"><PhaseEditor /></TabsContent>
        <TabsContent value="signals" className="pt-4"><SignalEditor /></TabsContent>
        <TabsContent value="intel" className="pt-4"><IntelEditor /></TabsContent>
      </Tabs>
    </div>
  );
};

/** Generic helpers for the four sub-editors */
const useTenantTable = <T extends { id: string; dealership_id: string }>(
  table: string,
  orderBy: string = "sort_order",
) => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    // Pull tenant rows + default rows; tenant overrides default on key collisions.
    const tQ = supabase
      .from(table as never).select("*")
      .eq("dealership_id", tenant.dealership_id)
      .order(orderBy);
    const dQ = supabase
      .from(table as never).select("*")
      .eq("dealership_id", "default")
      .order(orderBy);
    const [t, d] = await Promise.all([tQ, dQ]);
    if (t.error || d.error) {
      const msg = (t.error?.message || d.error?.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        setMissing(true);
        setLoading(false);
        return;
      }
    }
    setRows([
      ...((t.data as unknown as T[]) || []),
      ...((d.data as unknown as T[]) || []),
    ]);
    setLoading(false);
  }, [table, tenant.dealership_id, orderBy]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { rows, loading, missing, refetch, dealershipId: tenant.dealership_id };
};

const MigrationMissingCard = () => (
  <Card>
    <CardContent className="pt-5 pb-5 px-5">
      <p className="text-xs text-muted-foreground">
        Voice AI Training tables aren't enabled yet. Apply migration{" "}
        <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">
          20260507130000_voice_agent_training.sql
        </code>{" "}
        via Lovable's "Push to Supabase" or the SQL editor, then refresh.
      </p>
    </CardContent>
  </Card>
);

/* ──────────────────────────── PERSONA ──────────────────────────── */
const PersonaEditor = () => {
  const { rows, loading, missing, refetch, dealershipId } = useTenantTable<PersonaRow>("voice_agent_persona", "sort_order");
  const { toast } = useToast();
  const [draft, setDraft] = useState<PersonaRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Default to the first active persona (tenant-first ordering means
  // tenant override wins automatically).
  useEffect(() => {
    if (!draft && rows.length > 0) setDraft(rows.find((r) => r.is_active) || rows[0]);
  }, [rows, draft]);

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-12 mx-auto block" />;
  if (missing)  return <MigrationMissingCard />;
  if (!draft)   return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        dealership_id: dealershipId,
        persona_name: draft.persona_name,
        voice_rules: draft.voice_rules,
        mission_block: draft.mission_block,
        success_criteria: draft.success_criteria,
        hard_constraints: draft.hard_constraints,
        greeting_style: draft.greeting_style,
        signoff_style: draft.signoff_style,
        ai_disclosure_line: draft.ai_disclosure_line,
        is_active: draft.is_active,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("voice_agent_persona" as never)
        .upsert(payload as never, { onConflict: "dealership_id,persona_name" });
      if (error) throw error;
      toast({ title: "Persona saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">{draft.persona_name}</h4>
            <p className="text-micro text-muted-foreground">
              Active persona for this rooftop. Edits create a tenant override on save.
            </p>
          </div>
          <Badge variant={draft.dealership_id === "default" ? "outline" : "default"} className="text-micro">
            {draft.dealership_id === "default" ? "Network default" : "Tenant override"}
          </Badge>
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider">Persona name</Label>
          <Input value={draft.persona_name} onChange={(e) => setDraft({ ...draft, persona_name: e.target.value })} className="mt-1" />
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider">Voice rules</Label>
          <Textarea rows={4} value={draft.voice_rules} onChange={(e) => setDraft({ ...draft, voice_rules: e.target.value })} className="mt-1 text-xs" />
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider">Mission</Label>
          <Textarea rows={4} value={draft.mission_block} onChange={(e) => setDraft({ ...draft, mission_block: e.target.value })} className="mt-1 text-xs" />
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider">Success criteria</Label>
          <Textarea rows={2} value={draft.success_criteria} onChange={(e) => setDraft({ ...draft, success_criteria: e.target.value })} className="mt-1 text-xs" />
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider">Hard constraints (one per line)</Label>
          <Textarea
            rows={5}
            value={(draft.hard_constraints || []).join("\n")}
            onChange={(e) => setDraft({ ...draft, hard_constraints: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
            className="mt-1 text-xs font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-micro font-bold uppercase tracking-wider">Greeting style</Label>
            <Textarea rows={3} value={draft.greeting_style || ""} onChange={(e) => setDraft({ ...draft, greeting_style: e.target.value || null })} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-micro font-bold uppercase tracking-wider">Sign-off style</Label>
            <Textarea rows={3} value={draft.signoff_style || ""} onChange={(e) => setDraft({ ...draft, signoff_style: e.target.value || null })} className="mt-1 text-xs" />
          </div>
        </div>

        <div>
          <Label className="text-micro font-bold uppercase tracking-wider inline-flex items-center gap-1">
            <Mic className="w-3 h-3" /> AI disclosure (when customer asks)
          </Label>
          <Textarea rows={2} value={draft.ai_disclosure_line || ""} onChange={(e) => setDraft({ ...draft, ai_disclosure_line: e.target.value || null })} className="mt-1 text-xs" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="w-4 h-4 rounded border-border accent-primary" />
            <span className="text-muted-foreground">{draft.is_active ? "Active — voice agent loads this persona" : "Inactive"}</span>
          </label>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/* ──────────────────────── CONVERSATION PHASES ───────────────────── */
const PhaseEditor = () => {
  const { rows, loading, missing, refetch, dealershipId } = useTenantTable<PhaseRow>("conversation_phases", "sort_order");
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<PhaseRow>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Dedupe by phase_key+variant_label, tenant override wins.
  const merged = (() => {
    const byKey = new Map<string, PhaseRow>();
    for (const r of rows.filter((r) => r.dealership_id === "default")) byKey.set(`${r.phase_key}|${r.variant_label}`, r);
    for (const r of rows.filter((r) => r.dealership_id === dealershipId)) byKey.set(`${r.phase_key}|${r.variant_label}`, r);
    return Array.from(byKey.values()).sort((a, b) => a.sort_order - b.sort_order);
  })();

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-12 mx-auto block" />;
  if (missing)  return <MigrationMissingCard />;

  const handleSave = async (row: PhaseRow) => {
    const draft = drafts[row.id] || {};
    setSaving(row.id);
    try {
      const payload = {
        dealership_id: dealershipId,
        phase_key: row.phase_key,
        call_type: row.call_type,
        phase_position: row.phase_position,
        variant_label: row.variant_label,
        content: draft.content ?? row.content,
        signal_keywords: draft.signal_keywords ?? row.signal_keywords,
        use_when: draft.use_when ?? row.use_when,
        advances_to: draft.advances_to ?? row.advances_to,
        is_active: draft.is_active ?? row.is_active,
        sort_order: row.sort_order,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("conversation_phases" as never).upsert(payload as never, { onConflict: "dealership_id,phase_key,variant_label" });
      if (error) throw error;
      toast({ title: "Phase saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      {merged.map((row) => {
        const isOpen = openId === row.id;
        const draft = drafts[row.id] || {};
        const isOverride = row.dealership_id === dealershipId;
        return (
          <Card key={row.id} className={!row.is_active ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className="text-micro">{row.phase_position}</Badge>
                <Badge variant="outline" className="text-micro">{row.call_type}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{row.phase_key}</div>
                  <div className="text-micro text-muted-foreground truncate">variant: {row.variant_label}</div>
                </div>
                {isOverride && <Badge variant="outline" className="text-micro border-info/40 text-info">Customized</Badge>}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3">
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Content (what the AI says)</Label>
                    <Textarea rows={4} value={(draft.content ?? row.content)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, content: e.target.value } })} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Use when</Label>
                    <Textarea rows={2} value={(draft.use_when ?? row.use_when) || ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, use_when: e.target.value || null } })} className="mt-1 text-xs" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">{(draft.is_active ?? row.is_active) ? "Active" : "Inactive"}</span>
                    </label>
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

/* ──────────────────────────── SIGNALS ──────────────────────────── */
const SignalEditor = () => {
  const { rows, loading, missing, refetch, dealershipId } = useTenantTable<SignalRow>("customer_signals", "sort_order");
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<SignalRow>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const merged = (() => {
    const byKey = new Map<string, SignalRow>();
    for (const r of rows.filter((r) => r.dealership_id === "default")) byKey.set(r.signal_key, r);
    for (const r of rows.filter((r) => r.dealership_id === dealershipId)) byKey.set(r.signal_key, r);
    return Array.from(byKey.values()).sort((a, b) => a.sort_order - b.sort_order);
  })();

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-12 mx-auto block" />;
  if (missing)  return <MigrationMissingCard />;

  const handleSave = async (row: SignalRow) => {
    const draft = drafts[row.id] || {};
    setSaving(row.id);
    try {
      const payload = {
        dealership_id: dealershipId,
        signal_key: row.signal_key,
        signal_phrases: draft.signal_phrases ?? row.signal_phrases,
        customer_state: draft.customer_state ?? row.customer_state,
        recommended_posture: draft.recommended_posture ?? row.recommended_posture,
        response_variants: draft.response_variants ?? row.response_variants,
        do_not_say: draft.do_not_say ?? row.do_not_say,
        hand_off_to_human: draft.hand_off_to_human ?? row.hand_off_to_human,
        is_active: draft.is_active ?? row.is_active,
        sort_order: row.sort_order,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("customer_signals" as never).upsert(payload as never, { onConflict: "dealership_id,signal_key" });
      if (error) throw error;
      toast({ title: "Signal saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      {merged.map((row) => {
        const isOpen = openId === row.id;
        const draft = drafts[row.id] || {};
        const isOverride = row.dealership_id === dealershipId;
        return (
          <Card key={row.id} className={!row.is_active ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className="text-micro">{row.customer_state}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{row.signal_key}</div>
                  <div className="text-micro text-muted-foreground truncate">{row.recommended_posture}</div>
                </div>
                {row.hand_off_to_human && <Badge variant="outline" className="text-micro border-warning/40 text-warning">→ Human</Badge>}
                {isOverride && <Badge variant="outline" className="text-micro border-info/40 text-info">Customized</Badge>}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3">
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Signal phrases (one per line)</Label>
                    <Textarea rows={4} value={(draft.signal_phrases ?? row.signal_phrases).join("\n")} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, signal_phrases: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) } })} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Recommended posture</Label>
                    <Textarea rows={2} value={(draft.recommended_posture ?? row.recommended_posture)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, recommended_posture: e.target.value } })} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Response variants (one per line)</Label>
                    <Textarea rows={3} value={(draft.response_variants ?? row.response_variants).join("\n")} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, response_variants: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) } })} className="mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Do NOT say (one per line)</Label>
                    <Textarea rows={2} value={(draft.do_not_say ?? row.do_not_say).join("\n")} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, do_not_say: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) } })} className="mt-1 text-xs" />
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Active</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.hand_off_to_human ?? row.hand_off_to_human)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, hand_off_to_human: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Hand off to human</span>
                    </label>
                    <div className="flex-1" />
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

/* ───────────────────────────── INTEL ───────────────────────────── */
const IntelEditor = () => {
  const { rows, loading, missing, refetch, dealershipId } = useTenantTable<IntelRow>("industry_intel", "sort_order");
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<IntelRow>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const merged = (() => {
    const byKey = new Map<string, IntelRow>();
    for (const r of rows.filter((r) => r.dealership_id === "default")) byKey.set(`${r.scope}|${r.topic}`, r);
    for (const r of rows.filter((r) => r.dealership_id === dealershipId)) byKey.set(`${r.scope}|${r.topic}`, r);
    return Array.from(byKey.values()).sort((a, b) => a.scope.localeCompare(b.scope) || a.sort_order - b.sort_order);
  })();

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-12 mx-auto block" />;
  if (missing)  return <MigrationMissingCard />;

  const handleSave = async (row: IntelRow) => {
    const draft = drafts[row.id] || {};
    setSaving(row.id);
    try {
      const payload = {
        dealership_id: dealershipId,
        scope: row.scope,
        topic: row.topic,
        short_claim: draft.short_claim ?? row.short_claim,
        citable_number: draft.citable_number ?? row.citable_number,
        evidence_url: draft.evidence_url ?? row.evidence_url,
        use_when: draft.use_when ?? row.use_when,
        is_active: draft.is_active ?? row.is_active,
        sort_order: row.sort_order,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("industry_intel" as never).upsert(payload as never, { onConflict: "dealership_id,scope,topic" });
      if (error) throw error;
      toast({ title: "Intel saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-2">
      {merged.map((row) => {
        const isOpen = openId === row.id;
        const draft = drafts[row.id] || {};
        const isOverride = row.dealership_id === dealershipId;
        return (
          <Card key={row.id} className={!row.is_active ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className={`text-micro ${row.scope === "competitor" ? "border-warning/40 text-warning" : ""}`}>
                  {row.scope}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{row.topic}</div>
                  <div className="text-micro text-muted-foreground truncate">{row.short_claim}</div>
                </div>
                {isOverride && <Badge variant="outline" className="text-micro border-info/40 text-info">Customized</Badge>}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3">
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Short claim</Label>
                    <Textarea rows={3} value={(draft.short_claim ?? row.short_claim)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, short_claim: e.target.value } })} className="mt-1 text-xs" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-micro font-bold uppercase tracking-wider">Citable number</Label>
                      <Input value={(draft.citable_number ?? row.citable_number) || ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, citable_number: e.target.value || null } })} className="mt-1 text-xs" />
                    </div>
                    <div>
                      <Label className="text-micro font-bold uppercase tracking-wider">Evidence URL</Label>
                      <Input value={(draft.evidence_url ?? row.evidence_url) || ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, evidence_url: e.target.value || null } })} className="mt-1 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-micro font-bold uppercase tracking-wider">Use when</Label>
                    <Textarea rows={2} value={(draft.use_when ?? row.use_when) || ""} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, use_when: e.target.value || null } })} className="mt-1 text-xs" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Active</span>
                    </label>
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default VoiceAgentTrainingEditor;
