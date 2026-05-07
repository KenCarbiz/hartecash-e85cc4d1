import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, ChevronDown, MessageSquare } from "lucide-react";
import {
  useObjectionPlaybook,
  type ObjectionCard,
  type ObjectionCategory,
  type ProofPoint,
} from "@/hooks/useObjectionPlaybook";

/**
 * Objection Playbook Editor — admin tab under Communications hub.
 *
 * Each card is one objection ("CarMax offered me more", "I'll just
 * sell it privately"). The dealer can:
 *   - Read the customer concern + reframe + proof points + escalation
 *   - Edit the dealer-voice reframe, voice-AI snippet, and proof
 *     points to fit their own brand voice
 *   - Toggle individual cards off (some don't apply at every store —
 *     a privacy-letter proof needs the GM willing to sign one)
 *
 * Edits to a default card create a tenant override on save (via
 * upsert on (dealership_id, objection_key)). Network defaults stay
 * untouched. New objections can be added by the dealer for store-
 * specific situations.
 */

const CATEGORY_META: Record<ObjectionCategory, { label: string; color: string }> = {
  price:      { label: "Price",      color: "bg-warning/15 text-warning" },
  trust:      { label: "Trust",      color: "bg-info/15 text-info" },
  process:    { label: "Process",    color: "bg-muted text-muted-foreground" },
  competitor: { label: "Competitor", color: "bg-destructive/15 text-destructive" },
  logistics:  { label: "Logistics",  color: "bg-muted text-muted-foreground" },
  timing:     { label: "Timing",     color: "bg-success/15 text-success" },
};

