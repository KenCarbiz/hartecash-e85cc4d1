import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Printer, Camera, AlertTriangle, CheckCircle, Car, Gauge, Wrench,
  Save, Smartphone, Eye, Zap, Paintbrush, Armchair, Shield, ThermometerSun,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import PortalSkeleton from "@/components/PortalSkeleton";
import VehicleImage from "@/components/sell-form/VehicleImage";
import { useToast } from "@/hooks/use-toast";

// ── Types ──
interface DamageItem {
  type: string;
  location: string;
  severity: "minor" | "moderate" | "severe";
  description: string;
}

interface DamageReport {
  id: string;
  photo_category: string;
  damage_detected: boolean;
  damage_items: DamageItem[];
  overall_severity: string;
  confidence_score: number;
  suggested_condition: string | null;
}

type ConditionGrade = "" | "good" | "fair" | "poor" | "damaged";

const GRADE_CYCLE: ConditionGrade[] = ["", "good", "fair", "poor", "damaged"];

const gradeStyle = (g: ConditionGrade) => {
  switch (g) {
    case "good": return "bg-emerald-500/15 text-emerald-700 border-emerald-400 ring-emerald-400/30";
    case "fair": return "bg-amber-500/15 text-amber-700 border-amber-400 ring-amber-400/30";
    case "poor": return "bg-orange-500/15 text-orange-700 border-orange-400 ring-orange-400/30";
    case "damaged": return "bg-red-500/15 text-red-700 border-red-400 ring-red-400/30";
    default: return "bg-muted/50 text-muted-foreground border-border";
  }
};

const gradeIcon = (g: ConditionGrade) => {
  switch (g) {
    case "good": return "✓";
    case "fair": return "~";
    case "poor": return "✗";
    case "damaged": return "⚠";
    default: return "○";
  }
};

const gradeLabel = (g: ConditionGrade) => g || "Not Checked";

// ── Checklist definitions ──
const EXTERIOR_ITEMS = [
  "Hood", "Front Bumper", "Rear Bumper", "Roof", "Trunk/Liftgate",
  "Left Front Fender", "Right Front Fender", "Left Rear Quarter", "Right Rear Quarter",
  "Left Front Door", "Right Front Door", "Left Rear Door", "Right Rear Door",
  "Windshield", "Rear Glass", "Left Mirror", "Right Mirror",
  "Left Headlight", "Right Headlight", "Left Taillight", "Right Taillight",
  "Grille", "Wheels/Rims", "Undercarriage",
];

const INTERIOR_ITEMS = [
  "Driver Seat", "Passenger Seat", "Rear Seats", "Headliner",
  "Dashboard", "Center Console", "Steering Wheel", "Carpet/Floor Mats",
  "Door Panels", "Instrument Cluster", "Glove Box", "Trunk Interior",
  "Seat Belts", "Sun Visors", "Rearview Mirror",
];

const MECHANICAL_ITEMS = [
  "Engine Start/Idle", "Engine Noise", "Oil Leaks", "Coolant Leaks",
  "Transmission Shift", "Differential", "Exhaust System",
  "Power Steering", "CV Joints/Boots", "Drive Belts",
  "Shocks/Struts", "Ball Joints", "Tie Rods", "Wheel Bearings",
  "Brake Rotors", "Brake Lines", "Parking Brake",
];

const ELECTRICAL_ITEMS = [
  "A/C System", "Heater", "Power Windows", "Power Locks", "Power Mirrors",
  "Radio/Infotainment", "Speakers", "Backup Camera", "Navigation",
  "Sunroof/Moonroof", "Keyless Entry", "Remote Start",
  "Headlights", "Turn Signals", "Brake Lights", "Interior Lights",
  "Horn", "Wipers", "Defroster", "Charging Ports/USB",
];

const GLASS_LIGHTS_ITEMS = [
  "Windshield Chips/Cracks", "Side Windows", "Rear Window",
  "Headlight Clarity", "Taillight Clarity", "Fog Lights",
];

const severityColor = (s: string) => {
  if (s === "severe") return "bg-red-100 text-red-800 border-red-300";
  if (s === "moderate") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-green-100 text-green-800 border-green-300";
};

const severityBadge = (s: string) => {
  if (s === "severe") return "destructive" as const;
  if (s === "moderate") return "outline" as const;
  return "secondary" as const;
};

