import { useState, useEffect } from "react";

import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import {
  Save, CheckCircle, Gauge, Wrench, Car, Lock, DollarSign, ClipboardCheck,
  Paintbrush, Armchair, Zap, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import BrakePadDepthWidget from "@/components/inspection/BrakePadDepthWidget";

interface DamageItem {
  type: string;
  location: string;
  severity: "minor" | "moderate" | "severe";
  description: string;
}

const severityColor = (s: string) => {
  if (s === "severe") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "moderate") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
};

const MobileField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm h-10" inputMode="text" />
  </div>
);

// ── Standard Inspection Checklists ──
const STANDARD_SECTIONS = [
  {
    key: "test_drive",
    label: "Test Drive",
    icon: Car,
    items: [
      "Test drive completed",
      "Transmission shifts correctly",
      "No unusual engine noise",
      "Brakes feel normal",
      "Steering straight / no pull",
      "Suspension smooth — no clunks",
      "No warning lights on dash",
      "A/C blows cold",
      "Heat works",
    ],
  },
  {
    key: "exterior",
    label: "Exterior",
    icon: Paintbrush,
    items: [
      "Paint condition acceptable",
      "No major dents or dings",
      "Bumpers — no cracks",
      "Windshield — no chips/cracks",
      "All lights working",
      "Wheels/rims — no curb rash",
      "Mirrors intact",
      "No visible rust",
    ],
  },
  {
    key: "interior",
    label: "Interior",
    icon: Armchair,
    items: [
      "Seats — no tears or stains",
      "Dashboard — no cracks",
      "Carpet/mats acceptable",
      "Headliner intact",
      "No odor (smoke, pets, mold)",
      "Steering wheel condition OK",
      "All seat belts work",
    ],
  },
  {
    key: "mechanical",
    label: "Mechanical",
    icon: Wrench,
    items: [
      "Engine starts/idles smoothly",
      "No visible fluid leaks",
      "Exhaust — no excessive smoke",
      "Battery holds charge",
      "Oil level/condition OK",
    ],
  },
  {
    key: "electrical",
    label: "Electrical",
    icon: Zap,
    items: [
      "Power windows work",
      "Power locks work",
      "Radio/infotainment works",
      "Backup camera works",
      "All interior lights work",
      "Sunroof/moonroof operates",
    ],
  },
];

// ── 3-State Check: gray (unchecked) → green (pass) → yellow (caution) → red (fail) → gray ──
type CheckState = "" | "pass" | "caution" | "fail";
const CHECK_CYCLE: CheckState[] = ["", "pass", "caution", "fail"];

