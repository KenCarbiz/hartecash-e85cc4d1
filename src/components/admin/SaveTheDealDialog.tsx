import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

/**
 * SaveTheDealDialog — 1-click workflow for sales managers to salvage a
 * declined lead with a transparent offer bump.
 *
 * Shows:
 *   - The current offered_price vs. the relevant book tier
 *   - The available spread (what margin we have to play with)
 *   - Three pre-computed bump options ($100, half-spread, full-spread)
 *   - Custom amount input for when the manager wants to negotiate
 *
 * On submit:
 *   - Updates offered_price to the new number
 *   - Clears declined_reason (deal is live again)
 *   - Flips progress_status back to offer_made
 *   - Fires customer_offer_increased notification — customer gets an SMS
 *     "Good news — your offer just went up to $X"
 *   - Logs an activity_log entry with the bump amount + reason
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  currentOffer: number | null;
  bookAvg: number | null; // best tier we have — tradein or wholesale
  acv: number | null;
  /**
   * What the customer said they wanted to walk out with. Shown as the
   * "target" the manager is shooting for. Drives a 4th preset tile
   * when a bump to the target is within spread.
   */
  walkAwayNumber?: number | null;
  competitorName?: string | null;
  competitorOffer?: number | null;
  auditLabel?: string;
  onSaved?: () => void;
}

const SaveTheDealDialog = ({
  open,
  onOpenChange,
  submissionId,
  currentOffer,
  bookAvg,
  acv,
  walkAwayNumber,
  competitorName,
  competitorOffer,
  auditLabel,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Spread = the cushion between what we're offering and what the car is
  // worth to the dealer. Prefer ACV (what the appraiser set) — that's the
  // real ceiling; fall back to bookAvg if ACV isn't set yet.
  const ceiling = acv ?? bookAvg ?? null;
  const spread = ceiling && currentOffer ? Math.max(0, ceiling - currentOffer) : null;

  const presets = useMemo(() => {
    if (!spread || spread <= 0 || !currentOffer) return [] as { label: string; bump: number; newOffer: number }[];
    const baseline = [
      { label: "Small bump", bump: 100, newOffer: currentOffer + 100 },
      { label: "Meet halfway", bump: Math.round(spread / 2), newOffer: currentOffer + Math.round(spread / 2) },
      { label: "Full spread", bump: spread, newOffer: currentOffer + spread },
    ];
    // Add targeted presets when we know the customer's walk-away or the
    // competitor's number — these are far more useful than generic tiers.
    const targeted: { label: string; bump: number; newOffer: number }[] = [];
    if (walkAwayNumber && walkAwayNumber > currentOffer) {
      const bump = walkAwayNumber - currentOffer;
      if (ceiling === null || walkAwayNumber <= ceiling) {
        targeted.push({ label: "Meet their number", bump, newOffer: walkAwayNumber });
      }
    }
    if (competitorOffer && competitorOffer > currentOffer) {
      const bump = competitorOffer - currentOffer + 100; // beat by $100
      const newOffer = currentOffer + bump;
      if (ceiling === null || newOffer <= ceiling) {
        targeted.push({ label: "Beat competitor +$100", bump, newOffer });
      }
    }
    return [...targeted, ...baseline];
  }, [spread, currentOffer, walkAwayNumber, competitorOffer, ceiling]);

  const customBump = customAmount ? Number(customAmount.replace(/[^0-9]/g, "")) : 0;
  const customNewOffer = currentOffer && customBump > 0 ? currentOffer + customBump : null;

  const handleSubmit = async (newOffer: number, bumpAmount: number) => {
    if (!newOffer || newOffer <= 0 || !currentOffer) return;
    if (ceiling && newOffer > ceiling) {
      toast({
        title: "Above ceiling",
        description: `The bump would push offer above ${acv ? "ACV" : "book"} of $${ceiling.toLocaleString()}. Double-check before saving.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      offered_price: newOffer,
      progress_status: "offer_made",
      declined_reason: null,
      declined_notes: null,
      declined_at: null,
    };
    const { error } = await supabase.from("submissions").update(payload as any).eq("id", submissionId);
    if (error) {
      setSaving(false);
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("activity_log").insert({
      submission_id: submissionId,
      action: "Save-the-Deal Bump",
      old_value: `$${currentOffer.toLocaleString()}`,
      new_value: `$${newOffer.toLocaleString()} (+$${bumpAmount.toLocaleString()})${reason ? " — " + reason : ""}`,
      performed_by: auditLabel || "manager",
    } as any);
    // Fire the "your offer just went up" notification — customer sees
    // this as a win, which is the entire point of the workflow.
    safeInvoke("send-notification", {
      body: { trigger_key: "customer_offer_increased", submission_id: submissionId },
      context: { from: "SaveTheDealDialog.submit" },
    });
    setSaving(false);
    toast({ title: "Deal revived", description: `New offer $${newOffer.toLocaleString()} — customer notified.` });
    setCustomAmount("");
    setReason("");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            Save the deal
          </DialogTitle>
          <DialogDescription>
            Bump the offer with one tap. Customer gets an immediate "your offer went up" SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current picture */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current offer</span>
              <span className="font-bold text-card-foreground">
                {currentOffer ? `$${currentOffer.toLocaleString()}` : "—"}
              </span>
            </div>
            {walkAwayNumber && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer wants</span>
                <span className="font-bold text-primary">
                  ${Number(walkAwayNumber).toLocaleString()}
                </span>
              </div>
            )}
            {competitorOffer && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {competitorName || "Competitor"}
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  ${Number(competitorOffer).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{acv ? "ACV" : "Book avg"}</span>
              <span className="font-semibold text-card-foreground">
                {ceiling ? `$${ceiling.toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Spread available</span>
              <span className={`font-bold ${spread && spread > 0 ? "text-success" : "text-muted-foreground"}`}>
                {spread !== null ? `$${spread.toLocaleString()}` : "—"}
              </span>
            </div>
          </div>

          {/* Guardrail when there's no room */}
          {(!spread || spread <= 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                No spread available. The current offer is already at or above {acv ? "ACV" : "book avg"}. Any bump would
                eat into margin — enter a custom amount if you've cleared it with the GM.
              </span>
            </div>
          )}

          {/* Preset bumps */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quick bumps</Label>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    disabled={saving}
                    onClick={() => handleSubmit(p.newOffer, p.bump)}
                    className="rounded-xl border-2 border-border hover:border-primary bg-background hover:bg-primary/5 p-3 text-left transition-all disabled:opacity-50"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {p.label}
                    </div>
                    <div className="text-lg font-bold text-card-foreground">
                      +${p.bump.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      new ${p.newOffer.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom bump */}
          <div>
            <Label htmlFor="custom" className="text-sm font-semibold mb-2 block">
              Custom bump
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="custom"
                type="tel"
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 500"
                className="pl-9"
              />
            </div>
            {customNewOffer && (
              <p className="text-xs text-muted-foreground mt-1">
                New offer would be <strong>${customNewOffer.toLocaleString()}</strong>
              </p>
            )}
          </div>

          {/* Optional reason */}
          <div>
            <Label htmlFor="reason" className="text-sm font-semibold mb-2 block">
              Reason <span className="font-normal text-muted-foreground">(optional — shows in activity log)</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer had competing offer at $X — matched + $100."
              className="min-h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => customNewOffer && handleSubmit(customNewOffer, customBump)}
            disabled={saving || !customNewOffer}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {saving ? "Saving…" : "Offer custom bump"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveTheDealDialog;
