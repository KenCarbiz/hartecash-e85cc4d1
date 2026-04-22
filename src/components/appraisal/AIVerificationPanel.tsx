import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Gauge, Sparkles, Disc3, FileWarning, Sofa, Camera } from "lucide-react";

/**
 * AIVerificationPanel — inspector-facing readout of the structured
 * signals the photo scorer captured. Renders under the existing
 * AI Damage Assessment block on AppraisalSidebar + InspectionSheet.
 *
 * Pulls:
 *  - submissions.ai_detected_mileage  (compared to the customer's entry)
 *  - damage_reports.verification_findings[] (warning lights, tread, etc.)
 *
 * If nothing of note was detected the component renders null so the
 * sidebar stays tight.
 */

interface Props {
  submissionId: string;
  customerMileage?: string | null;
}

interface VerificationFindings {
  mileage_reading?: number | null;
  warning_lights?: string[];
  tire_tread_32nds?: number | null;
  tire_issues?: string[];
  paint_mismatch_detected?: boolean;
  accident_repair_signs?: string[];
  cabin_concerns?: string[];
  inspector_note?: string | null;
}

interface DamageReportRow {
  id: string;
  photo_category: string;
  verification_findings: VerificationFindings | null;
}

const WARNING_LIGHT_LABELS: Record<string, string> = {
  check_engine: "Check Engine",
  airbag: "Airbag / SRS",
  abs: "ABS",
  tpms: "TPMS",
  oil_pressure: "Oil Pressure",
  battery: "Battery",
  service_engine: "Service Engine",
  traction_control: "Traction Control",
  other: "Other",
};

const TIRE_ISSUE_LABELS: Record<string, string> = {
  sidewall_bulge: "Sidewall bulge",
  sidewall_crack: "Sidewall crack",
  curb_rash_on_wheel: "Curb rash on wheel",
  uneven_wear: "Uneven wear (alignment)",
  looks_new: "Looks new",
  looks_worn: "Looks worn",
  other: "Other",
};

const REPAIR_LABELS: Record<string, string> = {
  panel_gaps: "Panel gaps",
  non_factory_welds: "Non-factory welds",
  replaced_fender_liner: "Replaced fender liner",
  paint_overspray: "Paint overspray",
  color_mismatch: "Color mismatch",
};

const CABIN_LABELS: Record<string, string> = {
  smoke_staining: "Smoke staining",
  stains: "Stains",
  rips: "Rips / tears",
  pet_damage: "Pet damage",
  heavy_wear: "Heavy wear",
  aftermarket_additions: "Aftermarket additions",
};

