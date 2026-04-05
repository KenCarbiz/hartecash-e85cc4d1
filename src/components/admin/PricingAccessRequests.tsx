import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Shield, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccessRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  requester_name?: string;
  requester_email?: string;
}

interface PricingAccessRequestsProps {
  userId: string;
}

/**
 * Admin/GM panel showing pending GSM pricing access requests with approve/deny actions.
 */
const PricingAccessRequests = ({ userId }: PricingAccessRequestsProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pricing_model_access_requests" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    const reqs = (data as any[]) || [];

    // Enrich with profile info
    const userIds = [...new Set(reqs.map(r => r.user_id))];
    let profiles: Record<string, { display_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);
      (profileData || []).forEach((p: any) => {
        profiles[p.user_id] = { display_name: p.display_name || "", email: p.email || "" };
      });
    }

    setRequests(reqs.map(r => ({
      ...r,
      requester_name: profiles[r.user_id]?.display_name || "Unknown",
      requester_email: profiles[r.user_id]?.email || "",
    })));
    setLoading(false);
  };

  const handleApprove = async (requestId: string) => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("pricing_model_access_requests" as any)
      .update({
        status: "approved",
        approved_by: userId,
        reviewed_at: new Date().toISOString(),
        expires_at: expiresAt,
      } as any)
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Access Granted", description: "24-hour access window has been activated." });
      fetchRequests();
    }
  };

  const handleDeny = async (requestId: string) => {
    const { error } = await supabase
      .from("pricing_model_access_requests" as any)
      .update({
        status: "denied",
        approved_by: userId,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Request Denied" });
      fetchRequests();
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const recentHistory = requests.filter(r => r.status !== "pending").slice(0, 5);

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading access requests…</div>;

  if (requests.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No pricing access requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Pending Access Requests
              <Badge variant="destructive" className="text-xs">{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-card-foreground truncate">{req.requester_name}</p>
                  <p className="text-xs text-muted-foreground">{req.requester_email}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Requested {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="default" className="gap-1 h-8 text-xs" onClick={() => handleApprove(req.id)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve 24hr
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleDeny(req.id)}>
                    <XCircle className="w-3.5 h-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent History */}
      {recentHistory.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">Recent History</p>
          {recentHistory.map(req => (
            <div key={req.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 text-sm">
              {req.status === "approved" ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className="truncate flex-1">{req.requester_name}</span>
              <Badge variant={req.status === "approved" ? "secondary" : "outline"} className="text-[10px]">
                {req.status}
              </Badge>
              {req.expires_at && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  exp {new Date(req.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingAccessRequests;
