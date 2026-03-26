import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, GripVertical, Save, Loader2, MapPin, ChevronDown, ChevronRight, X, MapPinned, Car, Radar } from "lucide-react";

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
  temporarily_offline: boolean;
  zip_codes: string[];
  oem_brands: string[];
  center_zip: string;
  coverage_radius_miles: number;
  all_brands: boolean;
  excluded_oem_brands: string[];
}

const LocationManagement = () => {
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

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from("dealership_locations" as any)
      .select("*")
      .order("sort_order");
    if (!error && data) setLocations(data as unknown as Location[]);
    setLoading(false);
  };

  useEffect(() => { fetchLocations(); }, []);

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
      .insert({ name: newName.trim(), city: newCity.trim(), state: newState.trim() || "CT", sort_order: maxOrder + 1 });
    if (error) {
      toast({ title: "Failed to add location", variant: "destructive" });
    } else {
      toast({ title: "Location added" });
      setNewName(""); setNewCity(""); setNewState("CT");
      fetchLocations();
    }
  };

  const toggleField = async (id: string, field: "is_active" | "show_in_footer" | "show_in_scheduling" | "temporarily_offline", current: boolean) => {
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

  const updateLocation = async (id: string, field: keyof Location, value: string) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const saveAll = async () => {
    setSaving(true);
    let hasError = false;
    for (const loc of locations) {
      const { error } = await supabase
        .from("dealership_locations" as any)
        .update({ name: loc.name, city: loc.city, state: loc.state, address: loc.address, sort_order: loc.sort_order, zip_codes: loc.zip_codes || [], oem_brands: loc.oem_brands || [], center_zip: loc.center_zip || '', coverage_radius_miles: loc.coverage_radius_miles || 0, all_brands: loc.all_brands ?? true, excluded_oem_brands: loc.excluded_oem_brands || [], temporarily_offline: loc.temporarily_offline ?? false })
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

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin w-6 h-6" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Dealership Locations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage locations shown in the site footer and scheduling.</p>
        </div>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </Button>
      </div>

      {/* Existing locations */}
      <div className="space-y-2">
        {locations.map((loc, index) => (
          <div
            key={loc.id}
            className={`rounded-lg border transition-colors ${loc.is_active ? "bg-card border-border" : "bg-muted/50 border-border/50 opacity-60"}`}
          >
            {/* Main row */}
            <div className="flex items-center gap-3 p-3">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(index)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                <button onClick={() => moveDown(index)} disabled={index === locations.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input
                  value={loc.name}
                  onChange={(e) => updateLocation(loc.id, "name", e.target.value)}
                  placeholder="Location name"
                  className="text-sm"
                />
                <Input
                  value={loc.city}
                  onChange={(e) => updateLocation(loc.id, "city", e.target.value)}
                  placeholder="City"
                  className="text-sm"
                />
                <Input
                  value={loc.state}
                  onChange={(e) => updateLocation(loc.id, "state", e.target.value)}
                  placeholder="State"
                  className="text-sm w-20"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5" title="Active">
                  <Label className="text-[10px] text-muted-foreground">Active</Label>
                  <Switch checked={loc.is_active} onCheckedChange={() => toggleField(loc.id, "is_active", loc.is_active)} />
                </div>
                <div className="flex items-center gap-1.5" title="Show address in Footer">
                  <Label className="text-[10px] text-muted-foreground">Addr Footer</Label>
                  <Switch checked={loc.show_in_footer} onCheckedChange={() => toggleField(loc.id, "show_in_footer", loc.show_in_footer)} />
                </div>
                <div className="flex items-center gap-1.5" title="Show this location in the customer scheduling dropdown">
                  <Label className="text-[10px] text-muted-foreground">Scheduling</Label>
                  <Switch checked={loc.show_in_scheduling} onCheckedChange={() => toggleField(loc.id, "show_in_scheduling", loc.show_in_scheduling)} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)} className="text-destructive hover:text-destructive/80 h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Collapsible details */}
            <div className="border-t border-border/50">
              <button
                onClick={() => toggleExpanded(loc.id)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground w-full text-left transition-colors"
              >
                {expandedIds.has(loc.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>Address, ZIP Codes ({loc.zip_codes?.length || 0}){loc.coverage_radius_miles > 0 ? ` + ${loc.coverage_radius_miles}mi radius` : ''}, Brands: {(loc.all_brands ?? true) ? `All${(loc.excluded_oem_brands?.length || 0) > 0 ? ` (−${loc.excluded_oem_brands.length})` : ''}` : `${loc.oem_brands?.length || 0} specific`}</span>
              </button>
              {expandedIds.has(loc.id) && (
                <div className="px-3 pb-3 space-y-4">
                  {/* Address */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Street Address</Label>
                    <Input
                      value={loc.address || ""}
                      onChange={(e) => updateLocation(loc.id, "address", e.target.value)}
                      placeholder="Full street address (e.g. 123 Main St, Hartford, CT 06103)"
                      className="text-sm"
                    />
                  </div>

                  {/* ZIP Codes */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <MapPinned className="w-3.5 h-3.5" /> Coverage ZIP Codes
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(loc.zip_codes || []).map((zip) => (
                        <Badge key={zip} variant="secondary" className="gap-1 text-xs font-mono pl-2 pr-1 py-0.5">
                          {zip}
                          <button
                            onClick={() => {
                              setLocations(prev => prev.map(l => l.id === loc.id
                                ? { ...l, zip_codes: l.zip_codes.filter(z => z !== zip) }
                                : l
                              ));
                            }}
                            className="hover:text-destructive ml-0.5"
                          >
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
                        value={zipInputs[loc.id] || ""}
                        onChange={(e) => setZipInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                        placeholder="Add ZIPs (comma-separated, e.g. 06101, 06102, 06103)"
                        className="text-sm font-mono flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const raw = zipInputs[loc.id] || "";
                            const newZips = raw.split(/[,\s]+/).map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
                            if (newZips.length > 0) {
                              setLocations(prev => prev.map(l => l.id === loc.id
                                ? { ...l, zip_codes: [...new Set([...(l.zip_codes || []), ...newZips])] }
                                : l
                              ));
                              setZipInputs(prev => ({ ...prev, [loc.id]: "" }));
                            }
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const raw = zipInputs[loc.id] || "";
                          const newZips = raw.split(/[,\s]+/).map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
                          if (newZips.length > 0) {
                            setLocations(prev => prev.map(l => l.id === loc.id
                              ? { ...l, zip_codes: [...new Set([...(l.zip_codes || []), ...newZips])] }
                              : l
                            ));
                            setZipInputs(prev => ({ ...prev, [loc.id]: "" }));
                          }
                        }}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, zip_codes: [] } : l));
                        }}
                        className="text-destructive hover:text-destructive/80 text-xs"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>

                  {/* Radius Coverage — only for multi-location groups */}
                  {locations.length > 1 && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Radar className="w-3.5 h-3.5" /> Geographic Coverage Radius
                      </Label>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Enable to steer leads to this store based on proximity. Useful when your group has multiple locations spread across a region.
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <Switch
                          checked={(loc.coverage_radius_miles || 0) > 0}
                          onCheckedChange={(on) => {
                            setLocations(prev => prev.map(l => l.id === loc.id
                              ? { ...l, coverage_radius_miles: on ? 15 : 0 }
                              : l
                            ));
                          }}
                        />
                        <Label className="text-sm">
                          {(loc.coverage_radius_miles || 0) > 0 ? "Radius routing enabled" : "Off — using ZIP list only"}
                        </Label>
                      </div>
                      {(loc.coverage_radius_miles || 0) > 0 && (
                        <div className="ml-1 border-l-2 border-border pl-3 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-28">
                              <Label className="text-[10px] text-muted-foreground mb-0.5 block">Center ZIP</Label>
                              <Input
                                value={loc.center_zip || ""}
                                onChange={(e) => updateLocation(loc.id, "center_zip" as any, e.target.value)}
                                placeholder="e.g. 06103"
                                className="text-sm font-mono"
                                maxLength={5}
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Radius</span>
                                <span className="text-xs font-semibold tabular-nums">
                                  {loc.coverage_radius_miles} mi
                                </span>
                              </div>
                              <Slider
                                value={[loc.coverage_radius_miles || 0]}
                                onValueChange={([val]) => {
                                  setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, coverage_radius_miles: val } : l));
                                }}
                                min={5}
                                max={50}
                                step={5}
                                className="w-full"
                              />
                              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                                <span>5 mi</span>
                                <span>25 mi</span>
                                <span>50 mi</span>
                              </div>
                            </div>
                          </div>
                          {loc.center_zip && loc.center_zip.length === 5 && (
                            <p className="text-[11px] text-primary/80">
                              ✓ Leads within {loc.coverage_radius_miles} miles of {loc.center_zip} will route to this store
                            </p>
                          )}
                          {(!loc.center_zip || loc.center_zip.length < 5) && (
                            <p className="text-[11px] text-amber-600">
                              ⚠ Enter a 5-digit center ZIP to activate radius routing
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {locations.length > 1 && <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" /> OEM Brand Mapping
                    </Label>

                    {/* All Brands toggle */}
                    <div className="flex items-center gap-2 mb-3">
                      <Switch
                        checked={loc.all_brands ?? true}
                        onCheckedChange={(checked) => {
                          setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, all_brands: checked } : l));
                        }}
                      />
                      <Label className="text-sm">
                        {(loc.all_brands ?? true) ? "All Brands" : "Specific Brands Only"}
                      </Label>
                      {(loc.all_brands ?? true) && (
                        <Badge variant="secondary" className="text-[10px]">Accepts every make</Badge>
                      )}
                    </div>

                    {/* When All Brands is ON — show excluded brands */}
                    {(loc.all_brands ?? true) && (
                      <div className="ml-1 border-l-2 border-border pl-3 space-y-2">
                        <p className="text-[11px] text-muted-foreground">Optionally exclude specific brands from this location:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(loc.excluded_oem_brands || []).map((brand) => (
                            <Badge key={brand} variant="destructive" className="gap-1 text-xs pl-2 pr-1 py-0.5 bg-destructive/10 text-destructive border-destructive/20">
                              {brand}
                              <button
                                onClick={() => {
                                  setLocations(prev => prev.map(l => l.id === loc.id
                                    ? { ...l, excluded_oem_brands: l.excluded_oem_brands.filter(b => b !== brand) }
                                    : l
                                  ));
                                }}
                                className="hover:text-destructive/80 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          {(!loc.excluded_oem_brands || loc.excluded_oem_brands.length === 0) && (
                            <span className="text-xs text-muted-foreground italic">No exclusions — all brands accepted</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={excludedBrandInputs[loc.id] || ""}
                            onChange={(e) => setExcludedBrandInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                            placeholder="Exclude brand (e.g. Porsche, Maserati)"
                            className="text-sm flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const raw = excludedBrandInputs[loc.id] || "";
                                const newBrands = raw.split(",").map(b => b.trim()).filter(Boolean);
                                if (newBrands.length > 0) {
                                  setLocations(prev => prev.map(l => l.id === loc.id
                                    ? { ...l, excluded_oem_brands: [...new Set([...(l.excluded_oem_brands || []), ...newBrands])] }
                                    : l
                                  ));
                                  setExcludedBrandInputs(prev => ({ ...prev, [loc.id]: "" }));
                                }
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const raw = excludedBrandInputs[loc.id] || "";
                              const newBrands = raw.split(",").map(b => b.trim()).filter(Boolean);
                              if (newBrands.length > 0) {
                                setLocations(prev => prev.map(l => l.id === loc.id
                                  ? { ...l, excluded_oem_brands: [...new Set([...(l.excluded_oem_brands || []), ...newBrands])] }
                                  : l
                                ));
                                setExcludedBrandInputs(prev => ({ ...prev, [loc.id]: "" }));
                              }
                            }}
                            className="gap-1"
                          >
                            <Plus className="w-3 h-3" /> Exclude
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* When All Brands is OFF — show specific included brands */}
                    {!(loc.all_brands ?? true) && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {(loc.oem_brands || []).map((brand) => (
                            <Badge key={brand} variant="outline" className="gap-1 text-xs pl-2 pr-1 py-0.5 border-primary/30 bg-primary/5">
                              {brand}
                              <button
                                onClick={() => {
                                  setLocations(prev => prev.map(l => l.id === loc.id
                                    ? { ...l, oem_brands: l.oem_brands.filter(b => b !== brand) }
                                    : l
                                  ));
                                }}
                                className="hover:text-destructive ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          {(!loc.oem_brands || loc.oem_brands.length === 0) && (
                            <span className="text-xs text-muted-foreground italic">No brands assigned — add specific brands this location handles</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={brandInputs[loc.id] || ""}
                            onChange={(e) => setBrandInputs(prev => ({ ...prev, [loc.id]: e.target.value }))}
                            placeholder="Add brand (e.g. Nissan, Infiniti, Hyundai)"
                            className="text-sm flex-1"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const raw = brandInputs[loc.id] || "";
                                const newBrands = raw.split(",").map(b => b.trim()).filter(Boolean);
                                if (newBrands.length > 0) {
                                  setLocations(prev => prev.map(l => l.id === loc.id
                                    ? { ...l, oem_brands: [...new Set([...(l.oem_brands || []), ...newBrands])] }
                                    : l
                                  ));
                                  setBrandInputs(prev => ({ ...prev, [loc.id]: "" }));
                                }
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const raw = brandInputs[loc.id] || "";
                              const newBrands = raw.split(",").map(b => b.trim()).filter(Boolean);
                              if (newBrands.length > 0) {
                                setLocations(prev => prev.map(l => l.id === loc.id
                                  ? { ...l, oem_brands: [...new Set([...(l.oem_brands || []), ...newBrands])] }
                                  : l
                                ));
                                setBrandInputs(prev => ({ ...prev, [loc.id]: "" }));
                              }
                            }}
                            className="gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="border-t pt-4">
        <Label className="text-sm font-semibold mb-2 block">Add New Location</Label>
        <div className="flex items-center gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Location name" className="flex-1" />
          <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="City" className="w-32" />
          <Input value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="State" className="w-20" />
          <Button onClick={addLocation} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LocationManagement;
