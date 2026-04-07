import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useInspectionConfig } from "@/hooks/useInspectionConfig";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import {
  ArrowLeft, Printer, Camera, AlertTriangle, CheckCircle, Car, Gauge, Wrench,
  Save, Smartphone, Eye, Zap, Paintbrush, Armchair, Shield, ThermometerSun,
  ChevronDown, ChevronRight, CheckCheck, Sparkles, ClipboardCheck, RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import BrakePadDepthWidget from "@/components/inspection/BrakePadDepthWidget";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { formatGrade } from "@/lib/formatGrade";
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

type ConditionGrade = "" | "pass" | "caution" | "fail";

const GRADE_CYCLE: ConditionGrade[] = ["", "pass", "caution", "fail"];

// #9 — Dark-mode-friendly grade colors using HSL tokens
const gradeStyle = (g: ConditionGrade) => {
  switch (g) {
    case "pass": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/50 dark:border-emerald-500/40 ring-emerald-400/30";
    case "caution": return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/50 dark:border-amber-500/40 ring-amber-400/30";
    case "fail": return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-400/50 dark:border-red-500/40 ring-red-400/30";
    default: return "bg-muted/50 text-muted-foreground border-border";
  }
};

const gradeIcon = (g: ConditionGrade) => {
  switch (g) {
    case "pass": return "✓";
    case "caution": return "~";
    case "fail": return "✗";
    default: return "○";
  }
};

const gradeLabel = (g: ConditionGrade) => {
  switch (g) {
    case "pass": return "Pass";
    case "caution": return "Caution";
    case "fail": return "Fail";
    default: return "Not Checked";
  }
};

// ── Inspection Mode Types ──
type InspectionMode = "full" | "ucm";

// ── UCM (Used Car Manager) abbreviated items — key stuff a non-mechanic checks ──
const UCM_ITEMS: Record<string, string[]> = {
  exterior: [
    "Hood", "Front Bumper", "Rear Bumper", "Roof",
    "Left Front Fender", "Right Front Fender",
    "Left Front Door", "Right Front Door",
    "Left Rear Door", "Right Rear Door",
    "Windshield", "Wheels/Rims", "Paint Condition",
  ],
  interior: [
    "Driver Seat", "Passenger Seat", "Dashboard",
    "Steering Wheel", "Carpet/Floor Mats", "Headliner",
    "Odor Check", "Seat Belts",
  ],
  mechanical: [
    "Engine Start/Idle", "Engine Noise", "Transmission Shift",
    "Exhaust Noise", "Visible Leaks", "A/C Blows Cold",
  ],
  electrical: [
    "A/C System", "Power Windows", "Power Locks",
    "Radio/Infotainment", "Backup Camera", "All Lights Work",
  ],
  glass: [
    "Windshield Chips/Cracks", "Side Windows", "Rear Window",
  ],
};

// ── Full Tech checklist definitions ──
const FULL_SECTION_DEFS = [
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
      // Organized: left-column items paired with right-column items (left side / right side of vehicle)
      "Hood", "Front Bumper",
      "Rear Bumper", "Roof",
      "Trunk/Liftgate", "Windshield",
      "Left Front Fender", "Right Front Fender",
      "Left Rear Quarter", "Right Rear Quarter",
      "Left Front Door", "Right Front Door",
      "Left Rear Door", "Right Rear Door",
      "Left Mirror", "Right Mirror",
      "Left Headlight", "Right Headlight",
      "Left Taillight", "Right Taillight",
      "Rear Glass", "Grille",
      "Wheels/Rims", "Undercarriage",
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

const getSectionDefs = (mode: InspectionMode) => {
  if (mode === "full") return FULL_SECTION_DEFS;
  // UCM mode: same structure but with abbreviated items
  return FULL_SECTION_DEFS.map(section => {
    if (section.key === "tires" || section.key === "measurements") return section;
    const ucmItems = UCM_ITEMS[section.key];
    if (!ucmItems) return section;
    return { ...section, items: ucmItems };
  });
};

const ALL_CHECKLIST_SECTIONS = FULL_SECTION_DEFS.filter(s => s.items.length > 0);
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
        onSetGrade("pass");
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
      {(grade === "caution" || grade === "fail") && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowNote(!showNote); }}
            className="text-[10px] underline opacity-70 hover:opacity-100"
          >
            {showNote ? "hide" : "+ note"}
          </button>
        )}
      </button>
      {showNote && (grade === "caution" || grade === "fail") && (
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
  sectionDef: typeof FULL_SECTION_DEFS[number];
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
  const issues = items.filter(i => grades[i] === "fail").length;
  const cautions = items.filter(i => grades[i] === "caution").length;
  const allGood = checked === items.length && issues === 0 && cautions === 0;
  const allMarkedGood = items.every(i => grades[i] === "pass");

  return (
    <Card className={`print:shadow-none print:border-foreground/30 break-inside-avoid border-l-4 ${borderAccent} overflow-hidden`}>
      <div className={`w-full text-left bg-gradient-to-r ${gradient}`}>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {/* Mark All Pass circle toggle */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkAllGood(); }}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                allMarkedGood
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-muted-foreground/30 bg-background hover:border-emerald-400"
              }`}
              title={allMarkedGood ? "Clear all" : "Mark all pass"}
            >
              {allMarkedGood && <CheckCheck className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </button>
            <button type="button" onClick={onToggle} className="ml-auto flex items-center gap-1.5 text-xs">
              {allGood && <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">All Good ✓</Badge>}
              {!allGood && (
                <Badge variant="secondary" className="text-[10px]">{checked}/{items.length}</Badge>
              )}
              {issues > 0 && (
                <Badge variant="destructive" className="text-[10px]">{issues} issue{issues > 1 ? "s" : ""}</Badge>
              )}
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardTitle>
        </CardHeader>
      </div>
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
              {/* #1 Mark All Pass — now handled by the circle in the header */}
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
    {(["pass", "caution", "fail"] as ConditionGrade[]).map(g => (
      <div key={g} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${gradeStyle(g)}`}>
        <span className="font-bold">{gradeIcon(g)}</span>
        <span className="font-medium">{gradeLabel(g)}</span>
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
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { config } = useSiteConfig();
  const { config: inspConfig, loading: inspConfigLoading } = useInspectionConfig();
  const printRef = useRef<HTMLDivElement>(null);

  const [submission, setSubmission] = useState<any>(null);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [inspectionMode, setInspectionMode] = useState<InspectionMode>(
    inspConfig.default_inspection_mode === "full" ? "full" : "ucm"
  );

  // Get section defs based on inspection mode
  const SECTION_DEFS = getSectionDefs(inspectionMode);

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
    .filter(Boolean) as typeof FULL_SECTION_DEFS;

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

  // Depth policies
  interface DepthPolicy { id: string; name: string; policy_type: string; oem_brands: string[]; all_brands: boolean; max_vehicle_age_years: number | null; max_mileage: number | null; min_tire_depth: number; min_brake_depth: number; is_active: boolean; }
  const [depthPolicies, setDepthPolicies] = useState<DepthPolicy[]>([]);

  // Mechanical fields
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [paintReading, setPaintReading] = useState("");
  const [oilLife, setOilLife] = useState("");
  const [batteryHealth, setBatteryHealth] = useState("");
  const [overallGrade, setOverallGrade] = useState("");
  const [inspectorGrade, setInspectorGrade] = useState("");
  const [customerGrade, setCustomerGrade] = useState("");

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
      const allAlreadyGood = items.every(i => prev[i] === "pass");
      const updated = { ...prev };
      if (allAlreadyGood) {
        items.forEach(i => { updated[i] = ""; });
      } else {
        items.forEach(i => { updated[i] = "pass"; });
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

    // Map AI damage locations to inspection checklist items
    const AI_LOCATION_TO_ITEMS: Record<string, string[]> = {
      front_bumper: ["Front Bumper"],
      rear_bumper: ["Rear Bumper"],
      hood: ["Hood"],
      roof: ["Roof"],
      trunk: ["Trunk/Liftgate"],
      liftgate: ["Trunk/Liftgate"],
      driver_door: ["Left Front Door"],
      passenger_door: ["Right Front Door"],
      left_front_door: ["Left Front Door"],
      right_front_door: ["Right Front Door"],
      left_rear_door: ["Left Rear Door"],
      right_rear_door: ["Right Rear Door"],
      driver_fender: ["Left Front Fender"],
      left_front_fender: ["Left Front Fender"],
      right_front_fender: ["Right Front Fender"],
      left_rear_quarter: ["Left Rear Quarter"],
      right_rear_quarter: ["Right Rear Quarter"],
      rear_quarter_panel: ["Left Rear Quarter", "Right Rear Quarter"],
      windshield: ["Windshield", "Windshield Chips/Cracks"],
      rear_glass: ["Rear Glass", "Rear Window"],
      left_mirror: ["Left Mirror"],
      right_mirror: ["Right Mirror"],
      left_headlight: ["Left Headlight"],
      right_headlight: ["Right Headlight"],
      left_taillight: ["Left Taillight"],
      right_taillight: ["Right Taillight"],
      grille: ["Grille"],
      wheels: ["Wheels/Rims"],
      rims: ["Wheels/Rims"],
      undercarriage: ["Undercarriage"],
      dashboard: ["Dashboard"],
      driver_seat: ["Driver Seat"],
      passenger_seat: ["Passenger Seat"],
      rear_seats: ["Rear Seats"],
      headliner: ["Headliner"],
      steering_wheel: ["Steering Wheel"],
      carpet: ["Carpet/Floor Mats"],
      center_console: ["Center Console"],
      door_panels: ["Door Panels"],
    };

    const severityToGrade = (severity: string): ConditionGrade => {
      if (severity === "severe") return "fail";
      if (severity === "moderate") return "fail";
      return "caution";
    };

    const prefillGradesFromAI = (reports: DamageReport[]) => {
      const items = reports.flatMap(r => r.damage_items || []);
      if (items.length === 0) return;

      const newGrades: Record<string, ConditionGrade> = {};
      const newNotes: Record<string, string> = {};
      const gradeRank: Record<ConditionGrade, number> = { "": 0, pass: 1, caution: 2, fail: 3 };

      for (const dmg of items) {
        const loc = dmg.location.toLowerCase().replace(/ /g, "_");
        const matchedItems = AI_LOCATION_TO_ITEMS[loc] || [];
        const grade = severityToGrade(dmg.severity);
        const noteText = `AI: ${dmg.description}`;

        for (const item of matchedItems) {
          // Only upgrade severity, never downgrade
          if ((gradeRank[grade] || 0) > (gradeRank[newGrades[item]] || 0)) {
            newGrades[item] = grade;
          }
          // Append notes
          newNotes[item] = newNotes[item] ? `${newNotes[item]}; ${noteText}` : noteText;
        }
      }

      if (Object.keys(newGrades).length > 0) {
        setAllGrades(prev => ({ ...newGrades, ...prev }));
        setAllNotes(prev => ({ ...newNotes, ...prev }));
      }
    };

    const loadSubmission = async () => {
      const [subRes, dmgRes, policiesRes] = await Promise.all([
        supabase.from("submissions").select("*").eq("id", id).maybeSingle(),
        supabase.from("damage_reports").select("*").eq("submission_id", id).order("created_at"),
        supabase.from("depth_policies").select("*").eq("dealership_id", dealershipId).eq("is_active", true).order("sort_order"),
      ]);
      if (policiesRes.data) setDepthPolicies(policiesRes.data as DepthPolicy[]);
      if (subRes.data) {
        setSubmission(subRes.data);
        setCustomerGrade(subRes.data.overall_condition || "");
        setOverallGrade(subRes.data.overall_condition || "");
        setInspectorGrade((subRes.data as any).inspector_grade || "");
        if (subRes.data.tire_lf != null) setTireDepth(prev => ({ ...prev, lf: subRes.data.tire_lf }));
        if (subRes.data.tire_rf != null) setTireDepth(prev => ({ ...prev, rf: subRes.data.tire_rf }));
        if (subRes.data.tire_lr != null) setTireDepth(prev => ({ ...prev, lr: subRes.data.tire_lr }));
        if (subRes.data.tire_rr != null) setTireDepth(prev => ({ ...prev, rr: subRes.data.tire_rr }));
        if (subRes.data.brake_lf != null) setBrakeDepth(prev => ({ ...prev, lf: subRes.data.brake_lf }));
        if (subRes.data.brake_rf != null) setBrakeDepth(prev => ({ ...prev, rf: subRes.data.brake_rf }));
        if (subRes.data.brake_lr != null) setBrakeDepth(prev => ({ ...prev, lr: subRes.data.brake_lr }));
        if (subRes.data.brake_rr != null) setBrakeDepth(prev => ({ ...prev, rr: subRes.data.brake_rr }));
        if (subRes.data.internal_notes) setInspectorNotes(subRes.data.internal_notes);
        const saved = (subRes.data as any).inspection_data;
        if (saved && typeof saved === "object") {
          if (saved.grades) setAllGrades(saved.grades);
          if (saved.itemNotes) setAllNotes(saved.itemNotes);
          if (saved.paintReading) setPaintReading(saved.paintReading);
          if (saved.oilLife) setOilLife(saved.oilLife);
          if (saved.batteryHealth) setBatteryHealth(saved.batteryHealth);
        }
      }
      if (dmgRes.data) {
        const reports = dmgRes.data as unknown as DamageReport[];
        setDamageReports(reports);
        prefillGradesFromAI(reports);
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Refresh inspection data from database (pulls mobile inspection updates)
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshInspection = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const { data: subData } = await supabase.from("submissions").select("*").eq("id", id).maybeSingle();
      if (subData) {
        setSubmission(subData);
        if (subData.tire_lf != null) setTireDepth(prev => ({ ...prev, lf: subData.tire_lf }));
        if (subData.tire_rf != null) setTireDepth(prev => ({ ...prev, rf: subData.tire_rf }));
        if (subData.tire_lr != null) setTireDepth(prev => ({ ...prev, lr: subData.tire_lr }));
        if (subData.tire_rr != null) setTireDepth(prev => ({ ...prev, rr: subData.tire_rr }));
        if (subData.brake_lf != null) setBrakeDepth(prev => ({ ...prev, lf: subData.brake_lf }));
        if (subData.brake_rf != null) setBrakeDepth(prev => ({ ...prev, rf: subData.brake_rf }));
        if (subData.brake_lr != null) setBrakeDepth(prev => ({ ...prev, lr: subData.brake_lr }));
        if (subData.brake_rr != null) setBrakeDepth(prev => ({ ...prev, rr: subData.brake_rr }));
        if ((subData as any).inspector_grade) setInspectorGrade((subData as any).inspector_grade);
        const saved = (subData as any).inspection_data;
        if (saved && typeof saved === "object") {
          if (saved.grades) setAllGrades(prev => ({ ...prev, ...saved.grades }));
          if (saved.itemNotes) setAllNotes(prev => ({ ...prev, ...saved.itemNotes }));
          if (saved.paintReading) setPaintReading(saved.paintReading);
          if (saved.oilLife) setOilLife(saved.oilLife);
          if (saved.batteryHealth) setBatteryHealth(saved.batteryHealth);
        }
        toast({ title: "Refreshed", description: "Inspection data updated from latest mobile submission." });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to refresh inspection data.", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }, [id, toast]);

  // #8 — Animated save with confetti
   const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    // Build structured inspection data to persist (not dumped into notes)
    const inspectionData = {
      grades: allGrades,
      itemNotes: allNotes,
      paintReading: paintReading || null,
      oilLife: oilLife || null,
      batteryHealth: batteryHealth || null,
      inspectedAt: new Date().toISOString(),
      mode: inspectionMode,
    };

    // Save inspection_data JSON + only the user-typed notes
    const { error: updateErr } = await supabase
      .from("submissions")
      .update({
        inspection_data: inspectionData,
        internal_notes: inspectorNotes || null,
        overall_condition: inspectorGrade || overallGrade || undefined,
        inspector_grade: inspectorGrade || null,
        tire_lf: tireDepth.lf, tire_rf: tireDepth.rf, tire_lr: tireDepth.lr, tire_rr: tireDepth.rr,
        brake_lf: brakeDepth.lf, brake_rf: brakeDepth.rf, brake_lr: brakeDepth.lr, brake_rr: brakeDepth.rr,
      } as any)
      .eq("id", id!);

    // Also call RPC for tire adjustment calculation
    const { data, error } = await supabase.rpc("save_mobile_inspection", {
      _submission_id: id!,
      _internal_notes: inspectorNotes || "",
      _overall_condition: inspectorGrade || overallGrade || null,
      _tire_lf: tireDepth.lf,
      _tire_rf: tireDepth.rf,
      _tire_lr: tireDepth.lr,
      _tire_rr: tireDepth.rr,
      _brake_lf: brakeDepth.lf,
      _brake_rf: brakeDepth.rf,
      _brake_lr: brakeDepth.lr,
      _brake_rr: brakeDepth.rr,
      _inspector_grade: inspectorGrade || null,
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
    const logoUrl = config?.logo_url || "";
    const isStandard = inspectionMode === "ucm";
    const formTitle = isStandard ? "Standard Vehicle Inspection" : "Full Technical Inspection";

    // ── Shared Styles ──
    const css = `
      @page { size: letter; margin: 0.4in 0.5in; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.4; }
      .header { display: flex; align-items: center; border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 14px; position: relative; }
      .header .logo { height: 44px; flex-shrink: 0; }
      .header .center { flex: 1; text-align: center; }
      .header .center h1 { font-size: 18px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
      .header .center .subtitle { font-size: 11px; color: #555; font-weight: 500; margin-top: 2px; }
      .header .right { text-align: right; font-size: 10px; color: #666; flex-shrink: 0; }
      .header .right .date { font-weight: 700; font-size: 11px; color: #111; }
      .vehicle-bar { display: flex; gap: 2px; margin-bottom: 14px; border: 1.5px solid #222; border-radius: 6px; overflow: hidden; }
      .vehicle-bar .cell { flex: 1; padding: 6px 10px; border-right: 1px solid #ddd; }
      .vehicle-bar .cell:last-child { border-right: none; }
      .vehicle-bar .cell-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; font-weight: 600; }
      .vehicle-bar .cell-value { font-size: 12px; font-weight: 700; margin-top: 1px; }
      .vehicle-bar .cell-mono { font-family: 'SF Mono', 'Consolas', monospace; font-size: 10px; letter-spacing: 0.5px; }
      .section { break-inside: avoid; margin-bottom: 12px; border: 1.5px solid #ccc; border-radius: 6px; overflow: hidden; }
      .section-header { background: #f5f5f5; padding: 6px 10px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; align-items: center; }
      .section-header h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      .section-header .badge { font-size: 9px; color: #666; font-weight: 500; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
      .grid-2 .item { border-bottom: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5; }
      .grid-2 .item:nth-child(2n) { border-right: none; }
      .item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; min-height: 28px; }
      .cb { width: 15px; height: 15px; border: 1.5px solid #555; border-radius: 2px; flex-shrink: 0; }
      .pf-boxes { display: flex; gap: 8px; flex-shrink: 0; }
      .pf-box { display: flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 600; color: #555; }
      .pf-box .cb-sm { width: 14px; height: 14px; border: 1.5px solid #555; border-radius: 2px; }
      .item-label { font-size: 11.5px; font-weight: 500; flex-shrink: 0; }
      .item-grade { display: flex; gap: 4px; flex-shrink: 0; }
      .item-grade .g { width: 16px; height: 16px; border: 1.5px solid #999; border-radius: 2px; text-align: center; font-size: 8px; line-height: 16px; font-weight: 700; color: #777; }
      .note-line { border-bottom: 1px dotted #bbb; height: 20px; flex: 1; min-width: 70px; }
      .tire-table { width: 100%; border-collapse: collapse; }
      .tire-table th, .tire-table td { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center; font-size: 12px; }
      .tire-table th { background: #fafafa; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
      .tire-table td.label-cell { text-align: left; font-weight: 600; }
      .tire-table .write-box { width: 48px; height: 22px; border: 1.5px solid #999; border-radius: 3px; display: inline-block; }
      .measure-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #e5e5e5; min-height: 32px; }
      .measure-label { font-weight: 600; font-size: 11.5px; width: 120px; flex-shrink: 0; }
      .measure-line { flex: 1; border-bottom: 1px solid #bbb; height: 20px; }
      .notes-box { border: 1.5px solid #ccc; border-radius: 6px; overflow: hidden; break-inside: avoid; margin-bottom: 12px; }
      .notes-header { background: #f5f5f5; padding: 8px 12px; border-bottom: 1.5px solid #aaa; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .notes-lines { padding: 10px 12px; }
      .notes-lines .line { border-bottom: 1px dotted #ccc; height: 28px; }
      .grade-box { display: inline-flex; gap: 14px; margin: 6px 0; }
      .grade-option { display: flex; align-items: center; gap: 5px; font-size: 11px; }
      .grade-option .radio { width: 14px; height: 14px; border: 1.5px solid #555; border-radius: 50%; }
      .signatures { margin-top: 28px; padding-top: 16px; border-top: 2px solid #ddd; display: flex; justify-content: space-between; gap: 40px; }
      .sig-block { flex: 1; }
      .sig-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; margin-bottom: 4px; }
      .sig-line { border-bottom: 1.5px solid #333; height: 32px; }
      .sig-date { margin-top: 4px; font-size: 9px; color: #aaa; }
      .test-drive-section .item { padding: 4px 8px; }
      .footer { text-align: center; margin-top: 16px; font-size: 8px; color: #bbb; }
    `;

    // ── Grade Columns for Full Mode ──
    const gradeColumns = `
      <div class="item-grade">
        <div class="g">G</div>
        <div class="g">F</div>
        <div class="g">P</div>
        <div class="g">D</div>
      </div>`;

    // ── Build checklist item row ──
    const passFail = `<div class="pf-boxes"><div class="pf-box"><div class="cb-sm"></div>P</div><div class="pf-box"><div class="cb-sm"></div>F</div></div>`;

    const checkItem = (label: string, withGrades: boolean, withNote: boolean = true) => `
      <div class="item">
        ${withGrades ? '' : passFail}
        <span class="item-label">${label}</span>
        ${withNote ? '<div class="note-line"></div>' : ''}
        ${withGrades ? gradeColumns : ''}
      </div>`;

    // ── Standard Mode: Test Drive + checklist categories ──
    const standardTestDrive = `
      <div class="section test-drive-section">
        <div class="section-header" style="border-bottom-color:#0ea5e9;">
          <h2>🚗 Test Drive</h2>
          <span class="badge">Required</span>
        </div>
        <div class="grid-2">
          ${["Test drive completed", "Transmission shifts correctly", "No unusual engine noise", "Brakes feel normal", "Steering straight / no pull", "Suspension smooth — no clunks", "No warning lights on dash", "A/C blows cold", "Heat works"].map(i => checkItem(i, false, false)).join("")}
        </div>
        <div style="padding:6px 10px;border-top:1px solid #e5e5e5;">
          <span style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;">Test Drive Notes</span>
          <div class="note-line" style="height:20px;margin-top:4px;"></div>
        </div>
      </div>`;

    const standardSection = (title: string, items: string[], color: string) => `
      <div class="section">
        <div class="section-header" style="border-bottom-color:${color};">
          <h2>${title}</h2>
          <span class="badge">${items.length} items</span>
        </div>
        <div class="grid-2">
          ${items.map(i => checkItem(i, false)).join("")}
        </div>
      </div>`;

    // ── Full Mode: grade-based checklist ──
    const fullSection = (title: string, items: string[], color: string) => {
      if (!items.length) return "";
      return `
        <div class="section">
          <div class="section-header" style="border-bottom-color:${color};">
            <h2>${title}</h2>
            <span class="badge">G=Good · F=Fair · P=Poor · D=Damaged</span>
          </div>
          <div class="grid-2">
            ${items.map(i => checkItem(i, true)).join("")}
          </div>
        </div>`;
    };

    // ── Tire & Brake Table (shared) ──
    const tireBrakeSection = `
      <div class="section">
        <div class="section-header" style="border-bottom-color:#0ea5e9;">
          <h2>Tire Tread & Brake Pads</h2>
          <span class="badge">Depth in /32"</span>
        </div>
        <table class="tire-table">
          <thead>
            <tr><th></th><th>Left Front</th><th>Right Front</th><th>Left Rear</th><th>Right Rear</th><th>Avg</th></tr>
          </thead>
          <tbody>
            <tr>
              <td class="label-cell">Tire Tread</td>
              <td><div class="write-box"></div></td><td><div class="write-box"></div></td>
              <td><div class="write-box"></div></td><td><div class="write-box"></div></td>
              <td><div class="write-box"></div></td>
            </tr>
            <tr>
              <td class="label-cell">Brake Pads</td>
              <td><div class="write-box"></div></td><td><div class="write-box"></div></td>
              <td><div class="write-box"></div></td><td><div class="write-box"></div></td>
              <td><div class="write-box"></div></td>
            </tr>
          </tbody>
        </table>
        <div style="padding:4px 10px;font-size:9px;color:#888;background:#fafafa;border-top:1px solid #e5e5e5;">
          Tire Brand: __________________ &nbsp;&nbsp; Tire Size: __________________ &nbsp;&nbsp; Match: ☐ Yes ☐ No &nbsp;&nbsp; Spare Present: ☐ Yes ☐ No
        </div>
        ${applicablePolicies.length > 0 ? `
        <div style="padding:8px 10px;border-top:1px solid #e5e5e5;background:#f0f7ff;">
          <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#1e40af;margin-bottom:4px;">⛨ Certification Depth Requirements</div>
          ${applicablePolicies.map(p => {
            const typeLabels: Record<string, string> = { manufacturer_cpo: "Mfr CPO", limited_cpo: "Ltd CPO", internal_cert: "Internal", custom: "Custom", standard: "Standard" };
            return `<div style="font-size:10px;padding:2px 0;color:#333;">
              <strong>${typeLabels[p.policy_type] || p.policy_type}:</strong> ${p.name} — Tires ≥ ${p.min_tire_depth}/32″, Brakes ≥ ${p.min_brake_depth}/32″
              ${p.max_vehicle_age_years ? ` — ≤${p.max_vehicle_age_years}yr` : ""}${p.max_mileage ? ` — ≤${p.max_mileage.toLocaleString()}mi` : ""}
            </div>`;
          }).join("")}
        </div>` : ""}
      </div>`;

    // ── Measurements Section (Full only) ──
    const measurementsSection = `
      <div class="section">
        <div class="section-header" style="border-bottom-color:#8b5cf6;">
          <h2>Measurements & Readings</h2>
        </div>
        <div>
          ${["Paint Meter (mil)", "Oil Life %", "Battery Voltage", "Coolant Level", "Transmission Fluid"].map(m => `
            <div class="measure-row"><span class="measure-label">${m}</span><div class="measure-line"></div></div>
          `).join("")}
        </div>
      </div>`;

    // ── Overall Grade Box ──
    const overallGradeBox = `
      <div class="section">
        <div class="section-header" style="border-bottom-color:#10b981;">
          <h2>Overall Vehicle Grade</h2>
        </div>
        <div style="padding:8px 10px;">
          <div class="grade-box">
            ${["Excellent", "Good", "Fair", "Rough", "Poor"].map(g => `
              <div class="grade-option"><div class="radio"></div><span>${g}</span></div>
            `).join("")}
          </div>
        </div>
      </div>`;

    // ── Notes Box ──
    const notesBox = `
      <div class="notes-box">
        <div class="notes-header">${isStandard ? "Manager" : "Inspector"} Notes</div>
        <div class="notes-lines">
          ${Array(5).fill('<div class="line"></div>').join("")}
        </div>
      </div>`;

    // ── Equipment Verification Section ──
    const addDeducts: any[] = (() => {
      try {
        const raw = submission.bb_add_deducts;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();
    const customerSelected: string[] = submission.bb_selected_options || [];
    const autoEquip = addDeducts.filter((ad: any) => ad.auto !== "N");
    const customerOptional = addDeducts.filter((ad: any) => ad.auto === "N" && customerSelected.includes(ad.uoc));
    const hasPowertrain = submission.bb_drivetrain || submission.bb_transmission || submission.bb_engine || submission.bb_fuel_type;

    const equipmentSection = (hasPowertrain || autoEquip.length > 0 || customerOptional.length > 0) ? `
      <div class="section">
        <div class="section-header" style="border-bottom-color:#7c3aed;">
          <h2>🔧 Equipment & Powertrain Verification</h2>
          <span class="badge">Verify all items match the physical vehicle</span>
        </div>
        ${hasPowertrain ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e5e5e5;">
          ${[
            { label: "Drivetrain", value: submission.bb_drivetrain },
            { label: "Transmission", value: submission.bb_transmission },
            { label: "Engine", value: submission.bb_engine },
            { label: "Fuel Type", value: submission.bb_fuel_type },
          ].filter(s => s.value).map(s => `
            <div style="padding:6px 10px;border-right:1px solid #e5e5e5;">
              <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.8px;color:#888;font-weight:600;">${s.label}</div>
              <div style="font-size:11px;font-weight:700;margin-top:1px;">${s.value}</div>
            </div>
          `).join("")}
        </div>` : ""}
        ${autoEquip.length > 0 ? `
        <div style="padding:6px 10px;border-bottom:1px solid #e5e5e5;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-bottom:4px;">Factory Equipment (from VIN)</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${autoEquip.map((ad: any) => `
              <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:2px 6px;color:#166534;">
                ✓ ${ad.name}${ad.avg ? ` ($${ad.avg > 0 ? "+" : ""}${ad.avg})` : ""}
              </span>
            `).join("")}
          </div>
        </div>` : ""}
        ${customerOptional.length > 0 ? `
        <div style="padding:8px 10px;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#b45309;margin-bottom:6px;">⚠ Customer-Claimed Optional Equipment — VERIFY PRESENT</div>
          <div class="grid-2">
            ${customerOptional.map((ad: any) => `
              <div class="item" style="border:1.5px dashed #f59e0b;background:#fffbeb;margin:2px;border-radius:4px;">
                <div class="cb" style="border-color:#f59e0b;"></div>
                <span class="item-label" style="font-weight:600;">${ad.name}</span>
                ${ad.avg ? `<span style="font-size:9px;color:#92400e;font-weight:600;">($${ad.avg > 0 ? "+" : ""}${ad.avg})</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>` : ""}
      </div>` : "";

    // ── Compose Body ──
    let body = "";

    body += equipmentSection;
    body += tireBrakeSection;

    if (isStandard) {
      body += standardTestDrive;
      body += standardSection("Exterior", UCM_ITEMS.exterior, "#0284c7");
      body += standardSection("Interior", UCM_ITEMS.interior, "#d97706");
      body += standardSection("Mechanical", UCM_ITEMS.mechanical, "#475569");
      body += standardSection("Electrical", UCM_ITEMS.electrical, "#ca8a04");
      body += standardSection("Glass & Lights", UCM_ITEMS.glass || [], "#0d9488");
    } else {
      body += measurementsSection;
      ACTIVE_CHECKLIST_SECTIONS.forEach(s => {
        const colors: Record<string, string> = {
          exterior: "#0284c7", interior: "#d97706", mechanical: "#475569",
          electrical: "#ca8a04", glass: "#0d9488",
        };
        body += fullSection(s.label, s.items, colors[s.key] || "#666");
      });
    }

    body += overallGradeBox;
    body += notesBox;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${formTitle} — ${vTitle}</title>
      <style>${css}</style>
    </head><body>
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="${dealerName}" style="filter:brightness(0);" />` : `<span style="font-size:16px;font-weight:800;">${dealerName}</span>`}
        <div class="center">
          <h1>${formTitle}</h1>
          <div class="subtitle">${vTitle || "Vehicle Inspection"}</div>
        </div>
        <div class="right">
          <div class="date">Date: _____ / _____ / _____</div>
          <div style="margin-top:3px;">Stock #: ${submission.id?.slice(0, 8).toUpperCase() || "________"}</div>
          <div style="margin-top:2px;">Inspector: ____________________</div>
        </div>
      </div>

      <div class="vehicle-bar">
        <div class="cell"><div class="cell-label">Vehicle</div><div class="cell-value">${vTitle || "_______________"}</div></div>
        <div class="cell"><div class="cell-label">VIN</div><div class="cell-value cell-mono">${submission.vin || "_________________"}</div></div>
        <div class="cell"><div class="cell-label">Mileage</div><div class="cell-value">${submission.mileage ? Number(submission.mileage).toLocaleString() + " mi" : "________"}</div></div>
        <div class="cell"><div class="cell-label">Color</div><div class="cell-value">${submission.exterior_color || "________"}</div></div>
        <div class="cell"><div class="cell-label">Plate / State</div><div class="cell-value">${submission.plate || "______"} / ${submission.state || "__"}</div></div>
      </div>

      ${body}

      <div class="signatures">
        <div class="sig-block">
          <div class="sig-label">${isStandard ? "Manager" : "Inspector"} Signature</div>
          <div class="sig-line"></div>
          <div class="sig-date">Date: _____ / _____ / _____</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">${isStandard ? "Sales Advisor" : "Manager"} Signature</div>
          <div class="sig-line"></div>
          <div class="sig-date">Date: _____ / _____ / _____</div>
        </div>
      </div>

      <div class="footer">Confidential — ${dealerName} Internal Use Only</div>
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

  // Compute applicable depth policies for this vehicle
  const applicablePolicies = depthPolicies.filter(p => {
    if (!p.all_brands && p.oem_brands.length > 0 && submission.vehicle_make) {
      if (!p.oem_brands.some((b: string) => submission.vehicle_make.toLowerCase().includes(b.toLowerCase()))) return false;
    }
    if (p.max_vehicle_age_years != null && submission.vehicle_year) {
      const age = new Date().getFullYear() - parseInt(submission.vehicle_year);
      if (age > p.max_vehicle_age_years) return false;
    }
    if (p.max_mileage != null && submission.mileage) {
      const miles = parseInt(String(submission.mileage).replace(/[^0-9]/g, ""));
      if (miles > p.max_mileage) return false;
    }
    return true;
  });

  // #3 — AI flagged items mapped to checklist labels
  const flaggedItems = new Set(
    allDamageItems.flatMap(d => [d.type.replace(/_/g, " ").toLowerCase(), d.location.replace(/_/g, " ").toLowerCase()])
  );

  // Overall completion
  const totalChecked = ACTIVE_ALL_ITEMS.filter(i => !!allGrades[i]).length;
  const totalIssues = ACTIVE_ALL_ITEMS.filter(i => allGrades[i] === "caution" || allGrades[i] === "fail").length;
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 gap-1"
              onClick={handleRefreshInspection} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Syncing…" : "Sync"}
            </Button>
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
                    <QRCodeSVG value={`${window.location.origin}/inspect/${id}?mode=${inspectionMode === "full" ? "full" : "standard"}`} size={160} level="H" />
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
              <QRCodeSVG value={`${window.location.origin}/inspect/${id}?mode=${inspectionMode === "full" ? "full" : "standard"}`} size={64} level="M" />
            </div>
          </div>
        </div>
      </div>

      <div ref={printRef} className="max-w-5xl mx-auto p-4 md:p-6 print:p-4 print:max-w-none space-y-4">
        {/* Inspection Mode Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setInspectionMode("ucm")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                inspectionMode === "ucm"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Standard Inspection
            </button>
            <button
              onClick={() => setInspectionMode("full")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                inspectionMode === "full"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Full Inspection
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {inspectionMode === "ucm" ? "Standard inspection for managers & sales staff" : "Full mechanic-aided deep inspection"}
          </p>
        </div>

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
                <div className="w-40 h-24 rounded-lg overflow-hidden flex-shrink-0">
                  <VehicleImage year={submission.vehicle_year} make={submission.vehicle_make} model={submission.vehicle_model} selectedColor={submission.exterior_color || "white"} hideColorLabel />
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

        {/* Powertrain & Equipment Verification */}
        {(() => {
          const addDeducts: any[] = (() => {
            try {
              const raw = submission.bb_add_deducts;
              if (Array.isArray(raw)) return raw;
              if (typeof raw === "string") return JSON.parse(raw);
              return [];
            } catch { return []; }
          })();
          const customerSelected: string[] = submission.bb_selected_options || [];
          const autoEquipment = addDeducts.filter((ad: any) => ad.auto !== "N");
          const customerOptional = addDeducts.filter((ad: any) => ad.auto === "N" && customerSelected.includes(ad.uoc));
          const hasPowertrain = submission.bb_drivetrain || submission.bb_transmission || submission.bb_engine || submission.bb_fuel_type;
          const hasEquipment = autoEquipment.length > 0 || customerOptional.length > 0;

          return (hasPowertrain || hasEquipment) ? (
            <Card className="print:shadow-none print:border-foreground/30 border-l-4 border-l-primary bg-primary/5">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  Equipment & Powertrain Verification
                  <span className="ml-auto text-[10px] text-muted-foreground font-normal">Verify all items match the vehicle</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 space-y-3">
                {/* Powertrain Specs */}
                {hasPowertrain && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: "Drivetrain", value: submission.bb_drivetrain },
                      { label: "Transmission", value: submission.bb_transmission },
                      { label: "Engine", value: submission.bb_engine },
                      { label: "Fuel Type", value: submission.bb_fuel_type },
                    ].filter(s => s.value).map(spec => (
                      <div key={spec.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold block">{spec.label}</span>
                          <span className="font-semibold text-card-foreground text-xs">{spec.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Auto-Included Equipment */}
                {autoEquipment.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Factory Equipment (from VIN)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {autoEquipment.map((ad: any) => (
                        <Badge key={ad.uoc} variant="secondary" className="text-[10px] gap-1">
                          <CheckCircle className="w-3 h-3 text-success" />
                          {ad.name}
                          {ad.avg !== 0 && <span className={`font-bold ${ad.avg > 0 ? "text-success" : "text-destructive"}`}>{ad.avg > 0 ? "+" : ""}${ad.avg.toLocaleString()}</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer-Selected Optional Equipment — VERIFY THESE */}
                {customerOptional.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">⚠ Customer Claims These Options — Verify Present</p>
                    <div className="grid gap-1.5">
                      {customerOptional.map((ad: any) => (
                        <div key={ad.uoc} className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-amber-400/50 bg-amber-500/5 text-sm">
                          <div className="w-5 h-5 border-2 border-amber-500 rounded flex-shrink-0" />
                          <span className="font-medium text-card-foreground">{ad.name}</span>
                          {ad.avg !== 0 && (
                            <span className={`ml-auto text-xs font-bold ${ad.avg > 0 ? "text-success" : "text-destructive"}`}>
                              {ad.avg > 0 ? "+" : ""}${ad.avg.toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null;
        })()}

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
                                inputMode={inspConfig.tire_brake_input_mode}
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
                                  setTireDepth(p => ({ ...p, [map[id]]: depth === -1 ? null : depth }));
                                }}
                                onBrakeChange={(id, depth) => {
                                  const map: Record<string, string> = { leftFront: "lf", rightFront: "rf", leftRear: "lr", rightRear: "rr" };
                                  setBrakeDepth(p => ({ ...p, [map[id]]: depth }));
                                }}
                              />
                            </div>
                          )}
                          {/* Depth Policy Targets */}
                          {applicablePolicies.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-primary" />
                                Certification Depth Requirements
                              </p>
                              {applicablePolicies.map(policy => {
                                const POLICY_TYPE_LABELS: Record<string, string> = {
                                  manufacturer_cpo: "Manufacturer CPO",
                                  limited_cpo: "Limited CPO",
                                  internal_cert: "Internal Cert",
                                  custom: "Custom",
                                  standard: "Standard",
                                };
                                const typeLabel = POLICY_TYPE_LABELS[policy.policy_type] || policy.policy_type;
                                const tireVals = [tireDepth.lf, tireDepth.rf, tireDepth.lr, tireDepth.rr].filter(v => v != null) as number[];
                                const brakeVals = [brakeDepth.lf, brakeDepth.rf, brakeDepth.lr, brakeDepth.rr].filter(v => v != null) as number[];
                                const tireFail = tireVals.length > 0 && tireVals.some(v => v < policy.min_tire_depth);
                                const brakeFail = brakeVals.length > 0 && brakeVals.some(v => v < policy.min_brake_depth);
                                const tirePass = tireVals.length > 0 && !tireFail;
                                const brakePass = brakeVals.length > 0 && !brakeFail;
                                const hasFail = tireFail || brakeFail;

                                return (
                                  <div key={policy.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${hasFail ? "border-red-400/50 bg-red-500/5" : "border-border bg-muted/30"}`}>
                                    <Badge variant="outline" className={`text-[9px] shrink-0 ${hasFail ? "border-red-400/50 text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                      {typeLabel}
                                    </Badge>
                                    <span className="font-semibold text-card-foreground truncate">{policy.name}</span>
                                    <div className="ml-auto flex items-center gap-3 shrink-0">
                                      <span className={`font-mono font-bold ${tireFail ? "text-red-600 dark:text-red-400" : tirePass ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                        Tires ≥ {policy.min_tire_depth}/32″
                                        {tireFail && " ✗"}
                                        {tirePass && " ✓"}
                                      </span>
                                      <span className={`font-mono font-bold ${brakeFail ? "text-red-600 dark:text-red-400" : brakePass ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                        Brakes ≥ {policy.min_brake_depth}/32″
                                        {brakeFail && " ✗"}
                                        {brakePass && " ✓"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
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
            {/* Customer Grade vs Inspector Final Grade */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Customer Self-Assessment</label>
                <div className="h-10 flex items-center">
                  <Badge variant="outline" className={`text-sm px-3 py-1 ${
                    customerGrade === "excellent" ? "border-emerald-400/50 text-emerald-600 bg-emerald-500/10" :
                    customerGrade === "good" ? "border-emerald-400/50 text-emerald-600 bg-emerald-500/10" :
                    customerGrade === "fair" ? "border-amber-400/50 text-amber-600 bg-amber-500/10" :
                    customerGrade === "rough" || customerGrade === "poor" ? "border-red-400/50 text-red-600 bg-red-500/10" :
                    ""
                  }`}>
                    {formatGrade(customerGrade) || "Not provided"}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  {inspectorGrade ? "Final Grade" : "Inspector Final Grade"}
                </label>
                <select
                  value={inspectorGrade}
                  onChange={e => setInspectorGrade(e.target.value)}
                  className={`w-full h-10 rounded-md border-2 bg-background px-3 text-sm font-bold transition-all ${
                    inspectorGrade
                      ? "border-primary ring-2 ring-primary/20 text-primary"
                      : "border-input text-muted-foreground"
                  }`}
                >
                  <option value="">Select final grade...</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="rough">Rough</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
            {/* Show prominent final grade badge when set */}
            {inspectorGrade && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Verified Final Grade</p>
                  <p className="text-lg font-black text-primary">{formatGrade(inspectorGrade)}</p>
                </div>
                {customerGrade && customerGrade !== inspectorGrade && (
                  <div className="ml-auto text-right">
                    <p className="text-[9px] text-muted-foreground">Customer said</p>
                    <p className="text-xs font-medium text-muted-foreground">{formatGrade(customerGrade)}</p>
                  </div>
                )}
              </div>
            )}
            {submission.ai_condition_score && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">AI Suggested</label>
                <div className="h-10 flex items-center">
                  <Badge variant="outline" className="capitalize text-sm">{submission.ai_condition_score}</Badge>
                </div>
              </div>
            )}
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
