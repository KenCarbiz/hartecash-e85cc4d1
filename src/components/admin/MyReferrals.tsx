import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Send, CheckCircle, Clock, Award, QrCode, Link2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

interface MyReferral {
  id: string;
  referral_code: string;
  referrer_name: string | null;
  referred_name: string | null;
  status: string;
  reward_amount: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rewarded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const MyReferrals = ({ staffName }: { staffName: string }) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<MyReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffEmail, setStaffEmail] = useState("");
  const [showQR, setShowQR] = useState(false);

  // Invite form
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch staff email from session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStaffEmail(data.session?.user?.email || "");
    });
  }, []);

  const staffCode = `STAFF-${(staffEmail || "unknown").split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
  const referralLink = `${window.location.origin}/?ref=${staffCode}`;

  const fetchMyReferrals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("referrals")
      .select("id, referral_code, referrer_name, referred_name, status, reward_amount, created_at")
      .eq("dealership_id", tenant.dealership_id)
      .eq("referred_by_staff", staffEmail)
      .order("created_at", { ascending: false });
    setReferrals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMyReferrals(); }, [tenant.dealership_id, staffEmail]);

  // Ensure staff code exists as a referral record
  useEffect(() => {
    if (!staffEmail) return;
    const ensureCode = async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id")
        .eq("referral_code", staffCode)
        .eq("dealership_id", tenant.dealership_id)
        .maybeSingle();
      if (!data) {
        await supabase.from("referrals").insert({
          dealership_id: tenant.dealership_id,
          referral_code: staffCode,
          referrer_name: staffName,
          referrer_email: staffEmail,
          referred_by_staff: staffEmail,
          status: "pending",
          reward_amount: 200,
        } as any);
      }
    };
    ensureCode();
  }, [staffEmail, tenant.dealership_id]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Your referral link is on the clipboard." });
  };

  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleSendInvite = async () => {
    if (!prospectName.trim() || !prospectEmail.trim()) return;
    setSending(true);

    const inviteCode = generateInviteCode();
    const inviteLink = `${window.location.origin}/?ref=${inviteCode}`;

    // Create referral record
    await supabase.from("referrals").insert({
      dealership_id: tenant.dealership_id,
      referral_code: inviteCode,
      referrer_name: prospectName,
      referrer_email: prospectEmail,
      referred_by_staff: staffEmail,
      status: "pending",
      reward_amount: 200,
      notes: personalNote || null,
    } as any);

    // Send the referral invite email
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "referral-invite",
        recipientEmail: prospectEmail,
        idempotencyKey: `staff-referral-${inviteCode}`,
        templateData: {
          customerName: prospectName,
          referralLink: inviteLink,
          rewardAmount: "200",
          dealershipName: tenant.display_name,
          staffName,
          personalNote: personalNote || undefined,
          isStaffInvite: true,
        },
      },
    });

    toast({ title: "Invite sent!", description: `Referral invite sent to ${prospectEmail}` });
    setProspectName("");
    setProspectEmail("");
    setPersonalNote("");
    setSending(false);
    fetchMyReferrals();
  };

  const converted = referrals.filter(r => r.status === "converted" || r.status === "rewarded").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Gift className="w-5 h-5 text-accent" /> My Referrals
        </h2>
        <Badge variant="secondary" className="text-xs">
          {converted} converted · {referrals.length} total
        </Badge>
      </div>

      {/* QR Code & Link Card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-card-foreground">Your Personal Referral Link</p>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono truncate border border-border">
            {referralLink}
          </code>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setShowQR(!showQR)} className="text-xs gap-1.5">
          <QrCode className="w-3.5 h-3.5" /> {showQR ? "Hide" : "Show"} QR Code
        </Button>

        {showQR && (
          <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-border">
            <QRCodeSVG value={referralLink} size={200} level="M" includeMargin />
            <p className="text-xs text-muted-foreground text-center">
              Customers scan this to start their offer — referral tracked automatically.
            </p>
          </div>
        )}
      </div>

      {/* Send Invite Form */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-card-foreground">Send a Referral Invite</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Enter the name and email of someone you'd like to refer. We'll send them a personalized invite from you.
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Their name"
              value={prospectName}
              onChange={e => setProspectName(e.target.value)}
              className="flex-1 min-w-[140px]"
            />
            <Input
              placeholder="Their email"
              type="email"
              value={prospectEmail}
              onChange={e => setProspectEmail(e.target.value)}
              className="flex-1 min-w-[180px]"
            />
          </div>
          <Textarea
            placeholder={`Add a personal note (optional) — e.g. "Hey Mike, I had a great experience selling my car here. You should check them out!"`}
            value={personalNote}
            onChange={e => setPersonalNote(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <Button
            onClick={handleSendInvite}
            disabled={!prospectName.trim() || !prospectEmail.trim() || sending}
            size="sm"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>

      {/* My Referrals Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground">People You've Referred</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
            ) : referrals.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No referrals yet — share your link to get started!</td></tr>
            ) : referrals.map(ref => (
              <tr key={ref.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium text-card-foreground">{ref.referrer_name || ref.referred_name || "—"}</td>
                <td className="px-4 py-2.5">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{ref.referral_code}</code>
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={`text-[10px] ${STATUS_COLORS[ref.status] || ""}`}>
                    {ref.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {ref.status === "converted" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {ref.status === "rewarded" && <Award className="w-3 h-3 mr-1" />}
                    {ref.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(ref.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyReferrals;
