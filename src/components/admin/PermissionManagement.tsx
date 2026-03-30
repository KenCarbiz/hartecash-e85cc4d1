import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Save, Loader2, Plus, Trash2, Edit2, Shield, Users, ChevronDown, UserCog,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StaffSectionEditor from "@/components/admin/StaffSectionEditor";

interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  allowed_sections: string[];
  is_default: boolean;
}

interface AccessRequest {
  id: string;
  user_id: string;
  requested_group_id: string;
  message: string;
  status: string;
  created_at: string;
  user_email?: string;
  group_name?: string;
}

interface StaffMember {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  individual_sections: string[];
}

export const ALL_SECTIONS = [
  { key: "submissions", label: "Submissions", group: "Pipeline" },
  { key: "appointments", label: "Appointments", group: "Pipeline" },
  { key: "staff", label: "Staff", group: "Team" },
  { key: "requests", label: "Access Requests", group: "Team" },
  { key: "consent", label: "Consent Log", group: "Compliance" },
  { key: "follow-ups", label: "Follow-Ups", group: "Compliance" },
  { key: "notification-log", label: "Notification Log", group: "Compliance" },
  { key: "offer-settings", label: "Offer Settings", group: "Configuration" },
  { key: "site-config", label: "Site Config", group: "Configuration" },
  { key: "notifications", label: "Notifications", group: "Configuration" },
  { key: "form-config", label: "Form Config", group: "Configuration" },
  { key: "testimonials", label: "Testimonials", group: "Configuration" },
  { key: "comparison", label: "Comparison", group: "Configuration" },
  { key: "locations", label: "Locations", group: "Configuration" },
  { key: "image-inventory", label: "Image Cache", group: "Configuration" },
  { key: "about-page", label: "About Page", group: "Configuration" },
  { key: "changelog", label: "Changelog", group: "Configuration" },
  { key: "permissions", label: "Permissions", group: "Configuration" },
];

export const SECTION_GROUPS = ["Pipeline", "Team", "Compliance", "Configuration"];

