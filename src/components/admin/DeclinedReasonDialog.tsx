import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle } from "lucide-react";

/**
 * DeclinedReasonDialog — BDC captures WHY a customer didn't accept.
 * Rolls up into dealer-level conversion diagnostics (why are we
 * losing deals — price too low? trade complications? unreachable?).
 */

export const DECLINED_REASONS: { value: string; label: string; hint?: string }[] = [
  { value: "price_too_low",        label: "Offer too low",           hint: "Customer wants more than we quoted." },
  { value: "sold_elsewhere",       label: "Sold it elsewhere",       hint: "They took a competing offer." },
  { value: "financing_issue",      label: "Financing or loan issue", hint: "Lien, payoff, or financing didn't work out." },
  { value: "changed_mind",         label: "Changed their mind",      hint: "Decided to keep the vehicle." },
  { value: "lease_buyout_conflict", label: "Lease buyout conflict",  hint: "Lease terms made the deal impossible." },
  { value: "unreachable",          label: "Unreachable",             hint: "Customer stopped responding." },
  { value: "other",                label: "Other — see notes",       hint: "Explain in the notes field." },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  userEmail?: string | null;
  initialReason?: string | null;
  initialNotes?: string | null;
  onSaved?: () => void;
}

const DeclinedReasonDialog = ({ open, onOpenChange, submissionId, userEmail, initialReason, initialNotes, onSaved }: Props) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(initialReason || "");
  const [notes, setNotes] = useState<string>(initialNotes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(initialReason || "");
      setNotes(initialNotes || "");
    }
  }, [open, initialReason, initialNotes]);

  const selectedHint = DECLINED_REASONS.find((r) => r.value === reason)?.hint;

  const handleSave = async () => {
    if (!reason) {
      toast({ title: "Pick a reason", description: "Conversion reporting needs this so we can spot patterns.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      declined_reason: reason,
      declined_notes: notes.trim() || null,
      declined_at: new Date().toISOString(),
      declined_by: userEmail || null,
    };
    const { error } = await supabase
      .from("submissions")
      .update(payload as any)
      .eq("id", submissionId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reason logged", description: "Thanks — this feeds dealer conversion reports." });
    await supabase.from("activity_log").insert({
      submission_id: submissionId,
      action: "Declined Reason Logged",
      old_value: initialReason ? (DECLINED_REASONS.find((r) => r.value === initialReason)?.label || initialReason) : null,
      new_value: DECLINED_REASONS.find((r) => r.value === reason)?.label || reason,
      performed_by: userEmail || "unknown",
    } as any);
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Why didn't the customer accept?
          </DialogTitle>
          <DialogDescription>
            Quick tag + notes. This rolls up into conversion reporting so the team can spot patterns across declined leads.
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
                {DECLINED_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHint && (
              <p className="text-xs text-muted-foreground mt-1.5">{selectedHint}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did they say, what did we try, is there anything a manager could still salvage?"
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !reason} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save reason"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeclinedReasonDialog;
