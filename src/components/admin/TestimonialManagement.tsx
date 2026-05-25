import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Loader2, GripVertical, Check, X } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

type ReviewStatus = "pending" | "approved" | "denied";
type ReviewSource = "token" | "public" | "admin";

interface Testimonial {
  id: string;
  author_name: string;
  location: string;
  vehicle: string;
  review_text: string;
  rating: number;
  is_active: boolean;
  sort_order: number;
  status: ReviewStatus;
  source: ReviewSource;
}

type Filter = "pending" | "published" | "hidden" | "denied" | "all";

const EMPTY = {
  author_name: "",
  location: "",
  vehicle: "",
  review_text: "",
  rating: 5,
  is_active: true,
  sort_order: 0,
};

const SOURCE_LABEL: Record<ReviewSource, string> = {
  token: "Customer link",
  public: "Website",
  admin: "Manual",
};

const TestimonialManagement = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const didInitialFilter = useRef(false);

  useEffect(() => { didInitialFilter.current = false; fetchAll(); }, [dealershipId]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const rows = data as Testimonial[];
      setTestimonials(rows);
      // On first load only, drop the admin onto the moderation queue when
      // reviews are waiting — don't yank them back after each action.
      if (!didInitialFilter.current) {
        didInitialFilter.current = true;
        if (rows.some((t) => t.status === "pending")) setFilter("pending");
      }
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: testimonials.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({ author_name: t.author_name, location: t.location, vehicle: t.vehicle, review_text: t.review_text, rating: t.rating, is_active: t.is_active, sort_order: t.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.author_name.trim() || !form.review_text.trim()) {
      toast({ title: "Missing fields", description: "Author name and review text are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    let error;
    if (editing) {
      // Editing leaves moderation state alone — use Approve/Deny for that.
      ({ error } = await supabase
        .from("testimonials")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", editing.id));
    } else {
      // Admin-authored testimonials are approved on creation.
      ({ error } = await supabase.from("testimonials").insert({
        ...form,
        status: "approved",
        source: "admin",
        dealership_id: dealershipId,
        updated_at: new Date().toISOString(),
      }));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Updated" : "Created", description: "Testimonial saved." });
      setDialogOpen(false);
      fetchAll();
    }
    setSaving(false);
  };

  // Approve / deny write the moderator + timestamp for the audit trail.
  const moderate = async (t: Testimonial, status: ReviewStatus) => {
    setActingId(t.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("testimonials")
      .update({
        status,
        is_active: status === "approved",
        moderated_at: new Date().toISOString(),
        moderated_by: userData.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: status === "approved" ? "Approved" : "Denied",
        description: status === "approved" ? "Review is now live on your site." : "Review hidden and kept on file.",
      });
      fetchAll();
    }
    setActingId(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Testimonial removed." });
      fetchAll();
    }
  };

  // Switch on an approved review just hides / shows it (status unchanged).
  const toggleActive = async (t: Testimonial) => {
    await supabase.from("testimonials").update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq("id", t.id);
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading testimonials...</div>;
  }

  const pendingCount = testimonials.filter((t) => t.status === "pending").length;
  const publishedCount = testimonials.filter((t) => t.status === "approved" && t.is_active).length;
  const hiddenCount = testimonials.filter((t) => t.status === "approved" && !t.is_active).length;
  const deniedCount = testimonials.filter((t) => t.status === "denied").length;

  const matchesFilter = (t: Testimonial): boolean => {
    switch (filter) {
      case "pending": return t.status === "pending";
      case "published": return t.status === "approved" && t.is_active;
      case "hidden": return t.status === "approved" && !t.is_active;
      case "denied": return t.status === "denied";
      default: return true;
    }
  };

  const visible = testimonials.filter((t) => {
    if (!matchesFilter(t)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [t.author_name, t.location, t.vehicle, t.review_text]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const pills: { k: Filter; label: string; count: number }[] = [
    { k: "all", label: "All", count: testimonials.length },
    { k: "pending", label: "Pending", count: pendingCount },
    { k: "published", label: "Published", count: publishedCount },
    { k: "hidden", label: "Hidden", count: hiddenCount },
    { k: "denied", label: "Denied", count: deniedCount },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-card-foreground">Customer Reviews</h3>
          <p className="text-xs text-muted-foreground">
            {testimonials.length} total · {publishedCount} live
            {pendingCount > 0 && <span className="text-amber-600 font-semibold"> · {pendingCount} awaiting review</span>}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Add Review
        </Button>
      </div>

      {testimonials.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {pills.map((p) => {
            const selected = filter === p.k;
            const isPending = p.k === "pending" && p.count > 0;
            return (
              <button
                key={p.k}
                onClick={() => setFilter(p.k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  selected
                    ? "bg-foreground text-background border-foreground"
                    : isPending
                      ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {p.label} <span className={selected ? "opacity-70" : "opacity-60"}>· {p.count}</span>
              </button>
            );
          })}
          <Input
            placeholder="Search author, vehicle, review text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs flex-1 min-w-[200px] max-w-md"
          />
        </div>
      )}

      {testimonials.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No reviews yet. Customers can leave one at <code className="text-xs">/leave-a-review</code>, or add one manually.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No reviews match the current filter.{" "}
          <button onClick={() => { setFilter("all"); setSearch(""); }} className="text-primary hover:underline font-semibold">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => {
            const isPending = t.status === "pending";
            const isDenied = t.status === "denied";
            const acting = actingId === t.id;
            return (
              <div
                key={t.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                  isPending
                    ? "bg-amber-50/60 border-amber-300"
                    : isDenied
                      ? "bg-muted/40 border-border/50"
                      : t.is_active
                        ? "bg-card border-border"
                        : "bg-muted/30 border-border/50 opacity-70"
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    {isPending && <span className="text-micro bg-amber-500 text-white px-1.5 py-0.5 rounded font-semibold">Pending</span>}
                    {isDenied && <span className="text-micro bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">Denied</span>}
                    {t.status === "approved" && !t.is_active && <span className="text-micro bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">Hidden</span>}
                    {t.source !== "admin" && (
                      <span className="text-micro bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{SOURCE_LABEL[t.source]}</span>
                    )}
                  </div>
                  <p className="text-sm text-card-foreground italic line-clamp-3">"{t.review_text}"</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-card-foreground">{t.author_name}</span>
                    {t.location && <span>• {t.location}</span>}
                    {t.vehicle && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-micro font-medium">{t.vehicle}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isPending ? (
                    <>
                      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" onClick={() => moderate(t, "approved")} disabled={acting}>
                        {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive border-destructive/30" onClick={() => moderate(t, "denied")} disabled={acting}>
                        <X className="w-3.5 h-3.5 mr-1" /> Deny
                      </Button>
                    </>
                  ) : isDenied ? (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => moderate(t, "approved")} disabled={acting}>
                      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} Approve
                    </Button>
                  ) : (
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} className="scale-75" aria-label="Visible on site" />
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Review" : "Add Review"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Author Name *</Label>
                <Input value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))} placeholder="Sarah M." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Hartford, CT" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Vehicle</Label>
              <Input value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} placeholder="2019 Toyota RAV4" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Review Text *</Label>
              <Textarea value={form.review_text} onChange={e => setForm(f => ({ ...f, review_text: e.target.value }))} rows={3} placeholder="Customer's review..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, rating: n }))} className="p-0.5">
                      <Star className={`w-5 h-5 transition-colors ${n <= form.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-xs">Visible on landing page</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                {editing ? "Save Changes" : "Add Review"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestimonialManagement;
