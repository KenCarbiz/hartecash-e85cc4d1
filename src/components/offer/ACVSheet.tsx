import { forwardRef } from "react";
import type { BBVehicle } from "@/components/sell-form/types";
import type { OfferEstimate } from "@/lib/offerCalculator";

interface WaterfallEntry {
  label: string;
  value: number;
  runningTotal: number;
  type: "base" | "add" | "subtract" | "total";
}

interface DeductionDetails {
  accidents: string;
  drivable: string;
  smokedIn: string;
  tiresReplaced: string;
  numKeys: string;
  windshield: string;
  moonroof: string;
  exteriorItems: number;
  interiorItems: number;
  mechItems: number;
  engineItems: number;
  techItems: number;
  deductionAmounts: Record<string, number>;
  deductionsConfig: Record<string, boolean>;
}

interface ACVSheetProps {
  sub: {
    vehicle_year: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vin: string | null;
    mileage: string | null;
    exterior_color: string | null;
    overall_condition: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    appraised_by: string | null;
    appraisal_finalized_at: string | null;
    accidents: string | null;
    drivable: string | null;
    smoked_in: string | null;
    tires_replaced: string | null;
    num_keys: string | null;
    exterior_damage: string[] | null;
    interior_damage: string[] | null;
    windshield_damage: string | null;
    mechanical_issues: string[] | null;
    engine_issues: string[] | null;
    tech_issues: string[] | null;
    tire_lf: number | null;
    tire_rf: number | null;
    tire_lr: number | null;
    tire_rr: number | null;
    brake_lf: number | null;
    brake_rf: number | null;
    brake_lr: number | null;
    brake_rr: number | null;
    tire_adjustment: number | null;
    inspector_grade: string | null;
  };
  bbVehicle: BBVehicle | null;
  offerResult: OfferEstimate | null;
  finalValue: number;
  wholesaleAvg: number;
  tradeinAvg: number;
  retailAvg: number;
  reconCost: number;
  dealerPack: number;
  projectedProfit: number;
  profitMargin: number;
  condition: string;
  dealerName?: string;
  retailMarketData?: {
    activeMean?: number;
    activeMedian?: number;
    activeCount?: number;
    soldMean?: number;
    soldMedian?: number;
    soldCount?: number;
    marketDaysSupply?: number;
    meanDaysToTurn?: number;
  } | null;
  waterfallBlocks?: WaterfallEntry[];
  deductionDetails?: DeductionDetails;
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent", very_good: "Very Good", good: "Good", fair: "Fair",
};

