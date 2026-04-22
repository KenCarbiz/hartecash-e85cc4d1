import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Shield, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  suggested_condition: string;
  created_at: string;
}

interface AIDamageReportProps {
  submissionId: string;
  vehicleStr: string;
}

const SEVERITY_COLORS = {
  minor: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  moderate: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  severe: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
};

const TYPE_LABELS: Record<string, string> = {
  dent: "Dent",
  scratch: "Scratch",
  rust: "Rust",
  paint_chip: "Paint Chip",
  crack: "Crack",
  misaligned_panel: "Misaligned Panel",
  missing_part: "Missing Part",
  stain: "Stain",
  tear: "Tear",
  wear: "Wear",
  other: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  front: "Front View",
  rear: "Rear View",
  "driver-side": "Driver Side",
  "passenger-side": "Passenger Side",
  dashboard: "Dashboard",
  interior: "Interior",
  damage: "Damage Photos",
};

const AIDamageReport = ({ submissionId, vehicleStr }: AIDamageReportProps) => {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("damage_reports")
        .select("*")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: true });

      if (data) setReports(data as unknown as DamageReport[]);
      setLoading(false);
    };
    fetchReports();
  }, [submissionId]);

  if (loading || reports.length === 0) return null;

  const allDamageItems = reports.flatMap((r) => r.damage_items || []);
  const severeCount = allDamageItems.filter((d) => d.severity === "severe").length;
  const moderateCount = allDamageItems.filter((d) => d.severity === "moderate").length;
  const minorCount = allDamageItems.filter((d) => d.severity === "minor").length;
  const totalIssues = allDamageItems.length;
  const noDamage = totalIssues === 0;

  const avgConfidence = Math.round(
    reports.reduce((sum, r) => sum + r.confidence_score, 0) / reports.length
  );

  // Determine overall condition color
  const overallCondition = noDamage ? "excellent" : severeCount >= 2 ? "poor" : severeCount >= 1 || moderateCount >= 3 ? "fair" : "good";
  const conditionColors: Record<string, string> = {
    excellent: "text-success",
    good: "text-success",
    fair: "text-amber-600 dark:text-amber-400",
    poor: "text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-card rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <h3 className="font-bold text-card-foreground flex items-center gap-1.5">
                AI Damage Assessment
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {avgConfidence}% confidence
            </span>
            {noDamage ? (
              <span className="text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" /> Clean
              </span>
            ) : (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${conditionColors[overallCondition]} bg-current/10`}>
                {totalIssues} issue{totalIssues !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Our AI analyzed {reports.length} photo{reports.length !== 1 ? "s" : ""} of your {vehicleStr} for damage, wear, and condition issues.
        </p>
      </div>

      {/* Summary Row */}
      <div className="p-5">
        {noDamage ? (
          <div className="flex items-center gap-3 bg-success/5 border border-success/15 rounded-lg p-4">
            <CheckCircle className="w-6 h-6 text-success shrink-0" />
            <div>
              <p className="font-semibold text-card-foreground">No Damage Detected</p>
              <p className="text-sm text-muted-foreground">
                AI inspection found your {vehicleStr} to be in excellent condition across all photos.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Severity summary chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {severeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertTriangle className="w-3 h-3" />
                  {severeCount} Severe
                </span>
              )}
              {moderateCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {moderateCount} Moderate
                </span>
              )}
              {minorCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {minorCount} Minor
                </span>
              )}
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${conditionColors[overallCondition]} bg-current/5`}>
                AI Condition: {overallCondition.charAt(0).toUpperCase() + overallCondition.slice(1)}
              </span>
            </div>

            {/* Expandable detail */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors mb-2"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? "Hide Details" : "View Detailed Findings"}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 overflow-hidden"
                >
                  {reports
                    .filter((r) => r.damage_detected && r.damage_items.length > 0)
                    .map((report) => (
                      <div key={report.id} className="border border-border/50 rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-card-foreground">
                            📷 {CATEGORY_LABELS[report.photo_category] || report.photo_category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {report.damage_items.length} finding{report.damage_items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="p-3 space-y-2">
                          {report.damage_items.map((item, i) => {
                            const colors = SEVERITY_COLORS[item.severity];
                            return (
                              <div
                                key={i}
                                className={`flex items-start gap-2.5 ${colors.bg} ${colors.border} border rounded-lg px-3 py-2`}
                              >
                                <span className={`text-xs font-bold uppercase mt-0.5 ${colors.text}`}>
                                  {item.severity}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-card-foreground">
                                    {TYPE_LABELS[item.type] || item.type} — {item.location.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <div className="mt-4 pt-3 border-t border-border flex items-start gap-2 text-xs text-muted-foreground">
          <Brain className="w-4 h-4 shrink-0 mt-0.5 text-violet-500" />
          <p>Powered by AI vision analysis. This assessment supplements — but does not replace — the in-person inspection.</p>
        </div>
      </div>
    </motion.div>
  );
};

export default AIDamageReport;