const checkStyle = (state: CheckState) => {
  switch (state) {
    case "pass": return { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-white", icon: "✓" };
    case "caution": return { bg: "bg-amber-500", border: "border-amber-500", text: "text-white", icon: "~" };
    case "fail": return { bg: "bg-red-500", border: "border-red-500", text: "text-white", icon: "✗" };
    default: return { bg: "bg-background", border: "border-muted-foreground/30", text: "", icon: "" };
  }
};

const CheckItem = ({
  label,
  state,
  onCycle,
}: {
  label: string;
  state: CheckState;
  onCycle: () => void;
}) => {
  const s = checkStyle(state);
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
      <button
        onClick={onCycle}
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${s.bg} ${s.border} ${s.text}`}
      >
        {s.icon && <span className="text-xs font-bold">{s.icon}</span>}
      </button>
      <span className={`text-sm flex-1 ${state ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      {state && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${
          state === "pass" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
          state === "caution" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" :
          "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
        }`}>
          {state === "pass" ? "Pass" : state === "caution" ? "Caution" : "Fail"}
        </span>
      )}
    </div>
  );
};

const MobileInspection = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const isFullMode = modeParam === "full";
  const { toast } = useToast();

  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [submission, setSubmission] = useState<any>(null);
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastAdjustment, setLastAdjustment] = useState<{ adjustment: number; avg_depth: number } | null>(null);
  const [tireBrakeInputMode, setTireBrakeInputMode] = useState<"measurement" | "pass_fail">("measurement");

  // Tire depths
  const [tireLF, setTireLF] = useState<number | null>(null);
  const [tireRF, setTireRF] = useState<number | null>(null);
  const [tireLR, setTireLR] = useState<number | null>(null);
  const [tireRR, setTireRR] = useState<number | null>(null);

  // Brake depths
  const [brakeLF, setBrakeLF] = useState<number | null>(null);
  const [brakeRF, setBrakeRF] = useState<number | null>(null);
  const [brakeLR, setBrakeLR] = useState<number | null>(null);
  const [brakeRR, setBrakeRR] = useState<number | null>(null);

  // Shared fields
  const [overallGrade, setOverallGrade] = useState("");
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [acNotes, setAcNotes] = useState("");

  // Full mode fields
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [engineNotes, setEngineNotes] = useState("");
  const [transmissionNotes, setTransmissionNotes] = useState("");
  const [suspensionNotes, setSuspensionNotes] = useState("");

  // Standard mode checklist state — 3-state cycling
  const [checkStates, setCheckStates] = useState<Record<string, CheckState>>({});

  const cycleCheck = (key: string) => setCheckStates(prev => {
    const cur = prev[key] || "";
    const idx = CHECK_CYCLE.indexOf(cur);
    const next = CHECK_CYCLE[(idx + 1) % CHECK_CYCLE.length];
    return { ...prev, [key]: next };
  });

  const markSectionAllPass = (sectionKey: string, items: string[]) => {
    setCheckStates(prev => {
      const allPass = items.every(item => prev[`${sectionKey}::${item}`] === "pass");
      const updated = { ...prev };
      items.forEach(item => {
        updated[`${sectionKey}::${item}`] = allPass ? "" : "pass";
      });
      return updated;
    });
  };

  // Verify PIN
  const handleVerifyPin = async () => {
    if (!id || pinInput.length !== 4) return;
    setVerifying(true);
    setPinError(false);
    const { data } = await supabase.rpc("verify_inspection_pin", {
      _submission_id: id,
      _pin: pinInput,
    });
    setVerifying(false);
    if (data === true) {
      setPinVerified(true);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  useEffect(() => {
    if (pinInput.length === 4 && !pinVerified) handleVerifyPin();
    // handleVerifyPin / pinVerified are intentionally omitted — including
    // handleVerifyPin would re-run on every render (new identity each
    // time) and cause a verify loop. pinInput is the single trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinInput]);

  // Load data
  useEffect(() => {
    if (!id || !pinVerified) return;
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

        // Fetch inspection config for this submission's dealership to get input mode
        const { data: subFull } = await supabase.from("submissions").select("dealership_id, inspection_started_notified_at").eq("id", id).maybeSingle();
        if (subFull?.dealership_id) {
          const { data: cfgData } = await supabase.from("inspection_config").select("tire_brake_input_mode").eq("dealership_id", subFull.dealership_id).maybeSingle();
          if (cfgData && (cfgData as any).tire_brake_input_mode === "pass_fail") {
            setTireBrakeInputMode("pass_fail");
          }
        }

        // Live-inspection transparency SMS — fire exactly once per
        // submission when an inspector first opens the sheet. Dedup via
        // the inspection_started_notified_at column (fetched above).
        // Fire-and-forget so any SMS-provider blip doesn't block the
        // inspector's workflow.
        if (!(subFull as any)?.inspection_started_notified_at) {
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_inspection_started", submission_id: id },
            context: { from: "MobileInspection.firstOpen" },
          });
          supabase
            .from("submissions")
            .update({ inspection_started_notified_at: new Date().toISOString() } as any)
            .eq("id", id)
            .then(() => {}, () => {});
        }
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
  }, [id, pinVerified]);

  const handleSave = async () => {
    setSaving(true);

    // Build notes
    const parts: string[] = [
      `[${isFullMode ? "FULL" : "STANDARD"} INSPECTION ${new Date().toLocaleString()}]`,
    ];

    if (tireLF !== null) {
      parts.push(`Tires (tread /32): LF:${tireLF} RF:${tireRF} LR:${tireLR} RR:${tireRR}`);
    }
    parts.push(`Brakes (/32): LF:${brakeLF ?? "—"} RF:${brakeRF ?? "—"} LR:${brakeLR ?? "—"} RR:${brakeRR ?? "—"}`);

    if (!isFullMode) {
      // Standard checklist results
      const passed: string[] = [];
      const cautions: string[] = [];
      const failed: string[] = [];
      STANDARD_SECTIONS.forEach(section => {
        section.items.forEach(item => {
          const key = `${section.key}::${item}`;
          const st = checkStates[key] || "";
          if (st === "fail") failed.push(`✗ ${item}`);
          else if (st === "caution") cautions.push(`~ ${item}`);
          else if (st === "pass") passed.push(`✓ ${item}`);
        });
      });
      if (passed.length) parts.push(`PASSED:\n${passed.join("\n")}`);
      if (cautions.length) parts.push(`CAUTION:\n${cautions.join("\n")}`);
      if (failed.length) parts.push(`FAILED:\n${failed.join("\n")}`);
    } else {
      if (paintReading) parts.push(`Paint: ${paintReading}`);
      if (oilLife) parts.push(`Oil: ${oilLife}`);
      if (batteryHealth) parts.push(`Battery: ${batteryHealth}`);
      if (acNotes) parts.push(`A/C: ${acNotes}`);
      if (engineNotes) parts.push(`Engine: ${engineNotes}`);
      if (transmissionNotes) parts.push(`Trans: ${transmissionNotes}`);
      if (suspensionNotes) parts.push(`Suspension: ${suspensionNotes}`);
    }

    if (overallGrade) parts.push(`Grade: ${overallGrade}`);
    if (inspectorNotes) parts.push(`Notes: ${inspectorNotes}`);

    const { data, error } = await supabase.rpc("save_mobile_inspection", {
      _submission_id: id!,
      _internal_notes: parts.join("\n"),
      _overall_condition: overallGrade || null,
      _tire_lf: tireLF,
      _tire_rf: tireRF,
      _tire_lr: tireLR,
      _tire_rr: tireRR,
      _brake_lf: brakeLF,
      _brake_rf: brakeRF,
      _brake_lr: brakeLR,
      _brake_rr: brakeRR,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      const result = data as any;
      if (result && result.adjustment !== undefined) setLastAdjustment(result);

      toast({ title: "Inspection saved", description: "Data synced to the customer file." });

      // Mid-inspection progress SMS — fire once per submission after
      // the inspector saves tire/brake measurements. Dedup via the
      // inspection_progress_notified_at column.
      const wroteTireOrBrake =
        tireLF !== null || brakeLF !== null || brakeRF !== null || brakeLR !== null || brakeRR !== null;
      if (wroteTireOrBrake && id) {
        const { data: subFull } = await supabase
          .from("submissions")
          .select("inspection_progress_notified_at")
          .eq("id", id)
          .maybeSingle();
        if (!(subFull as any)?.inspection_progress_notified_at) {
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_inspection_progress", submission_id: id },
            context: { from: "MobileInspection.midSave" },
          });
          supabase
            .from("submissions")
            .update({ inspection_progress_notified_at: new Date().toISOString() } as any)
            .eq("id", id)
            .then(() => {}, () => {});
        }
      }
    }
  };

  // ── PIN Screen ──
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-card-foreground">Inspection Access</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter the 4-digit PIN shown on the inspection sheet</p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={4} value={pinInput} onChange={setPinInput}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {pinError && <p className="text-sm text-destructive font-medium">Incorrect PIN. Please try again.</p>}
          {verifying && <p className="text-sm text-muted-foreground animate-pulse">Verifying...</p>}
        </div>
      </div>
    );
  }

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

  // Standard checklist stats
  const totalCheckItems = STANDARD_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const checkedCount = Object.values(checkStates).filter(v => !!v).length;
  const issueCount = Object.values(checkStates).filter(v => v === "fail").length;
  const cautionCount = Object.values(checkStates).filter(v => v === "caution").length;

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
          <Badge variant="outline" className="text-primary-foreground border-primary-foreground/30 text-[10px]">
            {isFullMode ? (
              <><Wrench className="w-3 h-3 mr-1" /> Full</>
            ) : (
              <><ClipboardCheck className="w-3 h-3 mr-1" /> Standard</>
            )}
          </Badge>
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

        {/* Tire Tread & Brake Pads — Always shown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Tire Tread & Brake Pads
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Select the measured depth for each position</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <BrakePadDepthWidget
              tireDepths={{ leftFront: tireLF, rightFront: tireRF, leftRear: tireLR, rightRear: tireRR }}
              brakeDepths={{ leftFront: brakeLF, rightFront: brakeRF, leftRear: brakeLR, rightRear: brakeRR }}
              inputMode={tireBrakeInputMode}
              onTireChange={(pos, depth) => {
                const val = depth === -1 ? null : depth;
                if (pos === "leftFront") setTireLF(val);
                else if (pos === "rightFront") setTireRF(val);
                else if (pos === "leftRear") setTireLR(val);
                else if (pos === "rightRear") setTireRR(val);
              }}
              onBrakeChange={(pos, depth) => {
                const val = depth === -1 ? null : depth;
                if (pos === "leftFront") setBrakeLF(val);
                else if (pos === "rightFront") setBrakeRF(val);
                else if (pos === "leftRear") setBrakeLR(val);
                else if (pos === "rightRear") setBrakeRR(val);
              }}
              compact
            />
          </CardContent>
        </Card>

        {/* Tire Adjustment Result */}
        {lastAdjustment && lastAdjustment.adjustment !== 0 && (
          <Card className={lastAdjustment.adjustment > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <DollarSign className={`h-5 w-5 ${lastAdjustment.adjustment > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`} />
              <div>
                <p className={`text-sm font-bold ${lastAdjustment.adjustment > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  Tire {lastAdjustment.adjustment > 0 ? "Credit" : "Deduction"}: {lastAdjustment.adjustment > 0 ? "+" : ""}${Math.abs(lastAdjustment.adjustment).toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Avg depth: {lastAdjustment.avg_depth.toFixed(1)}/32 · Applied to customer file</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════ STANDARD MODE: Checklist Categories ═══════ */}
        {!isFullMode && (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${totalCheckItems > 0 ? (checkedCount / totalCheckItems) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{checkedCount}/{totalCheckItems}</span>
              {issueCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{issueCount} fail{issueCount > 1 ? "s" : ""}</Badge>
              )}
              {cautionCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">{cautionCount} caution{cautionCount > 1 ? "s" : ""}</Badge>
              )}
            </div>

            {STANDARD_SECTIONS.map(section => {
              const Icon = section.icon;
              const sectionChecked = section.items.filter(item => checkStates[`${section.key}::${item}`]).length;
              const allPass = section.items.every(item => checkStates[`${section.key}::${item}`] === "pass");
              return (
                <Card key={section.key}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" /> {section.label}
                      </span>
                      <span className="flex items-center gap-2">
                        {/* Section all-pass toggle circle */}
                        <button
                          onClick={() => markSectionAllPass(section.key, section.items)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            allPass
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {allPass && <span className="text-xs font-bold">✓</span>}
                        </button>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {sectionChecked}/{section.items.length}
                        </span>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {section.items.map(item => {
                      const key = `${section.key}::${item}`;
                      return (
                        <CheckItem
                          key={key}
                          label={item}
                          state={checkStates[key] || ""}
                          onCycle={() => cycleCheck(key)}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Textarea
                  value={inspectorNotes}
                  onChange={e => setInspectorNotes(e.target.value)}
                  placeholder="Anything else worth noting — paint work, aftermarket parts, odor, etc."
                  className="text-sm min-h-[80px]"
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════ FULL MODE: Deep Mechanical ═══════ */}
        {isFullMode && (
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
        )}

        {/* Final Grade — always shown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Final Assessment
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
            {isFullMode && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Inspector Notes</label>
                <Textarea value={inspectorNotes} onChange={e => setInspectorNotes(e.target.value)} placeholder="Additional notes..." className="text-sm min-h-[80px]" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base gap-2">
          {saving ? <span className="animate-spin">⏳</span> : <Save className="h-5 w-5" />}
          {saving ? "Saving..." : "Save Inspection"}
        </Button>
      </div>
    </div>
  );
};

export default MobileInspection;
