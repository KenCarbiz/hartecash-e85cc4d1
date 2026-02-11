import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Trash2, Eye, ChevronLeft, ChevronRight, UserCheck, UserX, Users, Check, Circle, DollarSign, StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import harteLogo from "@/assets/harte-logo.png";

interface PendingRequest {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
}

interface Submission {
  id: string;
  token: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  zip: string | null;
  plate: string | null;
  vin: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  mileage: string | null;
  overall_condition: string | null;
  next_step: string | null;
  photos_uploaded: boolean;
  loan_status: string | null;
  exterior_color: string | null;
  drivetrain: string | null;
  modifications: string | null;
  exterior_damage: string[] | null;
  windshield_damage: string | null;
  moonroof: string | null;
  interior_damage: string[] | null;
  tech_issues: string[] | null;
  engine_issues: string[] | null;
  mechanical_issues: string[] | null;
  drivable: string | null;
  accidents: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  progress_status: string;
  offered_price: number | null;
  internal_notes: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
}

const PAGE_SIZE = 20;

const PROGRESS_STAGES = [
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Customer Contacted" },
  { key: "inspection_scheduled", label: "In-Person Inspection Scheduled" },
  { key: "inspection_completed", label: "In-Person Inspection Completed" },
  { key: "title_verified", label: "Title Verified" },
  { key: "ownership_verified", label: "Ownership Verified" },
  { key: "manager_approval", label: "Manager Approval" },
  { key: "price_agreed", label: "Price Agreed" },
  { key: "purchase_complete", label: "Purchase Complete" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales_bdc: "Sales / BDC",
  used_car_manager: "Used Car Manager",
  gsm_gm: "GSM / GM",
};

const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const canSetPrice = ["admin", "used_car_manager", "gsm_gm"].includes(userRole);
  const canApprove = ["admin", "gsm_gm"].includes(userRole);
  const canDelete = userRole === "admin";
  const canManageAccess = userRole === "admin";
  const canUpdateStatus = true; // all staff

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchSubmissions();
      if (canManageAccess) fetchPendingRequests();
    }
  }, [page, userRole]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/login");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      navigate("/admin/login");
    } else {
      setUserRole(roleData.role);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      setSubmissions(data);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from("pending_admin_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPendingRequests(data);
  };

  const [approveRole, setApproveRole] = useState<string>("sales_bdc");

  const handleApprove = async (request: PendingRequest) => {
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: request.user_id,
      role: approveRole as any,
    });
    if (roleError) {
      toast({ title: "Error", description: "Failed to grant role.", variant: "destructive" });
      return;
    }
    await supabase
      .from("pending_admin_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    toast({ title: "Approved", description: `${request.email} granted ${ROLE_LABELS[approveRole] || approveRole} access.` });
    fetchPendingRequests();
  };

  const handleReject = async (request: PendingRequest) => {
    await supabase
      .from("pending_admin_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    toast({ title: "Rejected", description: `${request.email} was denied access.` });
    fetchPendingRequests();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this submission? This cannot be undone.")) return;

    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete submission.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Submission removed." });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setSelected(null);
    }
  };

  const handleView = async (sub: Submission) => {
    setSelected(sub);
    // Fetch photos
    const { data } = await supabase.storage
      .from("submission-photos")
      .list(sub.token);

    if (data && data.length > 0) {
      const urls = data.map((file) => {
        const { data: urlData } = supabase.storage
          .from("submission-photos")
          .getPublicUrl(`${sub.token}/${file.name}`);
        return urlData.publicUrl;
      });
      setPhotos(urls);
    } else {
      setPhotos([]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const filtered = submissions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.vin?.toLowerCase().includes(q) ||
      s.plate?.toLowerCase().includes(q) ||
      `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-1.5 border-b border-border last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-card-foreground text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  const ArrayDetail = ({ label, value }: { label: string; value: string[] | null | undefined }) => {
    if (!value || value.length === 0 || (value.length === 1 && value[0] === "none")) return null;
    return (
      <DetailRow label={label} value={value.join(", ")} />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={harteLogo} alt="Harte Auto Group" className="h-10 w-auto" />
            <div>
              <span className="text-lg font-bold text-card-foreground">Dashboard</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
                {ROLE_LABELS[userRole] || userRole}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="submissions">
          <TabsList className="mb-4">
            <TabsTrigger value="submissions">Submissions ({total})</TabsTrigger>
            {canManageAccess && (
              <TabsTrigger value="requests" className="relative">
                <Users className="w-4 h-4 mr-1" />
                Access Requests
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="submissions">
            <div className="flex items-center justify-end mb-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No submissions found.</div>
            ) : (
              <>
                <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vehicle</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Contact</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Photos</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((sub) => (
                          <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {new Date(sub.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 font-medium text-card-foreground">
                              {sub.name || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {sub.vehicle_year && sub.vehicle_make
                                ? `${sub.vehicle_year} ${sub.vehicle_make} ${sub.vehicle_model || ""}`
                                : sub.vin || sub.plate || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div>{sub.email || "—"}</div>
                              <div className="text-muted-foreground text-xs">{sub.phone || ""}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sub.photos_uploaded ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                                {sub.photos_uploaded ? "Yes" : "No"}
                              </span>
                            </td>
                          <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                sub.progress_status === "purchase_complete" ? "bg-success/20 text-success" :
                                sub.progress_status === "new" ? "bg-muted text-muted-foreground" :
                                "bg-accent/20 text-accent"
                              }`}>
                                {PROGRESS_STAGES.find(s => s.key === sub.progress_status)?.label || sub.progress_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleView(sub)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(sub.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No pending access requests.</div>
            ) : (
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Requested</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((req) => (
                      <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-card-foreground">{req.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Select value={approveRole} onValueChange={setApproveRole}>
                            <SelectTrigger className="w-44">
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
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleApprove(req)} className="bg-success hover:bg-success/90 text-success-foreground">
                              <UserCheck className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(req)}>
                              <UserX className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setPhotos([]); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.vehicle_year} {selected?.vehicle_make} {selected?.vehicle_model || "Submission Details"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Contact */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact</h3>
                <DetailRow label="Name" value={selected.name} />
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Phone" value={selected.phone} />
                <DetailRow label="ZIP" value={selected.zip} />
              </div>

              {/* Vehicle */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vehicle</h3>
                <DetailRow label="Year/Make/Model" value={`${selected.vehicle_year || ""} ${selected.vehicle_make || ""} ${selected.vehicle_model || ""}`.trim() || null} />
                <DetailRow label="VIN" value={selected.vin} />
                <DetailRow label="Plate" value={selected.plate} />
                <DetailRow label="Mileage" value={selected.mileage} />
                <DetailRow label="Exterior Color" value={selected.exterior_color} />
                <DetailRow label="Drivetrain" value={selected.drivetrain} />
                <DetailRow label="Modifications" value={selected.modifications} />
              </div>

              {/* Condition */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Condition</h3>
                <DetailRow label="Overall" value={selected.overall_condition} />
                <ArrayDetail label="Exterior Damage" value={selected.exterior_damage} />
                <DetailRow label="Windshield" value={selected.windshield_damage} />
                <DetailRow label="Moonroof" value={selected.moonroof} />
                <ArrayDetail label="Interior Damage" value={selected.interior_damage} />
                <ArrayDetail label="Tech Issues" value={selected.tech_issues} />
                <ArrayDetail label="Engine Issues" value={selected.engine_issues} />
                <ArrayDetail label="Mechanical Issues" value={selected.mechanical_issues} />
                <DetailRow label="Drivable" value={selected.drivable} />
                <DetailRow label="Accidents" value={selected.accidents} />
                <DetailRow label="Smoked In" value={selected.smoked_in} />
                <DetailRow label="Tires Replaced" value={selected.tires_replaced} />
                <DetailRow label="Keys" value={selected.num_keys} />
              </div>

              {/* Deal Progress */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Deal Progress</h3>
                <div className="space-y-1">
                  {PROGRESS_STAGES.map((stage, i) => {
                    const currentIdx = PROGRESS_STAGES.findIndex(s => s.key === selected.progress_status);
                    const isComplete = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={stage.key} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isComplete ? "bg-success text-success-foreground" :
                          isCurrent ? "bg-accent text-accent-foreground" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {isComplete ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        </div>
                        <span className={`text-sm ${isCurrent ? "font-bold text-card-foreground" : isComplete ? "text-card-foreground" : "text-muted-foreground"}`}>
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Update Status</label>
                  <Select
                    value={selected.progress_status}
                    disabled={!canUpdateStatus || (["manager_approval", "price_agreed", "purchase_complete"].includes(selected.progress_status) && !canApprove)}
                    onValueChange={async (val) => {
                      // Only GSM/GM or admin can set manager_approval, price_agreed, purchase_complete
                      if (["manager_approval", "price_agreed", "purchase_complete"].includes(val) && !canApprove) {
                        toast({ title: "Not authorized", description: "Only GSM/GM can approve purchases.", variant: "destructive" });
                        return;
                      }
                      const { error } = await supabase
                        .from("submissions")
                        .update({ progress_status: val, status_updated_at: new Date().toISOString() })
                        .eq("id", selected.id);
                      if (!error) {
                        setSelected({ ...selected, progress_status: val });
                        setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, progress_status: val } : s));
                        toast({ title: "Status updated" });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROGRESS_STAGES.map(s => {
                        const isApprovalStage = ["manager_approval", "price_agreed", "purchase_complete"].includes(s.key);
                        return (
                          <SelectItem key={s.key} value={s.key} disabled={isApprovalStage && !canApprove}>
                            {s.label}{isApprovalStage && !canApprove ? " (GSM/GM only)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Offered Price */}
              {canSetPrice ? (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />Offered Price
                  </h3>
                  <Input
                    type="number"
                    placeholder="Enter offer amount"
                    defaultValue={selected.offered_price?.toString() || ""}
                    onBlur={async (e) => {
                      const price = e.target.value ? Number(e.target.value) : null;
                      const { error } = await supabase
                        .from("submissions")
                        .update({ offered_price: price })
                        .eq("id", selected.id);
                      if (!error) {
                        setSelected({ ...selected, offered_price: price });
                        toast({ title: "Price updated" });
                      }
                    }}
                  />
                </div>
              ) : selected.offered_price ? (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />Offered Price
                  </h3>
                  <p className="text-card-foreground font-medium">${selected.offered_price.toLocaleString()}</p>
                </div>
              ) : null}

              {/* Internal Notes */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <StickyNote className="w-4 h-4 inline mr-1" />Internal Notes
                </h3>
                <Textarea
                  placeholder="Add team notes here..."
                  defaultValue={selected.internal_notes || ""}
                  onBlur={async (e) => {
                    const { error } = await supabase
                      .from("submissions")
                      .update({ internal_notes: e.target.value || null })
                      .eq("id", selected.id);
                    if (!error) {
                      setSelected({ ...selected, internal_notes: e.target.value || null });
                      toast({ title: "Notes saved" });
                    }
                  }}
                  rows={3}
                />
              </div>

              {/* Info */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Info</h3>
                <DetailRow label="Loan Status" value={selected.loan_status} />
                <DetailRow label="Next Step" value={selected.next_step} />
                <DetailRow label="Submitted" value={new Date(selected.created_at).toLocaleString()} />
              </div>

              {/* Photos */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Photos {photos.length > 0 && `(${photos.length})`}
                </h3>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="rounded-lg w-full h-32 object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                )}
              </div>

              {canDelete && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Submission
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
