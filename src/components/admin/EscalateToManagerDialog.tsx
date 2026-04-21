import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

/**
 * EscalateToManagerDialog — BDC / Sales click "Escalate to Manager"
 * on a lead they can't move forward. Captures a reason tag + optional
 * notes and flips submissions.escalated_to_manager so the lead
 * bubbles up in the manager queue.
 */

export const ESCALATION_REASONS: { value: string; label: string; hint?: string }[] = [
  { value: "price_objection",    label: "Price objection",      hint: "Customer says our number is too low — needs manager override." },
  { value: "customer_stalled",   label: "Customer stalled",     hint: "Unresponsive or dragging out the decision." },
  { value: "trade_complication", label: "Trade complication",   hint: "Title, lien, co-signer, or lease issue." },
  { value: "competitor_offer",   label: "Competitor has better offer", hint: "Needs to see what we can match." },
  { value: "technical_issue",    label: "Technical / platform issue",   hint: "Something in the flow is blocking the customer." },
  { value: "other",              label: "Other — see notes",    hint: "Explain in the notes field." },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  userEmail?: string | null;
  onEscalated?: () => void;
}

const EscalateToManagerDialog = ({ open, onOpenChange, submissionId, userEmail, onEscalated }: Props) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selectedHint = ESCALATION_REASONS.find((r) => r.value === reason)?.hint;

  const handleEscalate = async () => {
    if (!reason) {
      toast({ title: "Pick a reason", description: "Choose why you're escalating so the manager can prioritize.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      escalated_to_manager: true,
      escalation_reason: reason,
      escalation_notes: notes.trim() || null,
      escalation_created_at: new Date().toISOString(),
      escalation_created_by: userEmail || null,
      escalation_resolved_at: null,
      escalation_resolved_by: null,
    };
    const { error } = await supabase
      .from("submissions")
      .update(payload as any)
      .eq("id", submissionId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not escalate", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Escalated to manager", description: "A manager will pick this up from their queue." });
    // Log the escalation in the activity trail
    await supabase.from("activity_log").insert({
      submission_id: submissionId,
      action: "Escalated to Manager",
      old_value: null,
      new_value: ESCALATION_REASONS.find((r) => r.value === reason)?.label || reason,
      performed_by: userEmail || "unknown",
    } as any);
    setReason("");
    setNotes("");
    onEscalated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Escalate to Manager
          </DialogTitle>
          <DialogDescription>
            Tag the reason so a manager can prioritize. You can keep working the lead; this just pings them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a reason..." />
              </SelectTrigger>
              <SelectContent>
                {ESCALATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHint && (
              <p className="text-xs text-muted-foreground mt-1.5">{selectedHint}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Notes <span className="font-normal text-muted-foreground">(optional but helpful)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Give the manager enough context to step in without re-calling the customer."
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleEscalate} disabled={saving || !reason} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {saving ? "Escalating…" : "Escalate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EscalateToManagerDialog;
