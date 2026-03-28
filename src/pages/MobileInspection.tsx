import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, CheckCircle, Gauge, Wrench, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface DamageItem {
  type: string;
  location: string;
  severity: "minor" | "moderate" | "severe";
  description: string;
}

const severityColor = (s: string) => {
  if (s === "severe") return "bg-red-100 text-red-800 border-red-300";
  if (s === "moderate") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-green-100 text-green-800 border-green-300";
};

const MobileInspection = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [submission, setSubmission] = useState<any>(null);
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [tireLF, setTireLF] = useState("");
  const [tireRF, setTireRF] = useState("");
  const [tireLR, setTireLR] = useState("");
  const [tireRR, setTireRR] = useState("");
  const [brakeLF, setBrakeLF] = useState("");
  const [brakeRF, setBrakeRF] = useState("");
  const [brakeLR, setBrakeLR] = useState("");
  const [brakeRR, setBrakeRR] = useState("");
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [acNotes, setAcNotes] = useState("");
  const [engineNotes, setEngineNotes] = useState("");
  const [transmissionNotes, setTransmissionNotes] = useState("");
  const [suspensionNotes, setSuspensionNotes] = useState("");
  const [overallGrade, setOverallGrade] = useState("");
  const [inspectorNotes, setInspectorNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const [subRes, dmgRes] = await Promise.all([
        supabase.rpc("get_inspection_data", { _submission_id: id }),
        supabase.rpc("get_inspection_damage", { _submission_id: id }),
      ]);
      if (subRes.data && (subRes.data as any[]).length > 0) {
        const sub = (subRes.data as any[])[0];
        setSubmission(sub);
        setOverallGrade(sub.overall_condition || "");
      }
      if (dmgRes.data) {
        const items = (dmgRes.data as any[]).flatMap((r: any) => {
          const di = r.damage_items;
          return Array.isArray(di) ? di : [];
        });
        setDamageItems(items);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    // For now we save inspector notes to the submission's internal_notes
    const notes = [
      `[INSPECTION ${new Date().toLocaleString()}]`,
      `Tires (tread /32): LF:${tireLF} RF:${tireRF} LR:${tireLR} RR:${tireRR}`,
      `Brakes (mm): LF:${brakeLF} RF:${brakeRF} LR:${brakeLR} RR:${brakeRR}`,
      paintReading && `Paint: ${paintReading}`,
      oilLife && `Oil: ${oilLife}`,
      batteryHealth && `Battery: ${batteryHealth}`,
      acNotes && `A/C: ${acNotes}`,
      engineNotes && `Engine: ${engineNotes}`,
      transmissionNotes && `Trans: ${transmissionNotes}`,
      suspensionNotes && `Suspension: ${suspensionNotes}`,
      overallGrade && `Grade: ${overallGrade}`,
      inspectorNotes && `Notes: ${inspectorNotes}`,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.rpc("save_mobile_inspection", {
      _submission_id: id!,
      _internal_notes: notes,
      _overall_condition: overallGrade || null,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Inspection saved", description: "Data synced to the submission record." });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading inspection...</div>
    </div>
  );

  if (!submission) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Submission not found.</p>
    </div>
  );

  const vehicleTitle = `${submission.vehicle_year || ""} ${submission.vehicle_make || ""} ${submission.vehicle_model || ""}`.trim();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            <div>
              <p className="font-bold text-sm leading-tight">{vehicleTitle}</p>
              <p className="text-[10px] opacity-70">VIN: {submission.vin || "N/A"} • {submission.mileage ? `${Number(submission.mileage).toLocaleString()} mi` : ""}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* AI Damage Summary */}
        {damageItems.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                🤖 AI Damage Findings
                <Badge variant="outline" className="text-[10px]">{damageItems.length} issues</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                {damageItems.map((item, i) => (
                  <div key={i} className={`text-xs p-2 rounded border ${severityColor(item.severity)}`}>
                    <span className="font-semibold capitalize">{item.type.replace(/_/g, " ")}</span>
                    <span className="mx-1">·</span>
                    <span className="capitalize">{item.location.replace(/_/g, " ")}</span>
                    <span className="mx-1">·</span>
                    <span className="capitalize font-medium">{item.severity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tire Tread Depth */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Tire Tread Depth (/32")
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Left Front" value={tireLF} onChange={setTireLF} placeholder="/32" />
              <MobileField label="Right Front" value={tireRF} onChange={setTireRF} placeholder="/32" />
              <MobileField label="Left Rear" value={tireLR} onChange={setTireLR} placeholder="/32" />
              <MobileField label="Right Rear" value={tireRR} onChange={setTireRR} placeholder="/32" />
            </div>
            <div className="flex justify-between mt-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> New 10-11</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Good 6-9</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Fair 4-5</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Replace ≤3</span>
            </div>
          </CardContent>
        </Card>

        {/* Brake Pad Thickness */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Brake Pad Thickness (mm)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Left Front" value={brakeLF} onChange={setBrakeLF} placeholder="mm" />
              <MobileField label="Right Front" value={brakeRF} onChange={setBrakeRF} placeholder="mm" />
              <MobileField label="Left Rear" value={brakeLR} onChange={setBrakeLR} placeholder="mm" />
              <MobileField label="Right Rear" value={brakeRR} onChange={setBrakeRR} placeholder="mm" />
            </div>
          </CardContent>
        </Card>

        {/* Mechanical Quick Checks */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> Mechanical Checks
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <MobileField label="Paint Meter (mil)" value={paintReading} onChange={setPaintReading} placeholder="e.g. 4.2 avg" />
            <MobileField label="Oil Life %" value={oilLife} onChange={setOilLife} placeholder="e.g. 65%" />
            <MobileField label="Battery" value={batteryHealth} onChange={setBatteryHealth} placeholder="e.g. Good — 12.6V" />
            <MobileField label="A/C" value={acNotes} onChange={setAcNotes} placeholder="e.g. Blowing cold" />
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Engine</label>
              <Textarea value={engineNotes} onChange={e => setEngineNotes(e.target.value)} placeholder="Start quality, leaks, smoke..." className="text-sm min-h-[50px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Transmission</label>
              <Textarea value={transmissionNotes} onChange={e => setTransmissionNotes(e.target.value)} placeholder="Shift quality, noises..." className="text-sm min-h-[50px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Suspension / Steering</label>
              <Textarea value={suspensionNotes} onChange={e => setSuspensionNotes(e.target.value)} placeholder="Play, struts, bushings..." className="text-sm min-h-[50px]" />
            </div>
          </CardContent>
        </Card>

        {/* Final Grade */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" /> Final Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Overall Grade</label>
              <select
                value={overallGrade}
                onChange={e => setOverallGrade(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select...</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="rough">Rough</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            {submission.ai_condition_score && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">AI suggests:</span>
                <Badge variant="outline" className="capitalize">{submission.ai_condition_score}</Badge>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Inspector Notes</label>
              <Textarea value={inspectorNotes} onChange={e => setInspectorNotes(e.target.value)} placeholder="Additional notes..." className="text-sm min-h-[80px]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base gap-2">
          {saving ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saving ? "Saving..." : "Save Inspection"}
        </Button>
      </div>
    </div>
  );
};

const MobileField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-10" inputMode="text" />
  </div>
);

export default MobileInspection;