// ── Clickable Condition Item ──
const ConditionItem = ({
  label,
  grade,
  onCycle,
  note,
  onNoteChange,
}: {
  label: string;
  grade: ConditionGrade;
  onCycle: () => void;
  note: string;
  onNoteChange: (v: string) => void;
}) => {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onCycle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer select-none hover:ring-2 ${gradeStyle(grade)}`}
      >
        <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ borderColor: "currentColor" }}>
          {gradeIcon(grade)}
        </span>
        <span className="flex-1 text-left">{label}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-60">{gradeLabel(grade)}</span>
        {(grade === "poor" || grade === "damaged") && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowNote(!showNote); }}
            className="text-[10px] underline opacity-70 hover:opacity-100"
          >
            {showNote ? "hide" : "+ note"}
          </button>
        )}
      </button>
      {showNote && (grade === "poor" || grade === "damaged") && (
        <Input
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          placeholder={`Details for ${label}...`}
          className="h-7 text-xs ml-7"
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  );
};

// ── Section with summary badges ──
const ChecklistSection = ({
  icon: Icon,
  title,
  items,
  grades,
  notes,
  onCycle,
  onNoteChange,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
  grades: Record<string, ConditionGrade>;
  notes: Record<string, string>;
  onCycle: (item: string) => void;
  onNoteChange: (item: string, v: string) => void;
}) => {
  const checked = items.filter(i => grades[i] && grades[i] !== "");
  const issues = items.filter(i => grades[i] === "poor" || grades[i] === "damaged");

  return (
    <Card className="print:shadow-none print:border-foreground/30 break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {title}
          <div className="ml-auto flex gap-1.5 text-xs">
            <Badge variant="secondary" className="text-[10px]">{checked.length}/{items.length} checked</Badge>
            {issues.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{issues.length} issue{issues.length > 1 ? "s" : ""}</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {items.map(item => (
            <ConditionItem
              key={item}
              label={item}
              grade={grades[item] || ""}
              onCycle={() => onCycle(item)}
              note={notes[item] || ""}
              onNoteChange={v => onNoteChange(item, v)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Grade Legend ──
const GradeLegend = () => (
  <div className="flex flex-wrap gap-3 text-xs print:text-[10px]">
    {(["good", "fair", "poor", "damaged"] as ConditionGrade[]).map(g => (
      <div key={g} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${gradeStyle(g)}`}>
        <span className="font-bold">{gradeIcon(g)}</span>
        <span className="capitalize font-medium">{g}</span>
      </div>
    ))}
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground border-border">
      <span className="font-bold">○</span>
      <span className="font-medium">Not Checked</span>
    </div>
  </div>
);

