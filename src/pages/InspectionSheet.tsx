import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useInspectionConfig } from "@/hooks/useInspectionConfig";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Printer, Camera, AlertTriangle, CheckCircle, Car, Gauge, Wrench,
  Save, Smartphone, Eye, Zap, Paintbrush, Armchair, Shield, ThermometerSun,
  ChevronDown, ChevronRight, CheckCheck, Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import BrakePadDepthWidget from "@/components/inspection/BrakePadDepthWidget";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import PortalSkeleton from "@/components/PortalSkeleton";
import VehicleImage from "@/components/sell-form/VehicleImage";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

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

// #9 — Dark-mode-friendly grade colors using HSL tokens
const gradeStyle = (g: ConditionGrade) => {
  switch (g) {
    case "good": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/50 dark:border-emerald-500/40 ring-emerald-400/30";
    case "fair": return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/50 dark:border-amber-500/40 ring-amber-400/30";
    case "poor": return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-400/50 dark:border-orange-500/40 ring-orange-400/30";
    case "damaged": return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-400/50 dark:border-red-500/40 ring-red-400/30";
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

// ── Checklist definitions (reordered: #3 — tires/mechanical first) ──
const SECTION_DEFS = [
  {
    key: "tires",
    label: "Tires & Brakes",
    icon: Gauge,
    gradient: "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20",
    borderAccent: "border-l-blue-500",
    items: [] as string[], // special section
  },
  {
    key: "measurements",
    label: "Quick Measurements",
    icon: ThermometerSun,
    gradient: "from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20",
    borderAccent: "border-l-violet-500",
    items: [] as string[], // special section
  },
  {
    key: "exterior",
    label: "Exterior",
    icon: Paintbrush,
    gradient: "from-sky-500/10 to-blue-500/10 dark:from-sky-500/20 dark:to-blue-500/20",
    borderAccent: "border-l-sky-500",
    items: [
      "Hood", "Front Bumper", "Rear Bumper", "Roof", "Trunk/Liftgate",
      "Left Front Fender", "Right Front Fender", "Left Rear Quarter", "Right Rear Quarter",
      "Left Front Door", "Right Front Door", "Left Rear Door", "Right Rear Door",
      "Windshield", "Rear Glass", "Left Mirror", "Right Mirror",
      "Left Headlight", "Right Headlight", "Left Taillight", "Right Taillight",
      "Grille", "Wheels/Rims", "Undercarriage",
    ],
  },
  {
    key: "interior",
    label: "Interior",
    icon: Armchair,
    gradient: "from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20",
    borderAccent: "border-l-amber-500",
    items: [
      "Driver Seat", "Passenger Seat", "Rear Seats", "Headliner",
      "Dashboard", "Center Console", "Steering Wheel", "Carpet/Floor Mats",
      "Door Panels", "Instrument Cluster", "Glove Box", "Trunk Interior",
      "Seat Belts", "Sun Visors", "Rearview Mirror",
    ],
  },
  {
    key: "mechanical",
    label: "Mechanical",
    icon: Wrench,
    gradient: "from-slate-500/10 to-zinc-500/10 dark:from-slate-500/20 dark:to-zinc-500/20",
    borderAccent: "border-l-slate-500",
    items: [
      "Engine Start/Idle", "Engine Noise", "Oil Leaks", "Coolant Leaks",
      "Transmission Shift", "Differential", "Exhaust System",
      "Power Steering", "CV Joints/Boots", "Drive Belts",
      "Shocks/Struts", "Ball Joints", "Tie Rods", "Wheel Bearings",
      "Brake Rotors", "Brake Lines", "Parking Brake",
    ],
  },
  {
    key: "electrical",
    label: "Electrical",
    icon: Zap,
    gradient: "from-yellow-500/10 to-amber-500/10 dark:from-yellow-500/20 dark:to-amber-500/20",
    borderAccent: "border-l-yellow-500",
    items: [
      "A/C System", "Heater", "Power Windows", "Power Locks", "Power Mirrors",
      "Radio/Infotainment", "Speakers", "Backup Camera", "Navigation",
      "Sunroof/Moonroof", "Keyless Entry", "Remote Start",
      "Headlights", "Turn Signals", "Brake Lights", "Interior Lights",
      "Horn", "Wipers", "Defroster", "Charging Ports/USB",
    ],
  },
  {
    key: "glass",
    label: "Glass & Lights",
    icon: Eye,
    gradient: "from-teal-500/10 to-emerald-500/10 dark:from-teal-500/20 dark:to-emerald-500/20",
    borderAccent: "border-l-teal-500",
    items: [
      "Windshield Chips/Cracks", "Side Windows", "Rear Window",
      "Headlight Clarity", "Taillight Clarity", "Fog Lights",
    ],
  },
];

const ALL_CHECKLIST_SECTIONS = SECTION_DEFS.filter(s => s.items.length > 0);
const ALL_ITEMS = ALL_CHECKLIST_SECTIONS.flatMap(s => s.items);

const severityColor = (s: string) => {
  if (s === "severe") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-400/50";
  if (s === "moderate") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/50";
  return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-400/50";
};

const severityBadge = (s: string) => {
  if (s === "severe") return "destructive" as const;
  if (s === "moderate") return "outline" as const;
  return "secondary" as const;
};

// ── #4 Progress Ring ──
const ProgressRing = ({ progress, size = 40, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const color = progress === 100 ? "stroke-emerald-500" : progress > 60 ? "stroke-primary" : "stroke-amber-500";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" className="stroke-muted/30" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none"
          className={`${color} transition-all duration-500`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
        {Math.round(progress)}%
      </span>
    </div>
  );
};

// ── #5 Condition Item with quick grade (tap = Good, long-press = cycle) ──
const ConditionItem = ({
  label, grade, onCycle, onSetGrade, note, onNoteChange, flaggedByAI,
}: {
  label: string;
  grade: ConditionGrade;
  onCycle: () => void;
  onSetGrade: (g: ConditionGrade) => void;
  note: string;
  onNoteChange: (v: string) => void;
  flaggedByAI?: boolean;
}) => {
  const [showNote, setShowNote] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = () => {
    didLongPress.current = false;
    longPressRef.current = setTimeout(() => {
      didLongPress.current = true;
      onCycle(); // long press cycles through all grades
    }, 400);
  };

  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (!didLongPress.current) {
      // Quick tap: toggle Good on/off, or cycle if already graded
      if (!grade) {
        onSetGrade("good");
      } else {
        onCycle();
      }
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer select-none hover:ring-2 active:scale-[0.98] ${gradeStyle(grade)} ${flaggedByAI ? "ring-2 ring-amber-400/50" : ""}`}
      >
        <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ borderColor: "currentColor" }}>
          {gradeIcon(grade)}
        </span>
        <span className="flex-1 text-left">{label}</span>
        {flaggedByAI && <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />}
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

// ── #2 Collapsible Section with #7 gradient header & #1 Mark All Good ──
const ChecklistSection = ({
  sectionDef, grades, notes, onCycle, onSetGrade, onNoteChange, onMarkAllGood, flaggedItems,
  isOpen, onToggle,
}: {
  sectionDef: typeof SECTION_DEFS[number];
  grades: Record<string, ConditionGrade>;
  notes: Record<string, string>;
  onCycle: (item: string) => void;
  onSetGrade: (item: string, g: ConditionGrade) => void;
  onNoteChange: (item: string, v: string) => void;
  onMarkAllGood: () => void;
  flaggedItems: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const { items, icon: Icon, label, gradient, borderAccent } = sectionDef;
  const checked = items.filter(i => !!grades[i]).length;
  const issues = items.filter(i => grades[i] === "poor" || grades[i] === "damaged").length;
  const allGood = checked === items.length && issues === 0;
  const allMarkedGood = items.every(i => grades[i] === "good");

  return (
    <Card className={`print:shadow-none print:border-foreground/30 break-inside-avoid border-l-4 ${borderAccent} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left bg-gradient-to-r ${gradient}`}
      >
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5 text-primary" />
            {label}
            <div className="ml-auto flex items-center gap-1.5 text-xs">
              {allGood && <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">All Good ✓</Badge>}
              {!allGood && (
                <Badge variant="secondary" className="text-[10px]">{checked}/{items.length}</Badge>
              )}
              {issues > 0 && (
                <Badge variant="destructive" className="text-[10px]">{issues} issue{issues > 1 ? "s" : ""}</Badge>
              )}
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardTitle>
        </CardHeader>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-2 pb-4">
              {/* #1 Mark All Good */}
              <div className="flex items-center justify-end gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 text-xs gap-1 ${allMarkedGood ? "border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10" : "border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"}`}
                  onClick={e => { e.stopPropagation(); onMarkAllGood(); }}
                >
                  <CheckCheck className="w-3.5 h-3.5" /> {allMarkedGood ? "Reset All" : "Mark All Good"}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {items.map(item => (
                  <ConditionItem
                    key={item}
                    label={item}
                    grade={grades[item] || ""}
                    onCycle={() => onCycle(item)}
                    onSetGrade={g => onSetGrade(item, g)}
                    note={notes[item] || ""}
                    onNoteChange={v => onNoteChange(item, v)}
                    flaggedByAI={flaggedItems.has(item.toLowerCase())}
                  />
                ))}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

// ── Grade Legend ──
const GradeLegend = () => (
  <div className="flex flex-wrap gap-2 text-xs print:text-[10px]">
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
  const { config: inspConfig, loading: inspConfigLoading } = useInspectionConfig();
  const printRef = useRef<HTMLDivElement>(null);

  const [submission, setSubmission] = useState<any>(null);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMobileQR, setShowMobileQR] = useState(false);

  // Build config-aware section definitions
  const sectionToggleMap: Record<string, boolean> = {
    tires: inspConfig.section_tires,
    measurements: inspConfig.section_measurements,
    exterior: inspConfig.section_exterior,
    interior: inspConfig.section_interior,
    mechanical: inspConfig.section_mechanical,
    electrical: inspConfig.section_electrical,
    glass: inspConfig.section_glass,
  };

  // Reorder + filter sections based on config
  const ACTIVE_SECTION_DEFS = inspConfig.section_order
    .filter(key => sectionToggleMap[key] !== false)
    .map(key => {
      const def = SECTION_DEFS.find(s => s.key === key);
      if (!def) return null;
      // Filter out disabled fields and add custom items
      const filteredItems = def.items.filter(item => !inspConfig.disabled_fields[item]);
      const customForSection = inspConfig.custom_items
        .filter(ci => ci.section === key)
        .map(ci => ci.label);
      return { ...def, items: [...filteredItems, ...customForSection] };
    })
    .filter(Boolean) as typeof SECTION_DEFS;

  const ACTIVE_CHECKLIST_SECTIONS = ACTIVE_SECTION_DEFS.filter(s => s.items.length > 0);
  const ACTIVE_ALL_ITEMS = ACTIVE_CHECKLIST_SECTIONS.flatMap(s => s.items);

  // #6 — Sticky tab active section
  const [activeTab, setActiveTab] = useState("tires");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // #2 — Collapsible sections (all start open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTION_DEFS.map(s => [s.key, s.key !== "measurements"]))
  );

  // #10 — Sticky vehicle strip
  const [showStickyVehicle, setShowStickyVehicle] = useState(false);
  const vehicleCardRef = useRef<HTMLDivElement>(null);

  // Tire & brake
  const [tireDepth, setTireDepth] = useState<{ lf: number | null; rf: number | null; lr: number | null; rr: number | null }>({ lf: null, rf: null, lr: null, rr: null });
  const [brakeDepth, setBrakeDepth] = useState<{ lf: number | null; rf: number | null; lr: number | null; rr: number | null }>({ lf: null, rf: null, lr: null, rr: null });

  // Mechanical fields
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [overallGrade, setOverallGrade] = useState("");

  // Clickable condition grades — single state object for all sections
  const [allGrades, setAllGrades] = useState<Record<string, ConditionGrade>>({});
  const [allNotes, setAllNotes] = useState<Record<string, string>>({});

  const cycleGrade = useCallback((item: string) => {
    setAllGrades(prev => {
      const cur = prev[item] || "";
      const idx = GRADE_CYCLE.indexOf(cur);
      const next = GRADE_CYCLE[(idx + 1) % GRADE_CYCLE.length];
      return { ...prev, [item]: next };
    });
  }, []);

  const setGrade = useCallback((item: string, g: ConditionGrade) => {
    setAllGrades(prev => ({ ...prev, [item]: g }));
  }, []);

  const setNote = useCallback((item: string, v: string) => {
    setAllNotes(prev => ({ ...prev, [item]: v }));
  }, []);

  // #1 — Mark All Good / Reset toggle for a section
  const markAllGood = useCallback((items: string[]) => {
    setAllGrades(prev => {
      const allAlreadyGood = items.every(i => prev[i] === "good");
      const updated = { ...prev };
      if (allAlreadyGood) {
        items.forEach(i => { updated[i] = ""; });
      } else {
        items.forEach(i => { updated[i] = "good"; });
      }
      return updated;
    });
  }, []);

  // #10 — IntersectionObserver for sticky vehicle strip
  useEffect(() => {
    const el = vehicleCardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setShowStickyVehicle(!entry.isIntersecting);
    }, { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [submission]);

  // Scroll spy for tabs
  useEffect(() => {
    const handleScroll = () => {
      for (const section of ACTIVE_SECTION_DEFS) {
        const el = sectionRefs.current[section.key];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveTab(section.key);
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
          if (sess) {
            subscription.unsubscribe();
            await loadSubmission();
          } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            setLoading(false);
          }
        });
        setTimeout(() => { subscription.unsubscribe(); setLoading(false); }, 5000);
        return;
      }
      await loadSubmission();
    };

    const loadSubmission = async () => {
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

  // #8 — Animated save with confetti
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    const gatherSection = (title: string, items: string[]) => {
      const entries = items
        .filter(i => !!allGrades[i])
        .map(i => `  ${i}: ${(allGrades[i] || "").toUpperCase()}${allNotes[i] ? ` — ${allNotes[i]}` : ""}`);
      return entries.length > 0 ? `[${title}]\n${entries.join("\n")}` : "";
    };

    const sections = [
      `[INSPECTION ${new Date().toLocaleString()}]`,
      ...(inspConfig.section_tires ? [
        `Tires (tread /32): LF:${tireDepth.lf ?? "—"} RF:${tireDepth.rf ?? "—"} LR:${tireDepth.lr ?? "—"} RR:${tireDepth.rr ?? "—"}`,
        `Brakes (/32): LF:${brakeDepth.lf ?? "—"} RF:${brakeDepth.rf ?? "—"} LR:${brakeDepth.lr ?? "—"} RR:${brakeDepth.rr ?? "—"}`,
      ] : []),
      ...(inspConfig.section_measurements ? [
        paintReading && `Paint: ${paintReading}`,
        oilLife && `Oil: ${oilLife}`,
        batteryHealth && `Battery: ${batteryHealth}`,
      ].filter(Boolean) : []),
      ...ACTIVE_CHECKLIST_SECTIONS.map(s => gatherSection(s.label.toUpperCase(), s.items)),
      overallGrade && `Grade: ${overallGrade}`,
      inspectorNotes && `Notes: ${inspectorNotes}`,
    ].filter(Boolean).join("\n\n");

    const { data, error } = await supabase.rpc("save_mobile_inspection", {
      _submission_id: id!,
      _internal_notes: sections,
      _overall_condition: overallGrade || null,
      _tire_lf: tireDepth.lf,
      _tire_rf: tireDepth.rf,
      _tire_lr: tireDepth.lr,
      _tire_rr: tireDepth.rr,
      _brake_lf: brakeDepth.lf,
      _brake_rf: brakeDepth.rf,
      _brake_lr: brakeDepth.lr,
      _brake_rr: brakeDepth.rr,
    } as any);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      setSaveSuccess(true);
      const result = data as any;
      if (result && result.adjustment !== undefined && result.adjustment !== 0) {
        toast({ title: "Inspection saved", description: `Tire adjustment: ${result.adjustment >= 0 ? "+" : ""}$${Math.abs(result.adjustment).toLocaleString()}` });
      }
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.95 }, colors: ["#10b981", "#3b82f6", "#f59e0b"] });
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handlePrint = () => {
    const vTitle = `${submission.vehicle_year || ""} ${submission.vehicle_make || ""} ${submission.vehicle_model || ""}`.trim();
    const dealerName = config?.dealership_name || "Dealership";

    const gradeHTML = (g: ConditionGrade) => {
      const colors: Record<string, string> = { good: "#10b981", fair: "#f59e0b", poor: "#f97316", damaged: "#ef4444" };
      const color = colors[g] || "#94a3b8";
      const label = g ? g.charAt(0).toUpperCase() + g.slice(1) : "Not Checked";
      return `<span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:600;color:${color};border:1.5px solid ${color}30;background:${color}15;">${label}</span>`;
    };

    const sectionRows = (items: string[]) =>
      items.map(item => {
        const g = allGrades[item] || "";
        const n = allNotes[item] || "";
        return `<tr><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${item}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${gradeHTML(g as ConditionGrade)}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${n}</td></tr>`;
      }).join("");

    const sectionBlock = (title: string, items: string[]) => {
      if (!items.length) return "";
      const checked = items.filter(i => !!allGrades[i]).length;
      const issues = items.filter(i => allGrades[i] === "poor" || allGrades[i] === "damaged").length;
      return `
        <div style="break-inside:avoid;margin-bottom:16px;">
          <div style="background:#f8fafc;padding:8px 12px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:2px solid #3b82f6;">
            <strong style="font-size:13px;">${title}</strong>
            <span style="float:right;font-size:11px;color:#64748b;">${checked}/${items.length} checked${issues > 0 ? ` · <span style="color:#ef4444">${issues} issue${issues > 1 ? "s" : ""}</span>` : ""}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
            <thead><tr style="background:#f1f5f9;"><th style="padding:4px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:1px solid #e2e8f0;">Item</th><th style="padding:4px 8px;text-align:center;font-size:11px;font-weight:600;border-bottom:1px solid #e2e8f0;width:100px;">Grade</th><th style="padding:4px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:1px solid #e2e8f0;">Notes</th></tr></thead>
            <tbody>${sectionRows(items)}</tbody>
          </table>
        </div>`;
    };

    const tireBrakeHTML = `
      <div style="break-inside:avoid;margin-bottom:16px;">
        <div style="background:#f8fafc;padding:8px 12px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:2px solid #0ea5e9;">
          <strong style="font-size:13px;">Tire Tread & Brake Pads</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:6px;font-size:11px;border-bottom:1px solid #e2e8f0;"></th><th style="padding:6px;font-size:11px;border-bottom:1px solid #e2e8f0;">LF</th><th style="padding:6px;font-size:11px;border-bottom:1px solid #e2e8f0;">RF</th><th style="padding:6px;font-size:11px;border-bottom:1px solid #e2e8f0;">LR</th><th style="padding:6px;font-size:11px;border-bottom:1px solid #e2e8f0;">RR</th></tr></thead>
          <tbody>
            <tr><td style="padding:6px;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">Tread (/32)</td><td style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0;">${tireDepth.lf ?? "—"}</td><td style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0;">${tireDepth.rf ?? "—"}</td><td style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0;">${tireDepth.lr ?? "—"}</td><td style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0;">${tireDepth.rr ?? "—"}</td></tr>
            <tr><td style="padding:6px;font-size:12px;font-weight:600;">Brake (/32)</td><td style="padding:6px;text-align:center;">${brakeDepth.lf ?? "—"}</td><td style="padding:6px;text-align:center;">${brakeDepth.rf ?? "—"}</td><td style="padding:6px;text-align:center;">${brakeDepth.lr ?? "—"}</td><td style="padding:6px;text-align:center;">${brakeDepth.rr ?? "—"}</td></tr>
          </tbody>
        </table>
      </div>`;

    const measurementsHTML = (paintReading || oilLife || batteryHealth) ? `
      <div style="break-inside:avoid;margin-bottom:16px;">
        <div style="background:#f8fafc;padding:8px 12px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:2px solid #8b5cf6;">
          <strong style="font-size:13px;">Quick Measurements</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
          <tbody>
            ${paintReading ? `<tr><td style="padding:6px 8px;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;width:140px;">Paint Meter</td><td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #e2e8f0;">${paintReading}</td></tr>` : ""}
            ${oilLife ? `<tr><td style="padding:6px 8px;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">Oil Life</td><td style="padding:6px 8px;font-size:12px;border-bottom:1px solid #e2e8f0;">${oilLife}</td></tr>` : ""}
            ${batteryHealth ? `<tr><td style="padding:6px 8px;font-size:12px;font-weight:600;">Battery Health</td><td style="padding:6px 8px;font-size:12px;">${batteryHealth}</td></tr>` : ""}
          </tbody>
        </table>
      </div>` : "";

    const notesHTML = inspectorNotes ? `<div style="break-inside:avoid;margin-bottom:16px;"><div style="background:#f8fafc;padding:8px 12px;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:2px solid #64748b;"><strong style="font-size:13px;">Inspector Notes</strong></div><div style="border:1px solid #e2e8f0;border-top:none;padding:10px 12px;font-size:12px;white-space:pre-wrap;">${inspectorNotes}</div></div>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inspection — ${vTitle}</title>
      <style>@media print{body{margin:0;padding:16px;}@page{size:letter;margin:0.5in;}}</style>
    </head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;max-width:800px;margin:0 auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e293b;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <h1 style="margin:0;font-size:22px;letter-spacing:-0.5px;">${dealerName}</h1>
          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Vehicle Inspection Report</p>
        </div>
        <div style="text-align:right;font-size:12px;">
          <p style="margin:0;font-weight:600;">Date: ${new Date().toLocaleDateString()}</p>
          <p style="margin:2px 0 0;color:#64748b;">Stock #: ${submission.id?.slice(0, 8).toUpperCase() || "—"}</p>
        </div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:32px;flex-wrap:wrap;">
        <div><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;">Vehicle</span><br><strong style="font-size:14px;">${vTitle}</strong></div>
        <div><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;">VIN</span><br><strong style="font-size:12px;font-family:monospace;">${submission.vin || "N/A"}</strong></div>
        <div><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;">Mileage</span><br><strong style="font-size:14px;">${submission.mileage ? Number(submission.mileage).toLocaleString() + " mi" : "N/A"}</strong></div>
        <div><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;">Color</span><br><strong style="font-size:14px;">${submission.exterior_color || "N/A"}</strong></div>
        ${overallGrade ? `<div><span style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;">Overall Grade</span><br><strong style="font-size:14px;text-transform:capitalize;">${overallGrade}</strong></div>` : ""}
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <span style="font-size:11px;font-weight:600;color:#64748b;">Completion: ${totalChecked}/${ACTIVE_ALL_ITEMS.length} (${Math.round(progressPct)}%)</span>
        ${totalIssues > 0 ? `<span style="font-size:11px;font-weight:600;color:#ef4444;">· ${totalIssues} issue${totalIssues > 1 ? "s" : ""} flagged</span>` : ""}
      </div>

      ${tireBrakeHTML}
      ${measurementsHTML}
      ${ACTIVE_CHECKLIST_SECTIONS.map(s => sectionBlock(s.label, s.items)).join("")}
      ${notesHTML}

      <div style="margin-top:32px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;">
        <div style="font-size:11px;color:#94a3b8;">Inspector Signature: ________________________________</div>
        <div style="font-size:11px;color:#94a3b8;">Manager Signature: ________________________________</div>
      </div>
    </body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  };

  const scrollToSection = (key: string) => {
    setActiveTab(key);
    setOpenSections(prev => ({ ...prev, [key]: true }));
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <PortalSkeleton />;
  if (!submission) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Submission not found. You may need to sign in first.</p>
      <Button variant="outline" onClick={() => window.location.href = "/admin-login"}>Sign In</Button>
    </div>
  );

  const allDamageItems = damageReports.flatMap(r => r.damage_items || []);
  const severeCount = allDamageItems.filter(d => d.severity === "severe").length;
  const moderateCount = allDamageItems.filter(d => d.severity === "moderate").length;
  const minorCount = allDamageItems.filter(d => d.severity === "minor").length;
  const vehicleTitle = `${submission.vehicle_year || ""} ${submission.vehicle_make || ""} ${submission.vehicle_model || ""}`.trim();

  // #3 — AI flagged items mapped to checklist labels
  const flaggedItems = new Set(
    allDamageItems.flatMap(d => [d.type.replace(/_/g, " ").toLowerCase(), d.location.replace(/_/g, " ").toLowerCase()])
  );

  // Overall completion
  const totalChecked = ACTIVE_ALL_ITEMS.filter(i => !!allGrades[i]).length;
  const totalIssues = ACTIVE_ALL_ITEMS.filter(i => allGrades[i] === "poor" || allGrades[i] === "damaged").length;
  const progressPct = ACTIVE_ALL_ITEMS.length > 0 ? (totalChecked / ACTIVE_ALL_ITEMS.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Primary Header ── */}
      <div className="print:hidden sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold font-display">Vehicle Inspection</h1>
              <p className="text-xs opacity-80">{vehicleTitle} • VIN: {submission.vin || "N/A"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* #4 — Progress Ring */}
            <ProgressRing progress={progressPct} size={42} strokeWidth={4} />
            <div className="hidden md:block text-xs text-right">
              <p className="font-semibold">{totalChecked}/{ACTIVE_ALL_ITEMS.length}</p>
              {totalIssues > 0 && <p className="text-red-300">{totalIssues} issues</p>}
            </div>
            <div className="relative">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 gap-1"
                onClick={() => setShowMobileQR(prev => !prev)}>
                <Smartphone className="h-4 w-4" /> Mobile
              </Button>
              {showMobileQR && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-card rounded-xl shadow-2xl p-5 w-64 text-center animate-in fade-in slide-in-from-top-2">
                  <p className="text-sm font-bold text-card-foreground mb-1">📱 Scan to Inspect</p>
                  <p className="text-xs text-muted-foreground mb-3">Open on your phone to walk around the vehicle</p>
                  <div className="bg-white p-3 rounded-lg inline-block border shadow-sm mb-3">
                    <QRCodeSVG value={`${window.location.origin}/inspect/${id}`} size={160} level="H" />
                  </div>
                  {submission?.inspection_pin && (
                    <div className="bg-muted rounded-lg p-2 mb-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Access PIN</p>
                      <p className="text-2xl font-mono font-black tracking-[0.3em] text-card-foreground">{submission.inspection_pin}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Point your phone camera at the code</p>
                  <button onClick={() => setShowMobileQR(false)} className="mt-3 text-xs text-muted-foreground hover:text-foreground underline">Close</button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handlePrint} className="text-primary-foreground hover:bg-primary-foreground/20 gap-1">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {/* #6 — Sticky Tab Navigation */}
        <div className="border-t border-primary-foreground/10 overflow-x-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto px-4 flex gap-0.5">
            {ACTIVE_SECTION_DEFS.map(s => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => scrollToSection(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
                    isActive
                      ? "border-primary-foreground text-primary-foreground"
                      : "border-transparent text-primary-foreground/50 hover:text-primary-foreground/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* #10 — Sticky Vehicle Strip (appears when vehicle card scrolls out of view) */}
      <AnimatePresence>
        {showStickyVehicle && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="print:hidden sticky top-[108px] z-40 bg-card/95 backdrop-blur border-b shadow-sm"
          >
            <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
              <Car className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-semibold">{vehicleTitle}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{submission.mileage ? `${Number(submission.mileage).toLocaleString()} mi` : ""}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground capitalize">{submission.exterior_color || ""}</span>
              <span className="text-muted-foreground text-xs ml-auto">VIN: {submission.vin || "N/A"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        {/* Grade Legend + instruction */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tap = Good · Long-press = Cycle grades
          </p>
          <GradeLegend />
        </div>

        {/* Vehicle Summary Card — observed for sticky strip */}
        <div ref={vehicleCardRef}>
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
        </div>

        {/* Customer-Reported Issues */}
        {(submission.exterior_damage?.length || submission.interior_damage?.length || submission.mechanical_issues?.length || submission.engine_issues?.length) && (
          <Card className="print:shadow-none print:border-foreground/30 border-l-4 border-l-amber-500 bg-amber-500/5">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Customer-Reported Issues
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...(submission.exterior_damage || []).map((d: string) => ({ label: d, category: "Exterior" })),
                  ...(submission.interior_damage || []).map((d: string) => ({ label: d, category: "Interior" })),
                  ...(submission.mechanical_issues || []).map((d: string) => ({ label: d, category: "Mechanical" })),
                  ...(submission.engine_issues || []).map((d: string) => ({ label: d, category: "Engine" })),
                  ...(submission.tech_issues || []).map((d: string) => ({ label: d, category: "Tech" })),
                ].map((item, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] capitalize border-amber-400/50 text-amber-600 dark:text-amber-400">
                    <span className="font-bold mr-1">{item.category}:</span> {item.label.replace(/_/g, " ")}
                  </Badge>
                ))}
                {submission.smoked_in === "yes" && <Badge variant="destructive" className="text-[10px]">Smoked In</Badge>}
                {submission.drivable === "no" && <Badge variant="destructive" className="text-[10px]">Not Drivable</Badge>}
                {submission.accidents && submission.accidents !== "none" && (
                  <Badge variant="outline" className="text-[10px] border-red-400/50 text-red-600 dark:text-red-400">Accidents: {submission.accidents}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Damage Detection */}
        {damageReports.length > 0 && allDamageItems.length > 0 && (
          <Card className="print:shadow-none print:border-foreground/30 border-l-4 border-l-blue-500 bg-blue-500/5">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4 text-blue-500" />
                AI Photo Analysis
                <div className="ml-auto flex gap-1.5">
                  {severeCount > 0 && <Badge variant="destructive" className="text-[10px]">{severeCount} Severe</Badge>}
                  {moderateCount > 0 && <Badge variant="outline" className="border-amber-400/50 text-amber-600 dark:text-amber-400 text-[10px]">{moderateCount} Moderate</Badge>}
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

        {/* ── #3 Smart-ordered sections: Tires/Brakes first ── */}
        {ACTIVE_SECTION_DEFS.map(section => {
          if (section.key === "tires") {
            return (
              <div key="tires" ref={el => { sectionRefs.current["tires"] = el; }}>
                <Card className={`print:shadow-none print:border-foreground/30 break-inside-avoid border-l-4 ${section.borderAccent} overflow-hidden`}>
                  <button type="button" onClick={() => setOpenSections(p => ({ ...p, tires: !p.tires }))}
                    className={`w-full text-left bg-gradient-to-r ${section.gradient}`}>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Gauge className="h-5 w-5 text-primary" />
                        Tire Tread & Brake Pads
                        <div className="ml-auto">
                          {openSections.tires ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </button>
                  <AnimatePresence>
                    {openSections.tires && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <CardContent className="pt-2">
                          {(inspConfig.show_tire_tread_depth || inspConfig.show_brake_pad_measurements) && (
                            <div className="mb-4">
                              <BrakePadDepthWidget
                                showTires={inspConfig.show_tire_tread_depth}
                                showBrakes={inspConfig.show_brake_pad_measurements}
                                tireDepths={{
                                  leftFront: tireDepth.lf,
                                  rightFront: tireDepth.rf,
                                  leftRear: tireDepth.lr,
                                  rightRear: tireDepth.rr,
                                }}
                                brakeDepths={{
                                  leftFront: brakeDepth.lf,
                                  rightFront: brakeDepth.rf,
                                  leftRear: brakeDepth.lr,
                                  rightRear: brakeDepth.rr,
                                }}
                                onTireChange={(id, depth) => {
                                  const map: Record<string, string> = { leftFront: "lf", rightFront: "rf", leftRear: "lr", rightRear: "rr" };
                                  setTireDepth(p => ({ ...p, [map[id]]: depth }));
                                }}
                                onBrakeChange={(id, depth) => {
                                  const map: Record<string, string> = { leftFront: "lf", rightFront: "rf", leftRear: "lr", rightRear: "rr" };
                                  setBrakeDepth(p => ({ ...p, [map[id]]: depth }));
                                }}
                              />
                            </div>
                          )}
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </div>
            );
          }

          if (section.key === "measurements") {
            return (
              <div key="measurements" ref={el => { sectionRefs.current["measurements"] = el; }}>
                <Card className={`print:shadow-none print:border-foreground/30 break-inside-avoid border-l-4 ${section.borderAccent} overflow-hidden`}>
                  <button type="button" onClick={() => setOpenSections(p => ({ ...p, measurements: !p.measurements }))}
                    className={`w-full text-left bg-gradient-to-r ${section.gradient}`}>
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ThermometerSun className="h-5 w-5 text-primary" />
                        Quick Measurements
                        <div className="ml-auto">
                          {openSections.measurements ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </button>
                  <AnimatePresence>
                    {openSections.measurements && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <CardContent className="pt-2">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {inspConfig.show_paint_readings && <InspectionField label="Paint Meter (mil)" value={paintReading} onChange={setPaintReading} placeholder="e.g. 4.2 avg" />}
                            {inspConfig.show_oil_life && <InspectionField label="Oil Life %" value={oilLife} onChange={setOilLife} placeholder="e.g. 65%" />}
                            {inspConfig.show_battery_health && <InspectionField label="Battery Health" value={batteryHealth} onChange={setBatteryHealth} placeholder="e.g. Good — 12.6V" />}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </div>
            );
          }

          // Regular checklist sections
          return (
            <div key={section.key} ref={el => { sectionRefs.current[section.key] = el; }}>
              <ChecklistSection
                sectionDef={section}
                grades={allGrades}
                notes={allNotes}
                onCycle={cycleGrade}
                onSetGrade={setGrade}
                onNoteChange={setNote}
                onMarkAllGood={() => markAllGood(section.items)}
                flaggedItems={flaggedItems}
                isOpen={openSections[section.key] ?? true}
                onToggle={() => setOpenSections(p => ({ ...p, [section.key]: !p[section.key] }))}
              />
            </div>
          );
        })}

        {/* Final Assessment */}
        <Card className="print:shadow-none print:border-foreground/30 border-l-4 border-l-emerald-500 break-inside-avoid">
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

      {/* ── Sticky Save Bar with #8 animated confirmation ── */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProgressRing progress={progressPct} size={36} strokeWidth={3} />
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalChecked}</span>/{ACTIVE_ALL_ITEMS.length} items
              {totalIssues > 0 && <span className="ml-2 text-destructive font-medium">• {totalIssues} issue{totalIssues > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {saveSuccess ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <CheckCircle className="h-6 w-6" />
                </motion.div>
                Inspection Saved!
              </motion.div>
            ) : (
              <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
                  {saving ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Inspection"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
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

const TireBrakeInput = ({ label, value, onChange, placeholder, accent }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; accent?: boolean }) => (
  <div>
    <label className={`text-[10px] font-semibold mb-1 block ${accent ? "text-primary" : "text-muted-foreground"}`}>{label}</label>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm text-center" inputMode="decimal" />
  </div>
);

const TreadGuide = ({ label, range, color }: { label: string; range: string; color: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`w-4 h-4 rounded-full ${color}`} />
    <span className="font-semibold text-xs">{label}</span>
    <span className="text-muted-foreground text-[10px]">{range}</span>
  </div>
);

export default InspectionSheet;
