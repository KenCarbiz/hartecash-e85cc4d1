import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantBaseUrl } from "@/hooks/useTenantBaseUrl";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Copy, Search, Send, CheckCircle, Clock, Award, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Referral {
  id: string;
  referral_code: string;
  referrer_name: string | null;
  referrer_email: string | null;
  referrer_phone: string | null;
  referrer_token: string | null;
  referred_name: string | null;
  referred_submission_id: string | null;
  status: string;
  reward_type: string | null;
  reward_amount: number;
  converted_at: string | null;
  rewarded_at: string | null;
  referred_by_staff: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rewarded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-muted text-muted-foreground",
};

const ReferralManagement = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const tenantBaseUrl = useTenantBaseUrl();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Stats
  const totalReferrals = referrals.length;
  const converted = referrals.filter(r => r.status === "converted" || r.status === "rewarded").length;
  const rewarded = referrals.filter(r => r.status === "rewarded").length;
  const totalPaidOut = referrals.filter(r => r.status === "rewarded").reduce((sum, r) => sum + (r.reward_amount || 0), 0);

  const fetchReferrals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("referrals")
      .select("*")
      .eq("dealership_id", tenant.dealership_id)
      .order("created_at", { ascending: false });
    setReferrals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchReferrals(); }, [tenant.dealership_id]);

  const generateReferralCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreateReferral = async (referrerName: string, referrerEmail: string) => {
    const code = generateReferralCode();
    const { error } = await supabase.from("referrals").insert({
      dealership_id: tenant.dealership_id,
      referral_code: code,
      referrer_name: referrerName,
      referrer_email: referrerEmail,
      status: "pending",
      reward_amount: 200,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Referral created!", description: `Code: ${code}` });
      fetchReferrals();
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "converted") updates.converted_at = new Date().toISOString();
    if (newStatus === "rewarded") updates.rewarded_at = new Date().toISOString();
    await supabase.from("referrals").update(updates).eq("id", id);
    fetchReferrals();
  };

  const handleSendReferralEmail = async (referral: Referral) => {
    if (!referral.referrer_email) {
      toast({ title: "No email", description: "This referrer has no email address.", variant: "destructive" });
      return;
    }
    const referralLink = `${tenantBaseUrl}/?ref=${referral.referral_code}`;
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "referral-invite",
        recipientEmail: referral.referrer_email,
        idempotencyKey: `referral-invite-${referral.id}`,
        templateData: {
          customerName: referral.referrer_name,
          referralLink,
          rewardAmount: "200",
          dealershipName: tenant.display_name,
        },
      },
    });
    toast({ title: "Referral email sent!", description: `Sent to ${referral.referrer_email}` });
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  const filtered = referrals.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.referrer_name?.toLowerCase().includes(s) || r.referrer_email?.toLowerCase().includes(s) || r.referral_code.toLowerCase().includes(s) || r.referred_name?.toLowerCase().includes(s));
    }
    return true;
  });

  // Quick-create state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Gift className="w-5 h-5 text-accent" /> Referral Program
        </h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-card-foreground">{totalReferrals}</p>
          <p className="text-xs text-muted-foreground">Total Referrals</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-2xl font-bold text-card-foreground">{converted}</p>
          <p className="text-xs text-muted-foreground">Converted</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Award className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-2xl font-bold text-card-foreground">{rewarded}</p>
          <p className="text-xs text-muted-foreground">Rewarded</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-2xl font-bold text-card-foreground">${totalPaidOut.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Paid Out</p>
        </div>
      </div>

      {/* Quick Create */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-card-foreground mb-3">Create New Referral</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Referrer name" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 min-w-[140px]" />
          <Input placeholder="Referrer email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 min-w-[180px]" />
          <Button
            onClick={() => { handleCreateReferral(newName, newEmail); setNewName(""); setNewEmail(""); }}
            disabled={!newName.trim()}
            size="sm"
          >
            <Gift className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="rewarded">Rewarded</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Referrer</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Referred</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reward</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Created</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No referrals found</td></tr>
            ) : filtered.map(ref => (
              <tr key={ref.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-card-foreground">{ref.referrer_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{ref.referrer_email || ""}</p>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{ref.referral_code}</code>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{ref.referred_name || "—"}</td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] ${STATUS_COLORS[ref.status] || ""}`}>
                    {ref.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {ref.status === "converted" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {ref.status === "rewarded" && <Award className="w-3 h-3 mr-1" />}
                    {ref.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-medium">${ref.reward_amount || 0}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(ref.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(ref.referral_code)} title="Copy referral link">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {ref.referrer_email && (
                      <Button variant="ghost" size="sm" onClick={() => handleSendReferralEmail(ref)} title="Send referral email">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {ref.status === "pending" && (
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleUpdateStatus(ref.id, "converted")}>
                        Mark Converted
                      </Button>
                    )}
                    {ref.status === "converted" && (
                      <Button variant="outline" size="sm" className="text-xs bg-green-50 dark:bg-green-900/20" onClick={() => handleUpdateStatus(ref.id, "rewarded")}>
                        Mark Rewarded
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReferralManagement;