const PermissionManagement = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestAccess, setShowRequestAccess] = useState(true);

  // Group dialog state
  const [editGroup, setEditGroup] = useState<PermissionGroup | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PermissionGroup | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSections, setFormSections] = useState<string[]>([]);
  const [formDefault, setFormDefault] = useState(false);

  // Staff section editor
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Request: grant specific sections
  const [grantingRequest, setGrantingRequest] = useState<AccessRequest | null>(null);
  const [grantSections, setGrantSections] = useState<string[]>([]);

  const [groupsOpen, setGroupsOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [staffOpen, setStaffOpen] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: groupData }, { data: reqData }, { data: configData }] = await Promise.all([
      supabase.from("permission_groups" as any).select("*").order("name"),
      supabase.from("permission_access_requests" as any).select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("site_config").select("show_request_access").eq("dealership_id", dealershipId).maybeSingle(),
    ]);

    setGroups((groupData as any[] || []) as PermissionGroup[]);

    // Enrich requests
    const enriched: AccessRequest[] = [];
    for (const r of (reqData as any[] || [])) {
      const { data: profile } = await supabase.from("profiles").select("email").eq("user_id", r.user_id).maybeSingle();
      const group = (groupData as any[] || []).find((g: any) => g.id === r.requested_group_id);
      enriched.push({
        ...r,
        user_email: profile?.email || r.user_id,
        group_name: group?.name || "Unknown",
      });
    }
    setRequests(enriched);
    setShowRequestAccess((configData as any)?.show_request_access ?? true);

    // Fetch staff with their individual sections
    await fetchStaffSections();

    setLoading(false);
  };

  const fetchStaffSections = async () => {
    const { data: allStaff } = await supabase.rpc("get_all_staff", { _dealership_id: dealershipId });
    if (!allStaff) return;

    const staffWithSections: StaffMember[] = [];
    for (const s of allStaff as any[]) {
      // Get individual sections for this user
      const { data: assignments } = await supabase
        .from("staff_permission_assignments" as any)
        .select("individual_sections")
        .eq("user_id", s.user_id)
        .is("permission_group_id", null)
        .maybeSingle();

      staffWithSections.push({
        user_id: s.user_id,
        email: s.email,
        display_name: s.display_name,
        role: s.role,
        individual_sections: (assignments as any)?.individual_sections || [],
      });
    }
    setStaffMembers(staffWithSections);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Permission Groups ---
  const openCreate = () => {
    setIsNew(true);
    setFormName("");
    setFormDesc("");
    setFormSections([]);
    setFormDefault(false);
    setEditGroup({ id: "", name: "", description: "", allowed_sections: [], is_default: false });
  };

  const openEdit = (g: PermissionGroup) => {
    setIsNew(false);
    setFormName(g.name);
    setFormDesc(g.description);
    setFormSections([...g.allowed_sections]);
    setFormDefault(g.is_default);
    setEditGroup(g);
  };

  const handleSaveGroup = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      allowed_sections: formSections,
      is_default: formDefault,
      updated_at: new Date().toISOString(),
    };
    if (isNew) {
      const { error } = await supabase.from("permission_groups" as any).insert(payload as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Group created" });
    } else {
      const { error } = await supabase.from("permission_groups" as any).update(payload as any).eq("id", editGroup!.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Group updated" });
    }
    setSaving(false);
    setEditGroup(null);
    fetchData();
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    await supabase.from("permission_groups" as any).delete().eq("id", deleteTarget.id);
    toast({ title: "Group deleted" });
    setDeleteTarget(null);
    fetchData();
  };

  // --- Access Requests ---
  const openGrantDialog = (req: AccessRequest) => {
    // Pre-select the sections from the requested group
    const group = groups.find((g) => g.id === req.requested_group_id);
    setGrantSections(group ? [...group.allowed_sections] : []);
    setGrantingRequest(req);
  };

  const handleGrantRequest = async () => {
    if (!grantingRequest) return;
    // Save individual sections for this user
    await saveIndividualSections(grantingRequest.user_id, grantSections);

    // Mark request as approved
    await supabase.from("permission_access_requests" as any)
      .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
      .eq("id", grantingRequest.id);

    toast({ title: "Access granted", description: `${grantSections.length} section${grantSections.length !== 1 ? "s" : ""} granted.` });

    try {
      await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "access_request_response",
          to_email: grantingRequest.user_email,
          data: { status: "approved", group_name: `${grantSections.length} sections` },
        },
      });
    } catch { /* non-critical */ }

    setGrantingRequest(null);
    fetchData();
  };

  const handleDenyRequest = async (req: AccessRequest) => {
    await supabase.from("permission_access_requests" as any)
      .update({ status: "denied", reviewed_at: new Date().toISOString() } as any)
      .eq("id", req.id);
    toast({ title: "Request denied" });
    try {
      await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "access_request_response",
          to_email: req.user_email,
          data: { status: "denied", group_name: req.group_name },
        },
      });
    } catch { /* non-critical */ }
    fetchData();
  };

  // --- Individual sections ---
  const saveIndividualSections = async (userId: string, sections: string[]) => {
    // Upsert the individual sections row (permission_group_id = null)
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
  };

  const handleSaveStaffSections = async (userId: string, sections: string[]) => {
    await saveIndividualSections(userId, sections);
    toast({ title: "Access updated" });
    setEditingStaff(null);
    fetchStaffSections();
  };

  const toggleShowRequestAccess = async (val: boolean) => {
    setShowRequestAccess(val);
    await supabase.from("site_config").update({ show_request_access: val } as any).eq("dealership_id", "default");
    toast({ title: val ? "Request Access enabled" : "Request Access hidden" });
  };

  const toggleSection = (key: string) => {
    setFormSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const selectAllInGroup = (groupLabel: string) => {
    const keys = ALL_SECTIONS.filter((s) => s.group === groupLabel).map((s) => s.key);
    const allSelected = keys.every((k) => formSections.includes(k));
    if (allSelected) {
      setFormSections((prev) => prev.filter((s) => !keys.includes(s)));
    } else {
      setFormSections((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading permissions…
      </div>
    );
  }

  const nonAdminStaff = staffMembers.filter((s) => s.role !== "admin");

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Permission Management
          </h2>
          <p className="text-xs text-muted-foreground">Toggle individual section access per employee, or use groups for bulk assignment.</p>
        </div>
      </div>

      {/* Toggle: Show Request Access */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Allow employees to request access</p>
          <p className="text-xs text-muted-foreground">When enabled, non-admin staff see a "Request Access" option.</p>
        </div>
        <Switch checked={showRequestAccess} onCheckedChange={toggleShowRequestAccess} />
      </div>

      {/* Pending Access Requests */}
      {requests.length > 0 && (
        <Collapsible open={requestsOpen} onOpenChange={setRequestsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2.5 px-4 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/15 transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${requestsOpen ? "" : "-rotate-90"}`} />
            <Users className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Pending Access Requests</span>
            <Badge variant="destructive" className="ml-auto">{requests.length}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2 px-1">
            {requests.map((req) => (
              <div key={req.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{req.user_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Requesting: <strong>{req.group_name}</strong>
                  </p>
                  {req.message && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{req.message}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => openGrantDialog(req)} className="gap-1">
                    <UserCog className="w-3.5 h-3.5" /> Grant Sections
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDenyRequest(req)}>
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Staff Access — individual section toggles */}
      <Collapsible open={staffOpen} onOpenChange={setStaffOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2.5 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${staffOpen ? "" : "-rotate-90"}`} />
          <UserCog className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Staff Access</span>
          <span className="text-xs text-muted-foreground ml-auto mr-2">{nonAdminStaff.length} employees</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          {nonAdminStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No non-admin staff members yet.</p>
          ) : (
            nonAdminStaff.map((member) => (
              <div key={member.user_id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{member.display_name || member.email || "Unknown"}</p>
                  {member.display_name && member.email && (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  )}
                  {member.individual_sections.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {member.individual_sections.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {ALL_SECTIONS.find((sec) => sec.key === s)?.label || s}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-1 italic">Using default access</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setEditingStaff(member)}>
                  <UserCog className="w-3.5 h-3.5" /> Manage Access
                </Button>
              </div>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Permission Groups */}
      <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2.5 px-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${groupsOpen ? "" : "-rotate-90"}`} />
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Permission Groups (Templates)</span>
          <span className="text-xs text-muted-foreground ml-auto mr-2">{groups.length} groups</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-2 px-1">
          {groups.map((g) => (
            <div key={g.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{g.name}</p>
                  {g.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                </div>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {g.allowed_sections.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {ALL_SECTIONS.find((sec) => sec.key === s)?.label || s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(g)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Group
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Edit/Create Group Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(open) => !open && setEditGroup(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Permission Group" : "Edit Permission Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Group Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Sales View" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Brief description" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formDefault} onCheckedChange={setFormDefault} id="default-toggle" />
              <Label htmlFor="default-toggle" className="text-xs">Default group (auto-assigned to new staff)</Label>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Allowed Sections</Label>
              <div className="space-y-3">
                {SECTION_GROUPS.map((groupLabel) => {
                  const secs = ALL_SECTIONS.filter((s) => s.group === groupLabel);
                  const allChecked = secs.every((s) => formSections.includes(s.key));
                  return (
                    <div key={groupLabel} className="bg-muted/30 rounded-lg p-3">
                      <button
                        type="button"
                        onClick={() => selectAllInGroup(groupLabel)}
                        className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
                      >
                        {groupLabel} {allChecked ? "(deselect all)" : "(select all)"}
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        {secs.map((s) => (
                          <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                            <Checkbox checked={formSections.includes(s.key)} onCheckedChange={() => toggleSection(s.key)} />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={saving || !formName.trim()} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isNew ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Section Editor Dialog */}
      {editingStaff && (
        <StaffSectionEditor
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(null)}
          staffName={editingStaff.display_name || editingStaff.email || "Employee"}
          currentSections={editingStaff.individual_sections}
          groups={groups}
          onSave={(sections) => handleSaveStaffSections(editingStaff.user_id, sections)}
        />
      )}

      {/* Grant Sections for Access Request */}
      {grantingRequest && (
        <StaffSectionEditor
          open={!!grantingRequest}
          onOpenChange={(open) => !open && setGrantingRequest(null)}
          staffName={grantingRequest.user_email || "Employee"}
          currentSections={grantSections}
          groups={groups}
          onSave={async (sections) => {
            await saveIndividualSections(grantingRequest.user_id, sections);
            await supabase.from("permission_access_requests" as any)
              .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
              .eq("id", grantingRequest.id);
            toast({ title: "Access granted", description: `${sections.length} section${sections.length !== 1 ? "s" : ""} granted.` });
            try {
              await supabase.functions.invoke("send-notification", {
                body: { trigger_key: "access_request_response", to_email: grantingRequest.user_email, data: { status: "approved", group_name: `${sections.length} sections` } },
              });
            } catch { /* non-critical */ }
            setGrantingRequest(null);
            fetchData();
          }}
          title={`Grant Access — ${grantingRequest.user_email}`}
        />
      )}

      {/* Delete group confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the permission group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PermissionManagement;
