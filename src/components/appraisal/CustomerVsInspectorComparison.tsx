import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Car } from "lucide-react";
import { formatGrade } from "@/lib/formatGrade";

interface ConditionState {
  condition: string;
  modifications: string;
  drivable: string;
  exteriorItems: number;
  windshield: string;
  moonroof: string;
  interiorItems: number;
  techItems: number;
  engineItems: number;
  mechItems: number;
  accidents: string;
  smokedIn: string;
  tiresReplaced: string;
  numKeys: string;
}

interface ConditionSetters {
  setModifications: (v: string) => void;
  setDrivable: (v: string) => void;
  setExteriorItems: (v: number) => void;
  setWindshield: (v: string) => void;
  setMoonroof: (v: string) => void;
  setInteriorItems: (v: number) => void;
  setTechItems: (v: number) => void;
  setEngineItems: (v: number) => void;
  setMechItems: (v: number) => void;
  setAccidents: (v: string) => void;
  setSmokedIn: (v: string) => void;
  setTiresReplaced: (v: string) => void;
  setNumKeys: (v: string) => void;
}

interface CustomerAnswers {
  condition: string | null;
  accidents: string | null;
  drivable: string | null;
  smokedIn: string | null;
  exteriorDamage: string[] | null;
  interiorDamage: string[] | null;
  windshield: string | null;
  moonroof: string | null;
  tires: string | null;
  keys: string | null;
  modifications: string | null;
  mechIssues: string[] | null;
  engineIssues: string[] | null;
  techIssues: string[] | null;
}

interface DeductionAmounts {
  getAmt: (key: string) => number;
  isOn: (key: string) => boolean;
}

interface Props {
  state: ConditionState;
  setters: ConditionSetters;
  customerAnswers: CustomerAnswers;
  deductions: DeductionAmounts;
  deductAmounts: {
    accidentDeduct: number; extDeduct: number; intDeduct: number;
    windDeduct: number; moonroofDeduct: number; engDeduct: number;
    mechDeduct: number; techDeduct: number; drivDeduct: number;
    smokeDeduct: number; tiresDeduct: number; keyDeduct: number;
  };
  hasInspection: boolean;
  inspectorGrade: string | null;
  overallCondition: string | null;
}

// Format customer raw answer to display string
function formatCustomerAnswer(value: string | string[] | null | undefined): string {
  if (!value) return "—";
  if (Array.isArray(value)) {
    const filtered = value.filter(v => v !== "none" && !v.includes("No "));
    return filtered.length > 0 ? `${filtered.length} issue${filtered.length > 1 ? "s" : ""}` : "None";
  }
  return value;
}

const DeductBadge = ({ amount }: { amount: number }) => amount > 0 ? (
  <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
    -${amount.toLocaleString()}
  </span>
) : (
  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
    No ded.
  </span>
);

interface ComparisonRowProps {
  label: string;
  customerValue: string;
  inspectorControl: React.ReactNode;
  deductAmount: number;
  hasDiscrepancy?: boolean;
}

function ComparisonRow({ label, customerValue, inspectorControl, deductAmount, hasDiscrepancy }: ComparisonRowProps) {
  return (
    <div className="grid grid-cols-[100px_1fr_1fr_auto] sm:grid-cols-[120px_1fr_1fr_auto] gap-1 items-center px-2 py-1.5 rounded-md bg-muted/30">
      <span className="text-[10px] font-semibold text-muted-foreground truncate">{label}</span>
      <div className="text-[10px] text-amber-600 truncate">{customerValue}</div>
      <div className="flex items-center gap-1">
        {inspectorControl}
        {hasDiscrepancy && (
          <span className="flex items-center gap-0.5 text-[8px] text-amber-600 bg-amber-500/10 px-1 py-0.5 rounded-full shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" /> Diff
          </span>
        )}
      </div>
      <DeductBadge amount={deductAmount} />
    </div>
  );
}

