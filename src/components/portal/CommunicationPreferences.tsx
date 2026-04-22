import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail, MessageSquare, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface CommunicationPreferencesProps {
  token: string;
  email: string | null;
  phone: string | null;
}

const CommunicationPreferences = ({ token, email, phone }: CommunicationPreferencesProps) => {
  const [emailOptedOut, setEmailOptedOut] = useState(false);
  const [smsOptedOut, setSmsOptedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkStatus = async () => {
      if (!email && !phone) { setLoading(false); return; }

      const checks = await Promise.all([
        email
          ? supabase.from("opt_outs" as any).select("id").eq("email", email).eq("channel", "email").maybeSingle()
          : { data: null },
        phone
          ? supabase.from("opt_outs" as any).select("id").eq("phone", phone).eq("channel", "sms").maybeSingle()
          : { data: null },
      ]);

      setEmailOptedOut(!!checks[0].data);
      setSmsOptedOut(!!checks[1].data);
      setLoading(false);
    };
    checkStatus();
  }, [email, phone]);

  const handleToggle = async (channel: "email" | "sms") => {
    const isOptedOut = channel === "email" ? emailOptedOut : smsOptedOut;
    const contact = channel === "email" ? email : phone;
    if (!contact) return;

    setToggling(channel);

    try {
      if (isOptedOut) {
        const contactField = channel === "email" ? "email" : "phone";
        await supabase
          .from("opt_outs" as any)
          .delete()
          .eq(contactField, contact)
          .eq("channel", channel);

        if (channel === "email") setEmailOptedOut(false);
        else setSmsOptedOut(false);

        toast({
          title: "Re-subscribed",
          description: `You'll receive ${channel === "email" ? "email" : "SMS"} updates again.`,
        });
      } else {
        await supabase.functions.invoke("handle-unsubscribe", {
          body: { token, channel },
        });

        if (channel === "email") setEmailOptedOut(true);
        else setSmsOptedOut(true);

        toast({
          title: "Unsubscribed",
          description: `You won't receive ${channel === "email" ? "email" : "SMS"} follow-ups anymore.`,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setToggling(null);
    }
  };

  if (!email && !phone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-card-foreground">Communication Preferences</h3>
        </div>
      </div>
      <div className="p-5">
        <p className="text-xs text-muted-foreground mb-4">
          Control how we reach out to you about your vehicle submission.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {email && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email updates</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle("email")}
                  disabled={toggling === "email"}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                    !emailOptedOut ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                >
                  {toggling === "email" ? (
                    <Loader2 className="w-4 h-4 animate-spin absolute left-1/2 -translate-x-1/2 text-white" />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        !emailOptedOut ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  )}
                </button>
              </div>
            )}

            {/* SMS toggle — always visible */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">SMS updates</p>
                  <p className="text-xs text-muted-foreground">
                    {phone || "No phone on file"}
                  </p>
                </div>
              </div>
              {phone ? (
                <button
                  onClick={() => handleToggle("sms")}
                  disabled={toggling === "sms"}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors active:scale-95 ${
                    !smsOptedOut ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                >
                  {toggling === "sms" ? (
                    <Loader2 className="w-4 h-4 animate-spin absolute left-1/2 -translate-x-1/2 text-white" />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        !smsOptedOut ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground/60 italic">N/A</span>
              )}
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              You can also reply STOP to any SMS to opt out. To re-subscribe, toggle the switch back on.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CommunicationPreferences;
