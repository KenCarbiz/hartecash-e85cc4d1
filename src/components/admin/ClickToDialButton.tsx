import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/utils";
import { useChannelState } from "@/hooks/useChannelState";

interface Props {
  submissionId: string;
  customerPhone: string | null | undefined;
  customerName?: string | null;
  className?: string;
  /**
   * Visual variant.
   *  - "link":  renders as the customer-file phone link (mono font,
   *             hover underline). Drop-in replacement for `<a href="tel:">`.
   *  - "icon":  small icon button (used when phone text is rendered separately).
   */
  variant?: "link" | "icon";
}

/**
 * Click-to-dial bridge call. Confirms before dialing, then invokes
 * `twilio-click-to-dial`, which rings the rep's cell first and bridges
 * to the customer with the dealership's Twilio number as caller-ID.
 *
 * The rep needs a cell on file in Staff & Permissions
 * (`user_roles.phone`); the function returns a friendly error if not.
 */
const ClickToDialButton = ({
  submissionId,
  customerPhone,
  customerName,
  className,
  variant = "link",
}: Props) => {
  const { toast } = useToast();
  const { state: channels, loading: channelsLoading } = useChannelState();
  const [open, setOpen] = useState(false);
  const [calling, setCalling] = useState(false);

  if (!customerPhone) return null;

  // If the dealership disabled click-to-dial, fall back to a plain
  // tel: link so staff can still dial from their device — but skip
  // the Twilio bridge call.
  if (!channelsLoading && !channels.click_to_dial) {
    return (
      <a
        href={`tel:${customerPhone}`}
        title="Click-to-dial is disabled for this dealership — opens your device dialer instead"
        className={className || "font-mono hover:underline"}
      >
        {formatPhone(customerPhone)}
      </a>
    );
  }

  const dial = async () => {
    setCalling(true);
    const { data, error } = await supabase.functions.invoke("twilio-click-to-dial", {
      body: { submission_id: submissionId },
    });
    setCalling(false);

    if (error) {
      // FunctionsHttpError exposes the response body via context.
      let detail = error.message;
      try {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const j = await ctx.json();
          detail = j?.message || j?.error || detail;
        }
      } catch {
        /* keep default message */
      }
      toast({ title: "Couldn't start call", description: detail, variant: "destructive" });
      return;
    }

    if ((data as { error?: string })?.error) {
      toast({
        title: "Couldn't start call",
        description: (data as { message?: string }).message || (data as { error?: string }).error,
        variant: "destructive",
      });
      return;
    }

    setOpen(false);
    toast({
      title: "Calling your cell",
      description: "Pick up — we'll bridge you to the customer.",
    });
  };

  const triggerLabel = formatPhone(customerPhone);
  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Call ${triggerLabel}`}
        className={
          className ||
          "inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        }
      >
        <Phone className="w-3 h-3" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to dial"
        className={className || "font-mono hover:underline cursor-pointer"}
      >
        {triggerLabel}
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(v) => { if (!calling) setOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Call {customerName || "customer"}?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            We'll ring <span className="font-mono">your cell</span> first. When you
            pick up, we'll bridge you to{" "}
            <span className="font-mono">{triggerLabel}</span>. The customer sees the
            dealership number as caller-ID.
          </DialogDescription>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={calling}>
              Cancel
            </Button>
            <Button onClick={dial} disabled={calling}>
              {calling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
              Dial now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClickToDialButton;
