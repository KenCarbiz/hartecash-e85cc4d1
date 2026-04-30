import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ResendOfferLinkProps {
  submissionId: string;
  customerEmail: string | null;
}

/**
 * Customers misplace the magic-link email all the time. One click to
 * re-send the offer-ready notification with the same template the
 * dealer's notification settings already produce — keeps formatting,
 * branding, and the correct portal_link/{token} variables intact.
 *
 * Rate-limit is enforced by send-notification (idempotent on
 * trigger_key + submission_id within a short window) so spamming the
 * button just hits the existing queue dedupe.
 */
const ResendOfferLink = ({ submissionId, customerEmail }: ResendOfferLinkProps) => {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (!customerEmail) return null;

  const handleResend = async () => {
    if (state !== "idle") return;
    setState("sending");
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "customer_offer_ready",
          submission_id: submissionId,
        },
      });
      if (error) throw error;
      setState("sent");
      toast({
        title: "Sent!",
        description: `Offer link re-sent to ${customerEmail}`,
      });
      setTimeout(() => setState("idle"), 6000);
    } catch (e: any) {
      setState("idle");
      toast({
        title: "Couldn't send",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleResend}
      disabled={state !== "idle"}
      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/60 bg-card/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-70"
    >
      {state === "sending" ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Sending…
        </>
      ) : state === "sent" ? (
        <>
          <Check className="w-3.5 h-3.5 text-success" />
          Sent to {customerEmail}
        </>
      ) : (
        <>
          <Mail className="w-3.5 h-3.5" />
          Email me this offer link
        </>
      )}
    </button>
  );
};

export default ResendOfferLink;
