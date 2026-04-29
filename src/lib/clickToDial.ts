import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Fires a Twilio bridge call: rings the rep's cell first, then bridges
 * to the customer with the dealership's Twilio number as caller-ID.
 * Shows toast feedback.
 *
 * Used by action buttons (queue rows, Today cards, next-action CTAs)
 * that don't show a confirmation dialog. The customer-file phone
 * link uses ClickToDialButton.tsx which adds a confirm step.
 */
export async function clickToDial(submissionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("twilio-click-to-dial", {
    body: { submission_id: submissionId },
  });

  if (error) {
    const name = (error as { name?: string }).name || "";
    const msg = error.message || "";
    const isFetchError =
      name === "FunctionsFetchError" ||
      /failed to send a request|failed to fetch|networkerror/i.test(msg);
    let detail = error.message;
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        detail = j?.message || j?.error || detail;
      }
    } catch {
      /* keep default */
    }
    if (isFetchError) {
      // Bridge function unreachable (not deployed / CORS / network).
      // Tell the rep clearly so they can still pick up their phone.
      toast({
        title: "Click-to-dial unavailable",
        description: "The Twilio bridge isn't deployed yet. Ask your admin to deploy the twilio-click-to-dial edge function.",
        variant: "destructive",
      });
      return;
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

  toast({
    title: "Calling your cell",
    description: "Pick up — we'll bridge you to the customer.",
  });
}
