import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, Loader2, MapPin, ChevronDown, ChevronRight, X, MapPinned, Car } from "lucide-react";

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
  zip_codes: string[];
  oem_brands: string[];
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

  const toggleField = async (id: string, field: "is_active" | "show_in_footer" | "show_in_scheduling", current: boolean) => {
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
        .update({ name: loc.name, city: loc.city, state: loc.state, address: loc.address, sort_order: loc.sort_order })
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
                <div className="flex items-center gap-1.5" title="Show address in Scheduling">
                  <Label className="text-[10px] text-muted-foreground">Addr Sched.</Label>
                  <Switch checked={loc.show_in_scheduling} onCheckedChange={() => toggleField(loc.id, "show_in_scheduling", loc.show_in_scheduling)} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)} className="text-destructive hover:text-destructive/80 h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Collapsible address */}
            <div className="border-t border-border/50">
              <button
                onClick={() => toggleExpanded(loc.id)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground w-full text-left transition-colors"
              >
                {expandedIds.has(loc.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {loc.address ? "Address: " + loc.address : "Add address…"}
              </button>
              {expandedIds.has(loc.id) && (
                <div className="px-3 pb-3">
                  <Input
                    value={loc.address || ""}
                    onChange={(e) => updateLocation(loc.id, "address", e.target.value)}
                    placeholder="Full street address (e.g. 123 Main St, Hartford, CT 06103)"
                    className="text-sm"
                  />
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
