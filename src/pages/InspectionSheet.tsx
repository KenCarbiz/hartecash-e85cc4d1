import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer, Camera, AlertTriangle, CheckCircle, Car, Gauge, Wrench, Droplets, Save, Smartphone } from "lucide-react";
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

interface TireData {
  lf: string; rf: string; lr: string; rr: string;
}

interface BrakeData {
  lf: string; rf: string; lr: string; rr: string;
}

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

const InspectionSheet = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { config } = useSiteConfig();
  const printRef = useRef<HTMLDivElement>(null);

  const [submission, setSubmission] = useState<any>(null);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable inspection fields
  const [tireDepth, setTireDepth] = useState<TireData>({ lf: "", rf: "", lr: "", rr: "" });
  const [brakeDepth, setBrakeDepth] = useState<BrakeData>({ lf: "", rf: "", lr: "", rr: "" });
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [engineNotes, setEngineNotes] = useState("");
  const [transmissionNotes, setTransmissionNotes] = useState("");
  const [suspensionNotes, setSuspensionNotes] = useState("");
  const [acNotes, setAcNotes] = useState("");
  const [overallGrade, setOverallGrade] = useState("");

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <div className="print:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">Vehicle Inspection Sheet</h1>
            <p className="text-sm text-muted-foreground">{vehicleTitle}</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div ref={printRef} className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none space-y-6">
        {/* Print Header */}
        <div className="hidden print:block border-b-2 border-foreground pb-4 mb-6">
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
                <QRCodeSVG
                  value={`${window.location.origin}/inspect/${id}`}
                  size={64}
                  level="M"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 1: Vehicle Summary ── */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-5 w-5 text-primary" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-3 col-span-2 md:col-span-4">
                <div className="w-24 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  <VehicleImage
                    year={submission.vehicle_year}
                    make={submission.vehicle_make}
                    model={submission.vehicle_model}
                    selectedColor={submission.exterior_color || "white"}
                  />
                </div>
                <div>
                  <p className="font-bold text-lg">{vehicleTitle}</p>
                  <p className="text-muted-foreground">VIN: {submission.vin || "N/A"}</p>
                </div>
              </div>
              <InfoCell label="Mileage" value={submission.mileage ? `${Number(submission.mileage).toLocaleString()} mi` : "N/A"} />
              <InfoCell label="Color" value={submission.exterior_color || "N/A"} />
              <InfoCell label="Drivetrain" value={submission.drivetrain || submission.bb_drivetrain || "N/A"} />
              <InfoCell label="Transmission" value={submission.bb_transmission || "N/A"} />
              <InfoCell label="Engine" value={submission.bb_engine || "N/A"} />
              <InfoCell label="Fuel Type" value={submission.bb_fuel_type || "N/A"} />
              <InfoCell label="Plate" value={submission.plate ? `${submission.plate} (${submission.state || ""})` : "N/A"} />
              <InfoCell label="Customer Condition" value={submission.overall_condition || "N/A"} />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Customer-Reported Issues ── */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Customer-Reported Condition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReportedList label="Exterior Damage" items={submission.exterior_damage} />
              <ReportedList label="Interior Damage" items={submission.interior_damage} />
              <ReportedList label="Mechanical Issues" items={submission.mechanical_issues} />
              <ReportedList label="Engine Issues" items={submission.engine_issues} />
              <ReportedList label="Tech Issues" items={submission.tech_issues} />
              <div>
                <p className="font-medium text-muted-foreground mb-1">Other</p>
                <ul className="space-y-0.5 text-xs">
                  {submission.windshield_damage && <li>Windshield: {submission.windshield_damage}</li>}
                  {submission.moonroof && <li>Moonroof: {submission.moonroof}</li>}
                  {submission.accidents && <li>Accidents: {submission.accidents}</li>}
                  {submission.smoked_in === "yes" && <li className="text-amber-600">Smoked In</li>}
                  {submission.drivable === "no" && <li className="text-red-600 font-semibold">Not Drivable</li>}
                  {submission.tires_replaced && <li>Tires Replaced: {submission.tires_replaced}</li>}
                  {submission.num_keys && <li>Keys: {submission.num_keys}</li>}
                  {submission.modifications && <li>Modifications: {submission.modifications}</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 3: AI Damage Detection ── */}
        {damageReports.length > 0 && (
          <Card className="print:shadow-none print:border-foreground/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5 text-blue-500" />
                AI Photo Analysis
                <div className="ml-auto flex gap-1.5">
                  {severeCount > 0 && <Badge variant="destructive">{severeCount} Severe</Badge>}
                  {moderateCount > 0 && <Badge variant="outline" className="border-amber-400 text-amber-700">{moderateCount} Moderate</Badge>}
                  {minorCount > 0 && <Badge variant="secondary">{minorCount} Minor</Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submission.ai_damage_summary && (
                <p className="text-sm mb-3 font-medium">{submission.ai_damage_summary}</p>
              )}
              <div className="grid gap-2">
                {allDamageItems.map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded border text-sm ${severityColor(item.severity)}`}>
                    <Badge variant={severityBadge(item.severity)} className="text-xs capitalize w-20 justify-center">
                      {item.severity}
                    </Badge>
                    <span className="font-medium capitalize">{item.type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="capitalize">{item.location.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-xs opacity-70">{item.description}</span>
                  </div>
                ))}
                {allDamageItems.length === 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" /> No damage detected by AI analysis
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section 4: Tire & Brake Diagram ── */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5 text-primary" />
              Tire Tread Depth & Brake Pad Thickness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative w-[320px] h-[520px]">
                {/* Vehicle top-down SVG */}
                <svg viewBox="0 0 320 520" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Vehicle body */}
                  <path
                    d="M100 60 Q100 30 160 25 Q220 30 220 60 L225 140 Q230 160 230 180 L230 340 Q230 360 225 380 L220 460 Q220 490 160 495 Q100 490 100 460 L95 380 Q90 360 90 340 L90 180 Q90 160 95 140 Z"
                    fill="hsl(var(--muted))"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="2"
                  />
                  {/* Windshield */}
                  <path d="M115 80 Q115 65 160 62 Q205 65 205 80 L200 130 Q160 135 120 130 Z" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                  {/* Rear window */}
                  <path d="M120 390 Q160 385 200 390 L205 430 Q205 445 160 448 Q115 445 115 430 Z" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                  {/* Center line */}
                  <line x1="160" y1="62" x2="160" y2="448" stroke="hsl(var(--foreground))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                  {/* Headlights */}
                  <ellipse cx="120" cy="48" rx="12" ry="8" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="200" cy="48" rx="12" ry="8" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  {/* Taillights */}
                  <ellipse cx="120" cy="472" rx="10" ry="6" fill="hsl(var(--destructive) / 0.3)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="200" cy="472" rx="10" ry="6" fill="hsl(var(--destructive) / 0.3)" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  {/* Side mirrors */}
                  <ellipse cx="78" cy="110" rx="8" ry="5" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="1" />
                  <ellipse cx="242" cy="110" rx="8" ry="5" fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth="1" />

                  {/* FRONT tires */}
                  <rect x="60" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <rect x="232" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  {/* REAR tires */}
                  <rect x="60" y="365" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />
                  <rect x="232" y="365" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.8)" stroke="hsl(var(--foreground))" strokeWidth="2" />

                  {/* Tire treads */}
                  {[100, 110, 120, 130, 140].map(y => (
                    <g key={`tread-lf-${y}`}>
                      <line x1="66" y1={y} x2="82" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                      <line x1="238" y1={y} x2="254" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                    </g>
                  ))}
                  {[370, 380, 390, 400, 410].map(y => (
                    <g key={`tread-lr-${y}`}>
                      <line x1="66" y1={y} x2="82" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                      <line x1="238" y1={y} x2="254" y2={y} stroke="hsl(var(--muted))" strokeWidth="1.5" />
                    </g>
                  ))}

                  {/* Brake disc indicators */}
                  <circle cx="74" cy="122" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="246" cy="122" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="74" cy="392" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="246" cy="392" r="10" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 2" />

                  {/* Labels: FRONT */}
                  <text x="160" y="18" textAnchor="middle" className="fill-foreground text-[11px] font-bold">FRONT</text>
                  <text x="160" y="512" textAnchor="middle" className="fill-foreground text-[11px] font-bold">REAR</text>
                </svg>

                {/* Input overlays - LF */}
                <div className="absolute left-[-8px] top-[68px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LF Tread</label>
                  <Input
                    value={tireDepth.lf}
                    onChange={e => setTireDepth(p => ({ ...p, lf: e.target.value }))}
                    placeholder="/32"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">LF Brake</label>
                  <Input
                    value={brakeDepth.lf}
                    onChange={e => setBrakeDepth(p => ({ ...p, lf: e.target.value }))}
                    placeholder="mm"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                </div>
                {/* RF */}
                <div className="absolute right-[-8px] top-[68px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">RF Tread</label>
                  <Input
                    value={tireDepth.rf}
                    onChange={e => setTireDepth(p => ({ ...p, rf: e.target.value }))}
                    placeholder="/32"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">RF Brake</label>
                  <Input
                    value={brakeDepth.rf}
                    onChange={e => setBrakeDepth(p => ({ ...p, rf: e.target.value }))}
                    placeholder="mm"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                </div>
                {/* LR */}
                <div className="absolute left-[-8px] top-[342px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">LR Tread</label>
                  <Input
                    value={tireDepth.lr}
                    onChange={e => setTireDepth(p => ({ ...p, lr: e.target.value }))}
                    placeholder="/32"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">LR Brake</label>
                  <Input
                    value={brakeDepth.lr}
                    onChange={e => setBrakeDepth(p => ({ ...p, lr: e.target.value }))}
                    placeholder="mm"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                </div>
                {/* RR */}
                <div className="absolute right-[-8px] top-[342px] w-[72px]">
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">RR Tread</label>
                  <Input
                    value={tireDepth.rr}
                    onChange={e => setTireDepth(p => ({ ...p, rr: e.target.value }))}
                    placeholder="/32"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
                  <label className="text-[10px] font-semibold text-primary block mt-1 mb-0.5">RR Brake</label>
                  <Input
                    value={brakeDepth.rr}
                    onChange={e => setBrakeDepth(p => ({ ...p, rr: e.target.value }))}
                    placeholder="mm"
                    className="h-7 text-xs px-1.5 text-center print:border-foreground/40"
                  />
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

        {/* ── Section 5: Mechanical Inspection ── */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-5 w-5 text-primary" />
              Mechanical Inspection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <InspectionField label="Paint Meter Reading" value={paintReading} onChange={setPaintReading} placeholder="e.g. 4.2 mil avg" />
              <InspectionField label="Oil Life %" value={oilLife} onChange={setOilLife} placeholder="e.g. 65%" />
              <InspectionField label="Battery Health" value={batteryHealth} onChange={setBatteryHealth} placeholder="e.g. Good — 12.6V" />
              <InspectionField label="A/C System" value={acNotes} onChange={setAcNotes} placeholder="e.g. Blowing cold" />
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Engine Notes</label>
                <Textarea value={engineNotes} onChange={e => setEngineNotes(e.target.value)} placeholder="Start quality, idle, leaks, smoke..." className="text-sm min-h-[60px] print:border-foreground/40" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Transmission Notes</label>
                <Textarea value={transmissionNotes} onChange={e => setTransmissionNotes(e.target.value)} placeholder="Shift quality, slipping, noises..." className="text-sm min-h-[60px] print:border-foreground/40" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Suspension / Steering Notes</label>
                <Textarea value={suspensionNotes} onChange={e => setSuspensionNotes(e.target.value)} placeholder="Play in steering, struts, bushings..." className="text-sm min-h-[60px] print:border-foreground/40" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 6: Overall Assessment ── */}
        <Card className="print:shadow-none print:border-foreground/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Inspector's Final Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Overall Grade</label>
                <select
                  value={overallGrade}
                  onChange={e => setOverallGrade(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm print:border-foreground/40"
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
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">AI Suggested Grade</label>
                  <div className="h-10 flex items-center">
                    <Badge variant="outline" className="capitalize text-sm">
                      {submission.ai_condition_score}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Inspector Notes</label>
              <Textarea
                value={inspectorNotes}
                onChange={e => setInspectorNotes(e.target.value)}
                placeholder="Additional notes, concerns, recommendations..."
                className="text-sm min-h-[100px] print:border-foreground/40"
              />
            </div>

            {/* Print-only signature line */}
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
    </div>
  );
};

// ── Sub-components ──

const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
);

const ReportedList = ({ label, items }: { label: string; items: string[] | null }) => (
  <div>
    <p className="font-medium text-muted-foreground mb-1">{label}</p>
    {items && items.length > 0 ? (
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="capitalize">{item.replace(/_/g, " ")}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-muted-foreground">None reported</p>
    )}
  </div>
);

const InspectionField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm print:border-foreground/40" />
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
