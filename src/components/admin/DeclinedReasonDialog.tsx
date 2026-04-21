import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, XCircle, DollarSign } from "lucide-react";

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
  initialWalkAway?: number | null;
  initialCompetitor?: string | null;
  initialCompetitorAmount?: number | null;
  onSaved?: () => void;
}

const DeclinedReasonDialog = ({
  open,
  onOpenChange,
  submissionId,
  userEmail,
  initialReason,
  initialNotes,
  initialWalkAway,
  initialCompetitor,
  initialCompetitorAmount,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(initialReason || "");
  const [notes, setNotes] = useState<string>(initialNotes || "");
  const [walkAway, setWalkAway] = useState<string>(
    initialWalkAway ? String(initialWalkAway) : ""
  );
  const [competitor, setCompetitor] = useState<string>(initialCompetitor || "");
  const [competitorAmount, setCompetitorAmount] = useState<string>(
    initialCompetitorAmount ? String(initialCompetitorAmount) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(initialReason || "");
      setNotes(initialNotes || "");
      setWalkAway(initialWalkAway ? String(initialWalkAway) : "");
      setCompetitor(initialCompetitor || "");
      setCompetitorAmount(initialCompetitorAmount ? String(initialCompetitorAmount) : "");
    }
  }, [open, initialReason, initialNotes, initialWalkAway, initialCompetitor, initialCompetitorAmount]);

  const selectedHint = DECLINED_REASONS.find((r) => r.value === reason)?.hint;

  const handleSave = async () => {
    if (!reason) {
      toast({ title: "Pick a reason", description: "Conversion reporting needs this so we can spot patterns.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const walkAwayNum = walkAway ? Number(walkAway.replace(/[^0-9]/g, "")) : null;
    const competitorAmountNum = competitorAmount ? Number(competitorAmount.replace(/[^0-9]/g, "")) : null;
    const payload: Record<string, unknown> = {
      declined_reason: reason,
      declined_notes: notes.trim() || null,
      declined_at: new Date().toISOString(),
      declined_by: userEmail || null,
    };
    // Only stamp the walk-away / competitor fields when we actually
    // have new data — keeps the previous capture (and its timestamp)
    // intact if the user is only editing the reason.
    if (walkAwayNum && walkAwayNum > 0) {
      payload.customer_walk_away_number = walkAwayNum;
      payload.walk_away_captured_at = new Date().toISOString();
      payload.walk_away_captured_by = userEmail || null;
    }
    if (competitor.trim()) {
      payload.competitor_mentioned = competitor.trim();
    }
    if (competitorAmountNum && competitorAmountNum > 0) {
      payload.competitor_offer_amount = competitorAmountNum;
    }
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

          {/* Price-specific follow-up: capture walk-away + competitor
               offer when the customer declined on price. Feeds the
               Save-the-Deal bump calculator and competitor reporting. */}
          {reason === "price_too_low" && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                Price objection details
              </p>
              <div>
                <Label htmlFor="walkAway" className="text-sm font-semibold mb-1.5 block">
                  Their walk-away number <span className="font-normal text-muted-foreground">(what they want to get)</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="walkAway"
                    type="tel"
                    inputMode="numeric"
                    value={walkAway}
                    onChange={(e) => setWalkAway(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 13500"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="competitor" className="text-sm font-semibold mb-1.5 block">
                    Competitor <span className="font-normal text-muted-foreground">(if any)</span>
                  </Label>
                  <Input
                    id="competitor"
                    value={competitor}
                    onChange={(e) => setCompetitor(e.target.value)}
                    placeholder="CarMax, Carvana, dealer…"
                  />
                </div>
                <div>
                  <Label htmlFor="competitorAmount" className="text-sm font-semibold mb-1.5 block">
                    Their offer <span className="font-normal text-muted-foreground">(if known)</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="competitorAmount"
                      type="tel"
                      inputMode="numeric"
                      value={competitorAmount}
                      onChange={(e) => setCompetitorAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="e.g. 13500"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
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
