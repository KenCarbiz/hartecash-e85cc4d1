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
      // Send-notification returns 200 with { error } in the body for
      // recoverable failures (rate limit, missing recipient, etc).
      // The previous code only checked the FunctionsError network-
      // layer error, which made silent failures show "Sent!" — fixed
      // by also checking data.error.
      const { data, error } = await supabase.functions.invoke<{ error?: string }>(
        "send-notification",
        {
          body: {
            trigger_key: "customer_offer_ready",
            submission_id: submissionId,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
