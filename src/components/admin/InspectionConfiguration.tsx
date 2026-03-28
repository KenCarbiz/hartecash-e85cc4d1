import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save, GripVertical, Plus, Trash2, ChevronDown, ChevronRight,
  Gauge, ThermometerSun, Paintbrush, Armchair, Wrench, Zap, Eye,
  Camera, StickyNote, Loader2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Default field definitions matching InspectionSheet
const SECTION_FIELDS: Record<string, string[]> = {
  tires: [], // special — controlled by sub-toggles
  measurements: [], // special — controlled by sub-toggles
  exterior: [
    "Hood", "Front Bumper", "Rear Bumper", "Roof", "Trunk/Liftgate",
    "Left Front Fender", "Right Front Fender", "Left Rear Quarter", "Right Rear Quarter",
    "Left Front Door", "Right Front Door", "Left Rear Door", "Right Rear Door",
    "Windshield", "Rear Glass", "Left Mirror", "Right Mirror",
    "Left Headlight", "Right Headlight", "Left Taillight", "Right Taillight",
    "Grille", "Wheels/Rims", "Undercarriage",
  ],
  interior: [
    "Driver Seat", "Passenger Seat", "Rear Seats", "Headliner",
    "Dashboard", "Center Console", "Steering Wheel", "Carpet/Floor Mats",
    "Door Panels", "Instrument Cluster", "Glove Box", "Trunk Interior",
    "Seat Belts", "Sun Visors", "Rearview Mirror",
  ],
  mechanical: [
    "Engine Start/Idle", "Engine Noise", "Oil Leaks", "Coolant Leaks",
    "Transmission Shift", "Differential", "Exhaust System",
    "Power Steering", "CV Joints/Boots", "Drive Belts",
    "Shocks/Struts", "Ball Joints", "Tie Rods", "Wheel Bearings",
    "Brake Rotors", "Brake Lines", "Parking Brake",
  ],
  electrical: [
    "A/C System", "Heater", "Power Windows", "Power Locks", "Power Mirrors",
    "Radio/Infotainment", "Speakers", "Backup Camera", "Navigation",
    "Sunroof/Moonroof", "Keyless Entry", "Remote Start",
    "Headlights", "Turn Signals", "Brake Lights", "Interior Lights",
    "Horn", "Wipers", "Defroster", "Charging Ports/USB",
  ],
  glass: [
    "Windshield Chips/Cracks", "Side Windows", "Rear Window",
    "Headlight Clarity", "Taillight Clarity", "Fog Lights",
  ],
};

const SECTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  tires: { label: "Tires & Brakes", icon: Gauge, color: "text-blue-500" },
  measurements: { label: "Quick Measurements", icon: ThermometerSun, color: "text-violet-500" },
  exterior: { label: "Exterior", icon: Paintbrush, color: "text-sky-500" },
  interior: { label: "Interior", icon: Armchair, color: "text-amber-500" },
  mechanical: { label: "Mechanical", icon: Wrench, color: "text-slate-500" },
  electrical: { label: "Electrical", icon: Zap, color: "text-yellow-500" },
  glass: { label: "Glass & Lights", icon: Eye, color: "text-teal-500" },
};

interface CustomItem {
  section: string;
  label: string;
  sort_order: number;
}