// ── Main Component ──
const InspectionSheet = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const printRef = useRef<HTMLDivElement>(null);

  const [submission, setSubmission] = useState<any>(null);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tire & brake
  const [tireDepth, setTireDepth] = useState({ lf: "", rf: "", lr: "", rr: "" });
  const [brakeDepth, setBrakeDepth] = useState({ lf: "", rf: "", lr: "", rr: "" });

  // Mechanical fields
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [overallGrade, setOverallGrade] = useState("");

  // Clickable condition grades
  const [exteriorGrades, setExteriorGrades] = useState<Record<string, ConditionGrade>>({});
  const [interiorGrades, setInteriorGrades] = useState<Record<string, ConditionGrade>>({});
  const [mechanicalGrades, setMechanicalGrades] = useState<Record<string, ConditionGrade>>({});
  const [electricalGrades, setElectricalGrades] = useState<Record<string, ConditionGrade>>({});
  const [glassGrades, setGlassGrades] = useState<Record<string, ConditionGrade>>({});

  // Notes for items marked poor/damaged
  const [exteriorNotes, setExteriorNotes] = useState<Record<string, string>>({});
  const [interiorNotes, setInteriorNotes] = useState<Record<string, string>>({});
  const [mechanicalNotes, setMechanicalNotes] = useState<Record<string, string>>({});
  const [electricalNotes, setElectricalNotes] = useState<Record<string, string>>({});
  const [glassNotes, setGlassNotes] = useState<Record<string, string>>({});

  const cycleGrade = (setter: React.Dispatch<React.SetStateAction<Record<string, ConditionGrade>>>) =>
    (item: string) => {
      setter(prev => {
        const cur = prev[item] || "";
        const idx = GRADE_CYCLE.indexOf(cur);
        const next = GRADE_CYCLE[(idx + 1) % GRADE_CYCLE.length];
        return { ...prev, [item]: next };
      });
    };

  const setNote = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>) =>
    (item: string, v: string) => {
      setter(prev => ({ ...prev, [item]: v }));
    };

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const [subRes, dmgRes] = await Promise.all([
        supabase.from("submissions").select("*").eq("id", id).maybeSingle(),
        supabase.from("damage_reports").select("*").eq("submission_id", id).order("created_at"),
      ]);
      if (subRes.data) {
        setSubmission(subRes.data);
        setOverallGrade(subRes.data.overall_condition || "");
      }
      if (dmgRes.data) setDamageReports(dmgRes.data as unknown as DamageReport[]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);

    // Gather all checklist data into a structured note
    const gatherSection = (title: string, items: string[], grades: Record<string, ConditionGrade>, notes: Record<string, string>) => {
      const entries = items
        .filter(i => grades[i] && grades[i] !== "")
        .map(i => `  ${i}: ${(grades[i] || "").toUpperCase()}${notes[i] ? ` — ${notes[i]}` : ""}`);
      return entries.length > 0 ? `[${title}]\n${entries.join("\n")}` : "";
    };

    const sections = [
      `[INSPECTION ${new Date().toLocaleString()}]`,
      `Tires (tread /32): LF:${tireDepth.lf} RF:${tireDepth.rf} LR:${tireDepth.lr} RR:${tireDepth.rr}`,
      `Brakes (mm): LF:${brakeDepth.lf} RF:${brakeDepth.rf} LR:${brakeDepth.lr} RR:${brakeDepth.rr}`,
      paintReading && `Paint: ${paintReading}`,
      oilLife && `Oil: ${oilLife}`,
      batteryHealth && `Battery: ${batteryHealth}`,
      gatherSection("EXTERIOR", EXTERIOR_ITEMS, exteriorGrades, exteriorNotes),
      gatherSection("INTERIOR", INTERIOR_ITEMS, interiorGrades, interiorNotes),
      gatherSection("MECHANICAL", MECHANICAL_ITEMS, mechanicalGrades, mechanicalNotes),
      gatherSection("ELECTRICAL", ELECTRICAL_ITEMS, electricalGrades, electricalNotes),
      gatherSection("GLASS & LIGHTS", GLASS_LIGHTS_ITEMS, glassGrades, glassNotes),
      overallGrade && `Grade: ${overallGrade}`,
      inspectorNotes && `Notes: ${inspectorNotes}`,
    ].filter(Boolean).join("\n\n");

    const { error } = await supabase.from("submissions").update({
      internal_notes: sections,
      overall_condition: overallGrade || undefined,
    }).eq("id", id!);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Inspection saved", description: "All condition data synced to the submission." });
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <PortalSkeleton />;
  if (!submission) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Submission not found.</p>
    </div>
  );

  const allDamageItems = damageReports.flatMap(r => r.damage_items || []);
  const severeCount = allDamageItems.filter(d => d.severity === "severe").length;
  const moderateCount = allDamageItems.filter(d => d.severity === "moderate").length;
  const minorCount = allDamageItems.filter(d => d.severity === "minor").length;
  const vehicleTitle = `${submission.vehicle_year || ""} ${submission.vehicle_make || ""} ${submission.vehicle_model || ""}`.trim();

  // Overall completion stats
  const allItems = [...EXTERIOR_ITEMS, ...INTERIOR_ITEMS, ...MECHANICAL_ITEMS, ...ELECTRICAL_ITEMS, ...GLASS_LIGHTS_ITEMS];
  const allGrades = { ...exteriorGrades, ...interiorGrades, ...mechanicalGrades, ...electricalGrades, ...glassGrades };
  const totalChecked = allItems.filter(i => allGrades[i] && allGrades[i] !== "").length;
  const totalIssues = allItems.filter(i => allGrades[i] === "poor" || allGrades[i] === "damaged").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="print:hidden sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Vehicle Inspection</h1>
              <p className="text-xs opacity-80">{vehicleTitle} • VIN: {submission.vin || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 mr-4 text-xs">
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-0 text-[10px]">
                {totalChecked}/{allItems.length} checked
              </Badge>
              {totalIssues > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {totalIssues} issue{totalIssues > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <Link to={`/inspect/${id}`}>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 gap-1">
                <Smartphone className="h-4 w-4" /> Mobile
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handlePrint} className="text-primary-foreground hover:bg-primary-foreground/20 gap-1">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block border-b-2 border-foreground pb-4 mb-6 max-w-none px-4 pt-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{config?.dealership_name || "Dealership"}</h1>
            <p className="text-sm text-muted-foreground">Vehicle Inspection Report</p>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-right text-sm">
              <p className="font-semibold">Date: {new Date().toLocaleDateString()}</p>
              <p>Inspector: ____________________</p>
              <p className="text-[10px] text-muted-foreground mt-1">Scan to fill digitally →</p>
            </div>
            <div className="border border-foreground/20 rounded p-1">
              <QRCodeSVG value={`${window.location.origin}/inspect/${id}`} size={64} level="M" />
            </div>
          </div>
        </div>
      </div>

      <div ref={printRef} className="max-w-5xl mx-auto p-4 md:p-6 print:p-4 print:max-w-none space-y-4">
        {/* Grade Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Click items to cycle condition:</p>
          <GradeLegend />
        </div>

        {/* Vehicle Summary - compact */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-14 rounded overflow-hidden bg-muted flex-shrink-0">
                <VehicleImage year={submission.vehicle_year} make={submission.vehicle_make} model={submission.vehicle_model} selectedColor={submission.exterior_color || "white"} />
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <InfoCell label="Vehicle" value={vehicleTitle} />
                <InfoCell label="VIN" value={submission.vin || "N/A"} />
                <InfoCell label="Mileage" value={submission.mileage ? `${Number(submission.mileage).toLocaleString()} mi` : "N/A"} />
                <InfoCell label="Color" value={submission.exterior_color || "N/A"} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer-Reported Issues - compact */}
        {(submission.exterior_damage?.length || submission.interior_damage?.length || submission.mechanical_issues?.length || submission.engine_issues?.length) && (
          <Card className="print:shadow-none print:border-foreground/30 border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Customer-Reported Issues
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...(submission.exterior_damage || []).map((d: string) => ({ label: d, type: "ext" })),
                  ...(submission.interior_damage || []).map((d: string) => ({ label: d, type: "int" })),
                  ...(submission.mechanical_issues || []).map((d: string) => ({ label: d, type: "mech" })),
                  ...(submission.engine_issues || []).map((d: string) => ({ label: d, type: "eng" })),
                  ...(submission.tech_issues || []).map((d: string) => ({ label: d, type: "tech" })),
                ].map((item, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] capitalize border-amber-300 text-amber-700">
                    {item.label.replace(/_/g, " ")}
                  </Badge>
                ))}
                {submission.smoked_in === "yes" && <Badge variant="destructive" className="text-[10px]">Smoked In</Badge>}
                {submission.drivable === "no" && <Badge variant="destructive" className="text-[10px]">Not Drivable</Badge>}
                {submission.accidents && submission.accidents !== "none" && (
                  <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">Accidents: {submission.accidents}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Damage Detection */}
        {damageReports.length > 0 && allDamageItems.length > 0 && (
          <Card className="print:shadow-none print:border-foreground/30 border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4 text-blue-500" />
                AI Photo Analysis
                <div className="ml-auto flex gap-1.5">
                  {severeCount > 0 && <Badge variant="destructive" className="text-[10px]">{severeCount} Severe</Badge>}
                  {moderateCount > 0 && <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">{moderateCount} Moderate</Badge>}
                  {minorCount > 0 && <Badge variant="secondary" className="text-[10px]">{minorCount} Minor</Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid gap-1">
                {allDamageItems.map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-1.5 rounded border text-xs ${severityColor(item.severity)}`}>
                    <Badge variant={severityBadge(item.severity)} className="text-[10px] capitalize w-16 justify-center">{item.severity}</Badge>
                    <span className="font-medium capitalize">{item.type.replace(/_/g, " ")}</span>
                    <span className="capitalize text-muted-foreground">{item.location.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-[10px] opacity-70 hidden md:inline">{item.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Clickable Condition Checklists ── */}
        <ChecklistSection
          icon={Paintbrush}
          title="Exterior Condition"
          items={EXTERIOR_ITEMS}
          grades={exteriorGrades}
          notes={exteriorNotes}
          onCycle={cycleGrade(setExteriorGrades)}
          onNoteChange={setNote(setExteriorNotes)}
        />

        <ChecklistSection
          icon={Armchair}
          title="Interior Condition"
          items={INTERIOR_ITEMS}
          grades={interiorGrades}
          notes={interiorNotes}
          onCycle={cycleGrade(setInteriorGrades)}
          onNoteChange={setNote(setInteriorNotes)}
        />

        <ChecklistSection
          icon={Wrench}
          title="Mechanical Systems"
          items={MECHANICAL_ITEMS}
          grades={mechanicalGrades}
          notes={mechanicalNotes}
          onCycle={cycleGrade(setMechanicalGrades)}
          onNoteChange={setNote(setMechanicalNotes)}
        />

        <ChecklistSection
          icon={Zap}
          title="Electrical & Technology"
          items={ELECTRICAL_ITEMS}
          grades={electricalGrades}
          notes={electricalNotes}
          onCycle={cycleGrade(setElectricalGrades)}
          onNoteChange={setNote(setElectricalNotes)}
        />

        <ChecklistSection
          icon={Eye}
          title="Glass & Lights"
          items={GLASS_LIGHTS_ITEMS}
          grades={glassGrades}
          notes={glassNotes}
          onCycle={cycleGrade(setGlassGrades)}
          onNoteChange={setNote(setGlassNotes)}
        />

        {/* ── Tire & Brake Diagram ── */}
        <Card className="print:shadow-none print:border-foreground/30 break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5 text-primary" />
              Tire Tread & Brake Pads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative w-[320px] h-[520px]">
                <svg viewBox="0 0 320 520" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M100 60 Q100 30 160 25 Q220 30 220 60 L225 140 Q230 160 230 180 L230 340 Q230 360 225 380 L220 460 Q220 490 160 495 Q100 490 100 460 L95 380 Q90 360 90 340 L90 180 Q90 160 95 140 Z" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <path d="M115 80 Q115 65 160 62 Q205 65 205 80 L200 130 Q160 135 120 130 Z" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                  <path d="M120 390 Q160 385 200 390 L205 430 Q205 445 160 448 Q115 445 115 430 Z" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                  <line x1="160" y1="62" x2="160" y2="448" stroke="hsl(var(--foreground))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                  <ellipse cx="120" cy="48" rx="12" ry="8" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="200" cy="48" rx="12" ry="8" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="120" cy="472" rx="10" ry="6" fill="hsl(var(--destructive) / 0.3)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="200" cy="472" rx="10" ry="6" fill="hsl(var(--destructive) / 0.3)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="78" cy="110" rx="8" ry="5" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="242" cy="110" rx="8" ry="5" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <rect x="60" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <rect x="232" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <rect x="60" y="365" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <rect x="232" y="365" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  {[100, 110, 120, 130, 140].map(y => (
                    <g key={`tread-f-${y}`}>
                      <line x1="66" y1={y} x2="82" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                      <line x1="238" y1={y} x2="254" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                    </g>
                  ))}
                  {[370, 380, 390, 400, 410].map(y => (
                    <g key={`tread-r-${y}`}>
                      <line x1="66" y1={y} x2="82" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                      <line x1="238" y1={y} x2="254" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                    </g>
                  ))}
                  <circle cx="74" cy="122" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="246" cy="122" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="74" cy="392" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="246" cy="392" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <text x="160" y="18" textAnchor="middle" className="fill-foreground text-[11px] font-bold">FRONT</text>
                  <text x="160" y="512" textAnchor="middle" className="fill-foreground text-[11px] font-bold">REAR</text>
                </svg>

                {/* LF */}
                <div className="absolute left-[-8px] top-[68px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LF Tread</label>
                  <Input value={tireDepth.lf} onChange={e => setTireDepth(p => ({ ...p, lf: e.target.value }))} placeholder="/32" className="h-7 text-xs px-1.5 text-center" />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">LF Brake</label>
                  <Input value={brakeDepth.lf} onChange={e => setBrakeDepth(p => ({ ...p, lf: e.target.value }))} placeholder="mm" className="h-7 text-xs px-1.5 text-center" />
                </div>
                {/* RF */}
                <div className="absolute right-[-8px] top-[68px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">RF Tread</label>
                  <Input value={tireDepth.rf} onChange={e => setTireDepth(p => ({ ...p, rf: e.target.value }))} placeholder="/32" className="h-7 text-xs px-1.5 text-center" />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">RF Brake</label>
                  <Input value={brakeDepth.rf} onChange={e => setBrakeDepth(p => ({ ...p, rf: e.target.value }))} placeholder="mm" className="h-7 text-xs px-1.5 text-center" />
                </div>
                {/* LR */}
                <div className="absolute left-[-8px] top-[342px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LR Tread</label>
                  <Input value={tireDepth.lr} onChange={e => setTireDepth(p => ({ ...p, lr: e.target.value }))} placeholder="/32" className="h-7 text-xs px-1.5 text-center" />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">LR Brake</label>
                  <Input value={brakeDepth.lr} onChange={e => setBrakeDepth(p => ({ ...p, lr: e.target.value }))} placeholder="mm" className="h-7 text-xs px-1.5 text-center" />
                </div>
                {/* RR */}
                <div className="absolute right-[-8px] top-[342px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">RR Tread</label>
                  <Input value={tireDepth.rr} onChange={e => setTireDepth(p => ({ ...p, rr: e.target.value }))} placeholder="/32" className="h-7 text-xs px-1.5 text-center" />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">RR Brake</label>
                  <Input value={brakeDepth.rr} onChange={e => setBrakeDepth(p => ({ ...p, rr: e.target.value }))} placeholder="mm" className="h-7 text-xs px-1.5 text-center" />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <TreadGuide label="New" range="10-11/32" color="bg-green-500" />
              <TreadGuide label="Good" range="6-9/32" color="bg-emerald-400" />
              <TreadGuide label="Fair" range="4-5/32" color="bg-amber-400" />
              <TreadGuide label="Replace" range="≤3/32" color="bg-red-500" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Measurements */}
        <Card className="print:shadow-none print:border-foreground/30 break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ThermometerSun className="h-5 w-5 text-primary" />
              Quick Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InspectionField label="Paint Meter (mil)" value={paintReading} onChange={setPaintReading} placeholder="e.g. 4.2 avg" />
              <InspectionField label="Oil Life %" value={oilLife} onChange={setOilLife} placeholder="e.g. 65%" />
              <InspectionField label="Battery Health" value={batteryHealth} onChange={setBatteryHealth} placeholder="e.g. Good — 12.6V" />
            </div>
          </CardContent>
        </Card>

        {/* Final Assessment */}
        <Card className="print:shadow-none print:border-foreground/30 border-primary/30 break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Final Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
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
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">AI Suggested</label>
                  <div className="h-10 flex items-center">
                    <Badge variant="outline" className="capitalize text-sm">{submission.ai_condition_score}</Badge>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Inspector Notes</label>
              <Textarea value={inspectorNotes} onChange={e => setInspectorNotes(e.target.value)} placeholder="Additional notes, concerns, recommendations..." className="text-sm min-h-[100px]" />
            </div>

            {/* Print signature */}
            <div className="hidden print:block mt-10 pt-6 border-t">
              <div className="grid grid-cols-2 gap-12">
                <div>
                  <div className="border-b border-foreground w-full mb-1" />
                  <p className="text-xs">Inspector Signature</p>
                </div>
                <div>
                  <div className="border-b border-foreground w-full mb-1" />
                  <p className="text-xs">Date</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Save Bar */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalChecked}</span>/{allItems.length} items checked
            {totalIssues > 0 && <span className="ml-2 text-destructive font-medium">• {totalIssues} issue{totalIssues > 1 ? "s" : ""}</span>}
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
            {saving ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Inspection"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──
const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</p>
    <p className="font-medium text-sm">{value}</p>
  </div>
);

const InspectionField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
  </div>
);

const TreadGuide = ({ label, range, color }: { label: string; range: string; color: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-4 h-4 rounded-full ${color}`} />
    <span className="font-semibold">{label}</span>
    <span className="text-muted-foreground">{range}</span>
  </div>
);

export default InspectionSheet;
