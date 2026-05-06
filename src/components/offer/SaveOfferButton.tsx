import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Mail, MessageSquare, Send, Check, Loader2, Sparkles, ArrowRight, Camera } from "lucide-react";
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

  // Post-save "next page" — replaces the inline form once the offer
  // link has been sent. Surfaces the AI-photo boost as the natural
  // next step (the only thing the customer can do that materially
  // improves their offer at this point) with a secondary "Save again"
  // path for customers who want to re-send to a different address.
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-3 w-full"
      >
        <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
          <Check className="w-4 h-4" />
          Offer link sent — check your {method === "email" ? "inbox" : "messages"}
        </div>

        {/* Boost CTA — only appears here, after save. Same emerald
            language as the legacy standalone card on the offer page
            (now removed) so the customer sees it as a continuation
            of "your offer is locked, here's how to make it bigger." */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 md:p-6"
        >
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-emerald-500 text-white items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700 mb-1.5 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 sm:hidden" aria-hidden="true" />
                Boost this offer
              </p>
              <h3 className="text-lg md:text-xl font-bold tracking-tight leading-[1.2] text-zinc-900 mb-1.5">
                Add photos to potentially raise this offer.
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed mb-4">
                Customers who upload a clean photo set get a higher final number more often than not. Our AI re-prices the moment they're in.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => navigate(`/boost-offer/${token}`)}
                  className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Camera className="w-4 h-4" />
                  Upload photos now
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    // Reset → opens the form again so the customer
                    // can save to a different email/phone.
                    setSent(false);
                    setOpen(true);
                  }}
                  className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition-colors underline-offset-4 hover:underline"
                >
                  Save again
                </button>
              </div>
            </div>
          </div>
        </motion.div>
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
