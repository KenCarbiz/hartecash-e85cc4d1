import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";

interface ComparisonFeature {
  label: string;
  values: (boolean | "partial")[];
}

const VALUE_OPTIONS = [
  { value: "true", label: "✓ Yes" },
  { value: "partial", label: "— Partial" },
  { value: "false", label: "✗ No" },
];

const ComparisonConfig = () => {
  const [columns, setColumns] = useState<string[]>([]);
  const [features, setFeatures] = useState<ComparisonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_config")
      .select("competitor_columns, comparison_features")
      .eq("dealership_id", "default")
      .maybeSingle();

    if (data) {
      setColumns((data as any).competitor_columns || []);
      setFeatures((data as any).comparison_features || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        competitor_columns: columns as any,
        comparison_features: features as any,
        updated_at: new Date().toISOString(),
      })
      .eq("dealership_id", "default");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Comparison table updated." });
    }
    setSaving(false);
  };

  const addColumn = () => {
    setColumns([...columns, "New Competitor"]);
    setFeatures(features.map(f => ({ ...f, values: [...f.values, false] })));
  };

  const removeColumn = (idx: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== idx));
    setFeatures(features.map(f => ({
      ...f,
      values: f.values.filter((_, i) => i !== idx),
    })));
  };

  const updateColumn = (idx: number, name: string) => {
    setColumns(columns.map((c, i) => i === idx ? name : c));
  };

  const addFeature = () => {
    setFeatures([...features, {
      label: "New Feature",
      values: [true, ...columns.map(() => false)],
    }]);
  };

  const removeFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const updateFeatureLabel = (idx: number, label: string) => {
    setFeatures(features.map((f, i) => i === idx ? { ...f, label } : f));
  };

  const updateFeatureValue = (fIdx: number, vIdx: number, raw: string) => {
    const val = raw === "true" ? true : raw === "false" ? false : "partial";
    setFeatures(features.map((f, i) =>
      i === fIdx ? { ...f, values: f.values.map((v, j) => j === vIdx ? val : v) } : f
    ));
  };

  const serializeValue = (v: boolean | string) =>
    v === true ? "true" : v === "partial" ? "partial" : "false";

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...features];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setFeatures(updated);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading comparison config...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-card-foreground">Competitor Comparison Table</h3>
          <p className="text-xs text-muted-foreground">Configure the comparison table on your landing page. The first value column is always your dealership.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save Changes
        </Button>
      </div>

      {/* Competitor column names */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Competitor Columns</Label>
        <p className="text-xs text-muted-foreground mb-2">Your dealership is always the first column. Add competitors to compare against.</p>
        <div className="flex flex-wrap gap-2">
          {columns.map((col, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={col}
                onChange={e => updateColumn(i, e.target.value)}
                className="w-36 h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeColumn(i)}
                disabled={columns.length <= 1}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addColumn} className="h-8">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Feature rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Feature Rows</Label>
          <Button variant="outline" size="sm" onClick={addFeature} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
        </div>

        {/* Header */}
        <div className="grid gap-2 items-center text-xs font-semibold text-muted-foreground"
          style={{ gridTemplateColumns: `24px 1fr repeat(${columns.length + 1}, 90px) 32px` }}>
          <span />
          <span>Feature</span>
          <span className="text-center text-accent">You</span>
          {columns.map((col, i) => (
            <span key={i} className="text-center truncate">{col}</span>
          ))}
          <span />
        </div>

        {features.map((f, fIdx) => (
          <div
            key={fIdx}
            draggable
            onDragStart={() => handleDragStart(fIdx)}
            onDragOver={(e) => handleDragOver(e, fIdx)}
            onDrop={() => handleDrop(fIdx)}
            onDragEnd={handleDragEnd}
            className={`grid gap-2 items-center bg-card border rounded-lg px-2 py-1.5 transition-all ${
              dragIdx === fIdx ? "opacity-40 border-accent" : dragOverIdx === fIdx ? "border-accent border-2 shadow-md" : "border-border"
            }`}
            style={{ gridTemplateColumns: `24px 1fr repeat(${columns.length + 1}, 90px) 32px` }}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
            <Input
              value={f.label}
              onChange={e => updateFeatureLabel(fIdx, e.target.value)}
              className="h-7 text-xs"
            />
            {/* Your dealership value (index 0) */}
            <Select value={serializeValue(f.values[0])} onValueChange={v => updateFeatureValue(fIdx, 0, v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALUE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Competitor values */}
            {columns.map((_, cIdx) => (
              <Select key={cIdx} value={serializeValue(f.values[cIdx + 1] ?? false)} onValueChange={v => updateFeatureValue(fIdx, cIdx + 1, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => removeFeature(fIdx)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComparisonConfig;
