import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, Check, Loader2, TrendingUp, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { captureException } from "@/lib/errorReporting";

interface OfferWatchProps {
  token: string;
  vehicleStr: string;
  currentOffer: number;
  customerEmail: string | null;
  customerPhone: string | null;
}

const OfferWatch = ({
  token,
  vehicleStr,
  currentOffer,
  customerEmail,
  customerPhone,
}: OfferWatchProps) => {
  const [email, setEmail] = useState(customerEmail || "");
  const [saving, setSaving] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleStartTracking = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      toast({
        title: "Valid email required",
        description: "Please enter a valid email address so we can send you updates.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase.from("offer_watches" as any) as any).insert({
        token,
        email: trimmed,
        phone: customerPhone || null,
        current_offer: currentOffer,
        vehicle: vehicleStr,
        created_at: new Date().toISOString(),
      } as any);

      if (error) {
        // Duplicate signup is a success from the customer's POV — treat
        // the unique-violation as idempotent.
        const isDuplicate = error.code === "23505";
        if (!isDuplicate) {
          captureException(
            new Error(`OfferWatch insert failed: ${error.message || "unknown"}`),
            { code: error.code, token, email: trimmed },
          );
        }
      }

      setSubscribed(true);
      toast({
        title: "Tracking started!",
        description: "We'll notify you when your vehicle's market value changes.",
      });
    } catch (err) {
      captureException(err instanceof Error ? err : new Error("OfferWatch save threw"), {
        token,
        email: trimmed,
      });
      // Still mark as subscribed so the user gets feedback; retry handled
      // out-of-band by ops after the error surfaces in Sentry / error_log.
      setSubscribed(true);
    }
    setSaving(false);
  };

  if (subscribed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl overflow-hidden border border-success/20 shadow-sm bg-gradient-to-br from-success/5 via-success/3 to-transparent"
      >
        <div className="px-5 py-5 text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto"
          >
            <Check className="w-6 h-6 text-success" />
          </motion.div>
          <div>
            <p className="text-sm font-bold text-card-foreground">You're all set!</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We'll email you monthly with your {vehicleStr || "vehicle"}'s latest value.
              If prices move in your favor, you'll be the first to know.
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground/40">Unsubscribe anytime</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl overflow-hidden border border-border/30 shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
    >
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-br from-primary/6 via-primary/3 to-transparent px-5 py-4 border-b border-border/15 overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/6 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-card-foreground text-sm">Track Your Vehicle's Value</h3>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              Not ready today? We'll watch the market for you.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card px-5 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Not ready to sell today? We'll monitor the market and notify you when your
          {vehicleStr ? ` ${vehicleStr}'s` : " vehicle's"} value changes — so you always know the
          best time to sell.
        </p>

        {/* Value highlights */}
        <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-3.5 py-2.5 border border-border/15">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Current offer</p>
            <p className="text-sm font-bold text-card-foreground tabular-nums">
              ${currentOffer.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Email input + button */}
        <AnimatePresence mode="wait">
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2.5"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none" />
                <Input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-10 text-sm rounded-xl border-border/40 focus:border-primary/40"
                  onKeyDown={(e) => e.key === "Enter" && handleStartTracking()}
                />
              </div>
              <Button
                onClick={handleStartTracking}
                disabled={saving}
                className="gap-1.5 rounded-xl px-5 h-10 font-semibold text-sm shrink-0"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    Start Tracking
                  </>
                )}
              </Button>
            </div>

            {/* Trust footer */}
            <div className="flex items-center justify-center gap-3 text-[9px] text-muted-foreground/40">
              <span className="flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                No spam
              </span>
              <span className="text-muted-foreground/20">|</span>
              <span>Monthly updates only</span>
              <span className="text-muted-foreground/20">|</span>
              <span>Unsubscribe anytime</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default OfferWatch;
