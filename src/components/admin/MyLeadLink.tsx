import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Link2, QrCode, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

const MyLeadLink = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [staffEmail, setStaffEmail] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStaffEmail(data.session?.user?.email || "");
    });
  }, []);

  const repCode = staffEmail
    ? staffEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const leadLink = `${window.location.origin}/trade?rep=${repCode}`;

  useEffect(() => {
    if (!repCode) return;
    const fetchCount = async () => {
      setLoading(true);
      const { count } = await (supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", tenant.dealership_id) as any)
        .eq("assigned_rep_email", repCode);
      setAssignedCount(count || 0);
      setLoading(false);
    };
    fetchCount();
  }, [repCode, tenant.dealership_id]);

  const copyLink = () => {
    navigator.clipboard.writeText(leadLink);
    toast({ title: "Copied!", description: "Your lead link is on the clipboard." });
  };

  if (!repCode) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" /> My Lead Link
        </h2>
        <Badge variant="secondary" className="text-xs">
          {loading ? "…" : `${assignedCount} leads`}
        </Badge>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Share this link with your customers. Any submissions through it will be automatically assigned to you.
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono truncate border border-border">
            {leadLink}
          </code>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setShowQR(!showQR)} className="text-xs gap-1.5">
          <QrCode className="w-3.5 h-3.5" /> {showQR ? "Hide" : "Show"} QR Code
        </Button>

        {showQR && (
          <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-border">
            <QRCodeSVG value={leadLink} size={200} level="M" includeMargin />
            <p className="text-xs text-muted-foreground text-center">
              Customer scans this → submits their vehicle → lead is tagged to you.
            </p>
          </div>
        )}
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground">How It Works</span>
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Share your personal link with a customer (text, email, in-person)</li>
          <li>They fill out the form & get an instant offer</li>
          <li>The lead appears in your pipeline, tagged to you</li>
        </ol>
      </div>
    </div>
  );
};

export default MyLeadLink;