export default function CustomerVsInspectorComparison({
  state, setters, customerAnswers, deductions, deductAmounts,
  hasInspection, inspectorGrade, overallCondition,
}: Props) {
  const { getAmt, isOn } = deductions;
  const { condition, modifications, drivable, exteriorItems, windshield, moonroof,
    interiorItems, techItems, engineItems, mechItems, accidents, smokedIn, tiresReplaced, numKeys } = state;

  // Detect discrepancies
  const custAccidents = customerAnswers.accidents || "No accidents";
  const inspAccidents = accidents === "0" ? "No accidents" : accidents === "1" ? "1 accident" : "2+ accidents";
  const accidentDiscrep = custAccidents.toLowerCase() !== inspAccidents.toLowerCase();

  const custExtCount = (customerAnswers.exteriorDamage || []).filter(d => d !== "none" && !d.includes("No ")).length;
  const extDiscrep = custExtCount !== exteriorItems;

  const custIntCount = (customerAnswers.interiorDamage || []).filter(d => d !== "none" && !d.includes("No ")).length;
  const intDiscrep = custIntCount !== interiorItems;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <Car className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Vehicle Condition</span>
        {hasInspection && (
          <Badge variant="secondary" className="text-[8px] ml-auto">Inspector Data Applied</Badge>
        )}
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[100px_1fr_1fr_auto] sm:grid-cols-[120px_1fr_1fr_auto] gap-1 px-2 mb-1">
        <span className="text-[8px] font-bold text-muted-foreground uppercase">Category</span>
        <Badge variant="outline" className="text-[7px] w-fit border-amber-400/50 text-amber-600 px-1 py-0">Customer</Badge>
        <Badge variant="outline" className="text-[7px] w-fit border-primary/40 text-primary px-1 py-0">Inspector</Badge>
        <span className="text-[8px] font-bold text-muted-foreground">Deduct</span>
      </div>

      <div className="space-y-1 overflow-x-auto">
        {/* Condition */}
        <ComparisonRow
          label="Condition"
          customerValue={formatGrade(overallCondition) || "—"}
          inspectorControl={<span className="text-xs font-bold text-primary">{formatGrade(condition)}</span>}
          deductAmount={0}
          hasDiscrepancy={!!(inspectorGrade && inspectorGrade !== overallCondition)}
        />

        {/* Accidents */}
        {isOn("accidents") && (
          <ComparisonRow
            label="Accidents"
            customerValue={formatCustomerAnswer(customerAnswers.accidents)}
            inspectorControl={
              <Select value={accidents} onValueChange={setters.setAccidents}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No accidents</SelectItem>
                  <SelectItem value="1">1 accident</SelectItem>
                  <SelectItem value="2+">2+ accidents</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.accidentDeduct}
            hasDiscrepancy={accidentDiscrep}
          />
        )}

        {/* Drivable */}
        {isOn("not_drivable") && (
          <ComparisonRow
            label="Drivable?"
            customerValue={formatCustomerAnswer(customerAnswers.drivable)}
            inspectorControl={
              <Select value={drivable} onValueChange={setters.setDrivable}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Drivable</SelectItem>
                  <SelectItem value="no">Not Drivable</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.drivDeduct}
          />
        )}

        {/* Exterior */}
        {isOn("exterior_damage") && (
          <ComparisonRow
            label="Exterior Damage"
            customerValue={`${custExtCount} issue${custExtCount !== 1 ? "s" : ""}`}
            inspectorControl={
              <Select value={String(exteriorItems)} onValueChange={v => setters.setExteriorItems(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.extDeduct}
            hasDiscrepancy={extDiscrep}
          />
        )}

        {/* Interior */}
        {isOn("interior_damage") && (
          <ComparisonRow
            label="Interior Damage"
            customerValue={`${custIntCount} issue${custIntCount !== 1 ? "s" : ""}`}
            inspectorControl={
              <Select value={String(interiorItems)} onValueChange={v => setters.setInteriorItems(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.intDeduct}
            hasDiscrepancy={intDiscrep}
          />
        )}

        {/* Windshield */}
        {isOn("windshield_damage") && (
          <ComparisonRow
            label="Windshield"
            customerValue={formatCustomerAnswer(customerAnswers.windshield)}
            inspectorControl={
              <Select value={windshield} onValueChange={setters.setWindshield}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No damage</SelectItem>
                  <SelectItem value="minor_chips">Minor chips</SelectItem>
                  <SelectItem value="major_cracks">Major cracks</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.windDeduct}
          />
        )}

        {/* Moonroof */}
        <ComparisonRow
          label="Moonroof"
          customerValue={formatCustomerAnswer(customerAnswers.moonroof)}
          inspectorControl={
            <Select value={moonroof} onValueChange={setters.setMoonroof}>
              <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Works great">Works great</SelectItem>
                <SelectItem value="Doesn't work">Doesn't work</SelectItem>
                <SelectItem value="No moonroof">No moonroof</SelectItem>
              </SelectContent>
            </Select>
          }
          deductAmount={deductAmounts.moonroofDeduct}
        />

        {/* Engine */}
        {isOn("engine_issues") && (
          <ComparisonRow
            label="Engine Issues"
            customerValue={formatCustomerAnswer(customerAnswers.engineIssues)}
            inspectorControl={
              <Select value={String(engineItems)} onValueChange={v => setters.setEngineItems(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.engDeduct}
          />
        )}

        {/* Mechanical */}
        {isOn("mechanical_issues") && (
          <ComparisonRow
            label="Mechanical Issues"
            customerValue={formatCustomerAnswer(customerAnswers.mechIssues)}
            inspectorControl={
              <Select value={String(mechItems)} onValueChange={v => setters.setMechItems(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.mechDeduct}
          />
        )}

        {/* Tech */}
        {isOn("tech_issues") && (
          <ComparisonRow
            label="Tech Issues"
            customerValue={formatCustomerAnswer(customerAnswers.techIssues)}
            inspectorControl={
              <Select value={String(techItems)} onValueChange={v => setters.setTechItems(Number(v))}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.techDeduct}
          />
        )}

        {/* Smoked In */}
        {isOn("smoked_in") && (
          <ComparisonRow
            label="Smoked In?"
            customerValue={formatCustomerAnswer(customerAnswers.smokedIn)}
            inspectorControl={
              <Select value={smokedIn} onValueChange={setters.setSmokedIn}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Not Smoked In</SelectItem>
                  <SelectItem value="yes">Smoked In</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.smokeDeduct}
          />
        )}

        {/* Tires */}
        {isOn("tires_not_replaced") && (
          <ComparisonRow
            label="Tires Replaced"
            customerValue={formatCustomerAnswer(customerAnswers.tires)}
            inspectorControl={
              <Select value={tiresReplaced} onValueChange={setters.setTiresReplaced}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 tires</SelectItem>
                  <SelectItem value="2-3">2-3 tires</SelectItem>
                  <SelectItem value="1">1 tire</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.tiresDeduct}
          />
        )}

        {/* Keys */}
        {isOn("missing_keys") && (
          <ComparisonRow
            label="Keys"
            customerValue={formatCustomerAnswer(customerAnswers.keys)}
            inspectorControl={
              <Select value={numKeys} onValueChange={setters.setNumKeys}>
                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2+">2+ keys</SelectItem>
                  <SelectItem value="1">1 key</SelectItem>
                </SelectContent>
              </Select>
            }
            deductAmount={deductAmounts.keyDeduct}
          />
        )}

        {/* Modifications */}
        <ComparisonRow
          label="Modifications"
          customerValue={formatCustomerAnswer(customerAnswers.modifications)}
          inspectorControl={
            <Select value={modifications} onValueChange={setters.setModifications}>
              <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Mods</SelectItem>
                <SelectItem value="yes">Has Mods</SelectItem>
              </SelectContent>
            </Select>
          }
          deductAmount={0}
        />
      </div>
    </div>
  );
}
