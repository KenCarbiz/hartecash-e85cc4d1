import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Mail, MessageSquare, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface SaveOfferButtonProps {
  token: string;
  vehicleStr: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  guaranteeDays: number;
  dealershipName: string;
}

type SendMethod = "email" | "sms";

const SaveOfferButton = ({
  token,
  vehicleStr,
  customerName,
  customerEmail,
  customerPhone,
  guaranteeDays,
  dealershipName,
}: SaveOfferButtonProps) => {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SendMethod>("email");
  const [email, setEmail] = useState(customerEmail || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const portalLink = `${window.location.origin}/offer/${token}`;

  const handleSend = async () => {
    const target = method === "email" ? email.trim() : phone.trim();
    if (!target) {
      toast({ title: "Missing info", description: `Please enter your ${method === "email" ? "email address" : "phone number"}.`, variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "customer_offer_ready",
          channels: method === "email" ? ["email"] : ["sms"],
          recipient_email: method === "email" ? target : undefined,
          recipient_phone: method === "sms" ? target : undefined,
          variables: {
            customer_name: customerName || "there",
            vehicle: vehicleStr,
            portal_link: portalLink,
            guarantee_days: String(guaranteeDays),
            dealership_name: dealershipName,
          },
        },
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Offer saved!",
        description: method === "email"
          ? "We've sent the offer link to your email."
          : "We've texted the offer link to your phone.",
      });
    } catch (err) {
      console.error("Save offer error:", err);
      toast({
        title: "Couldn't send",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
    setSending(false);
  };

  // Post-save handoff — auto-navigate to the boost-offer page so
  // the customer lands on the AI photo upload as their next step
  // (the dealer's specced flow). Brief success interstitial first
  // so they see the confirmation that the link was sent.
  if (sent) {
    setTimeout(() => {
      navigate(`/boost-offer/${token}`);
    }, 1500);
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-2 w-full text-center"
      >
        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
          <Check className="w-4 h-4" />
          Offer link sent — check your {method === "email" ? "inbox" : "messages"}
        </div>
        <p className="text-xs text-zinc-500 inline-flex items-center justify-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Taking you to your photo boost…
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <Button
          variant="outline"
          className="w-full gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-semibold"
          onClick={() => setOpen(true)}
        >
          <Bookmark className="w-4 h-4" />
          Save My Offer
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border/50"
          >
            <p className="text-xs text-muted-foreground text-center">
              We'll send you a link so you can come back anytime
            </p>

            {/* Method toggle */}
            <div className="flex gap-1 bg-background rounded-lg p-1 border border-border/50">
              <button
                onClick={() => setMethod("email")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-colors ${
                  method === "email"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
              <button
                onClick={() => setMethod("sms")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-colors ${
                  method === "sms"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Text
              </button>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              {method === "email" ? (
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 text-sm"
                  autoFocus
                />
              ) : (
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 text-sm"
                  autoFocus
                />
              )}
              <Button
                onClick={handleSend}
                disabled={sending}
                size="sm"
                className="gap-1.5 rounded-lg px-4"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </>
                )}
              </Button>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default SaveOfferButton;