const ObjectionPlaybookEditor = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { cards, loading, missing } = useObjectionPlaybook(tenant.dealership_id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<ObjectionCard>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Keep drafts in step with loaded cards on first render.
  useEffect(() => {
    if (cards.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const c of cards) {
        if (!next[c.objection_key]) {
          next[c.objection_key] = {
            label: c.label,
            customer_concern: c.customer_concern,
            dealer_reframe: c.dealer_reframe,
            voice_ai_snippet: c.voice_ai_snippet,
            escalation_path: c.escalation_path,
            proof_points: c.proof_points,
            is_active: c.is_active,
          };
        }
      }
      return next;
    });
  }, [cards]);

  const grouped = useMemo(() => {
    const map = new Map<ObjectionCategory, ObjectionCard[]>();
    for (const c of cards) {
      const arr = map.get(c.category) || [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return Array.from(map.entries());
  }, [cards]);

  const updateDraft = (key: string, patch: Partial<ObjectionCard>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const handleSave = async (card: ObjectionCard) => {
    const draft = drafts[card.objection_key];
    if (!draft) return;
    setSavingKey(card.objection_key);
    try {
      // Upsert as a tenant override. If the existing card was the
      // default (dealership_id='default'), the upsert creates a new
      // tenant-scoped row; if it was already tenant-owned, it
      // updates in place.
      const payload = {
        dealership_id: tenant.dealership_id,
        objection_key: card.objection_key,
        category: card.category,
        label: draft.label ?? card.label,
        customer_signals: card.customer_signals,
        customer_concern: draft.customer_concern ?? card.customer_concern,
        dealer_reframe: draft.dealer_reframe ?? card.dealer_reframe,
        proof_points: draft.proof_points ?? card.proof_points,
        escalation_path: draft.escalation_path ?? card.escalation_path,
        voice_ai_snippet: draft.voice_ai_snippet ?? card.voice_ai_snippet,
        fires_on: card.fires_on,
        sort_order: card.sort_order,
        is_active: draft.is_active ?? card.is_active,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("objection_playbook" as never)
        .upsert(payload as never, { onConflict: "dealership_id,objection_key" });
      if (error) throw error;
      toast({ title: "Card saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (missing) {
    return (
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Objection Playbook not enabled yet</h3>
          <p className="text-xs text-muted-foreground">
            Apply migration <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">20260507070000_objection_playbook.sql</code>
            via Lovable's "Push to Supabase" or the SQL editor, then refresh this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5 pb-5 px-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Objection-handling playbook</h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            One card per objection. Trains the BDC team and feeds the AI voice agent's system prompt automatically.
            Edits create a tenant-specific override; network defaults stay intact for any card you don't customize.
            The voice-AI snippet is what the voice agent reads aloud — keep it short, conversational, no bullet points.
          </p>
          <div className="flex gap-2 pt-2 flex-wrap">
            {Object.entries(CATEGORY_META).map(([k, m]) => (
              <Badge key={k} variant="outline" className={`text-micro ${m.color}`}>
                {m.label} — {cards.filter((c) => c.category === (k as ObjectionCategory)).length}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {grouped.map(([cat, group]) => {
        const meta = CATEGORY_META[cat];
        return (
          <section key={cat} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className={`text-micro font-bold uppercase tracking-wider rounded px-2 py-0.5 ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-micro text-muted-foreground">
                {group.length} {group.length === 1 ? "card" : "cards"}
              </span>
            </div>

            <div className="space-y-2">
              {group.map((card) => {
                const isOpen = expanded === card.objection_key;
                const draft = drafts[card.objection_key] || {};
                const isOverride = card.dealership_id === tenant.dealership_id;
                return (
                  <Card key={card.id} className={!card.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : card.objection_key)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-foreground truncate">{card.label}</div>
                          <div className="text-micro text-muted-foreground mt-0.5 truncate">
                            {card.customer_concern.split(".")[0]}.
                          </div>
                        </div>
                        {isOverride && (
                          <Badge variant="outline" className="text-micro border-info/40 text-info">
                            Customized
                          </Badge>
                        )}
                        {card.voice_ai_snippet && (
                          <Mic className="w-3.5 h-3.5 text-success" aria-label="Voice AI ready" />
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-border p-4 space-y-4">
                          <div>
                            <label className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                              Customer's actual concern (BDC training)
                            </label>
                            <Textarea
                              value={draft.customer_concern || ""}
                              onChange={(e) => updateDraft(card.objection_key, { customer_concern: e.target.value })}
                              rows={3}
                              className="text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-1 inline-flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Dealer voice reframe (BDC + email/SMS)
                            </label>
                            <Textarea
                              value={draft.dealer_reframe || ""}
                              onChange={(e) => updateDraft(card.objection_key, { dealer_reframe: e.target.value })}
                              rows={5}
                              className="text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-1 inline-flex items-center gap-1">
                              <Mic className="w-3 h-3" />
                              Voice AI snippet (spoken — keep short, conversational, no lists)
                            </label>
                            <Textarea
                              value={draft.voice_ai_snippet || ""}
                              onChange={(e) => updateDraft(card.objection_key, { voice_ai_snippet: e.target.value })}
                              rows={3}
                              className="text-xs"
                              placeholder="What the voice agent says aloud when it hears this objection."
                            />
                          </div>

                          <div>
                            <label className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                              Proof points
                            </label>
                            <div className="space-y-2">
                              {((draft.proof_points || []) as ProofPoint[]).map((p, i) => (
                                <div key={i} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2">
                                  <Input
                                    value={p.label}
                                    onChange={(e) => {
                                      const next = [...(draft.proof_points as ProofPoint[])];
                                      next[i] = { ...next[i], label: e.target.value };
                                      updateDraft(card.objection_key, { proof_points: next });
                                    }}
                                    className="text-xs h-8"
                                  />
                                  <Input
                                    value={p.description}
                                    onChange={(e) => {
                                      const next = [...(draft.proof_points as ProofPoint[])];
                                      next[i] = { ...next[i], description: e.target.value };
                                      updateDraft(card.objection_key, { proof_points: next });
                                    }}
                                    className="text-xs h-8"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                              Escalation path (when reframe doesn't close)
                            </label>
                            <Textarea
                              value={draft.escalation_path || ""}
                              onChange={(e) => updateDraft(card.objection_key, { escalation_path: e.target.value })}
                              rows={2}
                              className="text-xs"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draft.is_active ?? true}
                                onChange={(e) => updateDraft(card.objection_key, { is_active: e.target.checked })}
                                className="w-4 h-4 rounded border-border accent-primary"
                              />
                              <span className="text-muted-foreground">
                                {(draft.is_active ?? true) ? "Active — used by BDC + voice AI" : "Inactive — won't fire"}
                              </span>
                            </label>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateDraft(card.objection_key, {
                                  label: card.label,
                                  customer_concern: card.customer_concern,
                                  dealer_reframe: card.dealer_reframe,
                                  voice_ai_snippet: card.voice_ai_snippet,
                                  escalation_path: card.escalation_path,
                                  proof_points: card.proof_points,
                                  is_active: card.is_active,
                                })}
                              >
                                Reset
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSave(card)}
                                disabled={savingKey === card.objection_key}
                              >
                                {savingKey === card.objection_key ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default ObjectionPlaybookEditor;
