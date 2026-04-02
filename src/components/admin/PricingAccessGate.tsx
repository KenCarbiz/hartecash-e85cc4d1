import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Clock, Shield, XCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PricingAccessGateProps {
  userId: string;
  userRole: string;
  children: React.ReactNode;
}

const PricingAccessGate = ({ userId, userRole, children }: PricingAccessGateProps) => {
  const { toast } = useToast();
  const [accessStatus, setAccessStatus] = useState<"loading" | "granted" | "pending" | "none" | "expired">("loading");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [requesting, setRequesting] = useState(false);

  const isGsm = userRole === "gsm_gm";
  const isPrivileged = userRole === "admin" || userRole === "gsm_gm";

  useEffect(() => {
    if (userRole === "admin" || userRole === "gsm_gm") {
      setAccessStatus("granted");
      return;
    }
    checkAccess();
  }, [userId, userRole]);

  // Countdown timer for GSM temp access
  useEffect(() => {
    if (!expiresAt || userRole === "admin" || userRole === "gsm_gm") return;
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setAccessStatus("expired");
        setTimeLeft("Expired");
        clearInterval(interval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, userRole]);

  const checkAccess = async () => {
    const { data } = await supabase
      .from("pricing_model_access_requests" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const reqs = (data as any[]) || [];
    if (reqs.length === 0) { setAccessStatus("none"); return; }

    const latest = reqs[0];
    if (latest.status === "approved" && latest.expires_at) {
      if (new Date(latest.expires_at).getTime() > Date.now()) {
        setAccessStatus("granted");
        setExpiresAt(latest.expires_at);
      } else {
        setAccessStatus("expired");
      }
    } else if (latest.status === "pending") {
      setAccessStatus("pending");
    } else {
      setAccessStatus("none");
    }
  };

  const handleRequestAccess = async () => {
    setRequesting(true);
    const { error } = await supabase.from("pricing_model_access_requests" as any).insert({
      user_id: userId, status: "pending",
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Access Requested", description: "Your request has been sent to management for approval." });
      setAccessStatus("pending");
    }
    setRequesting(false);
  };

  // Admin/GM — always pass through
  if (isPrivileged) return <>{children}</>;

  if (accessStatus === "loading") {
    return <div className="text-sm text-muted-foreground py-8 text-center">Checking access…</div>;
  }

  // GSM with active temp access
  if (accessStatus === "granted" && expiresAt) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Clock className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-card-foreground">Temporary Access Active</p>
            <p className="text-xs text-muted-foreground">
              Your 24-hour pricing access window expires in <span className="font-mono font-bold">{timeLeft}</span>
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary shrink-0 font-mono text-xs">
            {timeLeft}
          </Badge>
        </div>
        {children}
      </div>
    );
  }

  // Non-GSM roles — fully blocked
  if (!isGsm) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="py-12 text-center">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-bold text-lg text-card-foreground mb-2">Restricted Access</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Offer logic configuration is restricted to Admin and GM roles. Contact your administrator for access.
          </p>
        </CardContent>
      </Card>
    );
  }

  // GSM — request access UI
  return (
    <Card className="border-primary/20">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-lg">Offer Logic Access Required</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Offer logic configuration is a sensitive area. As a GSM, you can request temporary 24-hour access 
          that must be approved by an Admin or GM.
        </p>

        {accessStatus === "pending" ? (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-medium text-card-foreground">Request Pending — Awaiting Approval</span>
          </div>
        ) : accessStatus === "expired" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <XCircle className="w-4 h-4" />
              <span>Your previous access window has expired</span>
            </div>
            <Button onClick={handleRequestAccess} disabled={requesting} className="gap-2">
              <Send className="w-4 h-4" />
              {requesting ? "Requesting…" : "Request New 24hr Access"}
            </Button>
          </div>
        ) : (
          <Button onClick={handleRequestAccess} disabled={requesting} className="gap-2">
            <Lock className="w-4 h-4" />
            {requesting ? "Requesting…" : "Request 24-Hour Access"}
          </Button>
        )}

        <p className="text-[11px] text-muted-foreground">
          Access is automatically revoked after 24 hours for security.
        </p>
      </CardContent>
    </Card>
  );
};

export default PricingAccessGate;
