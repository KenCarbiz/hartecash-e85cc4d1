import { Badge } from "@/components/ui/badge";
import { Gauge, AlertTriangle, CheckCircle, XCircle, Shield } from "lucide-react";

interface DepthPolicy {
  id: string; name: string; policy_type: string;
  oem_brands: string[]; all_brands: boolean;
  max_vehicle_age_years: number | null; max_mileage: number | null;
  min_tire_depth: number; min_brake_depth: number;
}

interface Props {
  tireLF: number | null; tireRF: number | null; tireLR: number | null; tireRR: number | null;
  brakeLF: number | null; brakeRF: number | null; brakeLR: number | null; brakeRR: number | null;
  tireAdjustment: number | null;
  depthPolicies: DepthPolicy[];
  vehicleYear: string | null; vehicleMake: string | null; mileage: string | null;
}

const getStatus = (val: number | null) => {
  if (val == null) return { color: "text-muted-foreground", bg: "bg-muted", label: "—" };
  if (val <= 3) return { color: "text-red-600", bg: "bg-red-500/10 border-red-400/40", label: "Replace" };
  if (val <= 5) return { color: "text-amber-600", bg: "bg-amber-500/10 border-amber-400/40", label: "Fair" };
  return { color: "text-green-600", bg: "bg-green-500/10 border-green-400/40", label: "Good" };
};

export default function AppraisalTireBrakeHealth({
  tireLF, tireRF, tireLR, tireRR,
  brakeLF, brakeRF, brakeLR, brakeRR,
  tireAdjustment, depthPolicies,
  vehicleYear, vehicleMake, mileage,
}: Props) {
  const tires = [
    { label: "LF", val: tireLF }, { label: "RF", val: tireRF },
    { label: "LR", val: tireLR }, { label: "RR", val: tireRR },
  ];
  const brakes = [
    { label: "LF", val: brakeLF }, { label: "RF", val: brakeRF },
    { label: "LR", val: brakeLR }, { label: "RR", val: brakeRR },
  ];
  const hasTires = tires.some(t => t.val != null);
  const hasBrakes = brakes.some(b => b.val != null);
  if (!hasTires && !hasBrakes) return null;

  const needsTires = hasTires && tires.some(t => t.val != null && t.val <= 3);
  const needsBrakes = hasBrakes && brakes.some(b => b.val != null && b.val <= 3);

  const vehicleYearNum = parseInt(vehicleYear || "0");
  const vehicleMileage = parseInt(mileage || "0");
  const currentYear = new Date().getFullYear();
  const vehicleAge = vehicleYearNum > 0 ? currentYear - vehicleYearNum : 999;

  const minTire = tires.filter(t => t.val != null).map(t => t.val!);
  const minBrake = brakes.filter(b => b.val != null).map(b => b.val!);
  const lowestTire = minTire.length > 0 ? Math.min(...minTire) : null;
  const lowestBrake = minBrake.length > 0 ? Math.min(...minBrake) : null;

  const applicablePolicies = depthPolicies.filter(p => {
    if (!p.all_brands && p.oem_brands.length > 0 && vehicleMake) {
      if (!p.oem_brands.some(b => (vehicleMake || "").toLowerCase().includes(b.toLowerCase()))) return false;
    }
    if (p.max_vehicle_age_years != null && vehicleAge > p.max_vehicle_age_years) return false;
    if (p.max_mileage != null && vehicleMileage > p.max_mileage) return false;
    return true;
  });

  const DepthGrid = ({ items, label }: { items: { label: string; val: number | null }[]; label: string }) => (
    <div>
      <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(t => {
          const s = getStatus(t.val);
          return (
            <div key={t.label} className={`rounded-md border px-2 py-1.5 text-center ${s.bg}`}>
              <p className="text-[9px] text-muted-foreground">{t.label}</p>
              <p className={`text-base font-black ${s.color}`}>{t.val ?? "—"}</p>
              <p className={`text-[8px] font-bold uppercase ${s.color}`}>{s.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`rounded-lg border-2 p-3 ${needsTires || needsBrakes ? "border-red-400/60 bg-red-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-card-foreground">Tire & Brake Health</span>
        {(needsTires || needsBrakes) ? (
          <Badge variant="destructive" className="text-[9px] ml-auto animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {needsTires && needsBrakes ? "Tires & Brakes Need Replacement" : needsTires ? "Needs Tires" : "Needs Brakes"}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px] ml-auto text-green-600 bg-green-500/10 border-green-400/40">
            <CheckCircle className="w-3 h-3 mr-1" /> All Good
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {hasTires && <DepthGrid items={tires} label='Tire Tread (/32")' />}
        {hasBrakes && <DepthGrid items={brakes} label='Brake Pads (/32")' />}
      </div>

      {tireAdjustment != null && tireAdjustment !== 0 && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Tire Value Adjustment</span>
          <span className={`text-sm font-bold ${tireAdjustment >= 0 ? "text-green-600" : "text-red-600"}`}>
            {tireAdjustment >= 0 ? "+" : ""}${Math.abs(tireAdjustment).toLocaleString()}
          </span>
        </div>
      )}

      {/* Depth Policy Compliance */}
      {applicablePolicies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Shield className="w-3 h-3" /> Certification Policy Check
          </p>
          {applicablePolicies.map(policy => {
            const tireFail = lowestTire !== null && lowestTire < policy.min_tire_depth;
            const brakeFail = lowestBrake !== null && lowestBrake < policy.min_brake_depth;
            const pass = !tireFail && !brakeFail;
            const typeLabel = policy.policy_type === "manufacturer_cpo" ? "MFR CPO" : policy.policy_type === "limited_cpo" ? "Limited CPO" : policy.policy_type === "internal_cert" ? "Internal Cert" : "Standard";
            return (
              <div key={policy.id} className={`rounded-md border px-2.5 py-1.5 flex items-center justify-between text-[10px] ${pass ? "bg-green-500/5 border-green-400/30" : "bg-red-500/5 border-red-400/30"}`}>
                <div className="flex items-center gap-2">
                  {pass ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                  <span className="font-semibold text-card-foreground">{policy.name}</span>
                  <Badge variant="outline" className="text-[8px] h-4">{typeLabel}</Badge>
                </div>
                <div className="flex items-center gap-3 text-[9px]">
                  {tireFail && <span className="text-red-600 font-bold">Tires: {lowestTire}/32" &lt; {policy.min_tire_depth}/32"</span>}
                  {brakeFail && <span className="text-red-600 font-bold">Brakes: {lowestBrake}/32" &lt; {policy.min_brake_depth}/32"</span>}
                  {pass && <span className="text-green-600 font-bold">Meets Requirements</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
