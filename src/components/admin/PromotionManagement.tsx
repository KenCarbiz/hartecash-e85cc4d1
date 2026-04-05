import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Megaphone, Calendar, DollarSign, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Promotion {
  id: string;
  name: string;
  bonus_amount: number;
  description: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  show_on_widget: boolean;
  show_on_portal: boolean;
}

const emptyPromo: Omit<Promotion, "id"> = {
  name: "",
  bonus_amount: 500,
  description: "",
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: null,
  is_active: true,
  show_on_widget: true,
  show_on_portal: true,
};

const PromotionManagement = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Promotion, "id">>(emptyPromo);
  const [showNew, setShowNew] = useState(false);

  const fetchPromos = async () => {
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("created_at", { ascending: false });
    setPromos((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPromos(); }, [dealershipId]);

  const isCurrentlyActive = (p: Promotion) => {
    if (!p.is_active) return false;
    const now = new Date();
    if (new Date(p.starts_at) > now) return false;
    if (p.ends_at && new Date(p.ends_at) < now) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("promotions").insert({
      ...draft,
      dealership_id: dealershipId,
      ends_at: draft.ends_at || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Promotion created");
    setShowNew(false);
    setDraft(emptyPromo);
    fetchPromos();
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from("promotions").update({
      ...draft,
      ends_at: draft.ends_at || null,
    } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Promotion updated");
    setEditingId(null);
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    await supabase.from("promotions").delete().eq("id", id);
    toast.success("Promotion deleted");
    fetchPromos();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("promotions").update({ is_active: active } as any).eq("id", id);
    fetchPromos();
  };

  const startEdit = (p: Promotion) => {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      bonus_amount: p.bonus_amount,
      description: p.description || "",
      starts_at: p.starts_at?.slice(0, 16) || "",
      ends_at: p.ends_at?.slice(0, 16) || null,
      is_active: p.is_active,
      show_on_widget: p.show_on_widget,
      show_on_portal: p.show_on_portal,
    });
  };

  const renderForm = (isNew: boolean) => (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Promotion Name</Label>
            <Input placeholder="e.g. Summer Trade-In Bonus" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>Bonus Amount ($)</Label>
            <Input type="number" min={0} value={draft.bonus_amount} onChange={(e) => setDraft({ ...draft, bonus_amount: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <Label>Description (optional — shown to customers)</Label>
          <Textarea placeholder="Get an extra $500 on top of your offer!" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Input type="datetime-local" value={draft.starts_at?.slice(0, 16) || ""} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
          </div>
          <div>
            <Label>End Date (leave blank = no expiry)</Label>
            <Input type="datetime-local" value={draft.ends_at?.slice(0, 16) || ""} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value || null })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={draft.show_on_widget} onCheckedChange={(v) => setDraft({ ...draft, show_on_widget: v })} />
            <Label>Show on Widget/Banner</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.show_on_portal} onCheckedChange={(v) => setDraft({ ...draft, show_on_portal: v })} />
            <Label>Show on Customer Portal</Label>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => { isNew ? setShowNew(false) : setEditingId(null); setDraft(emptyPromo); }}>
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={() => isNew ? handleCreate() : handleUpdate(editingId!)}>
            <Save className="w-4 h-4 mr-1" /> {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Promotions & Bonuses
          </h2>
          <p className="text-sm text-muted-foreground">
            Create trade-in bonuses that automatically apply to customer offers.
          </p>
        </div>
        {!showNew && (
          <Button size="sm" onClick={() => { setShowNew(true); setDraft(emptyPromo); }}>
            <Plus className="w-4 h-4 mr-1" /> New Promotion
          </Button>
        )}
      </div>

      {showNew && renderForm(true)}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : promos.length === 0 && !showNew ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No promotions yet. Create one to boost trade-in offers.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => {
            const active = isCurrentlyActive(p);
            if (editingId === p.id) return <div key={p.id}>{renderForm(false)}</div>;
            return (
              <Card key={p.id} className={active ? "border-success/30" : "opacity-70"}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-card-foreground truncate">{p.name}</h3>
                        <Badge variant={active ? "default" : "secondary"} className={active ? "bg-success text-success-foreground" : ""}>
                          {active ? "Active" : p.is_active ? "Scheduled" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          +${p.bonus_amount.toLocaleString()} bonus
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(p.starts_at).toLocaleDateString()}
                          {p.ends_at ? ` — ${new Date(p.ends_at).toLocaleDateString()}` : " — No end date"}
                        </span>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={p.is_active} onCheckedChange={(v) => handleToggle(p.id, v)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PromotionManagement;
