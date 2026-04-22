import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Trash2, Shield, Info, Phone, Save, UserPlus, UserCog, Gauge } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AvatarCropDialog from "./AvatarCropDialog";
import StaffSectionEditor from "./StaffSectionEditor";
import { ALL_SECTIONS } from "./PermissionManagement";
import { useTenant } from "@/contexts/TenantContext";
import { ROLE_LABELS_LONG } from "@/lib/adminConstants";

interface StaffMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  role_id: string;
  phone_number?: string | null;
  profile_image_url?: string | null;
  location_id?: string | null;
  is_appraiser?: boolean;
}

interface DealerLocation {
  id: string;
  name: string;
}

// Local alias so this file keeps its existing ROLE_LABELS usage but reads
// from the canonical source in adminConstants.ts (#16 standardization).
const ROLE_LABELS: Record<string, string> = {
  ...ROLE_LABELS_LONG,
  user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/15 text-red-600 dark:text-red-400",
  gsm_gm: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  used_car_manager: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  new_car_manager: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  sales_bdc: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
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
  new_car_manager: [
    "Everything Sales/BDC can do",
    "Set offered price & ACV",
    "Generate check requests",
    "Same acquisition authority as Used Car Manager",
  ],
  gsm_gm: [
    "Everything Used / New Car Manager can do",
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
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("sales_bdc");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addLocationId, setAddLocationId] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [permGroups, setPermGroups] = useState<{ id: string; name: string; allowed_sections: string[] }[]>([]);
  const [editingSections, setEditingSections] = useState<StaffMember | null>(null);
  const [locations, setLocations] = useState<DealerLocation[]>([]);
  const [staffSections, setStaffSections] = useState<Record<string, string[]>>({});
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<StaffMember | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStaff();
    fetchPermGroups();
    fetchLocations();
  }, []);

  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_all_staff", { _dealership_id: dealershipId });
    if (error) {
      toast({ title: "Error", description: "Failed to load staff.", variant: "destructive" });
    } else {
      const staffList = (data || []) as unknown as StaffMember[];
      // Supplementary fetch: user_roles.is_appraiser for each staff row.
      // The get_all_staff RPC doesn't know about this column yet, so we
      // join it client-side by role_id.
      if (staffList.length > 0) {
        const roleIds = staffList.map(s => s.role_id);
        const { data: appraiserData } = await (supabase as any)
          .from("user_roles")
          .select("id, is_appraiser")
          .in("id", roleIds);
        if (appraiserData) {
          const map = new Map((appraiserData as any[]).map(r => [r.id, Boolean(r.is_appraiser)]));
          staffList.forEach(s => { s.is_appraiser = map.get(s.role_id) ?? false; });
        }
      }
      setStaff(staffList);
      // Fetch individual sections for all staff
      const sectionMap: Record<string, string[]> = {};
      for (const s of staffList) {
        const { data: assignment } = await supabase
          .from("staff_permission_assignments" as any)
          .select("individual_sections")
          .eq("user_id", s.user_id)
          .is("permission_group_id", null)
          .maybeSingle();
        sectionMap[s.user_id] = (assignment as any)?.individual_sections || [];
      }
      setStaffSections(sectionMap);
    }
    setLoading(false);
  };

  const fetchPermGroups = async () => {
    const { data } = await supabase.from("permission_groups" as any).select("id, name, allowed_sections").order("name");
    setPermGroups((data as any[] || []).map((g: any) => ({ id: g.id, name: g.name, allowed_sections: g.allowed_sections })));
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("dealership_locations" as any)
      .select("id, name")
      .eq("dealership_id", dealershipId)
      .eq("is_active", true)
      .order("sort_order");
    setLocations((data as any[] || []).map((l: any) => ({ id: l.id, name: l.name })));
  };

  const handleToggleAppraiser = async (member: StaffMember) => {
    const next = !member.is_appraiser;
    const { error } = await (supabase as any)
      .from("user_roles")
      .update({ is_appraiser: next })
      .eq("id", member.role_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setStaff(prev => prev.map(s => s.role_id === member.role_id ? { ...s, is_appraiser: next } : s));
    toast({
      title: next ? "Appraiser credential granted" : "Appraiser credential removed",
      description: `${member.email || "User"} ${next ? "can now see" : "no longer sees"} the Appraiser Queue.`,
    });
  };

  const handleLocationChange = async (member: StaffMember, locationId: string) => {
    const newVal = locationId === "all" ? null : locationId;
    const { error } = await supabase
      .from("user_roles")
      .update({ location_id: newVal } as any)
      .eq("id", member.role_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Store updated" });
      setStaff(prev => prev.map(s => s.role_id === member.role_id ? { ...s, location_id: newVal } : s));
    }
  };

  const handleSaveStaffSections = async (userId: string, sections: string[]) => {
    const { data: existing } = await supabase
      .from("staff_permission_assignments" as any)
      .select("id")
      .eq("user_id", userId)
      .is("permission_group_id", null)
      .maybeSingle();

    if (existing) {
      await supabase.from("staff_permission_assignments" as any)
        .update({ individual_sections: sections } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("staff_permission_assignments" as any)
        .insert({ user_id: userId, permission_group_id: null, individual_sections: sections } as any);
    }

    setStaffSections((prev) => ({ ...prev, [userId]: sections }));
    toast({ title: "Access updated" });
    setEditingSections(null);
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

  const handleRemove = (member: StaffMember) => {
    setConfirmRemoveMember(member);
  };

  const executeRemoveMember = async () => {
    if (!confirmRemoveMember) return;
    const member = confirmRemoveMember;
    setConfirmRemoveMember(null);

    const { error } = await supabase.rpc("remove_staff_role", { _role_id: member.role_id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Removed", description: `${member.email || "User"} has been removed.` });
      setStaff(prev => prev.filter(s => s.role_id !== member.role_id));
    }
  };

  const handleSavePhone = async (member: StaffMember) => {
    const { error } = await supabase
      .from("profiles")
      .update({ phone_number: phoneValue || null })
      .eq("user_id", member.user_id);

    if (error) {
      toast({ title: "Error", description: "Failed to save phone number.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Phone number updated." });
      setStaff(prev => prev.map(s => s.user_id === member.user_id ? { ...s, phone_number: phoneValue || null } : s));
      setEditingPhone(null);
    }
  };

  const handleAddEmployee = async () => {
    if (!addEmail.trim()) {
      toast({ title: "Email required", description: "Enter the employee's email address.", variant: "destructive" });
      return;
    }
    setAdding(true);

    // Find user by email in profiles
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .eq("email", addEmail.trim().toLowerCase());

    if (profileErr || !profiles || profiles.length === 0) {
      toast({ title: "User not found", description: "No account found with that email. They must sign up first.", variant: "destructive" });
      setAdding(false);
      return;
    }

    const profile = profiles[0];

    // Check if already has a role
    const existing = staff.find(s => s.user_id === profile.user_id);
    if (existing) {
      toast({ title: "Already a staff member", description: `${profile.email} already has the ${ROLE_LABELS[existing.role]} role.`, variant: "destructive" });
      setAdding(false);
      return;
    }

    // Insert role via user_roles table (RLS requires admin)
    const { data: inserted, error: insertErr } = await supabase
      .from("user_roles")
      .insert({ user_id: profile.user_id, role: addRole as any, location_id: addLocationId === "all" ? null : addLocationId } as any)
      .select("id")
      .single();

    if (insertErr) {
      toast({ title: "Error", description: insertErr.message, variant: "destructive" });
      setAdding(false);
      return;
    }

    // Optionally update display name if provided
    if (addDisplayName.trim() && addDisplayName.trim() !== (profile.display_name || "")) {
      await supabase.from("profiles").update({ display_name: addDisplayName.trim() }).eq("user_id", profile.user_id);
    }

    toast({ title: "Employee added", description: `${profile.email} has been added as ${ROLE_LABELS[addRole]}.` });
    setAddOpen(false);
    setAddEmail("");
    setAddRole("sales_bdc");
    setAddDisplayName("");
    setAdding(false);
    fetchStaff();
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading staff...</div>;
  }

  if (staff.length === 0 && !addOpen) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setAddOpen(true)} size="sm">
            <UserPlus className="w-4 h-4 mr-1" /> Add Employee
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">No staff members found.</div>
        {renderAddDialog()}
      </div>
    );
  }

  function renderAddDialog() {
    return (
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="employee@example.com"
                type="email"
              />
              <p className="text-xs text-muted-foreground">Employee must have an existing account.</p>
            </div>
            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input
                value={addDisplayName}
                onChange={(e) => setAddDisplayName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_bdc">Sales / BDC</SelectItem>
                  <SelectItem value="used_car_manager">Used Car Manager</SelectItem>
                  <SelectItem value="new_car_manager">New Car Manager</SelectItem>
                  <SelectItem value="gsm_gm">GSM / GM</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locations.length > 0 && addRole !== "admin" && (
              <div className="space-y-2">
                <Label>Store Location</Label>
                <Select value={addLocationId} onValueChange={setAddLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Which store can this employee see leads for?</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEmployee} disabled={adding}>
              {adding ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Employee button + Permissions legend */}
      <div className="flex items-center justify-between mb-2">
        <div />
        <Button onClick={() => setAddOpen(true)} size="sm">
          <UserPlus className="w-4 h-4 mr-1" /> Add Employee
        </Button>
      </div>

      {renderAddDialog()}

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
                    <span className="text-emerald-500 mt-0.5">•</span> {p}
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
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-12"></th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Current Role</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Change Role</th>
              {locations.length > 0 && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Store</th>}
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member, idx) => (
              <tr key={member.role_id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                <td className="px-4 py-3">
                  <AvatarCropDialog
                    userId={member.user_id}
                    currentUrl={member.profile_image_url}
                    onUploaded={(url) => setStaff(prev => prev.map(s => s.user_id === member.user_id ? { ...s, profile_image_url: url } : s))}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-card-foreground">{member.display_name || member.email || "Unknown"}</div>
                  {member.display_name && member.email && (
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingPhone === member.user_id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="h-7 text-xs w-36"
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSavePhone(member)}>
                        <Save className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPhone(member.user_id);
                        setPhoneValue(member.phone_number || "");
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-card-foreground transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {formatPhone(member.phone_number) || "Add phone"}
                    </button>
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
                {locations.length > 0 && (
                  <td className="px-4 py-3">
                    {member.role === "admin" ? (
                      <span className="text-xs text-muted-foreground italic">All Stores</span>
                    ) : (
                      <Select
                        value={member.location_id || "all"}
                        onValueChange={(v) => handleLocationChange(member, v)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Stores</SelectItem>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={member.is_appraiser ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleAppraiser(member)}
                          className="gap-1 text-xs"
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          {member.is_appraiser ? "Appraiser" : "Not Appraiser"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        {member.is_appraiser
                          ? "This staff member has the Appraiser credential and can see the Appraiser Queue in addition to their base role permissions. Click to remove."
                          : "Grant this staff member the Appraiser credential so they can see the Appraiser Queue. Does not change their base role."}
                      </TooltipContent>
                    </Tooltip>
                    {member.role !== "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSections(member)}
                        className="gap-1 text-xs"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        Access
                        {(staffSections[member.user_id]?.length || 0) > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{staffSections[member.user_id].length}</span>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Staff Section Editor Dialog */}
      {editingSections && (
        <StaffSectionEditor
          open={!!editingSections}
          onOpenChange={(open) => !open && setEditingSections(null)}
          staffName={editingSections.display_name || editingSections.email || "Employee"}
          currentSections={staffSections[editingSections.user_id] || []}
          groups={permGroups}
          onSave={(sections) => handleSaveStaffSections(editingSections.user_id, sections)}
        />
      )}

      <AlertDialog open={!!confirmRemoveMember} onOpenChange={(open) => { if (!open) setConfirmRemoveMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {confirmRemoveMember?.email || confirmRemoveMember?.display_name || "this user"} ({ROLE_LABELS[confirmRemoveMember?.role || ""] || confirmRemoveMember?.role})? They will lose all dashboard access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRemoveMember}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StaffManagement;
