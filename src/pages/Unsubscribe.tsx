import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, AlertCircle, Mail, MessageSquare, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const channelParam = searchParams.get("channel") || "all";

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ name?: string; vehicle?: string }>({});
  const [selectedChannel, setSelectedChannel] = useState(channelParam);

  const handleUnsubscribe = async (channel: string) => {
    if (!token) return;
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-unsubscribe", {
        body: { token, channel },
      });
      if (error) throw error;
      setResult(data);
      setStatus("success");
      setSelectedChannel(channel);
    } catch {
      setStatus("error");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">This unsubscribe link is invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You've Been Unsubscribed</h1>
          <p className="text-muted-foreground mb-1">
            {result.name ? `${result.name}, you` : "You"} will no longer receive{" "}
            {selectedChannel === "email" ? "email" : selectedChannel === "sms" ? "SMS" : "email or SMS"}{" "}
            follow-ups{result.vehicle ? ` about your ${result.vehicle}` : ""}.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            If you change your mind, contact us at{" "}
            <a href="tel:8668517390" className="text-primary underline">(866) 851-7390</a>.
          </p>
          <Link to="/">
            <Button variant="outline" className="mt-6">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <ShieldOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Unsubscribe</h1>
          <p className="text-muted-foreground">
            Choose which communications you'd like to stop receiving from Harte Auto Group.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleUnsubscribe("email")}
            disabled={status === "loading"}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors text-left active:scale-[0.98]"
          >
            <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-sm">Unsubscribe from emails only</p>
              <p className="text-xs text-muted-foreground">You'll still receive SMS messages</p>
            </div>
          </button>

          <button
            onClick={() => handleUnsubscribe("sms")}
            disabled={status === "loading"}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-colors text-left active:scale-[0.98]"
          >
            <MessageSquare className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium text-sm">Unsubscribe from SMS only</p>
              <p className="text-xs text-muted-foreground">You'll still receive email updates</p>
            </div>
          </button>

          <button
            onClick={() => handleUnsubscribe("all")}
            disabled={status === "loading"}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5 transition-colors text-left active:scale-[0.98]"
          >
            <ShieldOff className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-sm">Unsubscribe from all communications</p>
              <p className="text-xs text-muted-foreground">Stop all emails and SMS messages</p>
            </div>
          </button>
        </div>

        {status === "loading" && (
          <div className="flex items-center justify-center gap-2 mt-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing…</span>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-sm text-destructive">Something went wrong. Please try again or call (866) 851-7390.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          You can also reply STOP to any SMS to opt out instantly.
        </p>
      </div>
    </div>
  );
};

export default Unsubscribe;
