import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Globe, Save, ExternalLink, Building2 } from "lucide-react";
import { LANDING_TEMPLATES, type LandingTemplate } from "@/hooks/useSiteConfig";
import TemplateThumbnail from "@/components/landing/TemplateThumbnail";

interface LocationRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  landing_template: string | null;
}

interface RooftopTenant {
  id: string;
  dealership_id: string;
  slug: string;
  display_name: string;
  custom_domain: string | null;
  location_id: string | null;
  is_active: boolean;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

const RooftopWebsites = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [groupTenant, setGroupTenant] = useState<RooftopTenant | null>(null);
  const [rooftops, setRooftops] = useState<RooftopTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RooftopTenant | null>(null);

  // New rooftop form
  const [newLocationId, setNewLocationId] = useState<string>("");
  const [newSlug, setNewSlug] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newTemplate, setNewTemplate] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const [locRes, tRes] = await Promise.all([
      supabase.from("dealership_locations" as any)
        .select("id, name, city, state, landing_template")
        .eq("dealership_id", dealershipId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("tenants")
        .select("id, dealership_id, slug, display_name, custom_domain, location_id, is_active")
        .eq("dealership_id", dealershipId)
        .order("location_id", { ascending: true }),
    ]);
    setLocations(((locRes.data as unknown) as LocationRow[]) || []);
    const all = (tRes.data as RooftopTenant[]) || [];
    setGroupTenant(all.find((t) => !t.location_id) || null);
    setRooftops(all.filter((t) => !!t.location_id));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealershipId]);

  const locationName = (locationId: string | null) => {
    const l = locations.find((x) => x.id === locationId);
    if (!l) return "(unknown location)";
    const loc = [l.city, l.state].filter(Boolean).join(", ");
    return loc ? `${l.name} — ${loc}` : l.name;
  };

  // Locations that don't yet have a rooftop tenant — eligible for the add form
  const availableLocations = locations.filter(
    (l) => !rooftops.some((r) => r.location_id === l.id),
  );

  const handleAdd = async () => {
    if (!newLocationId) {
      toast({ title: "Pick a location", variant: "destructive" });
      return;
    }
    const slug = newSlug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      toast({
        title: "Invalid slug",
        description: "3–64 characters, lowercase letters, numbers and hyphens.",
        variant: "destructive",
      });
      return;
    }
    const domain = newDomain.trim().toLowerCase() || null;
    if (domain && !/^[a-z0-9.-]+$/i.test(domain)) {
      toast({ title: "Invalid custom domain", variant: "destructive" });
      return;
    }

    const loc = locations.find((l) => l.id === newLocationId);
    const { error } = await supabase.from("tenants" as any).insert({
      dealership_id: dealershipId,
      slug,
      display_name: loc?.name || slug,
      custom_domain: domain,
      location_id: newLocationId,
      is_active: true,
    } as any);

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }

    // If a template was picked, write it to the location override
    if (newTemplate) {
      await supabase.from("dealership_locations" as any)
        .update({ landing_template: newTemplate } as any)
        .eq("id", newLocationId);
    }

    toast({ title: "Rooftop website added" });
    setAddOpen(false);
    setNewLocationId("");
    setNewSlug("");
    setNewDomain("");
    setNewTemplate("");
    refresh();
  };

  const handleSaveRow = async (r: RooftopTenant, patch: Partial<RooftopTenant>, templatePatch?: string | null) => {
    setSavingId(r.id);
    const updates: any = {};
    if ("slug" in patch) updates.slug = (patch.slug || "").toLowerCase().trim();
    if ("custom_domain" in patch) {
      updates.custom_domain = patch.custom_domain?.trim().toLowerCase() || null;
    }
    if ("is_active" in patch) updates.is_active = patch.is_active;

    if (Object.keys(updates).length) {
      const { error } = await supabase.from("tenants" as any).update(updates as any).eq("id", r.id);
      if (error) {
        setSavingId(null);
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
    }

    if (templatePatch !== undefined && r.location_id) {
      await supabase.from("dealership_locations" as any)
        .update({ landing_template: templatePatch || null } as any)
        .eq("id", r.location_id);
    }

    setSavingId(null);
    toast({ title: "Saved" });
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("tenants" as any).delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rooftop website removed" });
      refresh();
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-primary" /> Rooftop Websites
        </h2>
        <p className="text-sm text-muted-foreground">
          Give each rooftop its own URL and landing page. All rooftops share this admin, leads, and
          staff — only the public-facing site differs.
        </p>
      </header>

      {/* Group hub */}
      {groupTenant && (
        <section className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-bold">Group Hub — {groupTenant.display_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  The group's main URL. Edit its landing template in Landing &amp; Flow.
                </div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-mono text-primary">{groupTenant.slug}.autocurb.io</div>
              {groupTenant.custom_domain && (
                <div className="font-mono text-muted-foreground mt-0.5">{groupTenant.custom_domain}</div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Rooftop list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Rooftop Sites ({rooftops.length})</h3>
          {availableLocations.length > 0 && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Rooftop Website
            </Button>
          )}
        </div>

        {rooftops.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-xl p-8 text-center">
            <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No rooftop websites yet. Click <strong>Add Rooftop Website</strong> above to give a
              location its own URL.
            </p>
          </div>
        ) : (
          rooftops.map((r) => (
            <RooftopRow
              key={r.id}
              tenant={r}
              locationLabel={locationName(r.location_id)}
              locationTemplate={locations.find((l) => l.id === r.location_id)?.landing_template || ""}
              saving={savingId === r.id}
              onSave={(patch, templatePatch) => handleSaveRow(r, patch, templatePatch)}
              onDelete={() => setDeleteTarget(r)}
            />
          ))
        )}
      </section>

      {/* Add dialog */}
      <AlertDialog open={addOpen} onOpenChange={setAddOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Rooftop Website</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a new URL for one of your locations. Shares admin, staff, and leads with the group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Location</Label>
              <Select
                value={newLocationId}
                onValueChange={(v) => {
                  setNewLocationId(v);
                  const loc = locations.find((l) => l.id === v);
                  if (loc && !newSlug) {
                    setNewSlug(`${slugify(tenant.slug || "group")}-${slugify(loc.name)}`.slice(0, 60));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pick a location…" /></SelectTrigger>
                <SelectContent>
                  {availableLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {locationName(l.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rooftop Slug (subdomain)</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="smith-toyota"
                className="font-mono"
              />
              {newSlug && <p className="text-[10px] text-muted-foreground">Will serve at {newSlug}.autocurb.io</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Custom Domain <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="smithtoyota.com"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Landing Template</Label>
              <Select value={newTemplate} onValueChange={setNewTemplate}>
                <SelectTrigger><SelectValue placeholder="Inherit group default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Inherit group default</SelectItem>
                  {LANDING_TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAdd}>Add Rooftop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove rooftop website?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the URL <span className="font-mono">{deleteTarget?.slug}.autocurb.io</span>
              {deleteTarget?.custom_domain && <> and <span className="font-mono">{deleteTarget.custom_domain}</span></>}.
              The location itself and its leads are not affected. You can re-add it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Row editor ──
interface RowProps {
  tenant: RooftopTenant;
  locationLabel: string;
  locationTemplate: string;
  saving: boolean;
  onSave: (patch: Partial<RooftopTenant>, templatePatch?: string | null) => void;
  onDelete: () => void;
}

const RooftopRow = ({ tenant, locationLabel, locationTemplate, saving, onSave, onDelete }: RowProps) => {
  const [slug, setSlug] = useState(tenant.slug);
  const [domain, setDomain] = useState(tenant.custom_domain || "");
  const [template, setTemplate] = useState(locationTemplate || "");

  const dirty =
    slug !== tenant.slug ||
    (domain || "") !== (tenant.custom_domain || "") ||
    template !== (locationTemplate || "");

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold">{tenant.display_name}</div>
            <span className="text-xs text-muted-foreground">— {locationLabel}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <a
              href={`//${tenant.slug}.autocurb.io`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline flex items-center gap-1"
            >
              {tenant.slug}.autocurb.io <ExternalLink className="w-3 h-3" />
            </a>
            {tenant.custom_domain && (
              <a
                href={`//${tenant.custom_domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-muted-foreground hover:text-primary"
              >
                {tenant.custom_domain}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive p-1"
          aria-label="Remove rooftop"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Custom Domain</Label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="font-mono text-sm"
            placeholder="optional"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Landing Template</Label>
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Inherit group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Inherit group default</SelectItem>
              {LANDING_TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {dirty && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={() =>
              onSave(
                { slug, custom_domain: domain || null },
                template || null,
              )
            }
            className="gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
};

export default RooftopWebsites;
