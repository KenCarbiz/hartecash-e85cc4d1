import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { logStaffAction } from "@/lib/staffAuditLog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, Save, ChevronDown, Mic, Bot, MessageSquare, BookOpen, Sparkles,
  GitBranch, ArchiveRestore, Archive, Eye, PhoneCall, X, Copy,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/**
 * Variant tracking columns (added by 20260507150000_voice_variant_store.sql)
 * — every cabinet row carries them. Optional in the type because
 * tables predate the migration; the editor degrades gracefully when
 * these are absent.
 */
interface VariantFields {
  variant_id?: string | null;
  parent_variant_id?: string | null;
  win_count?: number | null;
  loss_count?: number | null;
  last_promoted_at?: string | null;
  retired_at?: string | null;
}

interface PersonaRow extends VariantFields {
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

interface PhaseRow extends VariantFields {
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

interface SignalRow extends VariantFields {
  id: string;
  dealership_id: string;
  signal_key: string;
  variant_label?: string;
  signal_phrases: string[];
  customer_state: string;
  recommended_posture: string;
  response_variants: string[];
  do_not_say: string[];
  hand_off_to_human: boolean;
  is_active: boolean;
  sort_order: number;
}

interface IntelRow extends VariantFields {
  id: string;
  dealership_id: string;
  scope: string;
  topic: string;
  variant_label?: string;
  short_claim: string;
  citable_number: string | null;
  evidence_url: string | null;
  use_when: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * CabinetTools — manager controls for previewing the compiled cabinet
 * prompt and dispatching a test voice call to their own number.
 *
 * Two buttons:
 *   1. Preview compiled prompt — calls compile_voice_agent_prompt with
 *      the current tenant + a stub call_type and renders the result in
 *      a dialog so the manager can see what Bland will receive at
 *      call-start. No call_id passed → no variant attribution side
 *      effect.
 *   2. Send test call — invokes launch-voice-call with
 *      campaign_type:"test" + the manager's phone. Uses the existing
 *      test-shortcut path that bypasses submission lookup but still
 *      runs the cabinet compile against this dealership's overrides.
 *
 * Both fall back gracefully when the migrations / RPC aren't applied —
 * preview shows the placeholder text, test-call surfaces the error
 * toast.
 */
const CabinetTools = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");
  const [callType, setCallType] = useState("offered_to_accepted");
  const [testPhone, setTestPhone] = useState("");
  const [calling, setCalling] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { data, error } = await supabase.rpc("compile_voice_agent_prompt", {
        _dealership_id: tenant.dealership_id,
        _submission_id: null,
        _call_type: callType,
        _call_id: null,
      });
      if (error) {
        toast({ title: "Preview failed", description: error.message, variant: "destructive" });
        return;
      }
      setPreviewText(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      setPreviewOpen(true);
    } finally { setPreviewing(false); }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      toast({ title: "Copied", description: "Compiled prompt on clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleTestCall = async () => {
    const phone = testPhone.trim();
    if (!phone) {
      toast({ title: "Enter a phone number", variant: "destructive" });
      return;
    }
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke("launch-voice-call", {
        body: {
          campaign_type: "test",
          phone,
          context: { dealership_id: tenant.dealership_id, call_type: callType },
        },
      });
      if (error) {
        toast({ title: "Test call failed", description: error.message, variant: "destructive" });
        return;
      }
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) {
        toast({ title: "Test call failed", description: result.error, variant: "destructive" });
      } else {
        toast({
          title: "Test call dispatched",
          description: `Bland will dial ${phone} in a few seconds. Pick up to hear the cabinet live.`,
        });
      }
    } finally { setCalling(false); }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
        Cabinet tools
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={callType}
          onChange={(e) => setCallType(e.target.value)}
          className="text-xs h-8 px-2 rounded-md border border-border bg-background"
          aria-label="Call type"
        >
          <option value="offered_to_accepted">offered_to_accepted</option>
          <option value="voice_offer_re_engage">voice_offer_re_engage</option>
          <option value="voice_offer_refresh">voice_offer_refresh</option>
          <option value="voice_schedule_inspection">voice_schedule_inspection</option>
          <option value="appraiser_qa">appraiser_qa</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreview}
          disabled={previewing}
          className="h-8 text-xs"
        >
          <Eye className="w-3 h-3 mr-1.5" />
          {previewing ? "Compiling…" : "Preview compiled prompt"}
        </Button>
        <div className="h-6 w-px bg-border" />
        <Input
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="+15551234567"
          className="h-8 w-[180px] text-xs"
          aria-label="Test call phone"
        />
        <Button
          size="sm"
          onClick={handleTestCall}
          disabled={calling || !testPhone.trim()}
          className="h-8 text-xs"
        >
          <PhoneCall className="w-3 h-3 mr-1.5" />
          {calling ? "Dispatching…" : "Send test call"}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-8">
              <span>Compiled prompt — {callType}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyPreview}
                className="h-7 text-xs"
                title="Copy compiled prompt to clipboard"
              >
                <Copy className="w-3 h-3 mr-1.5" />
                Copy
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-3">
            <pre className="text-[11.5px] leading-snug font-mono whitespace-pre-wrap break-words">
              {previewText || "(empty)"}
            </pre>
          </div>
          <div className="text-micro text-muted-foreground pt-2">
            This is what Bland.ai will receive as the system prompt. Variant
            choices are sampled fresh on every preview, so the same call type
            may render different variants between previews.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const VoiceAgentTrainingEditor = () => {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <Bot className="w-4 h-4 text-info" />
            Voice AI Training
          </h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Four layers compile into the voice agent's prompt at call-start.
            Edits create a tenant-specific override; network defaults stay intact for any card you don't customize.
          </p>
          <CabinetTools />
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

/**
 * Win/loss + retired pill row, shown next to the row title in every
 * editor's collapsed header. Hidden entirely when the variant
 * columns aren't present (migration 20260507150000 not yet applied).
 *
 * The win-rate column is the bandit's current Beta posterior mean —
 * (1 + wins) / (2 + wins + losses). We render it instead of raw
 * win_count so a manager can compare two variants at a glance even
 * when their absolute counts differ wildly.
 */
const VariantBadges = ({ row }: { row: VariantFields }) => {
  const wins  = row.win_count  ?? 0;
  const losses = row.loss_count ?? 0;
  const total = wins + losses;
  const retired = !!row.retired_at;

  if (!row.variant_id && total === 0 && !retired) return null;

  const winRate = total === 0 ? null : (1 + wins) / (2 + wins + losses);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {retired && (
        <Badge variant="outline" className="text-micro border-red-300 text-red-600 bg-red-50">
          Retired
        </Badge>
      )}
      {total > 0 && (
        <Badge
          variant="outline"
          className={
            winRate != null && winRate >= 0.6
              ? "text-micro border-emerald-300 text-emerald-700 bg-emerald-50 font-mono"
              : winRate != null && winRate >= 0.4
              ? "text-micro border-slate-300 text-slate-700 bg-slate-50 font-mono"
              : "text-micro border-amber-300 text-amber-700 bg-amber-50 font-mono"
          }
        >
          {wins}W·{losses}L
          {winRate != null && (
            <span className="ml-1 opacity-70">
              ({Math.round(winRate * 100)}%)
            </span>
          )}
        </Badge>
      )}
    </div>
  );
};

/**
 * Branch / retire / reactivate actions inside the expanded edit form.
 * Branch creates a copy with a new variant_label and zero counts so
 * the original keeps its production-tested win/loss history. Retire
 * sets retired_at = now() — compile_voice_agent_prompt skips retired
 * rows so the variant stops being sampled at call-launch.
 *
 * The Branch button is disabled on rows the user can't write to (the
 * shared "default" rows). For those, the user should branch from the
 * tenant override, OR edit the default once which auto-creates a
 * tenant override (the existing upsert pattern), then branch off it.
 */
interface VariantActionsProps {
  row: VariantFields & { dealership_id: string; id: string };
  isOverride: boolean;
  onBranch: () => Promise<void>;
  onToggleRetire: () => Promise<void>;
  saving?: boolean;
}
const VariantActions = ({ row, isOverride, onBranch, onToggleRetire, saving }: VariantActionsProps) => {
  const retired = !!row.retired_at;
  const branchHint = isOverride
    ? "Create a new variant copied from this one, with zero counts. Both versions stay active and the bandit picks at call-time."
    : "Edit this row first to create a tenant override, then branch.";

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!isOverride || !!saving}
        onClick={() => void onBranch()}
        title={branchHint}
        className="h-8 text-xs"
      >
        <GitBranch className="w-3 h-3 mr-1.5" />
        Branch
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!isOverride || !!saving}
        onClick={() => void onToggleRetire()}
        title={retired ? "Re-activate this variant in the bandit pool." : "Stop sampling this variant. Counts retained."}
        className={`h-8 text-xs ${retired ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}`}
      >
        {retired ? <ArchiveRestore className="w-3 h-3 mr-1.5" /> : <Archive className="w-3 h-3 mr-1.5" />}
        {retired ? "Reactivate" : "Retire"}
      </Button>
    </div>
  );
};

