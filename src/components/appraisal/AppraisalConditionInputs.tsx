import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Car } from "lucide-react";
import { formatGrade } from "@/lib/formatGrade";

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
};

const DeductBadge = ({ amount }: { amount: number }) => amount > 0 ? (
  <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
    -${amount.toLocaleString()}
  </span>
) : (
  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto shrink-0">
    No deduction
  </span>
);

const SourceTag = ({ customer, inspector }: { customer?: string | null; inspector?: boolean }) => {
  if (inspector) return <Badge variant="outline" className="text-[7px] px-1 py-0 border-primary/40 text-primary shrink-0">Inspector</Badge>;
  if (customer) return <Badge variant="outline" className="text-[7px] px-1 py-0 border-amber-400/50 text-amber-600 shrink-0">Customer</Badge>;
  return null;
};

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

export default function AppraisalConditionInputs({
  state, setters, customerAnswers, deductions, deductAmounts, hasInspection, inspectorGrade, overallCondition,
}: Props) {
  const { getAmt, isOn } = deductions;
  const {
    condition, modifications, drivable, exteriorItems, windshield, moonroof,
    interiorItems, techItems, engineItems, mechItems, accidents, smokedIn, tiresReplaced, numKeys,
  } = state;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <Car className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold text-card-foreground uppercase tracking-wider">② Vehicle Condition</span>
        {hasInspection && (
          <Badge variant="secondary" className="text-[8px] ml-auto">Inspector Data Applied</Badge>
        )}
      </div>

      <div className="space-y-2">
        {/* Condition */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
          <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Condition</span>
          <span className="text-xs font-bold text-primary">{CONDITION_LABELS[condition]}</span>
          {inspectorGrade && inspectorGrade !== overallCondition && (
            <span className="text-[8px] text-muted-foreground">Customer: {formatGrade(overallCondition)}</span>
          )}
          <SourceTag inspector={!!inspectorGrade} customer={inspectorGrade ? undefined : overallCondition} />
          <span className="text-[9px] text-muted-foreground ml-auto">Set above ①</span>
        </div>

        {/* Modifications */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
          <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Modifications</span>
          <Select value={modifications} onValueChange={setters.setModifications}>
            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Modifications</SelectItem>
              <SelectItem value="yes">Has Modifications</SelectItem>
            </SelectContent>
          </Select>
          <SourceTag customer={customerAnswers.modifications} />
          <span className="text-[9px] text-muted-foreground ml-auto">Info only</span>
        </div>

        {/* Drivable */}
        {isOn("not_drivable") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Drivable?</span>
            <Select value={drivable} onValueChange={setters.setDrivable}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Drivable</SelectItem>
                <SelectItem value="no">Not Drivable</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.drivable} />
            <DeductBadge amount={deductAmounts.drivDeduct} />
          </div>
        )}

        {/* Exterior Damage */}
        {isOn("exterior_damage") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Exterior Damage</span>
            <Select value={String(exteriorItems)} onValueChange={v => setters.setExteriorItems(Number(v))}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
            {exteriorItems > 0 && <span className="text-[9px] text-muted-foreground">{exteriorItems} × ${getAmt("exterior_damage_per_item").toLocaleString()}</span>}
            <SourceTag customer={customerAnswers.exteriorDamage?.join(",")} />
            <DeductBadge amount={deductAmounts.extDeduct} />
          </div>
        )}

        {/* Windshield */}
        {isOn("windshield_damage") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Windshield</span>
            <Select value={windshield} onValueChange={setters.setWindshield}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No damage</SelectItem>
                <SelectItem value="minor_chips">Minor chips (-${getAmt("windshield_chipped").toLocaleString()})</SelectItem>
                <SelectItem value="major_cracks">Major cracks (-${getAmt("windshield_cracked").toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.windshield} />
            <DeductBadge amount={deductAmounts.windDeduct} />
          </div>
        )}

        {/* Moonroof */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
          <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Moonroof</span>
          <Select value={moonroof} onValueChange={setters.setMoonroof}>
            <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Works great">Works great</SelectItem>
              <SelectItem value="Doesn't work">Doesn't work (-${getAmt("moonroof_broken").toLocaleString()})</SelectItem>
              <SelectItem value="No moonroof">No moonroof</SelectItem>
            </SelectContent>
          </Select>
          <SourceTag customer={customerAnswers.moonroof} />
          <DeductBadge amount={deductAmounts.moonroofDeduct} />
        </div>

        {/* Interior Damage */}
        {isOn("interior_damage") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Interior Damage</span>
            <Select value={String(interiorItems)} onValueChange={v => setters.setInteriorItems(Number(v))}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
            {interiorItems > 0 && <span className="text-[9px] text-muted-foreground">{interiorItems} × ${getAmt("interior_damage_per_item").toLocaleString()}</span>}
            <SourceTag customer={customerAnswers.interiorDamage?.join(",")} />
            <DeductBadge amount={deductAmounts.intDeduct} />
          </div>
        )}

        {/* Tech Issues */}
        {isOn("tech_issues") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Tech Issues</span>
            <Select value={String(techItems)} onValueChange={v => setters.setTechItems(Number(v))}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
            {techItems > 0 && <span className="text-[9px] text-muted-foreground">{techItems} × ${getAmt("tech_issue_per_item").toLocaleString()}</span>}
            <SourceTag customer={customerAnswers.techIssues?.join(",")} />
            <DeductBadge amount={deductAmounts.techDeduct} />
          </div>
        )}

        {/* Engine Issues */}
        {isOn("engine_issues") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Engine Issues</span>
            <Select value={String(engineItems)} onValueChange={v => setters.setEngineItems(Number(v))}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
            {engineItems > 0 && <span className="text-[9px] text-muted-foreground">{engineItems} × ${getAmt("engine_issue_per_item").toLocaleString()}</span>}
            <SourceTag customer={customerAnswers.engineIssues?.join(",")} />
            <DeductBadge amount={deductAmounts.engDeduct} />
          </div>
        )}

        {/* Mechanical Issues */}
        {isOn("mechanical_issues") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Mechanical Issues</span>
            <Select value={String(mechItems)} onValueChange={v => setters.setMechItems(Number(v))}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : `${n} issue${n > 1 ? "s" : ""}`}</SelectItem>)}
              </SelectContent>
            </Select>
            {mechItems > 0 && <span className="text-[9px] text-muted-foreground">{mechItems} × ${getAmt("mechanical_issue_per_item").toLocaleString()}</span>}
            <SourceTag customer={customerAnswers.mechIssues?.join(",")} />
            <DeductBadge amount={deductAmounts.mechDeduct} />
          </div>
        )}

        {/* Accidents */}
        {isOn("accidents") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Accidents</span>
            <Select value={accidents} onValueChange={setters.setAccidents}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No accidents</SelectItem>
                <SelectItem value="1">1 accident (-${getAmt("accidents_1").toLocaleString()})</SelectItem>
                <SelectItem value="2+">2+ accidents (-${getAmt("accidents_2").toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.accidents} />
            <DeductBadge amount={deductAmounts.accidentDeduct} />
          </div>
        )}

        {/* Smoked In */}
        {isOn("smoked_in") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Smoked In?</span>
            <Select value={smokedIn} onValueChange={setters.setSmokedIn}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Not Smoked In</SelectItem>
                <SelectItem value="yes">Smoked In (-${getAmt("smoked_in").toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.smokedIn} />
            <DeductBadge amount={deductAmounts.smokeDeduct} />
          </div>
        )}

        {/* Tires */}
        {isOn("tires_not_replaced") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Tires Replaced</span>
            <Select value={tiresReplaced} onValueChange={setters.setTiresReplaced}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 tires (no deduction)</SelectItem>
                <SelectItem value="2-3">2-3 tires</SelectItem>
                <SelectItem value="1">1 tire (-${getAmt("tires_not_replaced").toLocaleString()})</SelectItem>
                <SelectItem value="None">None (-${getAmt("tires_not_replaced").toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.tires} />
            <DeductBadge amount={deductAmounts.tiresDeduct} />
          </div>
        )}

        {/* Keys */}
        {isOn("missing_keys") && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
            <span className="text-[10px] font-semibold text-muted-foreground w-24 sm:w-32 shrink-0">Keys</span>
            <Select value={numKeys} onValueChange={setters.setNumKeys}>
              <SelectTrigger className="h-6 text-[10px] w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2+">2+ keys (no deduction)</SelectItem>
                <SelectItem value="1">1 key (-${getAmt("missing_keys_1").toLocaleString()})</SelectItem>
              </SelectContent>
            </Select>
            <SourceTag customer={customerAnswers.keys} />
            <DeductBadge amount={deductAmounts.keyDeduct} />
          </div>
        )}
      </div>
    </div>
  );
}
