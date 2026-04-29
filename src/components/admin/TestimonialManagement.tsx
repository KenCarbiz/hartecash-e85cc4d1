import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Loader2, GripVertical } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface Testimonial {
  id: string;
  author_name: string;
  location: string;
  vehicle: string;
  review_text: string;
  rating: number;
  is_active: boolean;
  sort_order: number;
}

const EMPTY: Omit<Testimonial, "id"> = {
  author_name: "",
  location: "",
  vehicle: "",
  review_text: "",
  rating: 5,
  is_active: true,
  sort_order: 0,
};

const TestimonialManagement = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<Omit<Testimonial, "id">>(EMPTY);
  const [filter, setFilter] = useState<"all" | "published" | "hidden">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  useEffect(() => { fetchAll(); }, [dealershipId]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order", { ascending: true });
    if (!error && data) setTestimonials(data as Testimonial[]);
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
    const payload = { ...form, updated_at: new Date().toISOString() };

    let error;
    if (editing) {
      ({ error } = await supabase.from("testimonials").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("testimonials").insert(payload));
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Testimonial removed." });
      fetchAll();
    }
  };

  const toggleActive = async (t: Testimonial) => {
    await supabase.from("testimonials").update({ is_active: !t.is_active, updated_at: new Date().toISOString() }).eq("id", t.id);
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading testimonials...</div>;
  }

  // Counts per state for the filter pills.
  const publishedCount = testimonials.filter((t) => t.is_active).length;
  const hiddenCount = testimonials.length - publishedCount;

  // Apply filter + search.
  const visible = testimonials.filter((t) => {
    if (filter === "published" && !t.is_active) return false;
    if (filter === "hidden" && t.is_active) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [t.author_name, t.location, t.vehicle, t.review_text]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-card-foreground">Customer Testimonials</h3>
          <p className="text-xs text-muted-foreground">{testimonials.length} testimonial{testimonials.length !== 1 ? "s" : ""} configured · {publishedCount} published</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Add Testimonial
        </Button>
      </div>

      {testimonials.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { k: "all" as const, label: "All", count: testimonials.length },
            { k: "published" as const, label: "Published", count: publishedCount },
            { k: "hidden" as const, label: "Hidden", count: hiddenCount },
          ]).map((p) => {
            const selected = filter === p.k;
            return (
              <button
                key={p.k}
                onClick={() => setFilter(p.k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  selected
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {p.label} <span className={selected ? "opacity-70" : "opacity-50"}>· {p.count}</span>
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
          No testimonials yet. Add your first customer review.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          No testimonials match the current filter.{" "}
          <button onClick={() => { setFilter("all"); setSearch(""); }} className="text-primary hover:underline font-semibold">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${t.is_active ? "bg-card border-border" : "bg-muted/30 border-border/50 opacity-60"}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < t.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  {!t.is_active && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">Hidden</span>}
                </div>
                <p className="text-sm text-card-foreground italic line-clamp-2">"{t.review_text}"</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-card-foreground">{t.author_name}</span>
                  {t.location && <span>• {t.location}</span>}
                  {t.vehicle && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-medium">{t.vehicle}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} className="scale-75" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
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
              <Textarea value={form.review_text} onChange={e => setForm(f => ({ ...f, review_text: e.target.value }))} rows={3} placeholder="Customer's testimonial..." />
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
                {editing ? "Save Changes" : "Add Testimonial"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestimonialManagement;
