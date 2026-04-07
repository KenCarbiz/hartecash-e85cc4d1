import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Save, Loader2, MapPin, ChevronDown, ChevronRight, X, MapPinned, Car, Radar, Store, Building2, ShoppingCart, Warehouse, Image, Eye, Globe, Megaphone } from "lucide-react";
import LocationLogoSection from "./LocationLogoSection";

const LOCATION_TYPE_OPTIONS = [
  { value: "primary", label: "Primary Store", icon: Store, color: "bg-primary/10 text-primary border-primary/20" },
  { value: "sister_store", label: "Sister Store", icon: Building2, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { value: "used_car", label: "Used Car Center", icon: ShoppingCart, color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  { value: "buying_center", label: "Buying Center", icon: Warehouse, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
];

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  sort_order: number;
  is_active: boolean;
  show_in_footer: boolean;
  show_in_scheduling: boolean;
  show_in_inspection: boolean;
  temporarily_offline: boolean;
  use_bdc: boolean;
  zip_codes: string[];
  oem_brands: string[];
  center_zip: string;
  coverage_radius_miles: number;
  all_brands: boolean;
  excluded_oem_brands: string[];
  corporate_logo_url: string | null;
  corporate_logo_dark_url: string | null;
  secondary_logo_url: string | null;
  secondary_logo_dark_url: string | null;
  oem_logo_urls: string[];
  logo_layout: string;
  show_corporate_logo: boolean;
  show_corporate_on_landing_only: boolean;
  location_type: string;
  established_year: number | null;
  use_corporate_established_year: boolean;
  // Landing page overrides
  dealership_name: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  logo_url: string | null;
  logo_white_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  success_color: string | null;
  tagline: string | null;
  hero_headline: string | null;
  hero_subtext: string | null;
  hero_layout: string | null;
  service_hero_headline: string | null;
  service_hero_subtext: string | null;
  trade_hero_headline: string | null;
  trade_hero_subtext: string | null;
  business_hours: any;
  facebook_url: string | null;
  instagram_url: string | null;
  google_review_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  stats_cars_purchased: string | null;
  stats_years_in_business: string | null;
  stats_rating: string | null;
  stats_reviews_count: string | null;
  price_guarantee_days: number | null;
}

const LocationManagement = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("CT");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [zipInputs, setZipInputs] = useState<Record<string, string>>({});
  const [brandInputs, setBrandInputs] = useState<Record<string, string>>({});
  const [excludedBrandInputs, setExcludedBrandInputs] = useState<Record<string, string>>({});
  const [newLocationType, setNewLocationType] = useState("primary");

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from("dealership_locations" as any)
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("sort_order");
    if (!error && data) setLocations(data as unknown as Location[]);
    setLoading(false);
  };

  useEffect(() => { fetchLocations(); }, [dealershipId]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addLocation = async () => {
    if (!newName.trim() || !newCity.trim()) {
      toast({ title: "Name and city are required", variant: "destructive" });
      return;
    }
    const maxOrder = locations.length > 0 ? Math.max(...locations.map(l => l.sort_order)) : 0;
    const { error } = await supabase
      .from("dealership_locations" as any)
      .insert({ name: newName.trim(), city: newCity.trim(), state: newState.trim() || "CT", sort_order: maxOrder + 1, location_type: newLocationType } as any);
    if (error) {
      toast({ title: "Failed to add location", variant: "destructive" });
    } else {
      toast({ title: "Location added" });
      setNewName(""); setNewCity(""); setNewState("CT"); setNewLocationType("primary");
      fetchLocations();
    }
  };

  const toggleField = async (id: string, field: "is_active" | "show_in_footer" | "show_in_scheduling" | "show_in_inspection" | "temporarily_offline" | "use_bdc", current: boolean) => {
    const { error } = await supabase
      .from("dealership_locations" as any)
      .update({ [field]: !current })
      .eq("id", id);
    if (!error) {
      setLocations(prev => prev.map(l => l.id === id ? { ...l, [field]: !current } : l));
    }
  };

  const deleteLocation = async (id: string) => {
    const { error } = await supabase
      .from("dealership_locations" as any)
      .delete()
      .eq("id", id);
    if (!error) {
      setLocations(prev => prev.filter(l => l.id !== id));
      toast({ title: "Location removed" });
    }
  };

  const updateLocation = (id: string, field: keyof Location, value: any) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const saveAll = async () => {
    setSaving(true);
    let hasError = false;
    for (const loc of locations) {
      const { error } = await supabase
        .from("dealership_locations" as any)
        .update({
          name: loc.name, city: loc.city, state: loc.state, address: loc.address,
          sort_order: loc.sort_order, zip_codes: loc.zip_codes || [],
          oem_brands: loc.oem_brands || [], center_zip: loc.center_zip || '',
          coverage_radius_miles: loc.coverage_radius_miles || 0,
          all_brands: loc.all_brands ?? true, excluded_oem_brands: loc.excluded_oem_brands || [],
          temporarily_offline: loc.temporarily_offline ?? false,
          use_bdc: loc.use_bdc ?? false, show_in_inspection: loc.show_in_inspection ?? true,
          corporate_logo_url: loc.corporate_logo_url || null,
          corporate_logo_dark_url: loc.corporate_logo_dark_url || null,
          secondary_logo_url: loc.secondary_logo_url || null,
          secondary_logo_dark_url: loc.secondary_logo_dark_url || null,
          oem_logo_urls: loc.oem_logo_urls || [],
          logo_layout: loc.logo_layout || 'side_by_side',
          show_corporate_logo: loc.show_corporate_logo ?? false,
          show_corporate_on_landing_only: loc.show_corporate_on_landing_only ?? false,
          location_type: loc.location_type || 'primary',
          established_year: loc.established_year,
          use_corporate_established_year: loc.use_corporate_established_year ?? true,
          // Landing page overrides
          dealership_name: loc.dealership_name || null,
          phone: loc.phone || null,
          email: loc.email || null,
          website_url: loc.website_url || null,
          logo_url: loc.logo_url || null,
          logo_white_url: loc.logo_white_url || null,
          favicon_url: loc.favicon_url || null,
          primary_color: loc.primary_color || null,
          accent_color: loc.accent_color || null,
          success_color: loc.success_color || null,
          tagline: loc.tagline || null,
          hero_headline: loc.hero_headline || null,
          hero_subtext: loc.hero_subtext || null,
          hero_layout: loc.hero_layout || null,
          service_hero_headline: loc.service_hero_headline || null,
          service_hero_subtext: loc.service_hero_subtext || null,
          trade_hero_headline: loc.trade_hero_headline || null,
          trade_hero_subtext: loc.trade_hero_subtext || null,
          business_hours: loc.business_hours || null,
          facebook_url: loc.facebook_url || null,
          instagram_url: loc.instagram_url || null,
          google_review_url: loc.google_review_url || null,
          tiktok_url: loc.tiktok_url || null,
          youtube_url: loc.youtube_url || null,
          stats_cars_purchased: loc.stats_cars_purchased || null,
          stats_years_in_business: loc.stats_years_in_business || null,
          stats_rating: loc.stats_rating || null,
          stats_reviews_count: loc.stats_reviews_count || null,
          price_guarantee_days: loc.price_guarantee_days || null,
        } as any)
        .eq("id", loc.id);
      if (error) hasError = true;
    }
    setSaving(false);
    toast({ title: hasError ? "Some updates failed" : "All locations saved", variant: hasError ? "destructive" : "default" });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...locations];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((l, i) => l.sort_order = i + 1);
    setLocations(updated);
  };

  const moveDown = (index: number) => {
    if (index === locations.length - 1) return;
    const updated = [...locations];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((l, i) => l.sort_order = i + 1);
    setLocations(updated);
  };

  const addZips = (locId: string) => {
    const raw = zipInputs[locId] || "";
    const newZips = raw.split(/[,\s]+/).map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
    if (newZips.length > 0) {
      setLocations(prev => prev.map(l => l.id === locId
        ? { ...l, zip_codes: [...new Set([...(l.zip_codes || []), ...newZips])] }
        : l
      ));
      setZipInputs(prev => ({ ...prev, [locId]: "" }));
    }
  };

  const addBrands = (locId: string, type: "include" | "exclude") => {
    const inputs = type === "include" ? brandInputs : excludedBrandInputs;
    const setInputs = type === "include" ? setBrandInputs : setExcludedBrandInputs;
    const field = type === "include" ? "oem_brands" : "excluded_oem_brands";
    const raw = inputs[locId] || "";
    const newBrands = raw.split(",").map(b => b.trim()).filter(Boolean);
    if (newBrands.length > 0) {
      setLocations(prev => prev.map(l => l.id === locId
        ? { ...l, [field]: [...new Set([...((l as any)[field] || []), ...newBrands])] }
        : l
      ));
      setInputs(prev => ({ ...prev, [locId]: "" }));
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin w-6 h-6" /></div>;

  const isMulti = locations.length > 1;
  const typeInfo = (type: string) => LOCATION_TYPE_OPTIONS.find(o => o.value === type) || LOCATION_TYPE_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Dealership Locations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Configure store locations, coverage areas, and branding.</p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </Button>
      </div>

      {/* Location Cards */}
      <div className="space-y-3">
        {locations.map((loc, index) => {
          const ti = typeInfo(loc.location_type);
          const expanded = expandedIds.has(loc.id);

          return (
            <div
              key={loc.id}
              className={`rounded-xl border transition-all ${loc.is_active ? "bg-card border-border shadow-sm" : "bg-muted/30 border-border/40 opacity-60"}`}
            >
              {/* Collapsed header row */}
              <div className="flex items-center gap-3 p-3">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveUp(index)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                  <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                  <button onClick={() => moveDown(index)} disabled={index === locations.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                </div>

                {/* Identity summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm truncate">{loc.name || "Unnamed"}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ti.color}`}>
                      <ti.icon className="w-3 h-3 mr-1" />
                      {ti.label}
                    </Badge>
                    {loc.temporarily_offline && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-200">⚠ Offline</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {[loc.address, loc.city, loc.state].filter(Boolean).join(", ") || "No address set"}
                    {loc.zip_codes?.length > 0 && ` · ${loc.zip_codes.length} ZIPs`}
                    {loc.coverage_radius_miles > 0 && ` · ${loc.coverage_radius_miles}mi radius`}
                  </p>
                </div>

                {/* Quick toggles */}
                <div className="hidden lg:flex items-center gap-4">
                  <div className="flex items-center gap-1.5" title="Active">
                    <Label className="text-[10px] text-muted-foreground">Active</Label>
                    <Switch checked={loc.is_active} onCheckedChange={() => toggleField(loc.id, "is_active", loc.is_active)} />
                  </div>
                </div>

                {/* Expand / Delete */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpanded(loc.id)}>
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)} className="text-destructive hover:text-destructive/80 h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded tabbed panel */}
              {expanded && (
                <div className="border-t border-border/50 p-4">
                  <Tabs defaultValue="identity" className="w-full">
                    <TabsList className="w-full justify-start mb-4 bg-muted/50">
                      <TabsTrigger value="identity" className="gap-1.5 text-xs">
                        <Store className="w-3.5 h-3.5" /> Identity
                      </TabsTrigger>
                      <TabsTrigger value="visibility" className="gap-1.5 text-xs">
                        <Eye className="w-3.5 h-3.5" /> Visibility
                      </TabsTrigger>
                      <TabsTrigger value="coverage" className="gap-1.5 text-xs">
                        <Globe className="w-3.5 h-3.5" /> Coverage
                      </TabsTrigger>
                      <TabsTrigger value="branding" className="gap-1.5 text-xs">
                        <Image className="w-3.5 h-3.5" /> Branding
                      </TabsTrigger>
                      <TabsTrigger value="landing" className="gap-1.5 text-xs">
                        <Megaphone className="w-3.5 h-3.5" /> Landing Page
                      </TabsTrigger>
                    </TabsList>

                    {/* ── IDENTITY ── */}
                    <TabsContent value="identity" className="space-y-4 mt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1 block">Location Name</Label>
                          <Input value={loc.name} onChange={e => updateLocation(loc.id, "name", e.target.value)} placeholder="e.g. Downtown Hartford" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1 block">Location Type</Label>
                          <Select value={loc.location_type || "primary"} onValueChange={val => updateLocation(loc.id, "location_type", val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LOCATION_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="flex items-center gap-1.5"><opt.icon className="w-3.5 h-3.5" />{opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-medium text-muted-foreground mb-1 block">Street Address</Label>
                        <Input value={loc.address || ""} onChange={e => updateLocation(loc.id, "address", e.target.value)} placeholder="123 Main St, Hartford, CT 06103" />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1 block">City</Label>
                          <Input value={loc.city} onChange={e => updateLocation(loc.id, "city", e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1 block">State</Label>
                          <Input value={loc.state} onChange={e => updateLocation(loc.id, "state", e.target.value)} className="w-20" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground mb-1 block">Year Established</Label>
                          {loc.use_corporate_established_year && loc.location_type !== "primary" ? (
                            <p className="text-xs text-muted-foreground italic pt-2">Using corporate year</p>
                          ) : (
                            <Input
                              type="number" min={1800} max={new Date().getFullYear()}
                              value={loc.established_year ?? ""}
                              onChange={e => updateLocation(loc.id, "established_year", e.target.value ? Number(e.target.value) : null)}
                              placeholder="e.g. 1947" className="w-28"
                            />
                          )}
                          {loc.location_type !== "primary" && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Switch checked={loc.use_corporate_established_year} onCheckedChange={v => updateLocation(loc.id, "use_corporate_established_year", v)} />
                              <Label className="text-[10px] text-muted-foreground">Inherit corporate year</Label>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* ── VISIBILITY ── */}
                    <TabsContent value="visibility" className="mt-0">
                      <p className="text-xs text-muted-foreground mb-4">Control where this location appears across the platform.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { field: "is_active" as const, label: "Active", desc: "Location is live and accepting leads" },
                          { field: "show_in_footer" as const, label: "Show in Footer", desc: "Display address in the site footer" },
                          { field: "show_in_scheduling" as const, label: "Customer Scheduling", desc: "Appear in the scheduling location picker" },
                          { field: "show_in_inspection" as const, label: "Inspections", desc: "Allow vehicle inspections at this store" },
                        ].map(item => (
                          <div key={item.field} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                            <Switch checked={(loc as any)[item.field]} onCheckedChange={() => toggleField(loc.id, item.field, (loc as any)[item.field])} className="mt-0.5" />
                            <div>
                              <Label className="text-sm font-medium">{item.label}</Label>
                              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                        <div className={`flex items-start gap-3 p-3 rounded-lg border ${loc.temporarily_offline ? "border-amber-300 bg-amber-500/5" : "border-border/50 bg-muted/20"}`}>
                          <Switch checked={!loc.temporarily_offline} onCheckedChange={() => toggleField(loc.id, "temporarily_offline", loc.temporarily_offline)} className="mt-0.5" />
                          <div>
                            <Label className={`text-sm font-medium ${loc.temporarily_offline ? "text-amber-600" : ""}`}>
                              {loc.temporarily_offline ? "⚠ Currently Offline" : "Online"}
                            </Label>
                            <p className="text-[11px] text-muted-foreground">Temporarily hide from scheduling & lead routing</p>
                          </div>
                        </div>
                        {isMulti && (
                          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                            <Switch checked={loc.use_bdc} onCheckedChange={() => toggleField(loc.id, "use_bdc", loc.use_bdc)} className="mt-0.5" />
                            <div>
                              <Label className={`text-sm font-medium ${loc.use_bdc ? "text-blue-600" : ""}`}>
                                {loc.use_bdc ? "📞 BDC Routing" : "BDC Routing"}
                              </Label>
                              <p className="text-[11px] text-muted-foreground">Route leads to the central Buying Center / BDC</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* ── COVERAGE ── */}
                    <TabsContent value="coverage" className="space-y-5 mt-0">
                      {/* ZIP Codes */}
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <MapPinned className="w-3.5 h-3.5" /> Coverage ZIP Codes
                        </Label>
                        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                          {(loc.zip_codes || []).map(zip => (
                            <Badge key={zip} variant="secondary" className="gap-1 text-xs font-mono pl-2 pr-1 py-0.5">
                              {zip}
                              <button onClick={() => updateLocation(loc.id, "zip_codes", loc.zip_codes.filter(z => z !== zip))} className="hover:text-destructive ml-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          {(!loc.zip_codes || loc.zip_codes.length === 0) && (
                            <span className="text-xs text-muted-foreground italic">No ZIP codes assigned</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={zipInputs[loc.id] || ""} onChange={e => setZipInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                            placeholder="Add ZIPs (comma-separated)" className="text-sm font-mono flex-1"
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addZips(loc.id); } }}
                          />
                          <Button size="sm" variant="outline" onClick={() => addZips(loc.id)} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
                          {(loc.zip_codes?.length || 0) > 0 && (
                            <Button size="sm" variant="ghost" onClick={() => updateLocation(loc.id, "zip_codes", [])} className="text-destructive text-xs">Clear</Button>
                          )}
                        </div>
                      </div>

                      {/* Radius — multi-location only */}
                      {isMulti && (
                        <div className="border-t border-border/30 pt-4">
                          <Label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Radar className="w-3.5 h-3.5" /> Geographic Radius
                          </Label>
                          <p className="text-[11px] text-muted-foreground mb-3">Steer leads to this store based on proximity.</p>
                          <div className="flex items-center gap-2 mb-3">
                            <Switch checked={(loc.coverage_radius_miles || 0) > 0} onCheckedChange={on => updateLocation(loc.id, "coverage_radius_miles", on ? 15 : 0)} />
                            <Label className="text-sm">{(loc.coverage_radius_miles || 0) > 0 ? "Radius routing enabled" : "Off — using ZIP list only"}</Label>
                          </div>
                          {(loc.coverage_radius_miles || 0) > 0 && (
                            <div className="ml-1 border-l-2 border-border pl-4 space-y-3">
                              <div className="flex items-center gap-4">
                                <div className="w-28">
                                  <Label className="text-[10px] text-muted-foreground mb-0.5 block">Center ZIP</Label>
                                  <Input value={loc.center_zip || ""} onChange={e => updateLocation(loc.id, "center_zip", e.target.value)} placeholder="06103" className="font-mono" maxLength={5} />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Radius</span>
                                    <span className="text-xs font-semibold tabular-nums">{loc.coverage_radius_miles} mi</span>
                                  </div>
                                  <Slider value={[loc.coverage_radius_miles || 0]} onValueChange={([val]) => updateLocation(loc.id, "coverage_radius_miles", val)} min={5} max={50} step={5} />
                                  <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>5 mi</span><span>25 mi</span><span>50 mi</span></div>
                                </div>
                              </div>
                              {loc.center_zip?.length === 5 && (
                                <p className="text-[11px] text-primary/80">✓ Leads within {loc.coverage_radius_miles} miles of {loc.center_zip} will route here</p>
                              )}
                              {(!loc.center_zip || loc.center_zip.length < 5) && (
                                <p className="text-[11px] text-amber-600">⚠ Enter a 5-digit center ZIP to activate</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* OEM Brand Mapping — multi-location only */}
                      {isMulti && (
                        <div className="border-t border-border/30 pt-4">
                          <Label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5" /> OEM Brand Mapping
                          </Label>
                          <div className="flex items-center gap-2 mb-3">
                            <Switch checked={loc.all_brands ?? true} onCheckedChange={v => updateLocation(loc.id, "all_brands", v)} />
                            <Label className="text-sm">{(loc.all_brands ?? true) ? "All Brands" : "Specific Brands Only"}</Label>
                            {(loc.all_brands ?? true) && <Badge variant="secondary" className="text-[10px]">Accepts every make</Badge>}
                          </div>

                          {/* All brands ON — exclusions */}
                          {(loc.all_brands ?? true) && (
                            <div className="ml-1 border-l-2 border-border pl-4 space-y-2">
                              <p className="text-[11px] text-muted-foreground">Optionally exclude brands:</p>
                              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                {(loc.excluded_oem_brands || []).map(brand => (
                                  <Badge key={brand} variant="destructive" className="gap-1 text-xs pl-2 pr-1 py-0.5 bg-destructive/10 text-destructive border-destructive/20">
                                    {brand}
                                    <button onClick={() => updateLocation(loc.id, "excluded_oem_brands", loc.excluded_oem_brands.filter(b => b !== brand))} className="hover:text-destructive/80 ml-0.5"><X className="w-3 h-3" /></button>
                                  </Badge>
                                ))}
                                {(!loc.excluded_oem_brands || loc.excluded_oem_brands.length === 0) && (
                                  <span className="text-xs text-muted-foreground italic">No exclusions</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Input value={excludedBrandInputs[loc.id] || ""} onChange={e => setExcludedBrandInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                                  placeholder="e.g. Porsche, Maserati" className="text-sm flex-1"
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBrands(loc.id, "exclude"); } }} />
                                <Button size="sm" variant="outline" onClick={() => addBrands(loc.id, "exclude")} className="gap-1"><Plus className="w-3 h-3" /> Exclude</Button>
                              </div>
                            </div>
                          )}

                          {/* All brands OFF — inclusions */}
                          {!(loc.all_brands ?? true) && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                {(loc.oem_brands || []).map(brand => (
                                  <Badge key={brand} variant="outline" className="gap-1 text-xs pl-2 pr-1 py-0.5 border-primary/30 bg-primary/5">
                                    {brand}
                                    <button onClick={() => updateLocation(loc.id, "oem_brands", loc.oem_brands.filter(b => b !== brand))} className="hover:text-destructive ml-0.5"><X className="w-3 h-3" /></button>
                                  </Badge>
                                ))}
                                {(!loc.oem_brands || loc.oem_brands.length === 0) && (
                                  <span className="text-xs text-muted-foreground italic">No brands assigned</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Input value={brandInputs[loc.id] || ""} onChange={e => setBrandInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                                  placeholder="e.g. Nissan, Infiniti" className="text-sm flex-1"
                                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addBrands(loc.id, "include"); } }} />
                                <Button size="sm" variant="outline" onClick={() => addBrands(loc.id, "include")} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── BRANDING ── */}
                    <TabsContent value="branding" className="mt-0">
                      <LocationLogoSection
                        location={loc}
                        dealershipId={dealershipId}
                        onUpdate={(field, value) => updateLocation(loc.id, field as any, value)}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Location */}
      <div className="rounded-xl border border-dashed border-border/60 p-4 bg-muted/10">
        <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Add New Location
        </Label>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-[10px] text-muted-foreground mb-1 block">Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Location name" />
          </div>
          <div className="w-32">
            <Label className="text-[10px] text-muted-foreground mb-1 block">City</Label>
            <Input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="City" />
          </div>
          <div className="w-20">
            <Label className="text-[10px] text-muted-foreground mb-1 block">State</Label>
            <Input value={newState} onChange={e => setNewState(e.target.value)} placeholder="ST" />
          </div>
          <div className="w-44">
            <Label className="text-[10px] text-muted-foreground mb-1 block">Type</Label>
            <Select value={newLocationType} onValueChange={setNewLocationType}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-1.5"><opt.icon className="w-3 h-3" />{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addLocation} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocationManagement;