/**
 * VariantLineage — inline parent + children panel for a variant.
 *
 * Shows the immediate ancestor (one level up via parent_variant_id)
 * and immediate descendants (one level down: rows whose parent_variant_id
 * == this row's variant_id) with their W·L counts. A multi-generation
 * tree view would be nice but most cabinet edits are 1-2 generations
 * deep; rendering deeper would mostly be visual noise.
 *
 * Each node is clickable — clicking jumps the parent editor's openId
 * to that row so the user can read/edit it.
 *
 * Generic over the four cabinet tables. Pass the table name and the
 * row's variant_id; the component handles the queries.
 */
interface LineageRow {
  id: string;
  variant_id: string | null;
  variant_label?: string | null;
  win_count: number | null;
  loss_count: number | null;
  retired_at: string | null;
  // Display label varies by table — we accept a render function for
  // the row title so the parent component decides what to show.
  __display_title: string;
}

const VariantLineage = <T extends object>({
  table,
  row,
  displayTitle,
  onJumpTo,
}: {
  table: string;
  row: VariantFields & { id: string; dealership_id: string } & T;
  displayTitle: (r: T) => string;
  onJumpTo: (rowId: string) => void;
}) => {
  const [parent, setParent]   = useState<(LineageRow & T) | null>(null);
  const [children, setChildren] = useState<Array<LineageRow & T>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row.variant_id && !row.parent_variant_id) return;
    let cancel = false;

    void (async () => {
      setLoading(true);
      const [parentQ, childrenQ] = await Promise.all([
        row.parent_variant_id
          ? supabase.from(table as never)
              .select("*")
              .eq("variant_id", row.parent_variant_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        row.variant_id
          ? supabase.from(table as never)
              .select("*")
              .eq("parent_variant_id", row.variant_id)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancel) return;

      const decorate = (r: T): LineageRow & T => ({
        ...r,
        __display_title: displayTitle(r),
      } as LineageRow & T);

      setParent((parentQ.data ? decorate(parentQ.data as unknown as T) : null));
      setChildren(((childrenQ.data || []) as unknown as T[]).map(decorate));
      setLoading(false);
    })();

    return () => { cancel = true; };
  }, [table, row.variant_id, row.parent_variant_id, displayTitle]);

  // Nothing to show — no parent and no children. Hide entirely.
  if (!parent && children.length === 0 && !loading) return null;

  const lineageNode = (n: LineageRow, depth: number, position: "parent" | "self" | "child") => {
    const wins   = n.win_count ?? 0;
    const losses = n.loss_count ?? 0;
    const total  = wins + losses;
    const winRate = total === 0 ? null : (1 + wins) / (2 + wins + losses);
    const dotCls = position === "self"
      ? "bg-blue-500"
      : n.retired_at
      ? "bg-slate-400"
      : winRate != null && winRate >= 0.6 ? "bg-emerald-500"
      : winRate != null && winRate < 0.4 ? "bg-amber-500"
      : "bg-slate-300";

    return (
      <div
        key={n.id}
        style={{ paddingLeft: `${depth * 16}px` }}
        className="flex items-center gap-2 py-1.5"
      >
        <span className={`shrink-0 w-2 h-2 rounded-full ${dotCls}`} />
        {position !== "self" ? (
          <button
            type="button"
            onClick={() => onJumpTo(n.id)}
            className="flex-1 min-w-0 text-left text-xs hover:underline text-foreground truncate"
            title="Jump to this variant"
          >
            <span className="font-mono text-muted-foreground">
              {n.variant_label || "default"}
            </span>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <span className="truncate">{n.__display_title}</span>
          </button>
        ) : (
          <span className="flex-1 min-w-0 text-xs italic text-muted-foreground truncate">
            (this variant)
          </span>
        )}
        {total > 0 && (
          <span className="font-mono text-micro shrink-0 text-muted-foreground">
            {wins}W·{losses}L
            {winRate != null && (
              <span className="ml-1 opacity-70">
                ({Math.round(winRate * 100)}%)
              </span>
            )}
          </span>
        )}
        {n.retired_at && (
          <Badge variant="outline" className="text-micro border-red-300 text-red-600 bg-red-50 shrink-0">
            Retired
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 mt-3">
      <div className="text-micro font-bold uppercase tracking-wider text-muted-foreground mb-1">
        Variant lineage
      </div>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground my-2" />
      ) : (
        <>
          {parent && lineageNode(parent, 0, "parent")}
          {lineageNode(
            { id: row.id, variant_id: row.variant_id ?? null, variant_label: (row as { variant_label?: string }).variant_label,
              win_count: row.win_count ?? 0, loss_count: row.loss_count ?? 0,
              retired_at: row.retired_at ?? null, __display_title: displayTitle(row as unknown as T) },
            parent ? 1 : 0,
            "self",
          )}
          {children.map((c) => lineageNode(c, parent ? 2 : 1, "child"))}
        </>
      )}
    </div>
  );
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

  const handleBranch = async (row: PhaseRow) => {
    setSaving(row.id);
    try {
      const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
      const payload = {
        dealership_id: dealershipId,
        phase_key: row.phase_key,
        call_type: row.call_type,
        phase_position: row.phase_position,
        variant_label: `${row.variant_label}_v${stamp}`,
        content: row.content,
        signal_keywords: row.signal_keywords,
        use_when: row.use_when,
        advances_to: row.advances_to,
        is_active: true,
        sort_order: row.sort_order,
        parent_variant_id: row.variant_id ?? null,
        win_count: 0,
        loss_count: 0,
        retired_at: null,
      };
      const { error } = await supabase.from("conversation_phases" as never).insert(payload as never);
      if (error) throw error;
      toast({ title: "Branched", description: `New variant: ${payload.variant_label}` });
      await refetch();
    } catch (e) {
      toast({ title: "Branch failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

  const handleToggleRetire = async (row: PhaseRow) => {
    setSaving(row.id);
    try {
      const wasRetired = !!row.retired_at;
      const newRetiredAt = wasRetired ? null : new Date().toISOString();
      const { error } = await supabase.from("conversation_phases" as never)
        .update({ retired_at: newRetiredAt } as never)
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: wasRetired ? "Reactivated" : "Retired" });
      void logStaffAction({
        action: wasRetired ? "voice_variant_revived" : "voice_variant_retired",
        dealershipId: row.dealership_id,
        targetType: "conversation_phase",
        targetId: row.id,
        before: { retired_at: row.retired_at, phase_key: row.phase_key, variant_label: row.variant_label },
        after:  { retired_at: newRetiredAt },
      });
      await refetch();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

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
          <Card key={row.id} className={(!row.is_active || row.retired_at) ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className="text-micro">{row.phase_position}</Badge>
                <Badge variant="outline" className="text-micro">{row.call_type}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{row.phase_key}</div>
                  <div className="text-micro text-muted-foreground truncate">variant: {row.variant_label}</div>
                </div>
                <VariantBadges row={row} />
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
                  <div className="flex items-center justify-between pt-2 border-t border-border gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">{(draft.is_active ?? row.is_active) ? "Active" : "Inactive"}</span>
                    </label>
                    <div className="flex-1" />
                    <VariantActions
                      row={row}
                      isOverride={isOverride}
                      onBranch={() => handleBranch(row)}
                      onToggleRetire={() => handleToggleRetire(row)}
                      saving={saving === row.id}
                    />
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <VariantLineage
                    table="conversation_phases"
                    row={row}
                    displayTitle={(r) => `${(r as PhaseRow).phase_position} · ${(r as PhaseRow).phase_key}`}
                    onJumpTo={(targetId) => setOpenId(targetId)}
                  />
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

  // Dedupe by signal_key+variant_label; tenant override wins on the same slot.
  const merged = (() => {
    const byKey = new Map<string, SignalRow>();
    const k = (r: SignalRow) => `${r.signal_key}|${r.variant_label || "default"}`;
    for (const r of rows.filter((r) => r.dealership_id === "default")) byKey.set(k(r), r);
    for (const r of rows.filter((r) => r.dealership_id === dealershipId)) byKey.set(k(r), r);
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
        variant_label: row.variant_label || "default",
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
      const { error } = await supabase.from("customer_signals" as never).upsert(payload as never, { onConflict: "dealership_id,signal_key,variant_label" });
      if (error) throw error;
      toast({ title: "Signal saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleBranch = async (row: SignalRow) => {
    setSaving(row.id);
    try {
      const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
      const payload = {
        dealership_id: dealershipId,
        signal_key: row.signal_key,
        variant_label: `${row.variant_label || "default"}_v${stamp}`,
        signal_phrases: row.signal_phrases,
        customer_state: row.customer_state,
        recommended_posture: row.recommended_posture,
        response_variants: row.response_variants,
        do_not_say: row.do_not_say,
        hand_off_to_human: row.hand_off_to_human,
        is_active: true,
        sort_order: row.sort_order,
        parent_variant_id: row.variant_id ?? null,
        win_count: 0,
        loss_count: 0,
        retired_at: null,
      };
      const { error } = await supabase.from("customer_signals" as never).insert(payload as never);
      if (error) throw error;
      toast({ title: "Branched", description: `New variant: ${payload.variant_label}` });
      await refetch();
    } catch (e) {
      toast({ title: "Branch failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

  const handleToggleRetire = async (row: SignalRow) => {
    setSaving(row.id);
    try {
      const wasRetired = !!row.retired_at;
      const newRetiredAt = wasRetired ? null : new Date().toISOString();
      const { error } = await supabase.from("customer_signals" as never)
        .update({ retired_at: newRetiredAt } as never)
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: wasRetired ? "Reactivated" : "Retired" });
      void logStaffAction({
        action: wasRetired ? "voice_variant_revived" : "voice_variant_retired",
        dealershipId: row.dealership_id,
        targetType: "customer_signal",
        targetId: row.id,
        before: { retired_at: row.retired_at, signal_key: row.signal_key, variant_label: row.variant_label },
        after:  { retired_at: newRetiredAt },
      });
      await refetch();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-2">
      {merged.map((row) => {
        const isOpen = openId === row.id;
        const draft = drafts[row.id] || {};
        const isOverride = row.dealership_id === dealershipId;
        return (
          <Card key={row.id} className={(!row.is_active || row.retired_at) ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className="text-micro">{row.customer_state}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {row.signal_key}
                    {row.variant_label && row.variant_label !== "default" && (
                      <span className="ml-2 text-micro text-muted-foreground font-normal">· {row.variant_label}</span>
                    )}
                  </div>
                  <div className="text-micro text-muted-foreground truncate">{row.recommended_posture}</div>
                </div>
                <VariantBadges row={row} />
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
                  <div className="flex items-center gap-3 pt-2 border-t border-border flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Active</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.hand_off_to_human ?? row.hand_off_to_human)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, hand_off_to_human: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Hand off to human</span>
                    </label>
                    <div className="flex-1" />
                    <VariantActions
                      row={row}
                      isOverride={isOverride}
                      onBranch={() => handleBranch(row)}
                      onToggleRetire={() => handleToggleRetire(row)}
                      saving={saving === row.id}
                    />
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <VariantLineage
                    table="customer_signals"
                    row={row}
                    displayTitle={(r) => `${(r as SignalRow).signal_key} · ${(r as SignalRow).customer_state}`}
                    onJumpTo={(targetId) => setOpenId(targetId)}
                  />
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

  // Dedupe by scope+topic+variant_label; tenant override wins.
  const merged = (() => {
    const byKey = new Map<string, IntelRow>();
    const k = (r: IntelRow) => `${r.scope}|${r.topic}|${r.variant_label || "default"}`;
    for (const r of rows.filter((r) => r.dealership_id === "default")) byKey.set(k(r), r);
    for (const r of rows.filter((r) => r.dealership_id === dealershipId)) byKey.set(k(r), r);
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
        variant_label: row.variant_label || "default",
        short_claim: draft.short_claim ?? row.short_claim,
        citable_number: draft.citable_number ?? row.citable_number,
        evidence_url: draft.evidence_url ?? row.evidence_url,
        use_when: draft.use_when ?? row.use_when,
        is_active: draft.is_active ?? row.is_active,
        sort_order: row.sort_order,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("industry_intel" as never).upsert(payload as never, { onConflict: "dealership_id,scope,topic,variant_label" });
      if (error) throw error;
      toast({ title: "Intel saved" });
      await refetch();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleBranch = async (row: IntelRow) => {
    setSaving(row.id);
    try {
      const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
      const payload = {
        dealership_id: dealershipId,
        scope: row.scope,
        topic: row.topic,
        variant_label: `${row.variant_label || "default"}_v${stamp}`,
        short_claim: row.short_claim,
        citable_number: row.citable_number,
        evidence_url: row.evidence_url,
        use_when: row.use_when,
        is_active: true,
        sort_order: row.sort_order,
        parent_variant_id: row.variant_id ?? null,
        win_count: 0,
        loss_count: 0,
        retired_at: null,
      };
      const { error } = await supabase.from("industry_intel" as never).insert(payload as never);
      if (error) throw error;
      toast({ title: "Branched", description: `New variant: ${payload.variant_label}` });
      await refetch();
    } catch (e) {
      toast({ title: "Branch failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

  const handleToggleRetire = async (row: IntelRow) => {
    setSaving(row.id);
    try {
      const wasRetired = !!row.retired_at;
      const newRetiredAt = wasRetired ? null : new Date().toISOString();
      const { error } = await supabase.from("industry_intel" as never)
        .update({ retired_at: newRetiredAt } as never)
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: wasRetired ? "Reactivated" : "Retired" });
      void logStaffAction({
        action: wasRetired ? "voice_variant_revived" : "voice_variant_retired",
        dealershipId: row.dealership_id,
        targetType: "industry_intel",
        targetId: row.id,
        before: { retired_at: row.retired_at, scope: row.scope, topic: row.topic, variant_label: row.variant_label },
        after:  { retired_at: newRetiredAt },
      });
      await refetch();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-2">
      {merged.map((row) => {
        const isOpen = openId === row.id;
        const draft = drafts[row.id] || {};
        const isOverride = row.dealership_id === dealershipId;
        return (
          <Card key={row.id} className={(!row.is_active || row.retired_at) ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <button type="button" onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                <Badge variant="outline" className={`text-micro ${row.scope === "competitor" ? "border-warning/40 text-warning" : ""}`}>
                  {row.scope}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {row.topic}
                    {row.variant_label && row.variant_label !== "default" && (
                      <span className="ml-2 text-micro text-muted-foreground font-normal">· {row.variant_label}</span>
                    )}
                  </div>
                  <div className="text-micro text-muted-foreground truncate">{row.short_claim}</div>
                </div>
                <VariantBadges row={row} />
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
                  <div className="flex items-center justify-between pt-2 border-t border-border gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={(draft.is_active ?? row.is_active)} onChange={(e) => setDrafts({ ...drafts, [row.id]: { ...draft, is_active: e.target.checked } })} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-muted-foreground">Active</span>
                    </label>
                    <div className="flex-1" />
                    <VariantActions
                      row={row}
                      isOverride={isOverride}
                      onBranch={() => handleBranch(row)}
                      onToggleRetire={() => handleToggleRetire(row)}
                      saving={saving === row.id}
                    />
                    <Button size="sm" disabled={saving === row.id} onClick={() => void handleSave(row)}>
                      {saving === row.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                  <VariantLineage
                    table="industry_intel"
                    row={row}
                    displayTitle={(r) => `${(r as IntelRow).scope} · ${(r as IntelRow).topic}`}
                    onJumpTo={(targetId) => setOpenId(targetId)}
                  />
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
