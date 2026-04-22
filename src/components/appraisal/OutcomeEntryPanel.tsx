import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, ClipboardCheck } from "lucide-react";

interface Props {
  submissionId: string;
  appraisalFinalizedAt: string | null;
  existingOutcome?: {
    outcome_accepted: boolean | null;
    outcome_sale_price: number | null;
    outcome_days_to_sale: number | null;
    outcome_wholesaled: boolean | null;
    outcome_wholesale_price: number | null;
    outcome_recon_actual: number | null;
    outcome_entered_at: string | null;
    outcome_entered_by: string | null;
  };
  onSaved?: () => void;
}

export default function OutcomeEntryPanel({ submissionId, appraisalFinalizedAt, existingOutcome, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [acquired, setAcquired] = useState(existingOutcome?.outcome_accepted != null);
  const [accepted, setAccepted] = useState(existingOutcome?.outcome_accepted ?? false);
  const [salePrice, setSalePrice] = useState(existingOutcome?.outcome_sale_price ?? "");
  const [wholesaled, setWholesaled] = useState(existingOutcome?.outcome_wholesaled ?? false);
  const [wholesalePrice, setWholesalePrice] = useState(existingOutcome?.outcome_wholesale_price ?? "");
  const [reconActual, setReconActual] = useState(existingOutcome?.outcome_recon_actual ?? "");

  const daysToSale = (() => {
    if (!appraisalFinalizedAt || !salePrice) return null;
    const finalized = new Date(appraisalFinalizedAt);
    const now = new Date();
    return Math.max(0, Math.round((now.getTime() - finalized.getTime()) / (1000 * 60 * 60 * 24)));
  })();

  const handleSave = async () => {
    setSaving(true);
    const payload: any = {
      outcome_accepted: acquired ? accepted : null,
      outcome_sale_price: salePrice ? Number(salePrice) : null,
      outcome_days_to_sale: daysToSale,
      outcome_wholesaled: wholesaled,
      outcome_wholesale_price: wholesalePrice ? Number(wholesalePrice) : null,
      outcome_recon_actual: reconActual ? Number(reconActual) : null,
      outcome_entered_at: new Date().toISOString(),
      outcome_entered_by: "Staff",
    };
    const { error } = await supabase.from("submissions").update(payload).eq("id", submissionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Outcome Saved", description: "Vehicle outcome data recorded for learning engine." });
      onSaved?.();
    }
    setSaving(false);
  };

  const isAlreadySaved = !!existingOutcome?.outcome_entered_at;

  return (
    <Card className="border-l-4 border-l-accent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-accent-foreground" />
            Outcome Entry — Learning Data
          </CardTitle>
          {isAlreadySaved && (
            <Badge variant="secondary" className="text-[9px]">
              Recorded {existingOutcome?.outcome_entered_at ? new Date(existingOutcome.outcome_entered_at).toLocaleDateString() : ""}
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Enter actual sale data when available. This feeds the historical intelligence engine.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Was vehicle acquired? */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
          <Label className="text-xs font-semibold">Was this vehicle acquired?</Label>
          <Switch checked={acquired} onCheckedChange={setAcquired} />
        </div>

        {acquired && (
          <>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
              <Label className="text-xs font-semibold">Did customer accept the ACV?</Label>
              <Switch checked={accepted} onCheckedChange={setAccepted} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-semibold text-muted-foreground">Actual Sale Price</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number" min={0} step={100}
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="Enter when sold"
                    className="pl-6 h-8 text-xs"
                  />
                </div>
                {daysToSale != null && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Auto-calculated: {daysToSale} days to sale
                  </p>
                )}
              </div>
              <div>
                <Label className="text-[10px] font-semibold text-muted-foreground">Actual Recon Cost</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number" min={0} step={50}
                    value={reconActual}
                    onChange={e => setReconActual(e.target.value)}
                    placeholder="Actual recon"
                    className="pl-6 h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
              <Label className="text-xs font-semibold">Was it wholesaled?</Label>
              <Switch checked={wholesaled} onCheckedChange={setWholesaled} />
            </div>

            {wholesaled && (
              <div>
                <Label className="text-[10px] font-semibold text-muted-foreground">Wholesale Price</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                  <Input
                    type="number" min={0} step={100}
                    value={wholesalePrice}
                    onChange={e => setWholesalePrice(e.target.value)}
                    className="pl-6 h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isAlreadySaved ? "Update Outcome" : "Save Outcome"}
        </Button>
      </CardContent>
    </Card>
  );
}
