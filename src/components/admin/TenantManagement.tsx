import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Globe, Store, Pencil, Trash2, Copy, ExternalLink, Rocket } from "lucide-react";

interface Tenant {
  id: string;
  dealership_id: string;
  slug: string;
  display_name: string;
  custom_domain: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_TENANT: Omit<Tenant, "id" | "created_at"> = {
  dealership_id: "",
  slug: "",
  display_name: "",
  custom_domain: null,
  is_active: true,
};

interface TenantManagementProps {
  onSetupDealer?: (dealershipId: string) => void;
}

const TenantManagement = ({ onSetupDealer }: TenantManagementProps) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(EMPTY_TENANT);

  const TRIGGER_KEYS = [
    "customer_offer_ready", "customer_offer_increased", "customer_offer_accepted",
    "customer_appointment_reminder", "customer_appointment_rescheduled",
    "staff_customer_accepted", "staff_deal_completed", "new_submission",
    "hot_lead", "appointment_booked", "photos_uploaded", "docs_uploaded",
    "status_change", "abandoned_lead",
  ];

  const seedNotificationTemplates = async (dealershipId: string, displayName: string) => {
    const templates: any[] = [];
    for (const key of TRIGGER_KEYS) {
      templates.push(
        { dealership_id: dealershipId, trigger_key: key, channel: "email", subject: `{{dealership_name}} — ${key.replace(/_/g, " ")}`, body: `Hi {{customer_name}},\n\nThank you for choosing ${displayName}.\n\n{{dealership_name}}` },
        { dealership_id: dealershipId, trigger_key: key, channel: "sms", subject: null, body: `${displayName}: Hi {{customer_name}}, {{vehicle}} update. {{portal_link}}` },
      );
    }
    await supabase.from("notification_templates").insert(templates as any);
  };

  const { toast } = useToast();

  const fetchTenants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: true });
    setTenants((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_TENANT);
    setDialogOpen(true);
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setForm({
      dealership_id: t.dealership_id,
      slug: t.slug,
      display_name: t.display_name,
      custom_domain: t.custom_domain,
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.dealership_id || !form.slug || !form.display_name) {
      toast({ title: "Missing fields", description: "ID, slug, and display name are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const payload = {
      dealership_id: form.dealership_id.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      display_name: form.display_name,
      custom_domain: form.custom_domain?.trim() || null,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("tenants").update(payload).eq("id", editing.id));
    } else {
      // Create tenant + seed config rows
      const { error: insertError } = await supabase.from("tenants").insert(payload);
      error = insertError;

      if (!insertError) {
        // Seed a site_config row for the new dealer
        await supabase.from("site_config").insert({
          dealership_id: payload.dealership_id,
          dealership_name: payload.display_name,
        } as any);
        // Seed form_config
        await supabase.from("form_config").insert({
          dealership_id: payload.dealership_id,
        } as any);
        // Seed offer_settings
        await supabase.from("offer_settings").insert({
          dealership_id: payload.dealership_id,
        } as any);
        // Seed inspection_config
        await supabase.from("inspection_config").insert({
          dealership_id: payload.dealership_id,
        } as any);
        // Seed notification_settings
        await supabase.from("notification_settings").insert({
          dealership_id: payload.dealership_id,
        } as any);
        // Seed dealer_accounts
        await supabase.from("dealer_accounts").insert({
          dealership_id: payload.dealership_id,
        } as any);
        // Seed branded notification_templates for the new dealer
        await seedNotificationTemplates(payload.dealership_id, payload.display_name);
      }
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Updated" : "Dealer Added", description: `${payload.display_name} is ready.` });
      setDialogOpen(false);
      fetchTenants();
    }
  };

  const handleDelete = async (t: Tenant) => {
    if (t.dealership_id === "default") {
      toast({ title: "Cannot delete", description: "The default tenant cannot be removed.", variant: "destructive" });
      return;
    }
    if (!confirm(`Delete "${t.display_name}"? This won't remove their data, just the tenant mapping.`)) return;
    await supabase.from("tenants").delete().eq("id", t.id);
    toast({ title: "Deleted", description: `${t.display_name} removed.` });
    fetchTenants();
  };

  const copySlugUrl = (slug: string) => {
    navigator.clipboard.writeText(`${slug}.hartecash.com`);
    toast({ title: "Copied", description: `${slug}.hartecash.com copied to clipboard.` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-card-foreground">Dealer Tenants</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage dealerships on this platform. Each dealer gets their own branded site.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Add Dealer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-card-foreground">{tenants.length}</p>
            <p className="text-xs text-muted-foreground">Total Dealers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{tenants.filter(t => t.is_active).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-card-foreground">{tenants.filter(t => t.custom_domain).length}</p>
            <p className="text-xs text-muted-foreground">Custom Domains</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dealer</TableHead>
                <TableHead>ID / Slug</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.display_name}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.dealership_id}</code>
                      <div className="flex items-center gap-1">
                        <code className="text-xs text-muted-foreground">{t.slug}</code>
                        <button onClick={() => copySlugUrl(t.slug)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.custom_domain ? (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm">{t.custom_domain}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onSetupDealer && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onSetupDealer(t.dealership_id)} title="Setup">
                          <Rocket className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {t.dealership_id !== "default" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Dealer" : "Add New Dealer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Display Name</Label>
              <Input
                value={form.display_name}
                onChange={e => {
                  const name = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    display_name: name,
                    // Auto-generate ID and slug from name if creating new
                    ...(!editing ? {
                      dealership_id: name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30),
                      slug: name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30),
                    } : {}),
                  }));
                }}
                placeholder="Smith Motors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dealership ID</Label>
                <Input
                  value={form.dealership_id}
                  onChange={e => setForm(prev => ({ ...prev, dealership_id: e.target.value }))}
                  placeholder="smith_motors"
                  disabled={!!editing}
                />
                <p className="text-[10px] text-muted-foreground">Internal key — cannot change after creation</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">URL Slug</Label>
                <Input
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="smith"
                />
                <p className="text-[10px] text-muted-foreground">Used for subdomain: smith.hartecash.com</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Custom Domain (optional)</Label>
              <Input
                value={form.custom_domain || ""}
                onChange={e => setForm(prev => ({ ...prev, custom_domain: e.target.value || null }))}
                placeholder="sellmycar.smithmotors.com"
              />
              <p className="text-[10px] text-muted-foreground">Dealer must point DNS to your server for this to work</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(prev => ({ ...prev, is_active: v }))} />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Update" : "Create Dealer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantManagement;
