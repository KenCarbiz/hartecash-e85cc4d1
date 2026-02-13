import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Shield, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StaffMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  role_id: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_bdc: "Sales / BDC",
  used_car_manager: "Used Car Manager",
  gsm_gm: "GSM / GM",
  user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive",
  gsm_gm: "bg-accent/20 text-accent",
  used_car_manager: "bg-primary/15 text-primary",
  sales_bdc: "bg-success/20 text-success",
  user: "bg-muted text-muted-foreground",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  sales_bdc: [
    "View all submissions",
    "Update lead status",
    "View & manage appointments",
    "View photos & documents",
  ],
  used_car_manager: [
    "Everything Sales/BDC can do",
    "Set offered price & ACV",
    "Generate check requests",
  ],
  gsm_gm: [
    "Everything Used Car Manager can do",
    "Final purchase approval",
    "Set manager-level statuses",
  ],
  admin: [
    "Full system access",
    "Manage staff & roles",
    "Approve/reject access requests",
    "Delete submissions",
  ],
};

const StaffManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_all_staff");
    if (error) {
      toast({ title: "Error", description: "Failed to load staff.", variant: "destructive" });
    } else {
      setStaff(data || []);
    }
    setLoading(false);
  };

  const handleRoleChange = async (member: StaffMember, newRole: string) => {
    if (newRole === member.role) return;
    setChangingRole(member.role_id);
    const { error } = await supabase.rpc("update_staff_role", {
      _role_id: member.role_id,
      _new_role: newRole as any,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated", description: `${member.email || "User"} is now ${ROLE_LABELS[newRole] || newRole}.` });
      setStaff(prev => prev.map(s => s.role_id === member.role_id ? { ...s, role: newRole } : s));
    }
    setChangingRole(null);
  };

  const handleRemove = async (member: StaffMember) => {
    if (!confirm(`Remove ${member.email || member.display_name || "this user"} (${ROLE_LABELS[member.role] || member.role})? They will lose all dashboard access.`)) return;

    const { error } = await supabase.rpc("remove_staff_role", { _role_id: member.role_id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: `${member.email || "User"} has been removed.` });
      setStaff(prev => prev.filter(s => s.role_id !== member.role_id));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading staff...</div>;
  }

  if (staff.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No staff members found.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Permissions legend */}
      <div className="bg-muted/40 rounded-xl p-4 border border-border">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Role Permissions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
            <div key={role} className="space-y-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[role] || "bg-muted text-muted-foreground"}`}>
                {ROLE_LABELS[role]}
              </span>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {perms.map((p, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-success mt-0.5">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Staff table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Current Role</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Change Role</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.role_id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-card-foreground">{member.display_name || member.email || "Unknown"}</div>
                  {member.display_name && member.email && (
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help ${ROLE_COLORS[member.role] || "bg-muted text-muted-foreground"}`}>
                        <Shield className="w-3 h-3" />
                        {ROLE_LABELS[member.role] || member.role}
                        <Info className="w-3 h-3 opacity-50" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-semibold mb-1">{ROLE_LABELS[member.role]} can:</p>
                      <ul className="text-xs space-y-0.5">
                        {(ROLE_PERMISSIONS[member.role] || []).map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={member.role}
                    onValueChange={(v) => handleRoleChange(member, v)}
                    disabled={changingRole === member.role_id}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales_bdc">Sales / BDC</SelectItem>
                      <SelectItem value="used_car_manager">Used Car Manager</SelectItem>
                      <SelectItem value="gsm_gm">GSM / GM</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(member)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffManagement;