const InspectionConfiguration = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState("");

  // Section toggles
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({
    tires: true, measurements: true, exterior: true, interior: true,
    mechanical: true, electrical: true, glass: true,
  });

  // Section order
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    ["tires", "measurements", "exterior", "interior", "mechanical", "electrical", "glass"]
  );

  // Disabled fields
  const [disabledFields, setDisabledFields] = useState<Record<string, boolean>>({});

  // Sub-toggles for tires/measurements
  const [showTireTread, setShowTireTread] = useState(true);
  const [showBrakePads, setShowBrakePads] = useState(true);
  const [showPaintReadings, setShowPaintReadings] = useState(true);
  const [showOilLife, setShowOilLife] = useState(true);
  const [showBatteryHealth, setShowBatteryHealth] = useState(true);

  // Tire credit/deduction policy
  const [enableTireAdjustments, setEnableTireAdjustments] = useState(false);
  const [tireAdjustmentMode, setTireAdjustmentMode] = useState<"whole" | "per_tire">("whole");
  const [tireCreditThreshold, setTireCreditThreshold] = useState(6);
  const [tireDeductThreshold, setTireDeductThreshold] = useState(3);
  const [tireCreditPer32, setTireCreditPer32] = useState(25);
  const [tireDeductPer32, setTireDeductPer32] = useState(50);

  // Requirements
  const [requirePhotos, setRequirePhotos] = useState<Record<string, boolean>>({});
  const [requireNotes, setRequireNotes] = useState<Record<string, boolean>>({});

  // Custom items
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [newItemSection, setNewItemSection] = useState("exterior");
  const [newItemLabel, setNewItemLabel] = useState("");

  // Expanded sections in the UI
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("inspection_config")
        .select("*")
        .eq("dealership_id", "default")
        .maybeSingle();

      if (data) {
        setConfigId(data.id);
        setSectionToggles({
          tires: data.section_tires,
          measurements: data.section_measurements,
          exterior: data.section_exterior,
          interior: data.section_interior,
          mechanical: data.section_mechanical,
          electrical: data.section_electrical,
          glass: data.section_glass,
        });
        setSectionOrder((data.section_order as any) || sectionOrder);
        setDisabledFields((data.disabled_fields as any) || {});
        setShowTireTread(data.show_tire_tread_depth);
        setShowBrakePads(data.show_brake_pad_measurements);
        setShowPaintReadings(data.show_paint_readings);
        setShowOilLife(data.show_oil_life);
        setShowBatteryHealth(data.show_battery_health);
        setRequirePhotos((data.require_photos as any) || {});
        setRequireNotes((data.require_notes as any) || {});
        setCustomItems((data.custom_items as any) || []);
        setEnableTireAdjustments((data as any).enable_tire_adjustments ?? false);
        setTireCreditThreshold((data as any).tire_credit_threshold ?? 6);
        setTireDeductThreshold((data as any).tire_deduct_threshold ?? 3);
        setTireCreditPer32((data as any).tire_credit_per_32 ?? 25);
        setTireDeductPer32((data as any).tire_deduct_per_32 ?? 50);
        setTireAdjustmentMode((data as any).tire_adjustment_mode || 'whole');
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("inspection_config")
      .update({
        section_tires: sectionToggles.tires,
        section_measurements: sectionToggles.measurements,
        section_exterior: sectionToggles.exterior,
        section_interior: sectionToggles.interior,
        section_mechanical: sectionToggles.mechanical,
        section_electrical: sectionToggles.electrical,
        section_glass: sectionToggles.glass,
        section_order: sectionOrder as any,
        disabled_fields: disabledFields as any,
        show_tire_tread_depth: showTireTread,
        show_brake_pad_measurements: showBrakePads,
        show_paint_readings: showPaintReadings,
        show_oil_life: showOilLife,
        show_battery_health: showBatteryHealth,
        require_photos: requirePhotos as any,
        require_notes: requireNotes as any,
        custom_items: customItems as any,
        enable_tire_adjustments: enableTireAdjustments,
        tire_credit_threshold: tireCreditThreshold,
        tire_deduct_threshold: tireDeductThreshold,
        tire_credit_per_32: tireCreditPer32,
        tire_deduct_per_32: tireDeductPer32,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", configId);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Inspection config saved", description: "Changes will apply to all new inspections." });
    }
  };

  const toggleField = (field: string) => {
    setDisabledFields(prev => {
      const next = { ...prev };
      if (next[field]) delete next[field];
      else next[field] = true;
      return next;
    });
  };

  const moveSection = (key: string, dir: -1 | 1) => {
    setSectionOrder(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const next = [...prev];
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const addCustomItem = () => {
    if (!newItemLabel.trim()) return;
    setCustomItems(prev => [...prev, {
      section: newItemSection,
      label: newItemLabel.trim(),
      sort_order: prev.filter(i => i.section === newItemSection).length,
    }]);
    setNewItemLabel("");
  };

  const removeCustomItem = (idx: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleExpanded = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const enabledFieldCount = (sectionKey: string) => {
    const fields = SECTION_FIELDS[sectionKey] || [];
    const customs = customItems.filter(i => i.section === sectionKey);
    return fields.filter(f => !disabledFields[f]).length + customs.length;
  };

  const totalFieldCount = (sectionKey: string) => {
    return (SECTION_FIELDS[sectionKey] || []).length + customItems.filter(i => i.section === sectionKey).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Inspection Sheet Builder</h2>
          <p className="text-sm text-muted-foreground">Toggle sections, fields, and add custom checklist items</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Section Cards — ordered by drag order */}
      <div className="space-y-3">
        {sectionOrder.map((sectionKey, idx) => {
          const meta = SECTION_META[sectionKey];
          if (!meta) return null;
          const Icon = meta.icon;
          const isEnabled = sectionToggles[sectionKey];
          const fields = SECTION_FIELDS[sectionKey] || [];
          const customs = customItems.filter(i => i.section === sectionKey);
          const isExpanded = expandedSections.has(sectionKey);
          const hasFields = fields.length > 0 || customs.length > 0;
          const isSpecial = sectionKey === "tires" || sectionKey === "measurements";

          return (
            <Card key={sectionKey} className={`transition-all ${!isEnabled ? "opacity-50" : ""}`}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveSection(sectionKey, -1)}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs leading-none"
                    >▲</button>
                    <button
                      onClick={() => moveSection(sectionKey, 1)}
                      disabled={idx === sectionOrder.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs leading-none"
                    >▼</button>
                  </div>

                  <Icon className={`w-5 h-5 ${meta.color}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{meta.label}</span>
                      {hasFields && isEnabled && (
                        <Badge variant="outline" className="text-[10px]">
                          {enabledFieldCount(sectionKey)}/{totalFieldCount(sectionKey)} fields
                        </Badge>
                      )}
                      {requirePhotos[sectionKey] && (
                        <Camera className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      {requireNotes[sectionKey] && (
                        <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Section toggle */}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(v) => setSectionToggles(prev => ({ ...prev, [sectionKey]: v }))}
                  />

                  {/* Expand toggle */}
                  {isEnabled && (hasFields || isSpecial) && (
                    <button onClick={() => toggleExpanded(sectionKey)} className="text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </CardHeader>

              {isEnabled && isExpanded && (
                <CardContent className="pt-0 pb-4 px-4 space-y-4">
                  {/* Section requirements */}
                  <div className="flex gap-6 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={requirePhotos[sectionKey] || false}
                        onCheckedChange={(v) => setRequirePhotos(prev => ({ ...prev, [sectionKey]: v }))}
                        className="scale-75"
                      />
                      <Camera className="w-3.5 h-3.5" />
                      Require photos
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={requireNotes[sectionKey] || false}
                        onCheckedChange={(v) => setRequireNotes(prev => ({ ...prev, [sectionKey]: v }))}
                        className="scale-75"
                      />
                      <StickyNote className="w-3.5 h-3.5" />
                      Require notes
                    </label>
                  </div>

                  {/* Special sub-toggles for tires */}
                  {sectionKey === "tires" && (
                    <div className="space-y-3">
                      <label className="flex items-center justify-between text-sm">
                        <span>Tire tread depth (32nds)</span>
                        <Switch checked={showTireTread} onCheckedChange={setShowTireTread} />
                      </label>
                      <label className="flex items-center justify-between text-sm">
                        <span>Brake pad measurements (mm)</span>
                        <Switch checked={showBrakePads} onCheckedChange={setShowBrakePads} />
                      </label>

                      {/* Tire Credit/Deduction Policy */}
                      <div className="border-t pt-3 mt-2">
                        <label className="flex items-center justify-between text-sm font-semibold">
                          <span className="flex items-center gap-2">
                            💰 Tire Credit / Deduction Policy
                          </span>
                          <Switch checked={enableTireAdjustments} onCheckedChange={setEnableTireAdjustments} />
                        </label>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Automatically credit or deduct from the offer based on tire tread depth at inspection
                        </p>

                        {enableTireAdjustments && (
                          <div className="mt-3 space-y-3 bg-muted/30 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Credit above (/32)</label>
                                <Input
                                  type="number"
                                  min={1} max={12}
                                  value={tireCreditThreshold}
                                  onChange={e => setTireCreditThreshold(Number(e.target.value))}
                                  className="h-8 text-sm"
                                />
                                <p className="text-[9px] text-muted-foreground mt-0.5">Avg depth ≥ this = credit</p>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Deduct below (/32)</label>
                                <Input
                                  type="number"
                                  min={0} max={12}
                                  value={tireDeductThreshold}
                                  onChange={e => setTireDeductThreshold(Number(e.target.value))}
                                  className="h-8 text-sm"
                                />
                                <p className="text-[9px] text-muted-foreground mt-0.5">Avg depth ≤ this = deduction</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Credit per /32 per tire ($)</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={tireCreditPer32}
                                  onChange={e => setTireCreditPer32(Number(e.target.value))}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Deduct per /32 per tire ($)</label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={tireDeductPer32}
                                  onChange={e => setTireDeductPer32(Number(e.target.value))}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground bg-background rounded p-2 border">
                              <strong>Example:</strong> If avg depth is {tireCreditThreshold + 2}/32 (credit threshold {tireCreditThreshold}), 
                              credit = 2 × ${tireCreditPer32} × 4 tires = <strong className="text-green-600">+${2 * tireCreditPer32 * 4}</strong>.
                              If avg depth is {Math.max(tireDeductThreshold - 1, 0)}/32 (deduct threshold {tireDeductThreshold}),
                              deduction = {Math.max(tireDeductThreshold - Math.max(tireDeductThreshold - 1, 0), 0)} × ${tireDeductPer32} × 4 = <strong className="text-red-600">-${Math.max(tireDeductThreshold - Math.max(tireDeductThreshold - 1, 0), 0) * tireDeductPer32 * 4}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Special sub-toggles for measurements */}
                  {sectionKey === "measurements" && (
                    <div className="space-y-2">
                      <label className="flex items-center justify-between text-sm">
                        <span>Paint meter readings</span>
                        <Switch checked={showPaintReadings} onCheckedChange={setShowPaintReadings} />
                      </label>
                      <label className="flex items-center justify-between text-sm">
                        <span>Oil life %</span>
                        <Switch checked={showOilLife} onCheckedChange={setShowOilLife} />
                      </label>
                      <label className="flex items-center justify-between text-sm">
                        <span>Battery health</span>
                        <Switch checked={showBatteryHealth} onCheckedChange={setShowBatteryHealth} />
                      </label>
                    </div>
                  )}

                  {/* Field toggles grid */}
                  {fields.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist Items</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const updates: Record<string, boolean> = {};
                              fields.forEach(f => { delete updates[f]; });
                              setDisabledFields(prev => {
                                const next = { ...prev };
                                fields.forEach(f => delete next[f]);
                                return next;
                              });
                            }}
                            className="text-[10px] text-accent hover:underline"
                          >Enable All</button>
                          <button
                            onClick={() => {
                              setDisabledFields(prev => {
                                const next = { ...prev };
                                fields.forEach(f => { next[f] = true; });
                                return next;
                              });
                            }}
                            className="text-[10px] text-muted-foreground hover:underline"
                          >Disable All</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                        {fields.map(field => (
                          <label
                            key={field}
                            className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                              disabledFields[field]
                                ? "bg-muted/30 text-muted-foreground line-through"
                                : "bg-card hover:bg-muted/50"
                            }`}
                          >
                            <Switch
                              checked={!disabledFields[field]}
                              onCheckedChange={() => toggleField(field)}
                              className="scale-[0.6]"
                            />
                            {field}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom items for this section */}
                  {customs.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Custom Items</span>
                      <div className="space-y-1">
                        {customs.map((item, i) => {
                          const globalIdx = customItems.indexOf(item);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm bg-accent/10 rounded-md px-3 py-1.5">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="flex-1">{item.label}</span>
                              <button onClick={() => removeCustomItem(globalIdx)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Custom Item */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Custom Checklist Item
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
              <Input
                value={newItemLabel}
                onChange={e => setNewItemLabel(e.target.value)}
                placeholder="e.g. Trailer Hitch, Roof Rack"
                className="h-9 text-sm"
                onKeyDown={e => e.key === "Enter" && addCustomItem()}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Section</label>
              <select
                value={newItemSection}
                onChange={e => setNewItemSection(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(SECTION_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={addCustomItem} disabled={!newItemLabel.trim()} className="h-9">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InspectionConfiguration;