const fmt = (n: number) => `$${n.toLocaleString()}`;
const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}$${n.toLocaleString()}`;

const ACVSheet = forwardRef<HTMLDivElement, ACVSheetProps>(({
  sub, bbVehicle, offerResult, finalValue,
  wholesaleAvg, tradeinAvg, retailAvg,
  reconCost, dealerPack, projectedProfit, profitMargin, condition,
  dealerName, retailMarketData, waterfallBlocks, deductionDetails,
}, ref) => {
  const privatePartyAvg = Number(bbVehicle?.private_party?.avg || 0);
  const financeAdvAvg = Number(bbVehicle?.finance_advance?.avg || 0);
  const msrp = Number(bbVehicle?.msrp || 0);
  const inventoryCost = finalValue + reconCost + dealerPack;
  const hasTires = !!(sub.tire_lf && sub.tire_rf && sub.tire_lr && sub.tire_rr);
  const avgTireDepth = hasTires ? ((sub.tire_lf! + sub.tire_rf! + sub.tire_lr! + sub.tire_rr!) / 4).toFixed(1) : null;
  const hasBrakes = !!(sub.brake_lf || sub.brake_rf || sub.brake_lr || sub.brake_rr);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Scarcity interpretation
  const scarcityLevel = retailMarketData?.marketDaysSupply != null
    ? retailMarketData.marketDaysSupply <= 30 ? "LOW" : retailMarketData.marketDaysSupply <= 60 ? "MODERATE" : "HIGH"
    : null;
  const scarcityColor = scarcityLevel === "LOW" ? "text-red-700" : scarcityLevel === "MODERATE" ? "text-yellow-700" : "text-green-700";

  // Build itemized deductions
  const deductionRows: { label: string; amount: number }[] = [];
  if (deductionDetails) {
    const da = deductionDetails.deductionAmounts;
    const dc = deductionDetails.deductionsConfig;
    const on = (k: string) => dc[k] !== false;
    if (on("accidents") && deductionDetails.accidents !== "0") {
      const amt = deductionDetails.accidents === "1" ? (da.accidents_1 || 0) : deductionDetails.accidents === "2+" ? (da.accidents_2 || 0) : 0;
      if (amt > 0) deductionRows.push({ label: `Accidents (${deductionDetails.accidents})`, amount: amt });
    }
    if (on("not_drivable") && deductionDetails.drivable === "no") deductionRows.push({ label: "Not Drivable", amount: da.not_drivable || 0 });
    if (on("smoked_in") && deductionDetails.smokedIn === "yes") deductionRows.push({ label: "Smoked In", amount: da.smoked_in || 0 });
    if (on("exterior_damage") && deductionDetails.exteriorItems > 0) deductionRows.push({ label: `Exterior Damage (${deductionDetails.exteriorItems} items)`, amount: deductionDetails.exteriorItems * (da.exterior_damage_per_item || 0) });
    if (on("interior_damage") && deductionDetails.interiorItems > 0) deductionRows.push({ label: `Interior Damage (${deductionDetails.interiorItems} items)`, amount: deductionDetails.interiorItems * (da.interior_damage_per_item || 0) });
    if (on("windshield_damage") && deductionDetails.windshield !== "none") {
      const amt = deductionDetails.windshield === "major_cracks" ? (da.windshield_cracked || 0) : deductionDetails.windshield === "minor_chips" ? (da.windshield_chipped || 0) : 0;
      if (amt > 0) deductionRows.push({ label: `Windshield (${deductionDetails.windshield === "major_cracks" ? "Cracked" : "Chipped"})`, amount: amt });
    }
    if (deductionDetails.moonroof === "Doesn't work" && da.moonroof_broken) deductionRows.push({ label: "Moonroof Inoperable", amount: da.moonroof_broken });
    if (on("engine_issues") && deductionDetails.engineItems > 0) deductionRows.push({ label: `Engine Issues (${deductionDetails.engineItems} items)`, amount: deductionDetails.engineItems * (da.engine_issue_per_item || 0) });
    if (on("mechanical_issues") && deductionDetails.mechItems > 0) deductionRows.push({ label: `Mechanical Issues (${deductionDetails.mechItems} items)`, amount: deductionDetails.mechItems * (da.mechanical_issue_per_item || 0) });
    if (on("tech_issues") && deductionDetails.techItems > 0) deductionRows.push({ label: `Tech Issues (${deductionDetails.techItems} items)`, amount: deductionDetails.techItems * (da.tech_issue_per_item || 0) });
    if (on("tires_not_replaced") && (deductionDetails.tiresReplaced === "None" || deductionDetails.tiresReplaced === "1")) deductionRows.push({ label: "Tires Not Replaced", amount: da.tires_not_replaced || 0 });
    if (on("missing_keys")) {
      if (deductionDetails.numKeys === "0") deductionRows.push({ label: "No Keys", amount: da.missing_keys_0 || 0 });
      else if (deductionDetails.numKeys === "1") deductionRows.push({ label: "Single Key Only", amount: da.missing_keys_1 || 0 });
    }
  }
  const totalItemizedDeductions = deductionRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div ref={ref} className="bg-white text-black p-6 max-w-[8.5in] mx-auto text-[11px] leading-tight" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wide">Actual Cash Value Worksheet</h1>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">INTERNAL — NOT FOR CUSTOMER DISTRIBUTION</p>
          {dealerName && <p className="text-[10px] font-semibold mt-0.5">{dealerName}</p>}
        </div>
        <div className="text-right text-[10px] text-gray-500">
          <div>{dateStr}</div>
          <div>{timeStr}</div>
          {sub.appraised_by && <div className="font-semibold text-black mt-0.5">Appraiser: {sub.appraised_by}</div>}
        </div>
      </div>

      {/* ═══ VEHICLE INFO + ACV HERO ═══ */}
      <div className="grid grid-cols-[1fr_auto] gap-4 mb-3">
        <div>
          <div className="text-base font-black mb-1">{sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10px]">
            <div><span className="text-gray-500 w-16 inline-block">VIN:</span> <span className="font-mono font-semibold">{sub.vin || "— Not Provided —"}</span></div>
            <div><span className="text-gray-500 w-16 inline-block">Mileage:</span> <span className="font-semibold">{sub.mileage ? `${Number(sub.mileage).toLocaleString()} mi` : "—"}</span></div>
            <div><span className="text-gray-500 w-16 inline-block">Color:</span> <span className="font-semibold">{sub.exterior_color || "—"}</span></div>
            <div><span className="text-gray-500 w-16 inline-block">Style:</span> <span className="font-semibold">{bbVehicle?.style || "—"}</span></div>
            <div><span className="text-gray-500 w-16 inline-block">Drivetrain:</span> <span className="font-semibold">{bbVehicle?.drivetrain || "—"}</span></div>
            <div><span className="text-gray-500 w-16 inline-block">Condition:</span> <span className="font-bold">{CONDITION_LABELS[condition] || condition}</span></div>
          </div>
        </div>
        <div className="border-2 border-black rounded-lg px-5 py-3 text-center min-w-[160px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">Actual Cash Value</div>
          <div className="text-2xl font-black">{fmt(finalValue)}</div>
          <div className={`text-[10px] font-bold mt-0.5 ${projectedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
            Proj. Profit: {fmtSigned(projectedProfit)} ({profitMargin.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* ═══ OFFER LOGIC WATERFALL ═══ */}
      {waterfallBlocks && waterfallBlocks.length > 0 && (
        <div className="mb-3">
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Offer Logic — Value Determination Waterfall</h2>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-gray-500 uppercase tracking-wider text-[8px]">
                <th className="text-left py-0.5 w-[55%]">Factor</th>
                <th className="text-right py-0.5 w-[20%]">Adjustment</th>
                <th className="text-right py-0.5 w-[25%]">Running Total</th>
              </tr>
            </thead>
            <tbody>
              {waterfallBlocks.map((block, i) => {
                const isBase = block.type === "base";
                const isTotal = block.type === "total";
                const isNeg = block.type === "subtract";
                return (
                  <tr key={i} className={`${isTotal ? "border-t-2 border-black font-black" : "border-t border-gray-200"}`}>
                    <td className={`py-0.5 ${isBase || isTotal ? "font-bold" : ""}`}>{block.label}</td>
                    <td className={`py-0.5 text-right ${isBase ? "font-bold" : ""} ${isNeg ? "text-red-700" : block.type === "add" ? "text-green-700" : ""}`}>
                      {isBase || isTotal ? "" : fmtSigned(block.value)}
                    </td>
                    <td className={`py-0.5 text-right font-bold ${isTotal ? "text-base" : ""}`}>{fmt(block.runningTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ ITEMIZED DEDUCTIONS ═══ */}
      {deductionRows.length > 0 && (
        <div className="mb-3">
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Itemized Condition Deductions</h2>
          <table className="w-full text-[10px]">
            <tbody>
              {deductionRows.map((row, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="py-0.5">{row.label}</td>
                  <td className="py-0.5 text-right text-red-700 font-bold">-{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black font-black">
                <td className="py-0.5">Total Deductions</td>
                <td className="py-0.5 text-right text-red-700">-{fmt(totalItemizedDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TWO-COLUMN: MARKET DATA + INVENTORY ECONOMICS ═══ */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* LEFT: Market Scarcity & Pricing */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Market Supply & Scarcity</h2>
          {retailMarketData ? (
            <div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-2">
                {retailMarketData.activeCount != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Currently Listed</span>
                    <span className="font-bold text-sm">{retailMarketData.activeCount}</span>
                  </div>
                )}
                {retailMarketData.soldCount != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recently Sold</span>
                    <span className="font-bold text-sm">{retailMarketData.soldCount}</span>
                  </div>
                )}
                {retailMarketData.marketDaysSupply != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Days Supply</span>
                    <span className={`font-bold text-sm ${scarcityColor}`}>{Math.round(retailMarketData.marketDaysSupply)}d</span>
                  </div>
                )}
                {retailMarketData.meanDaysToTurn != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Days to Sell</span>
                    <span className="font-bold text-sm">{Math.round(retailMarketData.meanDaysToTurn)}d</span>
                  </div>
                )}
              </div>
              {scarcityLevel && (
                <div className={`text-[9px] font-bold uppercase tracking-wider ${scarcityColor} bg-gray-100 rounded px-2 py-0.5 inline-block mb-1`}>
                  Supply: {scarcityLevel} {scarcityLevel === "LOW" ? "— Vehicle is scarce in market" : scarcityLevel === "MODERATE" ? "— Normal availability" : "— Abundant supply"}
                </div>
              )}
              {(retailMarketData.activeMean || retailMarketData.soldMean) && (
                <div className="text-[10px] mt-1 space-y-0.5">
                  {retailMarketData.activeMean != null && retailMarketData.activeMean > 0 && (
                    <div>
                      <span className="text-gray-500">Active Asking:</span>{" "}
                      Mean <strong>{fmt(retailMarketData.activeMean)}</strong>
                      {retailMarketData.activeMedian != null && <> · Median <strong>{fmt(retailMarketData.activeMedian)}</strong></>}
                    </div>
                  )}
                  {retailMarketData.soldMean != null && retailMarketData.soldMean > 0 && (
                    <div>
                      <span className="text-gray-500">Sold Prices:</span>{" "}
                      Mean <strong>{fmt(retailMarketData.soldMean)}</strong>
                      {retailMarketData.soldMedian != null && <> · Median <strong>{fmt(retailMarketData.soldMedian)}</strong></>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 italic">No live market data available — pull retail listings in the appraisal tool.</p>
          )}
        </div>

        {/* RIGHT: Inventory Economics */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Inventory Economics</h2>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-gray-500">ACV (Purchase Price)</span><span className="font-bold">{fmt(finalValue)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">+ Estimated Recon</span><span className="font-bold">{fmt(reconCost)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">+ Dealer Pack</span><span className="font-bold">{fmt(dealerPack)}</span></div>
            <div className="flex justify-between border-t border-gray-300 pt-0.5 font-black"><span>Total Inventory Cost</span><span>{fmt(inventoryCost)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500">Retail Benchmark</span><span className="font-bold">{fmt(retailAvg)}</span></div>
            <div className={`flex justify-between font-bold ${projectedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              <span>Projected Gross</span><span>{fmtSigned(projectedProfit)}</span>
            </div>
            <div className={`flex justify-between font-bold ${profitMargin >= 0 ? "text-green-700" : "text-red-700"}`}>
              <span>Margin</span><span>{profitMargin.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BLACK BOOK VALUES TABLE ═══ */}
      <div className="mb-3">
        <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Black Book Market Values</h2>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 uppercase tracking-wider text-[8px]">
              <th className="text-left py-0.5">Category</th>
              <th className="text-right py-0.5">X-Clean</th>
              <th className="text-right py-0.5">Clean</th>
              <th className="text-right py-0.5">Average</th>
              <th className="text-right py-0.5">Rough</th>
            </tr>
          </thead>
          <tbody>
            {bbVehicle?.retail && (
              <tr className="border-t border-gray-200">
                <td className="py-0.5 font-semibold">Retail</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.retail.xclean || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.retail.clean || 0))}</td>
                <td className="py-0.5 text-right font-bold">{fmt(Number(bbVehicle.retail.avg || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.retail.rough || 0))}</td>
              </tr>
            )}
            {bbVehicle?.private_party && privatePartyAvg > 0 && (
              <tr className="border-t border-gray-200">
                <td className="py-0.5 font-semibold">Private Party</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.private_party.xclean || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.private_party.clean || 0))}</td>
                <td className="py-0.5 text-right font-bold">{fmt(Number(bbVehicle.private_party.avg || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.private_party.rough || 0))}</td>
              </tr>
            )}
            {bbVehicle?.tradein && (
              <tr className="border-t border-gray-200">
                <td className="py-0.5 font-semibold">Trade-In</td>
                <td className="py-0.5 text-right">—</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.tradein.clean || 0))}</td>
                <td className="py-0.5 text-right font-bold">{fmt(Number(bbVehicle.tradein.avg || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.tradein.rough || 0))}</td>
              </tr>
            )}
            {bbVehicle?.wholesale && (
              <tr className="border-t border-gray-200">
                <td className="py-0.5 font-semibold">Wholesale</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.wholesale.xclean || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.wholesale.clean || 0))}</td>
                <td className="py-0.5 text-right font-bold">{fmt(Number(bbVehicle.wholesale.avg || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.wholesale.rough || 0))}</td>
              </tr>
            )}
            {bbVehicle?.finance_advance && financeAdvAvg > 0 && (
              <tr className="border-t border-gray-200">
                <td className="py-0.5 font-semibold">Finance Advance</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.finance_advance.xclean || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.finance_advance.clean || 0))}</td>
                <td className="py-0.5 text-right font-bold">{fmt(Number(bbVehicle.finance_advance.avg || 0))}</td>
                <td className="py-0.5 text-right">{fmt(Number(bbVehicle.finance_advance.rough || 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
        {msrp > 0 && <div className="text-[10px] mt-0.5 text-gray-500">Original MSRP: <span className="font-bold text-black">{fmt(msrp)}</span></div>}
      </div>

      {/* ═══ TWO-COLUMN: BENCHMARKS + CONDITION ═══ */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* Benchmark Comparison */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Benchmark Comparison</h2>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-gray-500">ACV</span><span className="font-bold">{fmt(finalValue)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Retail Avg</span><span className="font-bold">{fmt(retailAvg)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Trade-In Avg</span><span className="font-bold">{fmt(tradeinAvg)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Wholesale Avg</span><span className="font-bold">{fmt(wholesaleAvg)}</span></div>
            {privatePartyAvg > 0 && <div className="flex justify-between"><span className="text-gray-500">Private Party Avg</span><span className="font-bold">{fmt(privatePartyAvg)}</span></div>}
            {financeAdvAvg > 0 && <div className="flex justify-between"><span className="text-gray-500">Finance Advance</span><span className="font-bold">{fmt(financeAdvAvg)}</span></div>}
            <div className="flex justify-between border-t border-gray-300 pt-0.5">
              <span className="text-gray-500">ACV vs Retail</span>
              <span className={`font-bold ${finalValue < retailAvg ? "text-green-700" : "text-red-700"}`}>
                {retailAvg > 0 ? `${((finalValue / retailAvg) * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
            {retailMarketData?.soldMean && retailMarketData.soldMean > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">ACV vs Sold Avg</span>
                <span className={`font-bold ${finalValue < retailMarketData.soldMean ? "text-green-700" : "text-red-700"}`}>
                  {((finalValue / retailMarketData.soldMean) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Condition Summary */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Vehicle Condition</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <div><span className="text-gray-500">Accidents:</span> <span className="font-bold">{sub.accidents || "None"}</span></div>
            <div><span className="text-gray-500">Drivable:</span> <span className="font-bold">{sub.drivable || "Yes"}</span></div>
            <div><span className="text-gray-500">Smoked In:</span> <span className="font-bold">{sub.smoked_in || "No"}</span></div>
            <div><span className="text-gray-500">Windshield:</span> <span className="font-bold">{sub.windshield_damage || "OK"}</span></div>
            <div><span className="text-gray-500">Keys:</span> <span className="font-bold">{sub.num_keys || "2+"}</span></div>
            <div><span className="text-gray-500">Tires:</span> <span className="font-bold">{sub.tires_replaced || "—"}</span></div>
            <div><span className="text-gray-500">Ext. Damage:</span> <span className="font-bold">{(sub.exterior_damage || []).filter(d => d !== "none").length || "None"}</span></div>
            <div><span className="text-gray-500">Int. Damage:</span> <span className="font-bold">{(sub.interior_damage || []).filter(d => d !== "none").length || "None"}</span></div>
            <div><span className="text-gray-500">Mechanical:</span> <span className="font-bold">{(sub.mechanical_issues || []).filter(d => d !== "none").length || "None"}</span></div>
            {sub.inspector_grade && <div><span className="text-gray-500">Grade:</span> <span className="font-bold">{sub.inspector_grade}</span></div>}
          </div>
          {/* Tire/Brake measurements */}
          {(hasTires || hasBrakes) && (
            <div className="mt-1 pt-1 border-t border-gray-200">
              {avgTireDepth && <div className="text-[10px]"><span className="text-gray-500">Avg Tire Depth:</span> <span className="font-bold">{avgTireDepth}/32"</span>
                <span className="text-[9px] text-gray-400 ml-1">(LF:{sub.tire_lf} RF:{sub.tire_rf} LR:{sub.tire_lr} RR:{sub.tire_rr})</span>
              </div>}
              {hasBrakes && <div className="text-[10px]"><span className="text-gray-500">Brake Pads:</span>
                <span className="text-[9px] text-gray-400 ml-1">(LF:{sub.brake_lf ?? "—"} RF:{sub.brake_rf ?? "—"} LR:{sub.brake_lr ?? "—"} RR:{sub.brake_rr ?? "—"})mm</span>
              </div>}
            </div>
          )}
        </div>
      </div>

      {/* ═══ RESIDUAL VALUES ═══ */}
      {bbVehicle && ((bbVehicle.residual_12 || 0) > 0 || (bbVehicle.residual_24 || 0) > 0 || (bbVehicle.residual_36 || 0) > 0) && (
        <div className="mb-3">
          <h2 className="text-[10px] font-black uppercase tracking-wider border-b border-gray-400 pb-0.5 mb-1">Projected Residual Values</h2>
          <div className="grid grid-cols-4 gap-3 text-[10px]">
            {(bbVehicle.residual_12 || 0) > 0 && <div><span className="text-gray-500 block text-[9px]">12-Month</span><span className="font-bold">{fmt(Number(bbVehicle.residual_12))}</span></div>}
            {(bbVehicle.residual_24 || 0) > 0 && <div><span className="text-gray-500 block text-[9px]">24-Month</span><span className="font-bold">{fmt(Number(bbVehicle.residual_24))}</span></div>}
            {(bbVehicle.residual_36 || 0) > 0 && <div><span className="text-gray-500 block text-[9px]">36-Month</span><span className="font-bold">{fmt(Number(bbVehicle.residual_36))}</span></div>}
            {(bbVehicle.residual_48 || 0) > 0 && <div><span className="text-gray-500 block text-[9px]">48-Month</span><span className="font-bold">{fmt(Number(bbVehicle.residual_48))}</span></div>}
          </div>
        </div>
      )}

      {/* ═══ RECALL ALERTS ═══ */}
      {bbVehicle && (bbVehicle.recall_count || 0) > 0 && bbVehicle.recalls?.length && (
        <div className="mb-3 border border-red-300 rounded p-2">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-red-700 mb-0.5">⚠ Open Recalls ({bbVehicle.recall_count})</h2>
          {bbVehicle.recalls.map((r, i) => (
            <div key={i} className="text-[9px] text-gray-700 mb-0.5">
              <strong>{r.component}</strong>{r.campaign_number && ` (${r.campaign_number})`}
              {r.summary && ` — ${r.summary.substring(0, 120)}`}
            </div>
          ))}
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="border-t-2 border-black pt-2 mt-4 flex items-end justify-between text-[9px] text-gray-400">
        <div>
          <p className="font-bold text-black text-[9px] uppercase">CONFIDENTIAL — INTERNAL USE ONLY</p>
          <p className="text-[8px]">Values based on Black Book data, dealer offer logic, and live market analysis. Not for customer distribution.</p>
        </div>
        <div className="text-right">
          <div className="border-t border-gray-400 pt-1 w-44 mt-3">
            <span className="text-[9px]">Manager Signature / Date</span>
          </div>
        </div>
      </div>
    </div>
  );
});

ACVSheet.displayName = "ACVSheet";

export default ACVSheet;
