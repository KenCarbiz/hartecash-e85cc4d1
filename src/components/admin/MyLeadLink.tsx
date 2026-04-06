import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantBaseUrl } from "@/hooks/useTenantBaseUrl";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, Link2, QrCode, Users, MessageSquare, Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const DEFAULT_MESSAGE = "Hey! I can get you a cash offer on your vehicle in under 60 seconds. Tap the link below to get started — the lead comes right to me so I'll take great care of you.";

const MyLeadLink = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { config: siteConfig } = useSiteConfig();
  const [staffEmail, setStaffEmail] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [assignedCount, setAssignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [shareMode, setShareMode] = useState<"sms" | "email" | null>(null);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStaffEmail(data.session?.user?.email || "");
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      if (profile?.display_name) setStaffName(profile.display_name);
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

  const buildFullMessage = () => {
    const sign = staffName || repCode;
    return `${message}\n\n${leadLink}\n\n— ${sign}, ${siteConfig.dealership_name || "Our Dealership"}`;
  };

  const handleSend = () => {
    if (!recipient.trim()) {
      toast({ title: "Enter a recipient", variant: "destructive" });
      return;
    }
    const fullMsg = buildFullMessage();

    if (shareMode === "sms") {
      const encoded = encodeURIComponent(fullMsg);
      window.open(`sms:${encodeURIComponent(recipient)}?body=${encoded}`, "_blank");
    } else if (shareMode === "email") {
      const subject = encodeURIComponent(`Get a Cash Offer on Your Vehicle — ${siteConfig.dealership_name || "Our Dealership"}`);
      const body = encodeURIComponent(fullMsg);
      window.open(`mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`, "_blank");
    }

    toast({ title: "Opening your messaging app…" });
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

        {/* Share buttons row */}
        <div className="flex items-center gap-2">
          <Button
            variant={shareMode === "sms" ? "default" : "outline"}
            size="sm"
            onClick={() => setShareMode(shareMode === "sms" ? null : "sms")}
            className="text-xs gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Text
          </Button>
          <Button
            variant={shareMode === "email" ? "default" : "outline"}
            size="sm"
            onClick={() => setShareMode(shareMode === "email" ? null : "email")}
            className="text-xs gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowQR(!showQR)} className="text-xs gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> QR
          </Button>
        </div>

        {/* Share form */}
        {shareMode && (
          <div className="space-y-3 p-4 bg-muted/40 rounded-xl border border-border">
            <Input
              placeholder={shareMode === "sms" ? "Customer phone number" : "Customer email address"}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              type={shareMode === "sms" ? "tel" : "email"}
              className="text-sm"
            />
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              placeholder="Your message to the customer…"
            />
            <p className="text-[11px] text-muted-foreground italic">
              Your link and signature will be appended automatically.
            </p>
            <Button size="sm" onClick={handleSend} className="w-full gap-1.5">
              <Send className="w-3.5 h-3.5" />
              {shareMode === "sms" ? "Open Texting App" : "Open Email App"}
            </Button>
          </div>
        )}

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