const parseCustomerMileage = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const AIVerificationPanel = ({ submissionId, customerMileage }: Props) => {
  const [reports, setReports] = useState<DamageReportRow[]>([]);
  const [aiMileage, setAiMileage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dr, sub] = await Promise.all([
        supabase
          .from("damage_reports")
          .select("id, photo_category, verification_findings")
          .eq("submission_id", submissionId),
        supabase
          .from("submissions")
          .select("ai_detected_mileage")
          .eq("id", submissionId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (dr.data) setReports(dr.data as any);
      setAiMileage(((sub.data as any)?.ai_detected_mileage as number | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (loading) return null;

  // Aggregate findings across photos
  const warningLights = new Set<string>();
  const tireIssues = new Set<string>();
  const repairSigns = new Set<string>();
  const cabinConcerns = new Set<string>();
  const inspectorNotes: { category: string; note: string }[] = [];
  let minTread: number | null = null;
  let paintMismatch = false;

  for (const r of reports) {
    const vf = r.verification_findings || {};
    (vf.warning_lights || []).forEach((w) => warningLights.add(w));
    (vf.tire_issues || []).forEach((t) => tireIssues.add(t));
    (vf.accident_repair_signs || []).forEach((s) => repairSigns.add(s));
    (vf.cabin_concerns || []).forEach((c) => cabinConcerns.add(c));
    if (vf.paint_mismatch_detected) paintMismatch = true;
    if (typeof vf.tire_tread_32nds === "number") {
      minTread = minTread === null ? vf.tire_tread_32nds : Math.min(minTread, vf.tire_tread_32nds);
    }
    if (vf.inspector_note) {
      inspectorNotes.push({ category: r.photo_category, note: vf.inspector_note });
    }
  }

  const customerMi = parseCustomerMileage(customerMileage);
  const mileageDelta = customerMi !== null && aiMileage !== null ? aiMileage - customerMi : null;
  const mileageMismatch = mileageDelta !== null && Math.abs(mileageDelta) > Math.max(500, customerMi! * 0.02);

  const hasAnything =
    aiMileage !== null ||
    warningLights.size > 0 ||
    tireIssues.size > 0 ||
    repairSigns.size > 0 ||
    cabinConcerns.size > 0 ||
    inspectorNotes.length > 0 ||
    paintMismatch ||
    minTread !== null;

  if (!hasAnything) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          AI Verification Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        {/* Mileage verification */}
        {aiMileage !== null && (
          <div
            className={`rounded-lg border p-2.5 text-xs ${
              mileageMismatch
                ? "bg-destructive/10 border-destructive/30"
                : "bg-success/5 border-success/25"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold mb-0.5">
              <Gauge className="w-3.5 h-3.5" />
              Odometer read from dashboard photo
            </div>
            <div className="text-muted-foreground">
              AI saw <strong className="text-card-foreground">{aiMileage.toLocaleString()} mi</strong>
              {customerMi !== null && (
                <>
                  {" "}· customer entered <strong className="text-card-foreground">{customerMi.toLocaleString()} mi</strong>
                  {mileageDelta !== null && (
                    <>
                      {" "}·{" "}
                      <span className={mileageMismatch ? "text-destructive font-semibold" : "text-success font-semibold"}>
                        {mileageDelta >= 0 ? "+" : ""}{mileageDelta.toLocaleString()} delta
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Warning lights */}
        {warningLights.size > 0 && (
          <FindingRow
            icon={<AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
            title="Dashboard warning lights"
            tone="destructive"
            items={[...warningLights].map((w) => WARNING_LIGHT_LABELS[w] || w)}
          />
        )}

        {/* Tire tread */}
        {(minTread !== null || tireIssues.size > 0) && (
          <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              <Disc3 className="w-3.5 h-3.5 text-primary" />
              Tire condition
            </div>
            {minTread !== null && (
              <div
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mr-1.5 ${
                  minTread <= 4
                    ? "bg-destructive/10 text-destructive"
                    : minTread <= 6
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-success/10 text-success"
                }`}
              >
                ~{minTread}/32 tread
              </div>
            )}
            {[...tireIssues].map((t) => (
              <span
                key={t}
                className="inline-flex items-center text-[11px] text-muted-foreground bg-background border border-border/60 px-2 py-0.5 rounded-full mr-1 mt-1"
              >
                {TIRE_ISSUE_LABELS[t] || t}
              </span>
            ))}
          </div>
        )}

        {/* Paint mismatch + accident-repair signs */}
        {(paintMismatch || repairSigns.size > 0) && (
          <FindingRow
            icon={<FileWarning className="w-3.5 h-3.5 text-amber-500" />}
            title="Possible prior repair"
            tone="warning"
            items={[
              paintMismatch ? "Paint mismatch detected" : null,
              ...[...repairSigns].map((s) => REPAIR_LABELS[s] || s),
            ].filter(Boolean) as string[]}
          />
        )}

        {/* Cabin concerns */}
        {cabinConcerns.size > 0 && (
          <FindingRow
            icon={<Sofa className="w-3.5 h-3.5 text-primary" />}
            title="Cabin concerns"
            tone="muted"
            items={[...cabinConcerns].map((c) => CABIN_LABELS[c] || c)}
          />
        )}

        {/* Per-photo inspector notes */}
        {inspectorNotes.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold mb-1.5">
              <Camera className="w-3.5 h-3.5 text-primary" />
              AI notes for the inspector
            </div>
            <ul className="space-y-1.5">
              {inspectorNotes.map((n, i) => (
                <li key={i} className="text-muted-foreground leading-snug">
                  <span className="font-semibold text-card-foreground capitalize">
                    {n.category.replace(/_/g, " ")}:
                  </span>{" "}
                  {n.note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FindingRow = ({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "destructive" | "warning" | "muted";
}) => {
  const toneClass =
    tone === "destructive"
      ? "bg-destructive/10 border-destructive/30"
      : tone === "warning"
      ? "bg-amber-500/10 border-amber-500/25"
      : "bg-muted/30 border-border";
  return (
    <div className={`rounded-lg border p-2.5 text-xs ${toneClass}`}>
      <div className="flex items-center gap-1.5 font-semibold mb-1">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <span
            key={i}
            className="inline-flex items-center text-[11px] text-card-foreground bg-background border border-border/60 px-2 py-0.5 rounded-full"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AIVerificationPanel;
