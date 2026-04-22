import { useState } from "react";
import { Phone, Loader2, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  submissionId: string;
  submissionToken: string;
  defaultPhone?: string | null;
  vehicleSummary: string; // e.g. "2021 Toyota Camry SE"
  cashOffer: number;
}

/**
 * "Talk to our appraiser now" — outbound Bland AI call with full submission
 * context. Customer enters/confirms phone, we fire launch-voice-call with
 * a campaign template seeded with this submission's vehicle + offer.
 *
 * Fully novel for the dealer-trade-in space. Bland answers questions about
 * the offer, condition deductions, and pickup scheduling at any hour.
 */
const TalkToAppraiserButton = ({ submissionId, submissionToken, defaultPhone, vehicleSummary, cashOffer }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone || "");
  const [calling, setCalling] = useState(false);
  const [done, setDone] = useState(false);

  const launchCall = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      toast({ title: "Phone needed", description: "Enter the 10-digit US number to call.", variant: "destructive" });
      return;
    }
    setCalling(true);
    const { error } = await supabase.functions.invoke("launch-voice-call", {
      body: {
        submission_id: submissionId,
        submission_token: submissionToken,
        phone: `+1${digits}`,
        // Special template — the launch-voice-call function picks this up and
        // seeds the Bland task with vehicle + offer context so the AI can
        // answer customer questions accurately.
        campaign_type: "appraiser_qa",
        context: {
          vehicle_summary: vehicleSummary,
          cash_offer: cashOffer,
        },
      },
    });
    setCalling(false);
    if (error) {
      toast({ title: "Couldn't connect", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 font-bold text-sm px-4 py-2.5 rounded-full transition-colors"
      >
        <Phone className="w-4 h-4" />
        Talk to our appraiser now
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setDone(false); setCalling(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            {done ? "Calling now" : "Get a call from our appraiser"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {done
              ? "Hang tight — your phone should ring within 30 seconds. Our appraiser knows about your offer and can answer any question."
              : "We'll call you in seconds. Our AI appraiser already has your offer details and can walk through anything you want to know — no waiting until morning."}
          </DialogDescription>

          {!done ? (
            <>
              <div className="space-y-1.5 mt-3">
                <Label className="text-xs font-semibold">Best phone to reach you</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                    let f = digits;
                    if (digits.length > 6) f = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    else if (digits.length > 3) f = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                    else if (digits.length > 0) f = `(${digits}`;
                    setPhone(f);
                  }}
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={launchCall} disabled={calling}>
                  {calling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                  Call me now
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <CheckCircle2 className="w-12 h-12 text-success mb-2" />
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TalkToAppraiserButton;
