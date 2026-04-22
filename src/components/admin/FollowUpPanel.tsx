import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Send, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FollowUp {
  id: string;
  touch_number: number;
  channel: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
}

interface FollowUpPanelProps {
  submissionId: string;
  hasOffer: boolean;
  progressStatus: string;
}

const TOUCH_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: "Gentle Nudge", desc: "Your offer is waiting" },
  2: { label: "Value Add", desc: "Upload photos to fast-track" },
  3: { label: "Last Chance", desc: "Offer expires soon" },
};

const FollowUpPanel = ({ submissionId, hasOffer, progressStatus }: FollowUpPanelProps) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);
  const { toast } = useToast();

  const isCompleted = ["deal_finalized", "purchase_complete"].includes(progressStatus);

  useEffect(() => {
    fetchFollowUps();
  }, [submissionId]);

  const fetchFollowUps = async () => {
    const { data } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("submission_id", submissionId)
      .order("touch_number", { ascending: true })
      .order("created_at", { ascending: false });
    setFollowUps((data as FollowUp[]) || []);
    setLoading(false);
  };

  const sendFollowUp = async (touchNumber: number) => {
    setSending(touchNumber);
    try {
      const { data, error } = await supabase.functions.invoke("send-follow-up", {
        body: {
          submission_id: submissionId,
          touch_number: touchNumber,
          triggered_by: "manual",
        },
      });

      if (error) throw error;

      toast({
        title: "Follow-up sent",
        description: `Touch ${touchNumber} (${TOUCH_LABELS[touchNumber]?.label}) sent successfully.`,
      });
      fetchFollowUps();
    } catch (e) {
      console.error("Follow-up error:", e);
      toast({
        title: "Failed to send",
        description: "Check edge function logs for details.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const getSentForTouch = (touch: number) =>
    followUps.filter((f) => f.touch_number === touch && f.status === "sent");

  if (loading) return null;

  return (
    <div className="bg-muted/40 rounded-lg p-4">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
        <Send className="w-4 h-4 inline mr-1" />Follow-Up Sequence
      </h3>

      {!hasOffer && (
        <p className="text-xs text-muted-foreground italic">
          Follow-ups are available once an offer has been made.
        </p>
      )}

      {isCompleted && (
        <p className="text-xs text-success font-medium">
          <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
          Deal completed — no further follow-ups needed.
        </p>
      )}

      {hasOffer && !isCompleted && (
        <div className="space-y-2">
          {[1, 2, 3].map((touch) => {
            const sent = getSentForTouch(touch);
            const hasSentEmail = sent.some((s) => s.channel === "email");
            const hasSentSms = sent.some((s) => s.channel === "sms");
            const isSent = hasSentEmail || hasSentSms;
            const info = TOUCH_LABELS[touch];

            return (
              <div
                key={touch}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${
                  isSent ? "bg-success/5 border-success/20" : "bg-card border-border"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-card-foreground">
                      Touch {touch}: {info.label}
                    </span>
                    {isSent && (
                      <span className="flex items-center gap-0.5 text-success">
                        <CheckCircle className="w-3 h-3" /> Sent
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{info.desc}</p>
                  {sent.length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {hasSentEmail && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Mail className="w-3 h-3" /> Email
                        </span>
                      )}
                      {hasSentSms && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <MessageSquare className="w-3 h-3" /> SMS
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {new Date(sent[0].created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant={isSent ? "outline" : "default"}
                  className="text-xs h-7 px-3"
                  disabled={sending === touch}
                  onClick={() => sendFollowUp(touch)}
                >
                  {sending === touch ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isSent ? (
                    "Resend"
                  ) : (
                    <>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Failed follow-ups */}
      {followUps.some((f) => f.status === "failed") && (
        <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Some follow-ups failed to send. Check logs for details.
        </div>
      )}
    </div>
  );
};

export default FollowUpPanel;
